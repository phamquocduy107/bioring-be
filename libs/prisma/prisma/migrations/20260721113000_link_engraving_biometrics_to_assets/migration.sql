-- Link engraving checklist rows to personalization pipeline assets
ALTER TABLE "engraving_biometrics"
ADD COLUMN IF NOT EXISTS "biometric_asset_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "engraving_biometrics_biometric_asset_id_key"
ON "engraving_biometrics"("biometric_asset_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'engraving_biometrics_biometric_asset_id_fkey'
  ) THEN
    ALTER TABLE "engraving_biometrics"
      ADD CONSTRAINT "engraving_biometrics_biometric_asset_id_fkey"
      FOREIGN KEY ("biometric_asset_id") REFERENCES "biometric_assets"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;
