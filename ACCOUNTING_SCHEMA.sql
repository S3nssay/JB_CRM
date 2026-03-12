-- ==========================================
-- BUSINESS ACCOUNTING SYSTEM - SQL MIGRATION
-- ==========================================
-- Run this after adding the Drizzle schema definitions to shared/schema.ts
-- Or use `npm run db:push` to let Drizzle handle table creation, then run
-- only the INDEX and SEED sections below.

-- ==========================================
-- 1. Business Settings
-- ==========================================

CREATE TABLE IF NOT EXISTS business_setting (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  trading_name TEXT,
  company_registration_number TEXT,
  vat_number TEXT,
  tax_reference TEXT,
  corporation_tax_reference TEXT,
  registered_address_line1 TEXT,
  registered_address_line2 TEXT,
  registered_city TEXT,
  registered_postcode TEXT,
  registered_country TEXT DEFAULT 'United Kingdom',
  contact_email TEXT,
  contact_phone TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_sort_code TEXT,
  bank_account_holder_name TEXT,
  bank_iban TEXT,
  vat_scheme TEXT NOT NULL DEFAULT 'standard',
  vat_flat_rate_percentage NUMERIC,
  financial_year_start_month INTEGER NOT NULL DEFAULT 4,
  default_payment_terms_days INTEGER NOT NULL DEFAULT 30,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  purchase_order_prefix TEXT NOT NULL DEFAULT 'PO',
  next_purchase_order_number INTEGER NOT NULL DEFAULT 1,
  credit_note_prefix TEXT NOT NULL DEFAULT 'CN',
  next_credit_note_number INTEGER NOT NULL DEFAULT 1,
  logo_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. Chart of Accounts
-- ==========================================

CREATE TABLE IF NOT EXISTS chart_of_account (
  id SERIAL PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_sub_type TEXT NOT NULL,
  parent_account_id INTEGER,
  description TEXT,
  is_system_account BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  default_tax_rate_id INTEGER,
  opening_balance INTEGER DEFAULT 0,
  opening_balance_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chart_of_account_type ON chart_of_account (account_type);
CREATE INDEX idx_chart_of_account_parent ON chart_of_account (parent_account_id);
CREATE INDEX idx_chart_of_account_active ON chart_of_account (is_active);

-- ==========================================
-- 3. Tax Rates
-- ==========================================

CREATE TABLE IF NOT EXISTS tax_rate (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rate_percentage NUMERIC NOT NULL,
  tax_type TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMP,
  effective_to TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tax_rate_type_active ON tax_rate (tax_type, is_active);

-- ==========================================
-- 4. Financial Periods
-- ==========================================

CREATE TABLE IF NOT EXISTS financial_period (
  id SERIAL PRIMARY KEY,
  period_name TEXT NOT NULL,
  period_type TEXT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_by INTEGER,
  closed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX financial_period_type_start_unique ON financial_period (period_type, start_date);
CREATE INDEX idx_financial_period_status ON financial_period (status);
CREATE INDEX idx_financial_period_dates ON financial_period (start_date, end_date);

-- ==========================================
-- 5. Journal Entries (Double-Entry Core)
-- ==========================================

CREATE TABLE IF NOT EXISTS journal_entry (
  id SERIAL PRIMARY KEY,
  entry_number INTEGER NOT NULL UNIQUE,
  entry_date TIMESTAMP NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  source_type TEXT,
  source_id INTEGER,
  financial_period_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  reversed_by_entry_id INTEGER,
  reverses_entry_id INTEGER,
  total_debit INTEGER NOT NULL DEFAULT 0,
  total_credit INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  approved_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_entry_date ON journal_entry (entry_date);
CREATE INDEX idx_journal_entry_source ON journal_entry (source_type, source_id);
CREATE INDEX idx_journal_entry_status ON journal_entry (status);
CREATE INDEX idx_journal_entry_period ON journal_entry (financial_period_id);
CREATE INDEX idx_journal_entry_reference ON journal_entry (reference);

-- ==========================================
-- 6. Journal Entry Lines
-- ==========================================

CREATE TABLE IF NOT EXISTS journal_entry_line (
  id SERIAL PRIMARY KEY,
  journal_entry_id INTEGER NOT NULL,
  line_number INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  description TEXT,
  debit_amount INTEGER NOT NULL DEFAULT 0,
  credit_amount INTEGER NOT NULL DEFAULT 0,
  tax_rate_id INTEGER,
  tax_amount INTEGER DEFAULT 0,
  entity_type TEXT,
  entity_id INTEGER,
  property_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_entry_line_entry ON journal_entry_line (journal_entry_id);
CREATE INDEX idx_journal_entry_line_account ON journal_entry_line (account_id);
CREATE INDEX idx_journal_entry_line_entity ON journal_entry_line (entity_type, entity_id);
CREATE INDEX idx_journal_entry_line_property ON journal_entry_line (property_id);

-- ==========================================
-- 7. Business Invoices (Sales)
-- ==========================================

CREATE TABLE IF NOT EXISTS business_invoice (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  customer_type TEXT NOT NULL,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_address_line1 TEXT,
  customer_address_line2 TEXT,
  customer_city TEXT,
  customer_postcode TEXT,
  invoice_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  subtotal INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  balance_due INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  payment_terms_days INTEGER,
  notes TEXT,
  terms_and_conditions TEXT,
  pdf_url TEXT,
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  voided_at TIMESTAMP,
  voided_reason TEXT,
  property_id INTEGER,
  tenancy_id INTEGER,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_template_id INTEGER,
  journal_entry_id INTEGER,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_invoice_status ON business_invoice (status);
CREATE INDEX idx_business_invoice_customer ON business_invoice (customer_type, customer_id);
CREATE INDEX idx_business_invoice_date ON business_invoice (invoice_date);
CREATE INDEX idx_business_invoice_due ON business_invoice (due_date);
CREATE INDEX idx_business_invoice_property ON business_invoice (property_id);
CREATE INDEX idx_business_invoice_journal ON business_invoice (journal_entry_id);

-- ==========================================
-- 8. Business Invoice Lines
-- ==========================================

CREATE TABLE IF NOT EXISTS business_invoice_line (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount INTEGER DEFAULT 0,
  account_id INTEGER NOT NULL,
  tax_rate_id INTEGER,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL,
  property_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_invoice_line_invoice ON business_invoice_line (invoice_id);
CREATE INDEX idx_business_invoice_line_account ON business_invoice_line (account_id);

-- ==========================================
-- 9. Purchase Invoices (Bills)
-- ==========================================

CREATE TABLE IF NOT EXISTS purchase_invoice (
  id SERIAL PRIMARY KEY,
  bill_number TEXT,
  internal_reference TEXT NOT NULL UNIQUE,
  supplier_type TEXT NOT NULL,
  supplier_id INTEGER,
  supplier_name TEXT NOT NULL,
  supplier_address_line1 TEXT,
  supplier_address_line2 TEXT,
  supplier_city TEXT,
  supplier_postcode TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  invoice_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  received_date TIMESTAMP,
  subtotal INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  balance_due INTEGER NOT NULL,
  payment_terms_days INTEGER,
  notes TEXT,
  property_id INTEGER,
  landlord_id INTEGER,
  is_rechargeable BOOLEAN NOT NULL DEFAULT FALSE,
  recharged_invoice_id INTEGER,
  maintenance_ticket_id INTEGER,
  journal_entry_id INTEGER,
  approved_by INTEGER,
  approved_at TIMESTAMP,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_invoice_status ON purchase_invoice (status);
CREATE INDEX idx_purchase_invoice_supplier ON purchase_invoice (supplier_type, supplier_id);
CREATE INDEX idx_purchase_invoice_date ON purchase_invoice (invoice_date);
CREATE INDEX idx_purchase_invoice_due ON purchase_invoice (due_date);
CREATE INDEX idx_purchase_invoice_property ON purchase_invoice (property_id);
CREATE INDEX idx_purchase_invoice_landlord ON purchase_invoice (landlord_id);
CREATE INDEX idx_purchase_invoice_rechargeable ON purchase_invoice (is_rechargeable) WHERE is_rechargeable = TRUE;

-- ==========================================
-- 10. Purchase Invoice Lines
-- ==========================================

CREATE TABLE IF NOT EXISTS purchase_invoice_line (
  id SERIAL PRIMARY KEY,
  purchase_invoice_id INTEGER NOT NULL,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  tax_rate_id INTEGER,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL,
  property_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_invoice_line_invoice ON purchase_invoice_line (purchase_invoice_id);
CREATE INDEX idx_purchase_invoice_line_account ON purchase_invoice_line (account_id);

-- ==========================================
-- 11. Credit Notes
-- ==========================================

CREATE TABLE IF NOT EXISTS credit_note (
  id SERIAL PRIMARY KEY,
  credit_note_number TEXT NOT NULL UNIQUE,
  credit_note_type TEXT NOT NULL,
  related_invoice_type TEXT NOT NULL,
  related_invoice_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  credit_note_date TIMESTAMP NOT NULL,
  subtotal INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  reason TEXT,
  journal_entry_id INTEGER,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_note_status ON credit_note (status);
CREATE INDEX idx_credit_note_invoice ON credit_note (related_invoice_type, related_invoice_id);

-- ==========================================
-- 12. Payment Allocations
-- ==========================================

CREATE TABLE IF NOT EXISTS payment_allocation (
  id SERIAL PRIMARY KEY,
  payment_source_type TEXT NOT NULL,
  payment_source_id INTEGER NOT NULL,
  allocated_to_type TEXT NOT NULL,
  allocated_to_id INTEGER NOT NULL,
  amount_allocated INTEGER NOT NULL,
  allocation_date TIMESTAMP NOT NULL,
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_allocation_source ON payment_allocation (payment_source_type, payment_source_id);
CREATE INDEX idx_payment_allocation_target ON payment_allocation (allocated_to_type, allocated_to_id);
CREATE INDEX idx_payment_allocation_date ON payment_allocation (allocation_date);

-- ==========================================
-- 13. VAT Returns
-- ==========================================

CREATE TABLE IF NOT EXISTS vat_return (
  id SERIAL PRIMARY KEY,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  box1_vat_due_on_sales INTEGER NOT NULL DEFAULT 0,
  box2_vat_due_on_acquisitions INTEGER NOT NULL DEFAULT 0,
  box3_total_vat_due INTEGER NOT NULL DEFAULT 0,
  box4_vat_reclaimed_on_purchases INTEGER NOT NULL DEFAULT 0,
  box5_net_vat INTEGER NOT NULL DEFAULT 0,
  box6_total_sales_excl_vat INTEGER NOT NULL DEFAULT 0,
  box7_total_purchases_excl_vat INTEGER NOT NULL DEFAULT 0,
  box8_total_eu_supplies INTEGER NOT NULL DEFAULT 0,
  box9_total_eu_acquisitions INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP,
  submitted_by INTEGER,
  hmrc_reference TEXT,
  notes TEXT,
  journal_entry_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX vat_return_period_unique ON vat_return (period_start, period_end);
CREATE INDEX idx_vat_return_status ON vat_return (status);

-- ==========================================
-- 14. VAT Return Transactions
-- ==========================================

CREATE TABLE IF NOT EXISTS vat_return_transaction (
  id SERIAL PRIMARY KEY,
  vat_return_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  transaction_id INTEGER NOT NULL,
  net_amount INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL,
  vat_rate_applied NUMERIC NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vat_return_transaction_return ON vat_return_transaction (vat_return_id);
CREATE INDEX idx_vat_return_transaction_ref ON vat_return_transaction (transaction_type, transaction_id);

-- ==========================================
-- 15. Recurring Invoice Templates
-- ==========================================

CREATE TABLE IF NOT EXISTS recurring_invoice_template (
  id SERIAL PRIMARY KEY,
  template_name TEXT NOT NULL,
  invoice_type TEXT NOT NULL,
  customer_type TEXT,
  customer_id INTEGER,
  customer_name TEXT,
  supplier_type TEXT,
  supplier_id INTEGER,
  supplier_name TEXT,
  line_items JSONB NOT NULL,
  property_id INTEGER,
  recurrence_pattern TEXT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  next_generation_date TIMESTAMP,
  last_generated_date TIMESTAMP,
  payment_terms_days INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  auto_send BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_template_active_next ON recurring_invoice_template (is_active, next_generation_date);
CREATE INDEX idx_recurring_template_customer ON recurring_invoice_template (customer_type, customer_id);
CREATE INDEX idx_recurring_template_property ON recurring_invoice_template (property_id);

-- ==========================================
-- BRIDGE COLUMNS ON EXISTING TABLES
-- ==========================================

-- Link existing operational invoices to the accounting system
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS business_invoice_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_invoice_business_invoice ON invoice (business_invoice_id);

-- Link existing property transactions to journal entries
ALTER TABLE property_transaction ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_property_transaction_journal ON property_transaction (journal_entry_id);

-- ==========================================
-- SEED: DEFAULT TAX RATES
-- ==========================================

INSERT INTO tax_rate (name, rate_percentage, tax_type, is_default, is_active) VALUES
  ('Standard Rate 20%', 20, 'vat', true, true),
  ('Reduced Rate 5%', 5, 'vat', false, true),
  ('Zero Rate 0%', 0, 'vat', false, true),
  ('Exempt', 0, 'vat', false, true),
  ('No VAT', 0, 'vat', false, true)
ON CONFLICT DO NOTHING;

-- ==========================================
-- SEED: DEFAULT CHART OF ACCOUNTS
-- ==========================================

INSERT INTO chart_of_account (account_code, account_name, account_type, account_sub_type, is_system_account, is_active) VALUES
  -- Assets
  ('1000', 'Cash at Bank - Client Account', 'asset', 'current_asset', true, true),
  ('1001', 'Cash at Bank - Office Account', 'asset', 'current_asset', true, true),
  ('1010', 'Petty Cash', 'asset', 'current_asset', true, true),
  ('1100', 'Accounts Receivable - Landlords', 'asset', 'current_asset', true, true),
  ('1101', 'Accounts Receivable - Tenants', 'asset', 'current_asset', true, true),
  ('1102', 'Accounts Receivable - Other', 'asset', 'current_asset', true, true),
  ('1200', 'Prepayments', 'asset', 'current_asset', false, true),
  ('1300', 'Tenant Deposits Held', 'asset', 'current_asset', true, true),
  ('1500', 'Office Equipment', 'asset', 'fixed_asset', false, true),
  ('1501', 'Computer Equipment', 'asset', 'fixed_asset', false, true),
  ('1510', 'Accumulated Depreciation', 'asset', 'fixed_asset', false, true),
  -- Liabilities
  ('2000', 'Accounts Payable - Contractors', 'liability', 'current_liability', true, true),
  ('2001', 'Accounts Payable - Other', 'liability', 'current_liability', true, true),
  ('2100', 'VAT Output (Sales)', 'liability', 'current_liability', true, true),
  ('2101', 'VAT Input (Purchases)', 'liability', 'current_liability', true, true),
  ('2102', 'VAT Liability', 'liability', 'current_liability', true, true),
  ('2200', 'PAYE/NI Liability', 'liability', 'current_liability', false, true),
  ('2300', 'Tenant Deposits Liability', 'liability', 'current_liability', true, true),
  ('2400', 'Corporation Tax Liability', 'liability', 'current_liability', false, true),
  ('2500', 'Landlord Funds Held', 'liability', 'current_liability', true, true),
  -- Equity
  ('3000', 'Share Capital', 'equity', 'equity', true, true),
  ('3100', 'Retained Earnings', 'equity', 'equity', true, true),
  ('3200', 'Current Year Profit/Loss', 'equity', 'equity', true, true),
  -- Revenue
  ('4000', 'Management Fee Income', 'revenue', 'income', true, true),
  ('4001', 'Management Fee Income - Full Management', 'revenue', 'income', false, true),
  ('4002', 'Management Fee Income - Let Only', 'revenue', 'income', false, true),
  ('4003', 'Management Fee Income - Tenant Find', 'revenue', 'income', false, true),
  ('4100', 'Letting Commission Income', 'revenue', 'income', true, true),
  ('4200', 'Sales Commission Income', 'revenue', 'income', true, true),
  ('4300', 'Renewal Fee Income', 'revenue', 'income', false, true),
  ('4400', 'Admin Fee Income', 'revenue', 'income', false, true),
  ('4500', 'Inventory/Check-in Fee Income', 'revenue', 'income', false, true),
  ('4600', 'Contractor Markup Income', 'revenue', 'income', false, true),
  ('4900', 'Other Income', 'revenue', 'other_income', false, true),
  ('4910', 'Interest Income', 'revenue', 'other_income', false, true),
  -- Cost of Sales
  ('5000', 'Contractor Costs', 'expense', 'cost_of_sales', true, true),
  ('5100', 'Referral Fees', 'expense', 'cost_of_sales', false, true),
  -- Operating Expenses
  ('6000', 'Staff Salaries', 'expense', 'operating_expense', false, true),
  ('6010', 'Employer NI Contributions', 'expense', 'operating_expense', false, true),
  ('6020', 'Staff Pensions', 'expense', 'operating_expense', false, true),
  ('6100', 'Office Rent', 'expense', 'operating_expense', false, true),
  ('6110', 'Business Rates', 'expense', 'operating_expense', false, true),
  ('6120', 'Office Utilities', 'expense', 'operating_expense', false, true),
  ('6200', 'Insurance', 'expense', 'operating_expense', false, true),
  ('6300', 'Marketing & Advertising', 'expense', 'operating_expense', false, true),
  ('6310', 'Portal Listing Fees', 'expense', 'operating_expense', false, true),
  ('6400', 'Professional Fees - Legal', 'expense', 'operating_expense', false, true),
  ('6410', 'Professional Fees - Accounting', 'expense', 'operating_expense', false, true),
  ('6500', 'Software & IT', 'expense', 'operating_expense', false, true),
  ('6600', 'Telephone & Internet', 'expense', 'operating_expense', false, true),
  ('6700', 'Travel & Motor', 'expense', 'operating_expense', false, true),
  ('6800', 'Depreciation', 'expense', 'operating_expense', false, true),
  ('6900', 'Bank Charges', 'expense', 'operating_expense', false, true),
  -- Other Expenses
  ('7000', 'Bad Debts', 'expense', 'other_expense', false, true),
  ('7100', 'Sundry Expenses', 'expense', 'other_expense', false, true),
  -- Suspense
  ('9000', 'Suspense Account', 'liability', 'current_liability', true, true)
ON CONFLICT (account_code) DO NOTHING;
