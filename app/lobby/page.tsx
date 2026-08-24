




// "use client";

// import { useState, type FormEvent } from "react";
// import { useRouter } from "next/navigation";
// import Link from "next/link";
// import HowToPlayButton from "@/components/HowToPlayButton";
// import { isValidRoomCode, normalizeRoomCode } from "@/lib/roomCode";
// import type { RoomSettings, WinCondition } from "@/lib/game/types";
// import { useGridAuth } from "@/lib/auth";

// const CAPITAL_PRESETS = [
//   { label: "Casual — $1,500", value: 1500 },
//   { label: "Standard — $3,000", value: 3000 },
//   { label: "High Stakes — $10,000", value: 10000 },
// ];

// type AuthTab = "signup" | "login";

// function AccountPanel({
//   auth,
// }: {
//   auth: ReturnType<typeof useGridAuth>;
// }) {
//   const { loading, userId, username, email, isAnonymous, error, continueAsGuest, signUp, signIn } = auth;
//   const [tab, setTab] = useState<AuthTab>("signup");
//   const [formEmail, setFormEmail] = useState("");
//   const [formPassword, setFormPassword] = useState("");
//   const [formUsername, setFormUsername] = useState("");
//   const [formError, setFormError] = useState<string | null>(null);
//   const [formBusy, setFormBusy] = useState(false);
//   const [expanded, setExpanded] = useState(false);

//   // Signed in with a real account already — nothing to do here.
//   if (userId && !isAnonymous) {
//     return (
//       <div className="mb-6 flex items-center justify-between rounded-card border border-primary-accent/30 bg-primary-accent/5 px-4 py-3 text-sm">
//         <span className="text-cream">
//           Signed in as <span className="text-primary-accent">{email ?? username}</span>
//         </span>
//       </div>
//     );
//   }

//   async function handleSubmit(e: FormEvent) {
//     e.preventDefault();
//     setFormError(null);
//     if (!formEmail || !formPassword) {
//       setFormError("Email and password are required.");
//       return;
//     }
//     setFormBusy(true);
//     const result =
//       tab === "signup" ? await signUp(formEmail, formPassword, formUsername) : await signIn(formEmail, formPassword);
//     setFormBusy(false);
//     if (result.error) setFormError(result.error);
//     else setExpanded(false);
//   }

//   // Still resolving the initial (anonymous) session — show a real fallback
//   // instead of a dead "Signing in…" button with no way forward.
//   if (loading) {
//     return (
//       <div className="mb-6 rounded-card border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-cream/60">
//         Signing in…
//         {error && (
//           <div className="mt-2">
//             <p className="text-danger">{error}</p>
//             <button
//               type="button"
//               onClick={() => continueAsGuest()}
//               className="mt-1 rounded-full border border-cream/25 px-3 py-1.5 text-xs text-cream hover:border-cream/50"
//             >
//               Retry
//             </button>
//           </div>
//         )}
//       </div>
//     );
//   }

//   // Loaded, but no session at all (guest sign-in failed and hasn't been retried yet).
//   if (!userId) {
//     return (
//       <div className="mb-6 rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
//         <p className="text-cream/80">{error ?? "You're not signed in."}</p>
//         <div className="mt-3 flex flex-wrap gap-2">
//           <button
//             type="button"
//             onClick={() => continueAsGuest()}
//             className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-base hover:bg-gold-highlight"
//           >
//             Continue as guest
//           </button>
//           <button
//             type="button"
//             onClick={() => setExpanded(true)}
//             className="rounded-full border border-cream/25 px-4 py-2 text-xs text-cream hover:border-cream/50"
//           >
//             Create an account instead
//           </button>
//         </div>
//       </div>
//     );
//   }

//   // Anonymous session active — offer to create a real account before hosting.
//   return (
//     <div className="mb-6 rounded-card border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
//       <div className="flex items-center justify-between">
//         <span className="text-cream/70">
//           Playing as <span className="text-cream">{username || "Guest"}</span> (not saved)
//         </span>
//         {!expanded && (
//           <button
//             type="button"
//             onClick={() => setExpanded(true)}
//             className="rounded-full border border-gold/40 px-3 py-1.5 text-xs text-gold-highlight hover:bg-gold/10"
//           >
//             Create account
//           </button>
//         )}
//       </div>

