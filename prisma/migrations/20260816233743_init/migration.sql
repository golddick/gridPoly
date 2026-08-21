-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT,
    "authProvider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bestNetWorth" INTEGER NOT NULL DEFAULT 0,
    "bestNetWorthAt" TIMESTAMP(3),
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'DEMO',

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "relatedAssetId" TEXT,
    "roomId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPlayer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inGameBalance" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "netWorth" INTEGER NOT NULL DEFAULT 0,
    "pieceId" TEXT NOT NULL DEFAULT 'cone-gold',

    CONSTRAINT "RoomPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDefinition" (
    "id" TEXT NOT NULL,
    "boardVariantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL,
    "boardPosition" INTEGER,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseIncomeRate" INTEGER NOT NULL DEFAULT 0,
    "landingFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "AssetDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnedAsset" (
    "id" TEXT NOT NULL,
    "roomPlayerId" TEXT NOT NULL,
    "assetDefinitionId" TEXT NOT NULL,
    "amountInvested" INTEGER NOT NULL,
    "ownershipPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "OwnedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetPlacement" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "assetDefinitionId" TEXT NOT NULL,
    "bettorRoomPlayerId" TEXT NOT NULL,
    "ownerRoomPlayerId" TEXT NOT NULL,
    "betType" TEXT NOT NULL,
    "betAmount" INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "result" TEXT NOT NULL,
    "payoutAmount" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketEvent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "triggeredAtTurn" INTEGER NOT NULL,
    "affectedAssetType" TEXT NOT NULL,
    "impactPercent" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "MarketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "roomPlayerId" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "installmentAmount" INTEGER NOT NULL,
    "installmentIntervalTurns" INTEGER NOT NULL,
    "installmentsRemaining" INTEGER NOT NULL,
    "missedPayments" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAtTurn" INTEGER NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAction" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomPlayerId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_userId_key" ON "RoomPlayer"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnedAsset" ADD CONSTRAINT "OwnedAsset_roomPlayerId_fkey" FOREIGN KEY ("roomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnedAsset" ADD CONSTRAINT "OwnedAsset_assetDefinitionId_fkey" FOREIGN KEY ("assetDefinitionId") REFERENCES "AssetDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPlacement" ADD CONSTRAINT "BetPlacement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPlacement" ADD CONSTRAINT "BetPlacement_assetDefinitionId_fkey" FOREIGN KEY ("assetDefinitionId") REFERENCES "AssetDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketEvent" ADD CONSTRAINT "MarketEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_roomPlayerId_fkey" FOREIGN KEY ("roomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_roomPlayerId_fkey" FOREIGN KEY ("roomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
