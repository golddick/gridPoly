// "use client";

// import { useCallback, useEffect, useState } from "react";
// import { createSupabaseBrowserClient } from "./supabase/client";

// const ADJECTIVES = ["Sharp", "Bold", "Quiet", "Lucky", "Swift", "Prime", "Steady", "Sly"];
// const NOUNS = ["Investor", "Broker", "Trader", "Baron", "Analyst", "Mogul", "Banker", "Founder"];

// function randomUsername(): string {
//   const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
//   const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
//   return `${a}${n}${Math.floor(Math.random() * 100)}`;
// }

// export interface GrideAuth {
//   loading: boolean;
//   userId: string | null;
//   username: string;
//   email: string | null;
//   isAnonymous: boolean;
//   upgradeEmail: (email: string) => Promise<{ error: string | null }>;
// }

// /**
//  * Signs the visitor in anonymously on first load (via Supabase Auth) so every
//  * feature — trading, chat, the leaderboard — has a stable, durable user id
//  * without forcing signup. `upgradeEmail` lets them attach a real email later
//  * so their leaderboard entry survives across devices/browsers.
//  */
// export function useGrideAuth(): GrideAuth {
//   const [loading, setLoading] = useState(true);
//   const [userId, setUserId] = useState<string | null>(null);
//   const [username, setUsername] = useState("");
//   const [email, setEmail] = useState<string | null>(null);
//   const [isAnonymous, setIsAnonymous] = useState(true);

//   useEffect(() => {
//     let cancelled = false;
//     const supabase = createSupabaseBrowserClient();

//     async function init() {
//       const { data: sessionData } = await supabase.auth.getSession();
//       let user = sessionData.session?.user ?? null;

//       if (!user) {
//         const { data, error } = await supabase.auth.signInAnonymously();
//         if (error) {
//           console.error("Anonymous sign-in failed", error);
//           setLoading(false);
//           return;
//         }
//         user = data.user;
//       }

//       if (!user) {
//         setLoading(false);
//         return;
//       }

//       let name = (user.user_metadata?.username as string | undefined) ?? "";
//       if (!name) {
//         name = randomUsername();
//         await supabase.auth.updateUser({ data: { username: name } });
//       }

//       if (!cancelled) {
//         setUserId(user.id);
//         setUsername(name);
//         setEmail(user.email ?? null);
//         setIsAnonymous(user.is_anonymous ?? true);
//         setLoading(false);
//       }
//     }

//     init();

//     const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
//       if (!session?.user || cancelled) return;
//       setUserId(session.user.id);
//       setUsername((session.user.user_metadata?.username as string) ?? username);
//       setEmail(session.user.email ?? null);
//       setIsAnonymous(session.user.is_anonymous ?? true);
//     });

//     return () => {
//       cancelled = true;
//       sub.subscription.unsubscribe();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const upgradeEmail = useCallback(async (newEmail: string) => {
//     const supabase = createSupabaseBrowserClient();
//     const { error } = await supabase.auth.updateUser({ email: newEmail });
//     return { error: error?.message ?? null };
//   }, []);

//   return { loading, userId, username, email, isAnonymous, upgradeEmail };
// }







"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase/client";

const ADJECTIVES = ["Sharp", "Bold", "Quiet", "Lucky", "Swift", "Prime", "Steady", "Sly"];
const NOUNS = ["Investor", "Broker", "Trader", "Baron", "Analyst", "Mogul", "Banker", "Founder"];