//       {expanded && (
//         <form onSubmit={handleSubmit} className="mt-3 space-y-3">
//           <div className="flex gap-2 text-xs">
//             <button
//               type="button"
//               onClick={() => setTab("signup")}
//               className={`rounded-full px-3 py-1 ${tab === "signup" ? "bg-gold/15 text-gold-highlight" : "text-cream/50"}`}
//             >
//               Sign up
//             </button>
//             <button
//               type="button"
//               onClick={() => setTab("login")}
//               className={`rounded-full px-3 py-1 ${tab === "login" ? "bg-gold/15 text-gold-highlight" : "text-cream/50"}`}
//             >
//               Log in
//             </button>
//             <button type="button" onClick={() => setExpanded(false)} className="ml-auto text-cream/40 hover:text-cream/70">
//               Cancel
//             </button>
//           </div>

//           {tab === "signup" && (
//             <input
//               value={formUsername}
//               onChange={(e) => setFormUsername(e.target.value)}
//               placeholder={username || "Display name (optional)"}
//               className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//             />
//           )}
//           <input
//             type="email"
//             value={formEmail}
//             onChange={(e) => setFormEmail(e.target.value)}
//             placeholder="Email"
//             required
//             className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//           />
//           <input
//             type="password"
//             value={formPassword}
//             onChange={(e) => setFormPassword(e.target.value)}
//             placeholder="Password"
//             required
//             minLength={6}
//             className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//           />

//           {formError && <p className="text-xs text-danger">{formError}</p>}

//           <button
//             type="submit"
//             disabled={formBusy}
//             className="w-full rounded-full bg-gold py-2 text-sm font-semibold text-base hover:bg-gold-highlight disabled:opacity-60"
//           >
//             {formBusy ? "Please wait…" : tab === "signup" ? "Create account" : "Log in"}
//           </button>
//         </form>
//       )}
//     </div>
//   );
// }

// /**
//  * For an invited player (or the host, on another device) who already has a
//  * room code — validates it against the server before navigating, so a typo
//  * shows an inline error instead of landing on a dead room page.
//  */
// function JoinRoomPanel({ userId }: { userId: string | null }) {
//   const router = useRouter();
//   const [code, setCode] = useState("");
//   const [joining, setJoining] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   async function handleJoin(e: FormEvent) {
//     e.preventDefault();
//     setError(null);

//     const normalized = normalizeRoomCode(code);
//     if (!isValidRoomCode(normalized)) {
//       setError("Enter the 6-character room code exactly as shared.");
//       return;
//     }

//     setJoining(true);
//     try {
//       const res = await fetch(`/api/rooms?roomId=${encodeURIComponent(normalized)}`);
//       if (!res.ok) {
//         const data = await res.json().catch(() => ({}));
//         throw new Error(data.error ?? "No room found with that code.");
//       }
//       router.push(`/room/${normalized}`);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Something went wrong");
//       setJoining(false);
//     }
//   }

//   return (
//     <div className="mb-6 rounded-card border border-white/10 bg-white/[0.02] p-6 sm:p-8">
//       <h2 className="font-display text-xl text-cream">Have a room code?</h2>
//       <p className="mt-1 text-sm text-cream/60">Enter the 6-character code the host shared with you.</p>

//       <form onSubmit={handleJoin} className="mt-4 flex gap-2">
//         <input
//           value={code}
//           onChange={(e) => setCode(e.target.value)}
//           placeholder="e.g. K7XQ2M"
//           maxLength={8}
//           autoCapitalize="characters"
//           className="flex-1 rounded-lg border border-white/10 bg-base px-3 py-2 text-center font-mono text-lg uppercase tracking-[0.2em] text-cream placeholder:tracking-normal placeholder:text-cream/30"
//         />
//         <button
//           type="submit"
//           disabled={joining || !userId}
//           className="shrink-0 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-base hover:bg-gold-highlight disabled:opacity-60"
//         >
//           {joining ? "Joining…" : "Join"}
//         </button>
//       </form>
//       {error && <p className="mt-2 text-sm text-danger">{error}</p>}
//       {!userId && <p className="mt-2 text-xs text-cream/40">Sign in above first.</p>}
//     </div>
//   );
// }

