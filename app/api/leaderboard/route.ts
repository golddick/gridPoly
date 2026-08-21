import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? 50));

  const users = await prisma.user.findMany({
    where: { bestNetWorth: { gt: 0 } },
    orderBy: { bestNetWorth: "desc" },
    take: limit,
    select: { id: true, username: true, bestNetWorth: true, bestNetWorthAt: true, gamesWon: true, gamesPlayed: true },
  });

  return NextResponse.json({ entries: users });
}
