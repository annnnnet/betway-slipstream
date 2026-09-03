-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SlipActionKind" AS ENUM ('RESOLVE', 'CREATE', 'CONVERT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedSlip" (
    "code" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "isSingleBet" BOOLEAN NOT NULL,
    "isBuildABet" BOOLEAN NOT NULL,
    "combinedOdds" DOUBLE PRECISION NOT NULL,
    "selections" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CachedSlip_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SlipAction" (
    "id" TEXT NOT NULL,
    "kind" "SlipActionKind" NOT NULL,
    "code" TEXT NOT NULL,
    "sourceCode" TEXT,
    "fingerprint" TEXT NOT NULL,
    "selectionCount" INTEGER NOT NULL,
    "combinedOdds" DOUBLE PRECISION NOT NULL,
    "verified" BOOLEAN,
    "verification" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlipAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseSub_key" ON "User"("supabaseSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CachedSlip_fingerprint_idx" ON "CachedSlip"("fingerprint");

-- CreateIndex
CREATE INDEX "CachedSlip_resolvedAt_idx" ON "CachedSlip"("resolvedAt");

-- CreateIndex
CREATE INDEX "SlipAction_userId_createdAt_idx" ON "SlipAction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SlipAction_code_idx" ON "SlipAction"("code");

-- CreateIndex
CREATE INDEX "SlipAction_createdAt_idx" ON "SlipAction"("createdAt");

-- AddForeignKey
ALTER TABLE "SlipAction" ADD CONSTRAINT "SlipAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
