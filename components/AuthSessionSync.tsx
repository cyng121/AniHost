"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthSessionSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    // Handle OAuth hash cleanup (#access_token=...)
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      client.auth.getSession().then(({ data }) => {
        if (data.session) {
          // Clean the access token hash from URL
          const cleanUrl = window.location.pathname + (window.location.search || "");
          window.history.replaceState(null, "", cleanUrl || "/browse");

          if (pathname === "/") {
            router.push("/browse");
          } else {
            router.refresh();
          }
        }
      });
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
          const cleanUrl = window.location.pathname + (window.location.search || "");
          window.history.replaceState(null, "", cleanUrl || "/browse");
        }
        if (pathname === "/") {
          router.push("/browse");
        }
      }
    });

    return () => data.subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
