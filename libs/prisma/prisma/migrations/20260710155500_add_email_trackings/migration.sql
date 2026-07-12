-- CreateTable
CREATE TABLE "email_trackings" (
    "id" UUID NOT NULL,
    "email_id" VARCHAR(100) NOT NULL,
    "email_to" TEXT NOT NULL,
    "email_type" VARCHAR(100) NOT NULL,
    "order_id" UUID,
    "claim_id" UUID,
    "opened_at" TIMESTAMP(3),
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_trackings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_trackings_email_id_key" ON "email_trackings"("email_id");

-- CreateIndex
CREATE INDEX "email_trackings_email_id_idx" ON "email_trackings"("email_id");

-- CreateIndex
CREATE INDEX "email_trackings_order_id_idx" ON "email_trackings"("order_id");