// export default function LobbyPage() {
//   const router = useRouter();
//   const auth = useGridAuth();
//   const { userId } = auth;
//   const [startingCapital, setStartingCapital] = useState(3000);
//   const [winCondition, setWinCondition] = useState<WinCondition>("timed");
//   const [durationMinutes, setDurationMinutes] = useState(30);
//   const [turnTimerSeconds, setTurnTimerSeconds] = useState(45);
//   const [maxPlayers, setMaxPlayers] = useState(6);
//   const [boardSize, setBoardSize] = useState(10);
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   async function handleSubmit(e: FormEvent) {
//     e.preventDefault();
//     if (!userId) return;
//     setSubmitting(true);
//     setError(null);

//     const settings: Partial<RoomSettings> = {
//       startingCapital,
//       winCondition,
//       durationMinutes: winCondition === "timed" ? durationMinutes : undefined,
//       turnTimerSeconds,
//       maxPlayers,
//       boardSize,
//     };

//     try {
//       const res = await fetch("/api/rooms", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ settings }),
//       });
//       if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create room");
//       const data = await res.json();
//       router.push(`/room/${data.roomId}`);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Something went wrong");
//       setSubmitting(false);
//     }
//   }

//   return (
//     <main className="min-h-screen bg-base px-4 py-8 sm:px-6 sm:py-10">
//       <div className="mx-auto flex max-w-xl items-center justify-between">
//         <Link href="/" className="font-display text-lg text-cream">
//           GRIDE
//         </Link>
//         <HowToPlayButton />
//       </div>

//       <div className="mx-auto mt-8 max-w-xl sm:mt-10">
//         <AccountPanel auth={auth} />
//         <JoinRoomPanel userId={userId} />

//         <div className="rounded-card border border-white/10 bg-white/[0.02] p-6 sm:p-8">
//           <h1 className="font-display text-2xl text-cream">Create a room</h1>
//           <p className="mt-1 text-sm text-cream/60">
//             Set the table. Everyone who joins starts with the same balance.
//           </p>

//           <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
//             <div>
//               <label className="block text-xs uppercase tracking-wide text-cream/50">Starting capital</label>
//               <select
//                 value={startingCapital}
//                 onChange={(e) => setStartingCapital(Number(e.target.value))}
//                 className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//               >
//                 {CAPITAL_PRESETS.map((p) => (
//                   <option key={p.value} value={p.value}>
//                     {p.label}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div>
//               <label className="block text-xs uppercase tracking-wide text-cream/50">Win condition</label>
//               <select
//                 value={winCondition}
//                 onChange={(e) => setWinCondition(e.target.value as WinCondition)}
//                 className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//               >
//                 <option value="bankrupt_all">Last one standing</option>
//                 <option value="net_worth_target">Net worth target</option>
//                 <option value="timed">Timed — highest net worth wins</option>
//               </select>
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-xs uppercase tracking-wide text-cream/50">
//                   {winCondition === "timed" ? "Duration (min)" : "Turn timer (sec)"}
//                 </label>
//                 <input
//                   type="number"
//                   value={winCondition === "timed" ? durationMinutes : turnTimerSeconds}
//                   onChange={(e) =>
//                     winCondition === "timed"
//                       ? setDurationMinutes(Number(e.target.value))
//                       : setTurnTimerSeconds(Number(e.target.value))
//                   }
//                   className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//                 />
//               </div>
//               <div>
//                 <label className="block text-xs uppercase tracking-wide text-cream/50">Max players</label>
//                 <input
//                   type="number"
//                   value={maxPlayers}
//                   onChange={(e) => setMaxPlayers(Number(e.target.value))}
//                   min={2}
//                   max={8}
//                   className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//                 />
//               </div>
//             </div>

//             <div>
//               <label className="block text-xs uppercase tracking-wide text-cream/50">
//                 Board size (tiles per side, min 10)
//               </label>
//               <input
//                 type="number"
//                 value={boardSize}
//                 onChange={(e) => setBoardSize(Math.max(10, Number(e.target.value)))}
//                 min={10}
//                 max={20}
//                 className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//               />
//               <p className="mt-1 text-xs text-cream/40">
//                 {4 * (boardSize - 1)} tiles total — bigger boards suit longer games with more players.
//               </p>
//             </div>

//             {error && <p className="text-sm text-danger">{error}</p>}

//             <button
//               type="submit"
//               disabled={submitting || !userId}
//               className="w-full rounded-full bg-gold py-3 text-sm font-semibold text-base transition hover:bg-gold-highlight disabled:opacity-60"
//             >
//               {!userId ? "Sign in above to continue" : submitting ? "Creating room…" : "Create room"}
//             </button>
//           </form>
//         </div>
//       </div>
//     </main>
//   );
// }






"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HowToPlayButton from "@/components/HowToPlayButton";
import { useGridAuth } from "@/lib/auth";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/roomCode";
import type { RoomSettings, WinCondition } from "@/lib/game/types";

const CAPITAL_PRESETS = [
  { label: "Casual — $1,500", value: 1500 },
  { label: "Standard — $3,000", value: 3000 },
  { label: "High Stakes — $10,000", value: 10000 },
];

type AuthTab = "signup" | "login";

function AccountPanel({
  auth,
}: {
  auth: ReturnType<typeof useGridAuth>;
}) {
  const { loading, userId, username, email, isAnonymous, error, continueAsGuest, signUp, signIn } = auth;
  const [tab, setTab] = useState<AuthTab>("signup");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Signed in with a real account already — nothing to do here.
  if (userId && !isAnonymous) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-card border border-primary-accent/30 bg-primary-accent/5 px-4 py-3 text-sm">
        <span className="text-cream">
          Signed in as <span className="text-primary-accent">{email ?? username}</span>
        </span>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formEmail || !formPassword) {
      setFormError("Email and password are required.");
      return;
    }
    setFormBusy(true);
    const result =
      tab === "signup" ? await signUp(formEmail, formPassword, formUsername) : await signIn(formEmail, formPassword);
    setFormBusy(false);
    if (result.error) setFormError(result.error);
    else setExpanded(false);
  }

  // Still resolving the initial (anonymous) session — show a real fallback
  // instead of a dead "Signing in…" button with no way forward.
  if (loading) {
    return (
      <div className="mb-6 rounded-card border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-cream/60">
        Signing in…
        {error && (
          <div className="mt-2">
            <p className="text-danger">{error}</p>
            <button
              type="button"
              onClick={() => continueAsGuest()}
              className="mt-1 rounded-full border border-cream/25 px-3 py-1.5 text-xs text-cream hover:border-cream/50"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  // Loaded, but no session at all (guest sign-in failed and hasn't been retried yet).
  if (!userId) {
    return (
      <div className="mb-6 rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
        <p className="text-cream/80">{error ?? "You're not signed in."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => continueAsGuest()}
            className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-base hover:bg-gold-highlight"
          >
            Continue as guest
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-cream/25 px-4 py-2 text-xs text-cream hover:border-cream/50"
          >
            Create an account instead
          </button>
        </div>
      </div>
    );
  }

  // Anonymous session active — offer to create a real account before hosting.
  return (
    <div className="mb-6 rounded-card border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-cream/70">
          Playing as <span className="text-cream">{username || "Guest"}</span> (not saved)
        </span>
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-gold/40 px-3 py-1.5 text-xs text-gold-highlight hover:bg-gold/10"
          >
            Create account
          </button>
        )}
      </div>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`rounded-full px-3 py-1 ${tab === "signup" ? "bg-gold/15 text-gold-highlight" : "text-cream/50"}`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`rounded-full px-3 py-1 ${tab === "login" ? "bg-gold/15 text-gold-highlight" : "text-cream/50"}`}
            >
              Log in
            </button>
            <button type="button" onClick={() => setExpanded(false)} className="ml-auto text-cream/40 hover:text-cream/70">
              Cancel
            </button>
          </div>

          {tab === "signup" && (
            <input
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder={username || "Display name (optional)"}
              className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
            />
          )}
          <input
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
          />
          <input
            type="password"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
          />

          {formError && <p className="text-xs text-danger">{formError}</p>}

          <button
            type="submit"
            disabled={formBusy}
            className="w-full rounded-full bg-gold py-2 text-sm font-semibold text-base hover:bg-gold-highlight disabled:opacity-60"
          >
            {formBusy ? "Please wait…" : tab === "signup" ? "Create account" : "Log in"}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * For an invited player (or the host, on another device) who already has a
 * room code — validates it against the server before navigating, so a typo
 * shows an inline error instead of landing on a dead room page.
 */
function JoinRoomPanel({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setError("Enter the 6-character room code exactly as shared.");
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`/api/rooms?roomId=${encodeURIComponent(normalized)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No room found with that code.");
      }
      router.push(`/room/${normalized}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setJoining(false);
    }
  }

  return (
    <div className="mb-6 rounded-card border border-white/10 bg-white/[0.02] p-6 sm:p-8">
      <h2 className="font-display text-xl text-cream">Have a room code?</h2>
      <p className="mt-1 text-sm text-cream/60">Enter the 6-character code the host shared with you.</p>

      <form onSubmit={handleJoin} className="mt-4 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. K7XQ2M"
          maxLength={8}
          autoCapitalize="characters"
          className="flex-1 rounded-lg border border-white/10 bg-base px-3 py-2 text-center font-mono text-lg uppercase tracking-[0.2em] text-cream placeholder:tracking-normal placeholder:text-cream/30"
        />
        <button
          type="submit"
          disabled={joining || !userId}
          className="shrink-0 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-base hover:bg-gold-highlight disabled:opacity-60"
        >
          {joining ? "Joining…" : "Join"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {!userId && <p className="mt-2 text-xs text-cream/40">Sign in above first.</p>}
    </div>
  );
}

export default function LobbyPage() {
  const router = useRouter();
  const auth = useGridAuth();
  const { userId } = auth;
  const [startingCapital, setStartingCapital] = useState(3000);
  const [winCondition, setWinCondition] = useState<WinCondition>("timed");
  const [winTarget, setWinTarget] = useState(10000);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [turnTimerSeconds, setTurnTimerSeconds] = useState(45);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [boardSize, setBoardSize] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setError(null);

    const settings: Partial<RoomSettings> = {
      startingCapital,
      winCondition,
      winTarget: winCondition === "net_worth_target" ? winTarget : undefined,
      durationMinutes: winCondition === "timed" ? durationMinutes : undefined,
      turnTimerSeconds,
      maxPlayers,
      boardSize,
    };

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create room");
      const data = await res.json();
      router.push(`/room/${data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-base px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-xl items-center justify-between">
        <Link href="/" className="font-display text-lg text-cream">
          GRIDE
        </Link>
        <HowToPlayButton />
      </div>

      <div className="mx-auto mt-8 max-w-xl sm:mt-10">
        <AccountPanel auth={auth} />
        <JoinRoomPanel userId={userId} />

        <div className="rounded-card border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <h1 className="font-display text-2xl text-cream">Create a room</h1>
          <p className="mt-1 text-sm text-cream/60">
            Set the table. Everyone who joins starts with the same balance.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs uppercase tracking-wide text-cream/50">Starting capital</label>
              <select
                value={startingCapital}
                onChange={(e) => setStartingCapital(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
              >
                {CAPITAL_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-cream/50">Win condition</label>
              <select
                value={winCondition}
                onChange={(e) => setWinCondition(e.target.value as WinCondition)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
              >
                <option value="bankrupt_all">Last one standing</option>
                <option value="net_worth_target">Net worth target</option>
                <option value="timed">Timed — highest net worth wins</option>
              </select>
            </div>

            {winCondition === "net_worth_target" && (
              <div>
                <label className="block text-xs uppercase tracking-wide text-cream/50">Net worth target ($)</label>
                <input
                  type="number"
                  value={winTarget}
                  onChange={(e) => setWinTarget(Math.max(1, Number(e.target.value)))}
                  min={1}
                  step={500}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
                />
                <p className="mt-1 text-xs text-cream/40">First player to reach this net worth wins immediately.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-cream/50">
                  {winCondition === "timed" ? "Duration (min)" : "Turn timer (sec)"}
                </label>
                <input
                  type="number"
                  value={winCondition === "timed" ? durationMinutes : turnTimerSeconds}
                  onChange={(e) =>
                    winCondition === "timed"
                      ? setDurationMinutes(Number(e.target.value))
                      : setTurnTimerSeconds(Number(e.target.value))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-cream/50">Max players</label>
                <input
                  type="number"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  min={2}
                  max={8}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-cream/50">
                Board size (tiles per side, min 10)
              </label>
              <input
                type="number"
                value={boardSize}
                onChange={(e) => setBoardSize(Math.max(10, Number(e.target.value)))}
                min={10}
                max={20}
                className="mt-2 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
              />
              <p className="mt-1 text-xs text-cream/40">
                {4 * (boardSize - 1)} tiles total — bigger boards suit longer games with more players.
              </p>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !userId}
              className="w-full rounded-full bg-gold py-3 text-sm font-semibold text-base transition hover:bg-gold-highlight disabled:opacity-60"
            >
              {!userId ? "Sign in above to continue" : submitting ? "Creating room…" : "Create room"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
