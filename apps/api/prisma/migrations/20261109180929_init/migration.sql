-- CreateTable
CREATE TABLE "accounts" (
    "id" SMALLINT NOT NULL,
    "label" TEXT NOT NULL,
    "nick" TEXT,
    "bridge_token_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_state" (
    "account_id" SMALLINT NOT NULL,
    "payload" JSONB NOT NULL,
    "captured_at" TIMESTAMPTZ NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_state_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "snapshots" (
    "id" BIGSERIAL NOT NULL,
    "account_id" SMALLINT NOT NULL,
    "captured_at" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL,
    "xp_trainer_per_hour" DECIMAL,
    "xp_pokemon_per_hour" DECIMAL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" BIGSERIAL NOT NULL,
    "account_id" SMALLINT,
    "kind" TEXT NOT NULL,
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "acked_at" TIMESTAMPTZ,
    "payload" JSONB,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_tasks" (
    "account_id" SMALLINT NOT NULL,
    "day" DATE NOT NULL,
    "task" TEXT NOT NULL,
    "done_at" TIMESTAMPTZ,

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("account_id","day","task")
);

-- CreateTable
CREATE TABLE "hunt_catalog" (
    "id" SERIAL NOT NULL,
    "region" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "species" TEXT,
    "types" TEXT[],
    "source" TEXT NOT NULL,

    CONSTRAINT "hunt_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hunt_observations" (
    "id" BIGSERIAL NOT NULL,
    "account_id" SMALLINT NOT NULL,
    "region" TEXT NOT NULL,
    "hunt_level" INTEGER NOT NULL,
    "hunt_name" TEXT,
    "species" TEXT,
    "pokemon_level" INTEGER,
    "started_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ NOT NULL,
    "kills" INTEGER,
    "xp_trainer" DECIMAL,
    "xp_pokemon" DECIMAL,
    "gold" DECIMAL,
    "captures" INTEGER,
    "source" TEXT NOT NULL,

    CONSTRAINT "hunt_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "snapshots_account_time" ON "snapshots"("account_id", "captured_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "alerts_one_open" ON "alerts"("account_id", "kind") WHERE (resolved_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "hunt_catalog_region_level_species_key" ON "hunt_catalog"("region", "level", "species");

-- CreateIndex
CREATE INDEX "hunt_observations_hunt" ON "hunt_observations"("region", "hunt_level", "ended_at" DESC);

-- AddForeignKey
ALTER TABLE "account_state" ADD CONSTRAINT "account_state_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hunt_observations" ADD CONSTRAINT "hunt_observations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual: the owner has exactly 4 accounts (the game's Terms allow at most 4 per person).
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_id_range" CHECK ("id" BETWEEN 1 AND 4);
