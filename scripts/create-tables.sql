-- Create landlords table
CREATE TABLE IF NOT EXISTS landlords (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  mobile TEXT,
  bank_account_no TEXT,
  sort_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create rental_agreements table
CREATE TABLE IF NOT EXISTS rental_agreements (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL,
  landlord_id INTEGER NOT NULL,
  rent_amount INTEGER NOT NULL,
  rent_frequency TEXT NOT NULL,
  management_fee_percent DECIMAL,
  tenancy_start TIMESTAMP,
  tenancy_end TIMESTAMP,
  deposit_held_by TEXT,
  deposit_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
