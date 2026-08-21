import { PrismaClient } from "@prisma/client";
import { generateBoard, PURCHASABLE_TYPES } from "../lib/game/board";
import { MIN_BOARD_SIZE } from "../lib/game/types";

const prisma = new PrismaClient();

async function main() {
  // Seed AssetDefinition rows for the default board at the minimum size —
  // larger boards generate additional tiles procedurally at runtime and are
  // written to Postgres lazily the first time they're purchased.
  const tiles = generateBoard(MIN_BOARD_SIZE).filter((t) => PURCHASABLE_TYPES.has(t.type));

  for (const tile of tiles) {
    await prisma.assetDefinition.upsert({
      where: { id: tile.id },
      create: {
        id: tile.id,
        boardVariantId: "default",
        type: tile.type,
        name: tile.name,
        basePrice: tile.basePrice,
        currentValue: tile.basePrice,
        boardPosition: tile.position,
        volatility: tile.volatility,
        baseIncomeRate: tile.baseIncomeRate,
        landingFeePercent: tile.landingFeePercent,
      },
      update: {
        type: tile.type,
        name: tile.name,
        basePrice: tile.basePrice,
        boardPosition: tile.position,
        volatility: tile.volatility,
        baseIncomeRate: tile.baseIncomeRate,
        landingFeePercent: tile.landingFeePercent,
      },
    });
  }

  console.log(`Seeded ${tiles.length} asset definitions for board variant "default" (size ${MIN_BOARD_SIZE}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
