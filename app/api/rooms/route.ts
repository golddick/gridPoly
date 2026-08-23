


// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/db";
// import { createSupabaseServerClient } from "@/lib/supabase/server";
// import { generateRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/roomCode";
// import type { RoomSettings } from "@/lib/game";

// interface CreateRoomBody {
//   settings: Partial<RoomSettings>;
// }

// const DEFAULT_SETTINGS: RoomSettings = {
//   winCondition: "timed",
//   durationMinutes: 30,
//   turnTimerSeconds: 45,
//   startingCapital: 3000,
//   boardVariant: "default",
//   boardSize: 10,
//   maxPlayers: 6,
//   marketEventEveryNTurns: 4,
// };

// const MAX_CODE_ATTEMPTS = 8;

// /** Generates a short room code, retrying on the (extremely unlikely) chance of a collision with an existing room. */
// async function generateUniqueRoomCode(): Promise<string> {
//   for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
//     const code = generateRoomCode();
//     const existing = await prisma.room.findUnique({ where: { id: code }, select: { id: true } });
//     if (!existing) return code;
//   }
//   throw new Error("Could not generate a unique room code — please try again.");
// }

// export async function POST(req: NextRequest) {
//   const supabase = createSupabaseServerClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();

//   if (!user) {
//     return NextResponse.json({ error: "Not signed in" }, { status: 401 });
//   }

//   const body = (await req.json()) as CreateRoomBody;
//   const settings: RoomSettings = { ...DEFAULT_SETTINGS, ...body.settings };
//   const username = (user.user_metadata?.username as string | undefined) ?? "Player";

//   await prisma.user.upsert({
//     where: { id: user.id },
//     create: {
//       id: user.id,
//       username,
//       email: user.email ?? `${user.id}@anon.gride.local`,
//       authProvider: user.is_anonymous ? "supabase_anonymous" : "supabase",
//     },
//     update: { username, email: user.email ?? undefined },
//   });

//   let roomId: string;
//   try {
//     roomId = await generateUniqueRoomCode();
//   } catch (err) {
//     console.error("Room code generation failed", err);
//     return NextResponse.json({ error: "Couldn't create a room right now — please try again." }, { status: 500 });
//   }

//   const room = await prisma.room.create({
//     data: {
//       id: roomId, // short, shareable code — used as the primary key directly, e.g. "K7XQ2M"
//       hostId: user.id,
//       status: "waiting",
//       settings: settings as unknown as object,
//     },
//   });

//   return NextResponse.json({ roomId: room.id, settings });
// }

// /**
//  * GET /api/rooms?roomId=CODE — used by the lobby's "Join a room" form to
//  * validate a code exists *before* navigating, so a mistyped code shows an
//  * inline error instead of a dead room page.
//  */
// export async function GET(req: NextRequest) {
//   const raw = req.nextUrl.searchParams.get("roomId");
//   if (!raw) {
//     return NextResponse.json({ error: "roomId query param required" }, { status: 400 });
//   }

//   const roomId = normalizeRoomCode(raw);
//   if (!isValidRoomCode(roomId)) {
//     return NextResponse.json({ error: "That doesn't look like a valid room code." }, { status: 400 });
//   }

//   const room = await prisma.room.findUnique({ where: { id: roomId } });
//   if (!room) return NextResponse.json({ error: "No room found with that code." }, { status: 404 });
//   return NextResponse.json(room);
// }











import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/roomCode";
import type { RoomSettings } from "@/lib/game";

interface CreateRoomBody {
  settings: Partial<RoomSettings>;
}

const DEFAULT_SETTINGS: RoomSettings = {
  winCondition: "timed",
  durationMinutes: 30,
  turnTimerSeconds: 45,
  startingCapital: 3000,
  boardVariant: "default",
  boardSize: 10,
  maxPlayers: 6,
  marketEventEveryNTurns: 4,
};

const MAX_CODE_ATTEMPTS = 8;

/** Generates a short room code, retrying on the (extremely unlikely) chance of a collision with an existing room. */
async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const existing = await prisma.room.findUnique({ where: { id: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique room code — please try again.");
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await req.json()) as CreateRoomBody;
  const settings: RoomSettings = { ...DEFAULT_SETTINGS, ...body.settings };
  const username = (user.user_metadata?.username as string | undefined) ?? "Player";
  // Supabase gives anonymous users email: "" (empty string), not null/undefined —
  // `??` only falls back on null/undefined, so every anon user was getting the
  // exact same empty-string email and violating the unique constraint on the
  // second one to hit this route. `||` also treats "" as falsy, fixing that.
  const email = user.email || `${user.id}@anon.gride.local`;

  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, username, email, authProvider: user.is_anonymous ? "supabase_anonymous" : "supabase" },
    update: { username },
  });

  let roomId: string;
  try {
    roomId = await generateUniqueRoomCode();
  } catch (err) {
    console.error("Room code generation failed", err);
    return NextResponse.json({ error: "Couldn't create a room right now — please try again." }, { status: 500 });
  }

  const room = await prisma.room.create({
    data: {
      id: roomId, // short, shareable code — used as the primary key directly, e.g. "K7XQ2M"
      hostId: user.id,
      status: "waiting",
      settings: settings as unknown as object,
    },
  });

  return NextResponse.json({ roomId: room.id, settings });
}

/**
 * GET /api/rooms?roomId=CODE — used by the lobby's "Join a room" form to
 * validate a code exists *before* navigating, so a mistyped code shows an
 * inline error instead of a dead room page.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("roomId");
  if (!raw) {
    return NextResponse.json({ error: "roomId query param required" }, { status: 400 });
  }

  const roomId = normalizeRoomCode(raw);
  if (!isValidRoomCode(roomId)) {
    return NextResponse.json({ error: "That doesn't look like a valid room code." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "No room found with that code." }, { status: 404 });
  return NextResponse.json(room);
}