function randomUsername(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 100)}`;
}

export interface GrideAuth {
  loading: boolean;
  userId: string | null;
  username: string;
  email: string | null;
  isAnonymous: boolean;
  /** Set if sign-in (automatic or manual) failed. Always resolves `loading` to false alongside this — never hangs silently. */
  error: string | null;
  /** Manually (re)try anonymous sign-in — the fallback if it didn't happen automatically, or failed. */
  continueAsGuest: () => Promise<void>;
  /** Creates a real account. If currently anonymous, links the anonymous session to the new email/password in place (same userId, no data loss) — otherwise signs up fresh. */
  signUp: (email: string, password: string, username?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

/**
 * Anonymous-by-default auth. `continueAsGuest` always resolves `loading` to
 * false in its own `finally` block, independent of any outer cancellation —
 * so a stale/cancelled effect run (React Strict Mode's mount→cleanup→mount
 * double-invoke in dev) can never leave the UI stuck waiting on a promise
 * that was silently abandoned.
 */
export function useGridAuth(): GrideAuth {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyUser = useCallback((user: User) => {
    setUserId(user.id);
    setUsername((user.user_metadata?.username as string) ?? "");
    setEmail(user.email ?? null);
    setIsAnonymous(user.is_anonymous ?? true);
  }, []);

  const continueAsGuest = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user ?? null;

      if (!user) {
        const { data, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;
        user = data.user;
      }
      if (!user) throw new Error("Sign-in did not return a user.");

      let name = (user.user_metadata?.username as string | undefined) ?? "";
      if (!name) {
        name = randomUsername();
        const { error: updateError } = await supabase.auth.updateUser({ data: { username: name } });
        if (updateError) throw updateError;
      }

      setUserId(user.id);
      setUsername(name);
      setEmail(user.email ?? null);
      setIsAnonymous(user.is_anonymous ?? true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't sign in as a guest.";
      setError(message);
      console.error("Anonymous sign-in failed", err);
    } finally {
      // Always runs, regardless of whether this call originated from a since-cancelled effect.
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Scoped fresh to *this* effect invocation — unlike a ref, this can't be
    // poisoned by Strict Mode's synchronous mount→cleanup→mount in dev,
    // which flips `active` to false on the first (throwaway) invocation
    // before its awaits resolve, letting only the second, real invocation
    // proceed to call continueAsGuest.
    let active = true;
    const supabase = createSupabaseBrowserClient();

    const timeout = setTimeout(() => {
      if (!active) return;
      setError("Taking too long to reach Supabase — check NEXT_PUBLIC_SUPABASE_URL/ANON_KEY and your connection.");
      setLoading(false);
    }, 10000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          if (active) {
            clearTimeout(timeout);
            applyUser(data.session.user);
            setLoading(false);
          }
          return;
        }
      } catch (err) {
        console.error("Failed to read existing session", err);
      }
      if (active) {
        await continueAsGuest();
        clearTimeout(timeout);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      applyUser(session.user);
      setError(null);
    });

    return () => {
      active = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = useCallback(
    async (newEmail: string, password: string, newUsername?: string) => {
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const name = newUsername?.trim() || username || randomUsername();

      // Currently anonymous with a live session: link in place so the same
      // userId (and anything tied to it) carries over, rather than creating
      // a brand-new disconnected account.
      if (userId && isAnonymous) {
        const { data, error: updateError } = await supabase.auth.updateUser({
          email: newEmail,
          password,
          data: { username: name },
        });
        if (updateError) {
          setError(updateError.message);
          return { error: updateError.message };
        }
        if (data.user) applyUser(data.user);
        return { error: null };
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: newEmail,
        password,
        options: { data: { username: name } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return { error: signUpError.message };
      }
      if (data.user) applyUser(data.user);
      return { error: null };
    },
    [applyUser, isAnonymous, userId, username]
  );

  const signIn = useCallback(
    async (loginEmail: string, password: string) => {
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (signInError) {
        setError(signInError.message);
        return { error: signInError.message };
      }
      if (data.user) applyUser(data.user);
      return { error: null };
    },
    [applyUser]
  );

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUserId(null);
    setUsername("");
    setEmail(null);
    setIsAnonymous(true);
    setError(null);
  }, []);

  return { loading, userId, username, email, isAnonymous, error, continueAsGuest, signUp, signIn, signOut };
}