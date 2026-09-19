"use client";

import type { User } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Wordmark } from "./Wordmark";
import styles from "./AuthDialog.module.css";

export type AuthMode = "sign-in" | "create-account";

type BusyAction = "email" | "discord" | null;

export type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  /** A same-origin path to restore after OAuth or email confirmation. */
  returnTo?: string;
  onSignedIn?: (user: User) => void;
};

export function AuthDialog({
  open,
  onClose,
  initialMode = "sign-in",
  returnTo,
  onSignedIn,
}: AuthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const lastNotifiedUserRef = useRef<string | null>(null);
  const titleId = useId();
  const errorId = useId();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const notifySignedIn = useCallback(
    (user: User) => {
      if (lastNotifiedUserRef.current !== user.id) {
        lastNotifiedUserRef.current = user.id;
        onSignedIn?.(user);
      }
    },
    [onSignedIn],
  );

  const finishSignIn = useCallback(
    (user: User) => {
      setPassword("");
      notifySignedIn(user);
      onClose();
    },
    [notifySignedIn, onClose],
  );

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) finishSignIn(session.user);
      if (event === "INITIAL_SESSION" && session?.user) notifySignedIn(session.user);
    });

    return () => data.subscription.unsubscribe();
  }, [finishSignIn, notifySignedIn]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setMode(initialMode);
      setBusyAction(null);
      setError("");
      setNotice("");
      setPassword("");
      setShowPassword(false);
      dialog.showModal();
    } else if (!open && dialog.open) {
      setPassword("");
      dialog.close();
    }
  }, [initialMode, open]);

  function changeMode(nextMode: AuthMode) {
    if (busyAction) return;
    setMode(nextMode);
    setPassword("");
    setError("");
    setNotice("");
  }

  async function continueWithDiscord() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Sign-in service is connecting. Please try again in a moment.");
      return;
    }

    setBusyAction("discord");
    setError("");
    setNotice("");

    try {
      const { error: oauthError } = await client.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: authRedirectUrl(returnTo),
        },
      });
      if (oauthError) throw oauthError;
    } catch (authErr) {
      setError(authErrorMessage(authErr, mode));
      setBusyAction(null);
    }
  }

  async function continueWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Sign-in service is connecting. Please try again in a moment.");
      return;
    }

    setBusyAction("email");
    setError("");
    setNotice("");

    try {
      if (mode === "create-account") {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirectUrl(returnTo) },
        });
        if (authError) throw authError;

        if (data.session && data.user) {
          finishSignIn(data.user);
        } else {
          const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInError) throw signInError;
          if (signedIn.user) finishSignIn(signedIn.user);
        }
      } else {
        const { data, error: authError } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        if (data.user) finishSignIn(data.user);
      }
    } catch (authError) {
      setError(authErrorMessage(authError, mode));
    } finally {
      setBusyAction(null);
    }
  }

  const isBusy = busyAction !== null;
  const isCreating = mode === "create-account";

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-busy={isBusy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <section className={styles.panel}>
        <header className={styles.header}>
          <Wordmark className={styles.wordmark} />
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close sign-in"
          >
            <CloseIcon />
          </button>
        </header>

        <div style={{ margin: "14px 0 16px" }}>
          <h2 style={{ fontSize: "19px", fontWeight: 800, margin: 0, color: "#fff", letterSpacing: "-0.02em" }} id={titleId}>
            {isCreating ? "Join Ani Ghost" : "Welcome back"}
          </h2>
          <p style={{ fontSize: "13px", color: "rgba(247, 245, 251, 0.6)", margin: "5px 0 0", lineHeight: 1.4 }}>
            Sign in to sync your saves, continue watching, and join discussions.
          </p>
        </div>

        {/* ── #1 Primary Option: Discord Instant 1-Click Sign In ── */}
        <button
          type="button"
          className={styles.discordButton}
          onClick={continueWithDiscord}
          disabled={isBusy}
          style={{
            display: "flex",
            width: "100%",
            minHeight: "48px",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "12px 20px",
            fontFamily: "var(--font-ui, system-ui, -apple-system, sans-serif)",
            fontSize: "14.5px",
            fontWeight: 700,
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            background: "#5865F2",
            color: "#ffffff",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(88, 101, 242, 0.42)",
            boxSizing: "border-box",
          }}
        >
          {busyAction === "discord" ? (
            <>
              <Spinner />
              <span>Connecting to Discord…</span>
            </>
          ) : (
            <>
              <svg
                className={styles.discordIcon}
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
                style={{ flexShrink: 0, display: "block" }}
              >
                <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.198.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.0777.0777 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
              <span>Continue with Discord</span>
            </>
          )}
        </button>

        <div className={styles.divider}>
          <span />
          <small>or with email and password</small>
          <span />
        </div>

        {/* ── #2 Secondary Option: Email / Password ── */}
        <div className={styles.modeTabs} role="group" aria-label="Choose an account action">
          <button
            type="button"
            aria-pressed={!isCreating}
            className={!isCreating ? styles.activeTab : undefined}
            onClick={() => changeMode("sign-in")}
            disabled={isBusy}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={isCreating}
            className={isCreating ? styles.activeTab : undefined}
            onClick={() => changeMode("create-account")}
            disabled={isBusy}
          >
            Create account
          </button>
        </div>

        <form className={styles.form} onSubmit={continueWithEmail}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              ref={emailInputRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              disabled={isBusy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <span className={styles.passwordField}>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={isCreating ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isCreating ? "At least 6 characters" : "Your password"}
                minLength={isCreating ? 6 : undefined}
                required
                disabled={isBusy}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
              <button
                type="button"
                className={styles.revealButton}
                onClick={() => setShowPassword((shown) => !shown)}
                disabled={isBusy}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
          </label>

          {error ? (
            <p className={styles.errorMessage} id={errorId} role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className={styles.noticeMessage} role="status" aria-live="polite">
              {notice}
            </p>
          ) : null}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isBusy}
          >
            {busyAction === "email" ? <Spinner /> : null}
            {isCreating ? "Create account with email" : "Sign in with email"}
          </button>
        </form>

        <p className={styles.switchPrompt}>
          {isCreating ? "Already have an account?" : "New to Ani Ghost?"}{" "}
          <button
            type="button"
            onClick={() => changeMode(isCreating ? "sign-in" : "create-account")}
            disabled={isBusy}
          >
            {isCreating ? "Sign in" : "Create one"}
          </button>
        </p>
      </section>
    </dialog>
  );
}

