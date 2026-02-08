-- AlterTable
ALTER TABLE "UserInvite" ADD COLUMN "token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_token_key" ON "UserInvite"("token");
