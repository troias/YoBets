CREATE TABLE "bet_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "match_name" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "odds" DECIMAL(6,2) NOT NULL,
    "stake" DECIMAL(10,2) NOT NULL,
    "bet_type" TEXT NOT NULL DEFAULT 'manual',
    "result" TEXT NOT NULL DEFAULT 'pending',
    "profit" DECIMAL(10,2),
    "placed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ,
    "notes" TEXT,

    CONSTRAINT "bet_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bet_log_user_id_placed_at_idx" ON "bet_log"("user_id", "placed_at");
