-- Extend ai_sessions for knowledge chat persistence (preferences, intent, workspace).
ALTER TABLE "ai_sessions"
  ADD COLUMN IF NOT EXISTS "workspace_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "user_preferences" JSONB,
  ADD COLUMN IF NOT EXISTS "last_intent" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "current_intent" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "last_message" TEXT;

CREATE INDEX IF NOT EXISTS "ai_sessions_user_workspace_updated_idx"
  ON "ai_sessions" ("user_id", "workspace_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "ai_messages_session_created_idx"
  ON "ai_messages" ("ai_session_id", "created_at");
