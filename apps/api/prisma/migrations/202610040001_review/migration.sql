CREATE TABLE "AuthAttempt" (key TEXT PRIMARY KEY, "failedAttempts" INTEGER NOT NULL DEFAULT 0, "lockedUntil" TIMESTAMP(3));
ALTER TABLE "CashSession" ADD COLUMN "differenceCash" DECIMAL(14,2), ADD COLUMN "differenceCard" DECIMAL(14,2), ADD COLUMN "differenceTransfer" DECIMAL(14,2);
UPDATE "CashSession" SET "differenceCash"="countedCash"-"expectedCash", "differenceCard"="countedCard"-"expectedCard", "differenceTransfer"="countedTransfer"-"expectedTransfer" WHERE "closedAt" IS NOT NULL;
