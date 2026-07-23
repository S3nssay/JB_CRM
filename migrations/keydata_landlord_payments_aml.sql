-- KeyData parity: Landlord Payments workbench (statement math: BBF + tax + commit),
-- one-off landlord charges onto next statement, and AML sanction screening.
-- Additive & non-destructive. Safe to run against production (IF NOT EXISTS).

-- landlord_statement: balance brought forward, NRL/FICO tax, payment method, ledger commit flag
ALTER TABLE landlord_statement ADD COLUMN IF NOT EXISTS balance_brought_forward INTEGER NOT NULL DEFAULT 0;
ALTER TABLE landlord_statement ADD COLUMN IF NOT EXISTS tax_deducted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE landlord_statement ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE landlord_statement ADD COLUMN IF NOT EXISTS committed_to_ledger BOOLEAN NOT NULL DEFAULT FALSE;

-- recurring_landlord_charge: support one-off charges that land on the next statement
ALTER TABLE recurring_landlord_charge ADD COLUMN IF NOT EXISTS charge_kind TEXT NOT NULL DEFAULT 'recurring';
ALTER TABLE recurring_landlord_charge ADD COLUMN IF NOT EXISTS on_next_statement BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE recurring_landlord_charge ADD COLUMN IF NOT EXISTS charge_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE recurring_landlord_charge ADD COLUMN IF NOT EXISTS statement_id INTEGER;

-- AML sanction screening
CREATE TABLE IF NOT EXISTS sanction_list (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'csv',
  file_name TEXT,
  entry_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  imported_by INTEGER,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sanction_list_entry (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  entity_type TEXT DEFAULT 'person',
  aliases TEXT,
  country TEXT,
  program TEXT,
  date_of_birth TEXT,
  reference TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sanction_entry_list ON sanction_list_entry(list_id);
CREATE INDEX IF NOT EXISTS idx_sanction_entry_norm ON sanction_list_entry(normalized_name);

CREATE TABLE IF NOT EXISTS sanction_screening_run (
  id SERIAL PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'batch',
  provider TEXT NOT NULL DEFAULT 'csv',
  list_id INTEGER,
  party_types TEXT,
  total_checked INTEGER NOT NULL DEFAULT 0,
  total_matches INTEGER NOT NULL DEFAULT 0,
  total_potential INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  auto_generate_proof BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  run_by INTEGER,
  run_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sanction_screening_result (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL,
  party_type TEXT NOT NULL,
  party_id INTEGER,
  party_name TEXT NOT NULL,
  match_status TEXT NOT NULL DEFAULT 'clear',
  match_score INTEGER,
  matched_entry_id INTEGER,
  matched_name TEXT,
  provider TEXT NOT NULL DEFAULT 'csv',
  details JSONB,
  proof_document_url TEXT,
  screened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sanction_result_run ON sanction_screening_result(run_id);
CREATE INDEX IF NOT EXISTS idx_sanction_result_status ON sanction_screening_result(match_status);
