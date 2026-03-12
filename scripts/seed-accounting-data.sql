-- Seed Default Chart of Accounts (UK property management company)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, is_system_account, normal_balance, description, sort_order) VALUES
-- ASSETS (1xxx)
('1000', 'Current Assets', 'asset', true, 'debit', 'Parent account for current assets', 100),
('1010', 'Business Current Account', 'asset', true, 'debit', 'Main business bank account', 110),
('1020', 'Client Money Account', 'asset', true, 'debit', 'Client funds held in trust', 120),
('1030', 'Petty Cash', 'asset', false, 'debit', 'Petty cash float', 130),
('1100', 'Accounts Receivable', 'asset', true, 'debit', 'Amounts owed by customers', 140),
('1110', 'Accounts Receivable - Landlords', 'asset', false, 'debit', 'Management fees and charges due from landlords', 141),
('1120', 'Accounts Receivable - Tenants', 'asset', false, 'debit', 'Amounts due from tenants', 142),
('1200', 'Prepayments', 'asset', false, 'debit', 'Expenses paid in advance', 150),
('1300', 'Tenant Deposits Held', 'asset', true, 'debit', 'Deposit funds held (matched by liability)', 160),
('1400', 'Fixed Assets', 'asset', true, 'debit', 'Parent for fixed assets', 200),
('1410', 'Office Equipment', 'asset', false, 'debit', 'Computers, furniture, etc.', 210),
('1420', 'Motor Vehicles', 'asset', false, 'debit', 'Company vehicles', 220),
('1430', 'Leasehold Improvements', 'asset', false, 'debit', 'Office fit-out costs', 230),
('1500', 'Accumulated Depreciation', 'asset', false, 'credit', 'Contra asset for depreciation', 250),

-- LIABILITIES (2xxx)
('2000', 'Current Liabilities', 'liability', true, 'credit', 'Parent account for current liabilities', 300),
('2010', 'Accounts Payable', 'liability', true, 'credit', 'Amounts owed to suppliers', 310),
('2020', 'Accounts Payable - Contractors', 'liability', false, 'credit', 'Amounts owed to maintenance contractors', 311),
('2050', 'Accruals', 'liability', false, 'credit', 'Expenses incurred but not yet billed', 320),
('2100', 'VAT Output', 'liability', true, 'credit', 'VAT collected on sales', 330),
('2101', 'VAT Input', 'liability', true, 'debit', 'VAT paid on purchases (contra)', 331),
('2102', 'VAT Net Liability', 'liability', true, 'credit', 'Net VAT due to HMRC', 332),
('2200', 'PAYE and NI Payable', 'liability', false, 'credit', 'Employment taxes due', 340),
('2210', 'Corporation Tax Payable', 'liability', false, 'credit', 'CT due to HMRC', 341),
('2300', 'Tenant Deposits Liability', 'liability', true, 'credit', 'Obligation to return deposits', 350),
('2400', 'Client Money Liability', 'liability', true, 'credit', 'Obligation for client funds held', 360),
('2500', 'Deferred Income', 'liability', false, 'credit', 'Income received in advance', 370),
('2600', 'Long-term Liabilities', 'liability', false, 'credit', 'Parent for long-term debt', 400),
('2610', 'Bank Loans', 'liability', false, 'credit', 'Bank borrowings', 410),

-- EQUITY (3xxx)
('3000', 'Equity', 'equity', true, 'credit', 'Parent equity account', 500),
('3010', 'Share Capital', 'equity', false, 'credit', 'Issued share capital', 510),
('3020', 'Retained Earnings', 'equity', true, 'credit', 'Accumulated profits', 520),
('3030', 'Drawings', 'equity', false, 'debit', 'Owner withdrawals (contra equity)', 530),
('3040', 'Opening Balances', 'equity', true, 'credit', 'Used for accounting start balances', 540),

