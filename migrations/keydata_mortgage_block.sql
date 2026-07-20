-- KeyData parity: Mortgage Management + Block/Service-Charge Management
-- Additive, non-destructive. Safe to run against production (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS property_mortgage (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL,
  landlord_id INTEGER,
  lender_name TEXT NOT NULL,
  account_number TEXT,
  mortgage_type TEXT NOT NULL DEFAULT 'buy_to_let',
  monthly_payment INTEGER NOT NULL DEFAULT 0,
  interest_rate_bps INTEGER,
  term_months INTEGER,
  start_date TIMESTAMP,
  deal_expiry_date TIMESTAMP,
  end_date TIMESTAMP,
  outstanding_balance INTEGER,
  next_payment_date TIMESTAMP,
  pay_from_rent BOOLEAN NOT NULL DEFAULT FALSE,
  payee_sort_code TEXT,
  payee_account_number TEXT,
  payee_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_property_mortgage_property ON property_mortgage(property_id);
CREATE INDEX IF NOT EXISTS idx_property_mortgage_status ON property_mortgage(status);

CREATE TABLE IF NOT EXISTS mortgage_payment (
  id SERIAL PRIMARY KEY,
  mortgage_id INTEGER NOT NULL,
  due_date TIMESTAMP NOT NULL,
  amount INTEGER NOT NULL,
  paid_date TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'scheduled',
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mortgage_payment_mortgage ON mortgage_payment(mortgage_id);

CREATE TABLE IF NOT EXISTS block (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postcode TEXT,
  freeholder_name TEXT,
  freeholder_contact TEXT,
  managing_agent_name TEXT,
  number_of_units INTEGER DEFAULT 0,
  service_charge_year_end TEXT,
  ground_rent_annual_total INTEGER DEFAULT 0,
  reserve_fund_balance INTEGER DEFAULT 0,
  insurance_policy_ref TEXT,
  insurance_expiry TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS block_unit (
  id SERIAL PRIMARY KEY,
  block_id INTEGER NOT NULL,
  property_id INTEGER,
  unit_reference TEXT NOT NULL,
  leaseholder_name TEXT,
  leaseholder_contact TEXT,
  apportionment_bps INTEGER,
  ground_rent_annual INTEGER DEFAULT 0,
  lease_end_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_block_unit_block ON block_unit(block_id);

CREATE TABLE IF NOT EXISTS service_charge_budget (
  id SERIAL PRIMARY KEY,
  block_id INTEGER NOT NULL,
  year_label TEXT NOT NULL,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  total_budget INTEGER NOT NULL DEFAULT 0,
  reserve_contribution INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_charge_budget_block ON service_charge_budget(block_id);

CREATE TABLE IF NOT EXISTS service_charge_demand (
  id SERIAL PRIMARY KEY,
  block_id INTEGER NOT NULL,
  unit_id INTEGER,
  budget_id INTEGER,
  demand_type TEXT NOT NULL DEFAULT 'service_charge',
  description TEXT,
  demand_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP,
  amount INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  paid_date TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'issued',
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_charge_demand_block ON service_charge_demand(block_id);
CREATE INDEX IF NOT EXISTS idx_service_charge_demand_status ON service_charge_demand(status);
