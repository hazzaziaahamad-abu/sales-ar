-- Allow 'ticket' entity_type in follow_up_notes and mention_notifications
ALTER TABLE follow_up_notes DROP CONSTRAINT follow_up_notes_entity_type_check;
ALTER TABLE follow_up_notes ADD CONSTRAINT follow_up_notes_entity_type_check CHECK (entity_type = ANY (ARRAY['deal'::text, 'renewal'::text, 'ticket'::text]));

ALTER TABLE mention_notifications DROP CONSTRAINT mention_notifications_entity_type_check;
ALTER TABLE mention_notifications ADD CONSTRAINT mention_notifications_entity_type_check CHECK (entity_type = ANY (ARRAY['deal'::text, 'renewal'::text, 'ticket'::text]));
