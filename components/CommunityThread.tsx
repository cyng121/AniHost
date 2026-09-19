"use client";

import type { User } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, CHARACTERS } from "./Avatar";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase/browser";
import { readPrefs } from "@/lib/prefs";
import styles from "./CommunityThread.module.css";

type CommentRow = {
  id: number;
  user_id: string;
  body: string;
  rating: number;
  display_name: string;
  avatar_index: number;
  created_at: string;
  updated_at: string;
};

type LoadState = "loading" | "ready" | "unconfigured" | "error";
type CommentSummary = { total: number; average: number };

const PAGE_SIZE = 40;

const RATING = [
  { value: 1, emoji: "😭", label: "Bad" },
  { value: 2, emoji: "😕", label: "Weak" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Best" },
] as const;

const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const FULL_DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function CommunityThread({
  slug,
  title,
  episode,
}: {
  slug: string;
  title: string;
  episode?: number;
}) {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const configured = isSupabaseBrowserConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [summary, setSummary] = useState<CommentSummary>({ total: 0, average: 0 });
  const [commentLimit, setCommentLimit] = useState(PAGE_SIZE);
  const [loadState, setLoadState] = useState<LoadState>(configured ? "loading" : "unconfigured");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const seededReviewId = useRef<number | null>(null);
  const userId = user?.id ?? null;

  const loadComments = useCallback(async () => {
    if (!client) return;

    let recentQuery = client
      .from("anime_comments")
      .select("id,user_id,body,rating,display_name,avatar_index,created_at,updated_at")
      .eq("anime_slug", slug)
      .order("created_at", { ascending: false })
      .limit(commentLimit);

    recentQuery = episode === undefined
      ? recentQuery.is("episode", null)
      : recentQuery.eq("episode", episode);

    let ownQuery = userId
      ? client
          .from("anime_comments")
          .select("id,user_id,body,rating,display_name,avatar_index,created_at,updated_at")
          .eq("anime_slug", slug)
          .eq("user_id", userId)
      : null;
    if (ownQuery) {
      ownQuery = episode === undefined
        ? ownQuery.is("episode", null)
        : ownQuery.eq("episode", episode);
    }

    let summaryQuery = client
      .from("anime_comment_summary")
      .select("total_count,average_rating")
      .eq("anime_slug", slug);
    summaryQuery = episode === undefined
      ? summaryQuery.is("episode", null)
      : summaryQuery.eq("episode", episode);

    const [recentResult, ownResult, summaryResult] = await Promise.all([
      recentQuery,
      ownQuery ? ownQuery.maybeSingle() : Promise.resolve({ data: null, error: null }),
      summaryQuery.maybeSingle(),
    ]);

    if (recentResult.error || ownResult.error || summaryResult.error) {
      setLoadState("error");
      return;
    }

    const recent = (recentResult.data ?? []) as CommentRow[];
    const own = ownResult.data as CommentRow | null;
    const stats = summaryResult.data as { total_count?: number | string; average_rating?: number | string } | null;
    setComments(own && !recent.some((comment) => comment.id === own.id) ? [own, ...recent] : recent);
    setSummary({
      total: Math.max(0, Number(stats?.total_count) || 0),
      average: Math.max(0, Math.min(5, Number(stats?.average_rating) || 0)),
    });
    setLoadState("ready");
  }, [client, commentLimit, episode, slug, userId]);

  useEffect(() => {
    if (!client) return;
    let active = true;

    client.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!client) return;

    void loadComments();
    const channel = client
      .channel(`comments:${slug}:${episode ?? "title"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "anime_comments",
          filter: `anime_slug=eq.${slug}`,
        },
        () => void loadComments(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client, episode, loadComments, slug]);

  const ownComment = userId ? comments.find((comment) => comment.user_id === userId) : undefined;
  useEffect(() => {
    if (!ownComment) {
      seededReviewId.current = null;
      return;
    }
    if (seededReviewId.current !== ownComment.id) {
      seededReviewId.current = ownComment.id;
      setBody(ownComment.body);
      setRating(ownComment.rating);
    }
  }, [ownComment]);

  const { total: totalReviews, average } = summary;

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    if (!user) {
      requestSignIn();
      return;
    }

    const cleanBody = body.trim();
    if (!rating) {
      setFormError("Choose a rating from 1 to 5 first.");
      return;
    }
    if (!cleanBody) {
      setFormError("Write a short comment before posting.");
      return;
    }

    setSaving(true);
    setFormError("");
    const avatarIndex = normaliseAvatar(readPrefs().character);
    const displayName = userDisplayName(user);
    const payload = {
      body: cleanBody,
      rating,
      display_name: displayName,
      avatar_index: avatarIndex,
    };

    const result = ownComment
      ? await client
          .from("anime_comments")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", ownComment.id)
      : await client.from("anime_comments").insert({
          ...payload,
          user_id: user.id,
          anime_slug: slug,
          episode: episode ?? null,
        });

    setSaving(false);
    if (result.error) {
      setFormError(friendlyDatabaseError(result.error.message));
      return;
    }
    await loadComments();
  }

  async function deleteOwnReview() {
    if (!client || !ownComment || !window.confirm("Delete your review?")) return;
    setSaving(true);
    const { error } = await client.from("anime_comments").delete().eq("id", ownComment.id);
    setSaving(false);
    if (error) {
      setFormError("Your review could not be deleted. Please try again.");
      return;
    }
    setBody("");
    setRating(0);
    await loadComments();
  }

  return (
    <section className={styles.thread} aria-labelledby="community-title">
      <header className={styles.heading}>
        <div>
          <h2 id="community-title">{episode === undefined ? `${title} reviews` : `Episode ${episode} discussion`}</h2>
        </div>
        <div className={styles.summary} aria-label={totalReviews ? `${average.toFixed(1)} out of 5 from ${totalReviews} reviews` : "No ratings yet"}>
          <span aria-hidden>{totalReviews ? RATING[Math.max(0, Math.round(average) - 1)].emoji : "—"}</span>
          <b className="tnum">{totalReviews ? average.toFixed(1) : "New"}</b>
          <small>{totalReviews ? `${totalReviews} review${totalReviews === 1 ? "" : "s"}` : "Start the conversation"}</small>
        </div>
      </header>

      <form className={styles.composer} onSubmit={submitReview}>
        <div className={styles.composerTop}>
          {user ? <Avatar index={normaliseAvatar(readPrefs().character)} size="lg" /> : <span className={styles.guestMark} aria-hidden>?</span>}
          <div>
            <b>{user ? userDisplayName(user) : "Join the discussion"}</b>
            <span>{ownComment ? "Update your review" : "Rate what you just watched"}</span>
          </div>
        </div>

        <div className={styles.rating} role="radiogroup" aria-label="Rating from bad to best">
          {RATING.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={rating === item.value}
              aria-label={`${item.value} out of 5, ${item.label}`}
              className={rating === item.value ? styles.selectedRating : undefined}
              onClick={() => {
                setRating(item.value);
                setFormError("");
              }}
              disabled={!user || saving || loadState === "unconfigured"}
            >
              <span aria-hidden>{item.emoji}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </div>

        {user ? (
          <>
            <label className={styles.commentField}>
              <span className={styles.srOnly}>Your comment</span>
              <textarea
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  setFormError("");
                }}
                maxLength={1200}
                rows={3}
                placeholder="What worked, what did not, and would you recommend it?"
                disabled={saving || loadState === "unconfigured"}
              />
              <span className={`${styles.count} tnum`}>{body.length}/1200</span>
            </label>
            <div className={styles.formActions}>
              {ownComment ? (
                <button className={styles.deleteButton} type="button" onClick={deleteOwnReview} disabled={saving}>
                  Delete review
                </button>
              ) : null}
              <button className="btn btn--accent" type="submit" disabled={saving || loadState !== "ready"}>
                {saving ? "Saving…" : ownComment ? "Update review" : "Post review"}
              </button>
            </div>
          </>
        ) : (
          <button className="btn btn--accent" type="button" onClick={requestSignIn} disabled={loadState === "unconfigured"}>
            Sign in to comment
          </button>
        )}

        {loadState === "unconfigured" ? (
          <p className={styles.note} role="status">Community comments will open when the shared service is connected.</p>
        ) : null}
        {formError ? <p className={styles.error} role="alert">{formError}</p> : null}
      </form>

      <div className={styles.comments} aria-live="polite">
        {loadState === "loading" ? <p className={styles.note}>Loading the discussion…</p> : null}
        {loadState === "error" ? (
          <div className={styles.retry} role="alert">
            <p>The discussion could not load.</p>
            <button className="btn btn--ghost" type="button" onClick={() => void loadComments()}>Try again</button>
          </div>
        ) : null}
        {loadState === "ready" && !comments.length ? (
          <p className={styles.empty}>No reviews yet. Be the first person to leave an honest take.</p>
        ) : null}
        {comments.map((comment) => (
          <article className={styles.comment} key={comment.id}>
            <Avatar index={normaliseAvatar(comment.avatar_index)} size="lg" />
            <div className={styles.commentBody}>
              <header>
                <b>{comment.display_name}</b>
                <span className={styles.stars} aria-label={`${comment.rating} out of 5, ${RATING[comment.rating - 1]?.label ?? "rated"}`}>
                  <span aria-hidden>{RATING[comment.rating - 1]?.emoji ?? "⭐"} {"★".repeat(comment.rating)}{"☆".repeat(5 - comment.rating)}</span>
                </span>
                <time dateTime={comment.created_at}>{relativeDate(comment.created_at)}</time>
              </header>
              <p>{comment.body}</p>
            </div>
          </article>
        ))}
        {loadState === "ready" && comments.length < totalReviews ? (
          <div className={styles.loadMore}>
            <span className="tnum">Showing {comments.length} of {totalReviews}</span>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => {
                setLoadState("loading");
                setCommentLimit((current) => current + PAGE_SIZE);
              }}
            >
              Load older comments
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function requestSignIn() {
  window.dispatchEvent(new CustomEvent("anighost:open-auth"));
}

function normaliseAvatar(value: number): number {
  return ((value % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
}

function userDisplayName(user: User): string {
  const custom = readPrefs().username?.trim();
  if (custom) return custom.slice(0, 80);
  const candidate = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 80);
  return (user.email?.split("@")[0] || "Anime fan").slice(0, 80);
}

function friendlyDatabaseError(message: string): string {
  if (/duplicate|unique/i.test(message)) return "You already reviewed this episode. Refresh and update that review instead.";
  if (/row-level security|permission/i.test(message)) return "Your session expired. Sign in again, then retry.";
  return "Your review could not be saved. Please try again.";
}

function relativeDate(value: string): string {
  const elapsed = new Date(value).getTime() - Date.now();
  const minutes = Math.round(elapsed / 60000);
  if (Math.abs(minutes) < 60) return RELATIVE_TIME.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE_TIME.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return RELATIVE_TIME.format(days, "day");
  return FULL_DATE.format(new Date(value));
}
