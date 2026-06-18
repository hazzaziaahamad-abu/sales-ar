-- WhatsApp (OpenWA) integration — optional persistence layer.
--
-- The app works WITHOUT these tables: org→session resolution is done on the
-- gateway via the `dash-org-<orgId>` naming convention. These tables add
-- persistent metadata (for showing the connected number without hitting the
-- gateway) and an inbox of received messages.
--
-- Follows the repo convention: RLS enabled with permissive policies; org
-- isolation is enforced at the application layer.

-- One WhatsApp session per organization.
CREATE TABLE IF NOT EXISTS wa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  session_id TEXT NOT NULL,            -- gateway session UUID
  session_name TEXT NOT NULL,          -- e.g. dash-org-<orgId>
  phone TEXT,
  push_name TEXT,
  status TEXT DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_session_id ON wa_sessions (session_id);

ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_sessions_select" ON wa_sessions FOR SELECT USING (true);
CREATE POLICY "wa_sessions_insert" ON wa_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "wa_sessions_update" ON wa_sessions FOR UPDATE USING (true);
CREATE POLICY "wa_sessions_delete" ON wa_sessions FOR DELETE USING (true);

-- Inbox of received (and optionally sent) messages, per org.
CREATE TABLE IF NOT EXISTS wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  session_id TEXT NOT NULL,
  wa_message_id TEXT,                  -- gateway/WhatsApp message id (idempotency)
  direction TEXT NOT NULL DEFAULT 'in', -- 'in' | 'out'
  chat_id TEXT,                         -- e.g. 9665XXXXXXXX@c.us
  from_number TEXT,
  body TEXT,
  msg_type TEXT DEFAULT 'text',
  has_media BOOLEAN DEFAULT false,
  is_group BOOLEAN DEFAULT false,
  wa_timestamp BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wa_message_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_org_created ON wa_messages (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_chat ON wa_messages (org_id, chat_id, created_at DESC);

ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_messages_select" ON wa_messages FOR SELECT USING (true);
CREATE POLICY "wa_messages_insert" ON wa_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "wa_messages_update" ON wa_messages FOR UPDATE USING (true);
CREATE POLICY "wa_messages_delete" ON wa_messages FOR DELETE USING (true);
