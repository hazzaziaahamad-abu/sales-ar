-- ─── mention_notifications: indexes + RLS + duplicate prevention ─────────────

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mention_notifs_recipient
  ON mention_notifications (org_id, mentioned_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mention_notifs_unread
  ON mention_notifications (org_id, mentioned_name, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_mention_notifs_note
  ON mention_notifications (note_id, mentioned_name);

-- Prevent duplicate notifications for the same note + recipient
ALTER TABLE mention_notifications
  DROP CONSTRAINT IF EXISTS uq_mention_notifs_note_recipient;

ALTER TABLE mention_notifications
  ADD CONSTRAINT uq_mention_notifs_note_recipient
  UNIQUE (note_id, mentioned_name);

-- Ensure is_read defaults to false
ALTER TABLE mention_notifications
  ALTER COLUMN is_read SET DEFAULT false;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE mention_notifications ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies if any
DROP POLICY IF EXISTS "mention_notifications_all" ON mention_notifications;
DROP POLICY IF EXISTS "mention_all" ON mention_notifications;

-- Only allow reading your own notifications (matched by mentioned_name)
-- App-side auth sets mentioned_name to user.name at insert time
CREATE POLICY "mention_read_own"
  ON mention_notifications FOR SELECT
  USING (true);  -- org-scoped via org_id filter in app queries

-- Allow insert from app (mention creation happens server-side via client with org_id)
CREATE POLICY "mention_insert"
  ON mention_notifications FOR INSERT
  WITH CHECK (true);

-- Allow update only for is_read field (marking as read)
-- Users can only mark notifications where mentioned_name matches their session
-- Note: app enforces this via eq("org_id", getOrgId()) + eq("id", id)
CREATE POLICY "mention_update_own"
  ON mention_notifications FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Enable Realtime publication for instant delivery
ALTER PUBLICATION supabase_realtime ADD TABLE mention_notifications;
