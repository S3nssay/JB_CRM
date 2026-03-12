-- Accounting System Tables
-- Bridge columns on existing tables
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS business_invoice_id INTEGER;
ALTER TABLE property_transaction ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER;

-- 1. Business Settings
CREATE TABLE IF NOT EXISTS business_settings (
  id SERIAL PRIMARY KEY,
  financial_year_start INTEGER DEFAULT 4,
  base_currency TEXT DEFAULT 'GBP',
  vat_registered BOOLEAN DEFAULT false,
  vat_number TEXT,
  vat_scheme TEXT,
  flat_rate_percentage DECIMAL,
  default_payment_terms_days INTEGER DEFAULT 30,
  sales_invoice_prefix TEXT DEFAULT 'JBINV',
  sales_invoice_next_number INTEGER DEFAULT 1,
  purchase_invoice_prefix TEXT DEFAULT 'JBPI',
  purchase_invoice_next_number INTEGER DEFAULT 1,
  credit_note_prefix TEXT DEFAULT 'JBCN',
  credit_note_next_number INTEGER DEFAULT 1,
  journal_entry_prefix TEXT DEFAULT 'JE',
  journal_entry_next_number INTEGER DEFAULT 1,
  default_sales_account_id INTEGER,
  default_purchase_account_id INTEGER,
  default_bank_account_id INTEGER,
  accounting_start_date TIMESTAMP,
  logo_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id SERIAL PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  parent_account_id INTEGER,
  is_system_account BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  normal_balance TEXT,
  default_tax_rate_id INTEGER,
  opening_balance INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Tax Rates
CREATE TABLE IF NOT EXISTS tax_rates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rate DECIMAL NOT NULL,
  tax_type TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  effective_from TIMESTAMP,
  effective_to TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Financial Periods
CREATE TABLE IF NOT EXISTS financial_periods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'open',
  period_type TEXT,
  financial_year INTEGER,
  closed_at TIMESTAMP,
  closed_by_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  entry_number TEXT NOT NULL UNIQUE,
  entry_date TIMESTAMP NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT,
  source_id INTEGER,
  financial_period_id INTEGER,
  status TEXT DEFAULT 'draft',
  posted_at TIMESTAMP,
  posted_by_id INTEGER,
  reversed_entry_id INTEGER,
  notes TEXT,
  created_by_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id SERIAL PRIMARY KEY,
  journal_entry_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  description TEXT,
  debit_amount INTEGER DEFAULT 0,
  credit_amount INTEGER DEFAULT 0,
  tax_rate_id INTEGER,
  tax_amount INTEGER DEFAULT 0,
  property_id INTEGER,
  landlord_id INTEGER,
  tenant_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. Business Invoices
CREATE TABLE IF NOT EXISTS business_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  customer_type TEXT,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT,
  customer_vat_number TEXT,
  subtotal INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  property_id INTEGER,
  journal_entry_id INTEGER,
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  voided_at TIMESTAMP,
  pdf_url TEXT,
  notes TEXT,
  internal_notes TEXT,
  created_by_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. Business Invoice Lines
CREATE TABLE IF NOT EXISTS business_invoice_lines (
  id SERIAL PRIMARY KEY,
  business_invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  tax_rate_id INTEGER,
  tax_amount INTEGER DEFAULT 0,
  account_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. Purchase Invoices
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  supplier_type TEXT,
  supplier_id INTEGER,
  supplier_name TEXT NOT NULL,
  supplier_email TEXT,
  supplier_address TEXT,
  supplier_vat_number TEXT,
  invoice_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  property_id INTEGER,
  landlord_id INTEGER,
  is_rechargeable BOOLEAN DEFAULT false,
  recharge_invoice_id INTEGER,
  journal_entry_id INTEGER,
  approved_by_id INTEGER,
  approved_at TIMESTAMP,
  paid_at TIMESTAMP,
  pdf_url TEXT,
  notes TEXT,
  created_by_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. Purchase Invoice Lines
CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id SERIAL PRIMARY KEY,
  purchase_invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  tax_rate_id INTEGER,
  tax_amount INTEGER DEFAULT 0,
  account_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. Credit Notes
CREATE TABLE IF NOT EXISTS credit_notes (
  id SERIAL PRIMARY KEY,
  credit_note_number TEXT NOT NULL UNIQUE,
  credit_note_date TIMESTAMP NOT NULL,
  original_invoice_id INTEGER,
  customer_type TEXT,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  amount_applied INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  reason TEXT,
  journal_entry_id INTEGER,
  notes TEXT,
  created_by_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. Payment Allocations
CREATE TABLE IF NOT EXISTS payment_allocations (
  id SERIAL PRIMARY KEY,
  payment_date TIMESTAMP NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  allocation_type TEXT,
  allocation_id INTEGER,
  bank_account_id INTEGER,
  journal_entry_id INTEGER,
  notes TEXT,
  created_by_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 13. VAT Returns
CREATE TABLE IF NOT EXISTS vat_returns (
  id SERIAL PRIMARY KEY,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  box1_vat_due_sales INTEGER DEFAULT 0,
  box2_vat_due_acquisitions INTEGER DEFAULT 0,
  box3_total_vat_due INTEGER DEFAULT 0,
  box4_vat_reclaimed_input INTEGER DEFAULT 0,
  box5_net_vat_due INTEGER DEFAULT 0,
  box6_total_sales_ex_vat INTEGER DEFAULT 0,
  box7_total_purchases_ex_vat INTEGER DEFAULT 0,
  box8_total_supplies_ex_vat INTEGER DEFAULT 0,
  box9_total_acquisitions_ex_vat INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  submitted_at TIMESTAMP,
  submitted_by_id INTEGER,
  settlement_journal_entry_id INTEGER,
  hmrc_correlation_id TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 14. VAT Return Transactions
CREATE TABLE IF NOT EXISTS vat_return_transactions (
  id SERIAL PRIMARY KEY,
  vat_return_id INTEGER NOT NULL,
  journal_entry_line_id INTEGER NOT NULL,
  box_number INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 15. Recurring Invoice Templates
CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
  id SERIAL PRIMARY KEY,
  template_name TEXT NOT NULL,
  customer_type TEXT,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  day_of_month INTEGER,
  line_items JSON,
  subtotal INTEGER DEFAULT 0,
  vat_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  property_id INTEGER,
  account_id INTEGER,
  tax_rate_id INTEGER,
  next_generation_date TIMESTAMP,
  last_generated_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
