-- CreateTable: personalization pipeline assets (Python REVIEW → APPROVED)
CREATE TABLE IF NOT EXISTS "biometric_assets" (
    "id" UUID NOT NULL,
    "artifact_id" VARCHAR(100) NOT NULL,
    "asset_type" VARCHAR(50) NOT NULL DEFAULT 'fingerprint',
    "status" VARCHAR(50) NOT NULL,
    "review_files" JSONB,
    "approved_files" JSONB,
    "manifest_url" VARCHAR(500),
    "created_by_staff_id" UUID,
    "assigned_user_id" UUID,
    "engraving_id" UUID,
    "order_item_id" UUID,
    "model_code" VARCHAR(100),
    "surface" VARCHAR(100),
    "placement" JSONB,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "approval_note" TEXT,
    "placement_confirmed_at" TIMESTAMPTZ(6),
    "quality_score" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biometric_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "biometric_assets_engraving_id_asset_type_key"
ON "biometric_assets"("engraving_id", "asset_type");

CREATE INDEX IF NOT EXISTS "biometric_assets_artifact_id_idx"
ON "biometric_assets"("artifact_id");

CREATE INDEX IF NOT EXISTS "biometric_assets_assigned_user_id_idx"
ON "biometric_assets"("assigned_user_id");

CREATE INDEX IF NOT EXISTS "biometric_assets_engraving_id_idx"
ON "biometric_assets"("engraving_id");

CREATE INDEX IF NOT EXISTS "biometric_assets_status_idx"
ON "biometric_assets"("status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'biometric_assets_engraving_id_fkey'
  ) THEN
    ALTER TABLE "biometric_assets"
      ADD CONSTRAINT "biometric_assets_engraving_id_fkey"
      FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'biometric_assets_created_by_staff_id_fkey'
  ) THEN
    ALTER TABLE "biometric_assets"
      ADD CONSTRAINT "biometric_assets_created_by_staff_id_fkey"
      FOREIGN KEY ("created_by_staff_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'biometric_assets_assigned_user_id_fkey'
  ) THEN
    ALTER TABLE "biometric_assets"
      ADD CONSTRAINT "biometric_assets_assigned_user_id_fkey"
      FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'biometric_assets_approved_by_fkey'
  ) THEN
    ALTER TABLE "biometric_assets"
      ADD CONSTRAINT "biometric_assets_approved_by_fkey"
      FOREIGN KEY ("approved_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;