function authRedirectUrl(returnTo: string | undefined): string {
  if (typeof window === "undefined") return "/auth/callback";
  const target = returnTo?.startsWith("/") ? returnTo : `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
}

function authErrorMessage(error: unknown, mode: AuthMode): string {
  const candidate = error as { code?: string; message?: string } | null;
  const code = candidate?.code?.toLowerCase() ?? "";
  const message = candidate?.message?.toLowerCase() ?? "";

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "That email and password combination did not work.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (code === "weak_password" || message.includes("password should be")) {
    return "Choose a stronger password with at least 8 characters.";
  }
  if (code.includes("rate_limit") || message.includes("rate limit")) {
    return "Too many attempts. Wait a moment, then try again.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "We could not reach sign-in. Check your connection and try again.";
  }

  return mode === "create-account"
    ? "We could not create the account. Check the details and try again."
    : "We could not sign you in. Check the details and try again.";
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden />;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.7 12s3.4-5.2 9.3-5.2 9.3 5.2 9.3 5.2-3.4 5.2-9.3 5.2S2.7 12 2.7 12Z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m4 4 16 16M10.5 7c.5-.1 1-.2 1.5-.2 5.9 0 9.3 5.2 9.3 5.2a17 17 0 0 1-2.2 2.7M6.2 6.5A16 16 0 0 0 2.7 12s3.4 5.2 9.3 5.2c1.4 0 2.6-.3 3.7-.7M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
