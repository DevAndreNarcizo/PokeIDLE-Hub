/*
  Warnings:

  - You are about to drop the column `xp_pokemon` on the `hunt_observations` table. All the data in the column will be lost.
  - You are about to drop the column `xp_trainer` on the `hunt_observations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "hunt_observations" DROP COLUMN "xp_pokemon",
DROP COLUMN "xp_trainer",
ADD COLUMN     "captures_start" INTEGER,
ADD COLUMN     "gold_start" DECIMAL,
ADD COLUMN     "kills_start" INTEGER,
ADD COLUMN     "xp_pokemon_per_hour" DECIMAL,
ADD COLUMN     "xp_trainer_per_hour" DECIMAL;

-- CreateIndex
CREATE INDEX "hunt_observations_account" ON "hunt_observations"("account_id", "ended_at" DESC);