-- REVENUE (4xxx)
('4000', 'Revenue', 'revenue', true, 'credit', 'Parent revenue account', 600),
('4010', 'Management Fee Income', 'revenue', true, 'credit', 'Monthly property management fees', 610),
('4020', 'Letting Fee Income', 'revenue', false, 'credit', 'Tenant find / letting arrangement fees', 620),
('4030', 'Sales Commission Income', 'revenue', false, 'credit', 'Commission on property sales', 630),
('4040', 'Renewal Fee Income', 'revenue', false, 'credit', 'Tenancy renewal fees', 640),
('4050', 'Inventory/Check-in Fee Income', 'revenue', false, 'credit', 'Check-in/out and inventory fees', 650),
('4060', 'Maintenance Markup Income', 'revenue', false, 'credit', 'Markup on recharged maintenance', 660),
('4070', 'Insurance Commission Income', 'revenue', false, 'credit', 'Commission on insurance products', 670),
('4080', 'Other Income', 'revenue', false, 'credit', 'Miscellaneous revenue', 680),
('4090', 'Interest Income', 'revenue', false, 'credit', 'Bank interest earned', 690),

-- EXPENSES (5xxx-8xxx)
('5000', 'Cost of Sales', 'expense', true, 'debit', 'Parent for direct costs', 700),
('5010', 'Contractor Costs', 'expense', false, 'debit', 'Direct contractor/maintenance costs', 710),
('5020', 'Portal Listing Fees', 'expense', false, 'debit', 'Rightmove, Zoopla, OnTheMarket fees', 720),
('5030', 'Referencing Costs', 'expense', false, 'debit', 'Tenant reference check costs', 730),

('6000', 'Operating Expenses', 'expense', true, 'debit', 'Parent for overheads', 800),
('6010', 'Staff Salaries', 'expense', false, 'debit', 'Employee salaries', 810),
('6020', 'Employer NI Contributions', 'expense', false, 'debit', 'National Insurance employer share', 820),
('6030', 'Pension Contributions', 'expense', false, 'debit', 'Employer pension contributions', 830),
('6040', 'Office Rent', 'expense', false, 'debit', 'Office lease payments', 840),
('6050', 'Office Utilities', 'expense', false, 'debit', 'Electric, gas, water', 850),
('6060', 'Telephone & Internet', 'expense', false, 'debit', 'Communications costs', 860),
('6070', 'Software & IT', 'expense', false, 'debit', 'Software subscriptions and IT costs', 870),
('6080', 'Insurance', 'expense', false, 'debit', 'PI insurance, office insurance', 880),
('6090', 'Marketing & Advertising', 'expense', false, 'debit', 'Advertising and promotion', 890),
('6100', 'Professional Fees', 'expense', false, 'debit', 'Accountancy, legal, consulting', 900),
('6110', 'Travel & Motor Expenses', 'expense', false, 'debit', 'Business travel, fuel, parking', 910),
('6120', 'Printing & Stationery', 'expense', false, 'debit', 'Office supplies', 920),
('6130', 'Depreciation', 'expense', false, 'debit', 'Asset depreciation charge', 930),
('6140', 'Bad Debts', 'expense', false, 'debit', 'Irrecoverable debts written off', 940),
('6150', 'Bank Charges', 'expense', false, 'debit', 'Bank fees and charges', 950),
('6160', 'Sundry Expenses', 'expense', false, 'debit', 'Miscellaneous expenses', 960)

ON CONFLICT (account_code) DO NOTHING;

-- Seed Default Tax Rates (UK VAT)
INSERT INTO tax_rates (name, rate, tax_type, is_default, is_active, description) VALUES
('Standard Rate (20%)', 20.00, 'vat', true, true, 'Standard UK VAT rate'),
('Reduced Rate (5%)', 5.00, 'vat', false, true, 'Reduced rate for domestic energy etc.'),
('Zero Rate (0%)', 0.00, 'vat', false, true, 'Zero-rated supplies'),
('Exempt', 0.00, 'vat', false, true, 'VAT exempt supplies (e.g. residential rent)'),
('No VAT', 0.00, 'vat', false, true, 'Outside scope of VAT')
ON CONFLICT DO NOTHING;

-- Seed initial business settings row
INSERT INTO business_settings (financial_year_start, base_currency, vat_registered)
SELECT 4, 'GBP', false
WHERE NOT EXISTS (SELECT 1 FROM business_settings LIMIT 1);
