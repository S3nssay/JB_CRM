-- Email Workflow Automation - Schema Migration
-- Run against the database to create new tables and add columns

-- New columns on processed_email
ALTER TABLE processed_email ADD COLUMN IF NOT EXISTS ai_extracted_tasks jsonb;
ALTER TABLE processed_email ADD COLUMN IF NOT EXISTS ai_attachment_classifications jsonb;
ALTER TABLE processed_email ADD COLUMN IF NOT EXISTS ai_property_match jsonb;
ALTER TABLE processed_email ADD COLUMN IF NOT EXISTS ai_lead_details jsonb;
ALTER TABLE processed_email ADD COLUMN IF NOT EXISTS linked_lead_id integer;

-- New columns on task
ALTER TABLE task ADD COLUMN IF NOT EXISTS source_email_id integer;
ALTER TABLE task ADD COLUMN IF NOT EXISTS source_ticket_id integer;
ALTER TABLE task ADD COLUMN IF NOT EXISTS source_lead_id integer;
ALTER TABLE task ADD COLUMN IF NOT EXISTS sla_deadline timestamp;

-- New table: email_attachment
CREATE TABLE IF NOT EXISTS email_attachment (
  id SERIAL PRIMARY KEY,
  processed_email_id INTEGER NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  storage_url TEXT,
  document_id INTEGER,
  ai_document_type TEXT,
  ai_entity_type TEXT,
  ai_entity_id INTEGER,
  ai_confidence NUMERIC,
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- New table: assignment_rule
CREATE TABLE IF NOT EXISTS assignment_rule (
  id SERIAL PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  match_value TEXT NOT NULL,
  assigned_user_id INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_attachment_email ON email_attachment (processed_email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachment_review ON email_attachment (review_status);
CREATE INDEX IF NOT EXISTS idx_email_attachment_document ON email_attachment (document_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rule_type ON assignment_rule (rule_type, match_value);
CREATE INDEX IF NOT EXISTS idx_assignment_rule_active ON assignment_rule (is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_task_source_email ON task (source_email_id);
CREATE INDEX IF NOT EXISTS idx_task_source_ticket ON task (source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_task_sla ON task (sla_deadline) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_processed_email_lead ON processed_email (linked_lead_id);
