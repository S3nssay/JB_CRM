# Business Accounting System — Implementation Plan

## Overview

Add full business accounting to JB_CRM: double-entry bookkeeping, sales/purchase invoices, VAT returns, tax reporting, and a business settings page. This builds on the existing financial infrastructure (rent invoices, bank reconciliation, Stripe/GoCardless payments, landlord statements).

---

## Existing Financial Infrastructure (What We Have)

| Table | Purpose |
|---|---|
| `invoice` | Rent/service invoices to tenants (amounts in pence) |
| `payment` | Payment records (Stripe, GoCardless, bank transfer, cash) |
| `payment_schedule` | Recurring payment schedules |
| `arrears` | Outstanding rent tracking with dunning |
| `dunning_action` | Arrears escalation actions |
| `landlord_statement` | Monthly landlord income statements |
| `statement_line_item` | Line items on landlord statements |
| `property_transaction` | Per-property income/expense (P&L) |
| `bank_transaction` | Imported bank CSV rows for reconciliation |
| `management_fee` | Fee % per property |
| `gocardless_mandate` | Direct debit mandates |
| `gocardless_payment` | Direct debit payment records |
| `system_setting` | Key-value settings store |

**Existing frontend pages:** InvoiceManagement, BankReconciliation, LandlordStatements, RentCollection, ArrearsTracker, DirectDebitManagement, RentReviewManager, PortfolioFinancials

**Existing routes:** `server/financeRoutes.ts` (56KB), relevant sections in `server/crmRoutes.ts`

---

## Phase 1: Foundation — Schema & Business Settings

### 1.1 New Database Tables

All monetary values in **pence** (integer) to match existing convention. Serial IDs, snake_case DB columns, camelCase Drizzle names.

#### `business_settings` — Company information for invoicing & reporting
```
id                          serial PK
company_name                text NOT NULL
trading_name                text
company_registration_number text
vat_number                  text
tax_reference               text          -- UTR number
corporation_tax_reference   text
registered_address_line1    text
registered_address_line2    text
registered_city             text
registered_postcode         text
registered_country          text DEFAULT 'United Kingdom'
contact_email               text
contact_phone               text
website_url                 text
logo_url                    text
bank_name                   text
bank_account_holder_name    text
bank_account_number         text
bank_sort_code              text
bank_iban                   text
vat_scheme                  text DEFAULT 'standard'  -- standard, flat_rate, cash_accounting
vat_flat_rate_percentage    decimal
financial_year_start_month  integer DEFAULT 4         -- April for UK tax year
default_payment_terms_days  integer DEFAULT 30
invoice_prefix              text DEFAULT 'INV'
next_invoice_number         integer DEFAULT 1
credit_note_prefix          text DEFAULT 'CN'
next_credit_note_number     integer DEFAULT 1
purchase_order_prefix       text DEFAULT 'PO'
next_purchase_order_number  integer DEFAULT 1
invoice_footer_text         text
invoice_terms_text          text
created_at                  timestamp NOT NULL DEFAULT now()
updated_at                  timestamp NOT NULL DEFAULT now()
```

#### `chart_of_accounts` — Double-entry account structure
```
id                  serial PK
account_code        text NOT NULL UNIQUE    -- e.g. '1000', '4000'
account_name        text NOT NULL
account_type        text NOT NULL           -- asset, liability, equity, revenue, expense
account_sub_type    text NOT NULL           -- current_asset, fixed_asset, bank, current_liability,
                                            -- long_term_liability, equity, income, cost_of_sales,
                                            -- operating_expense, other_income, other_expense
parent_account_id   integer                 -- FK self-ref for hierarchy
description         text
is_system_account   boolean DEFAULT false   -- protected from deletion
is_active           boolean DEFAULT true
default_tax_rate_id integer                 -- FK tax_rates
opening_balance     integer DEFAULT 0       -- pence
opening_balance_date timestamp
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()
```

**Default seed accounts:**
| Code | Name | Type | Sub-Type |
|------|------|------|----------|
| 1000 | Cash in Hand | asset | current_asset |
| 1100 | Bank Current Account | asset | bank |
| 1101 | Bank Deposit Account | asset | bank |
| 1200 | Accounts Receivable | asset | current_asset |
| 1300 | Prepayments | asset | current_asset |
| 2000 | Accounts Payable | liability | current_liability |
| 2100 | VAT Liability | liability | current_liability |
| 2101 | VAT Input (Reclaimable) | asset | current_asset |
| 2200 | PAYE/NI Payable | liability | current_liability |
| 2300 | Corporation Tax Payable | liability | current_liability |
| 3000 | Share Capital | equity | equity |
| 3100 | Retained Earnings | equity | equity |
| 4000 | Management Fee Income | revenue | income |
| 4100 | Lettings Commission | revenue | income |
| 4200 | Sales Commission | revenue | income |
| 4300 | Other Income | revenue | other_income |
| 4400 | Rent Collected (Client) | revenue | income |
| 5000 | Staff Costs | expense | operating_expense |
| 5100 | Office Rent | expense | operating_expense |
| 5200 | Marketing & Advertising | expense | operating_expense |
| 5300 | Professional Fees | expense | operating_expense |
| 5400 | Software & IT | expense | operating_expense |
| 5500 | Insurance | expense | operating_expense |
| 5600 | Travel & Motor | expense | operating_expense |
| 5700 | Utilities & Telecoms | expense | operating_expense |
| 5800 | Maintenance Costs | expense | cost_of_sales |
| 5900 | Contractor Payments | expense | cost_of_sales |
| 6000 | Depreciation | expense | operating_expense |
| 6100 | Bank Charges | expense | other_expense |
| 6200 | Bad Debts | expense | other_expense |
| 6300 | Sundry Expenses | expense | operating_expense |

#### `tax_rates` — VAT and tax rate definitions
```
id              serial PK
name            text NOT NULL           -- 'Standard Rate', 'Reduced Rate', 'Zero Rate', 'Exempt', 'No VAT'
rate            decimal NOT NULL        -- 20, 5, 0
tax_type        text NOT NULL DEFAULT 'vat'  -- vat, corporation_tax
is_default      boolean DEFAULT false
is_active       boolean DEFAULT true
effective_from  timestamp
effective_to    timestamp
created_at      timestamp NOT NULL DEFAULT now()
```

**Default seed rates:**
| Name | Rate | Type | Default |
|------|------|------|---------|
| Standard Rate (20%) | 20 | vat | true |
| Reduced Rate (5%) | 5 | vat | false |
| Zero Rate (0%) | 0 | vat | false |
| Exempt | 0 | vat | false |
| No VAT | 0 | vat | false |
| Corporation Tax | 25 | corporation_tax | false |
| Small Profits Rate | 19 | corporation_tax | false |

#### `financial_periods` — Monthly/quarterly/annual period management
```
id          serial PK
name        text NOT NULL           -- 'March 2026', 'Q1 2026-27', 'FY 2025-26'
period_type text NOT NULL           -- monthly, quarterly, annual
start_date  timestamp NOT NULL
end_date    timestamp NOT NULL
status      text NOT NULL DEFAULT 'open'  -- open, closing, closed
closed_by   integer                 -- FK user
closed_at   timestamp
notes       text
created_at  timestamp NOT NULL DEFAULT now()
```

#### `journal_entries` — Core double-entry bookkeeping
```
id                  serial PK
entry_number        text NOT NULL UNIQUE    -- auto-generated: 'JE-000001'
entry_date          timestamp NOT NULL
description         text NOT NULL
reference           text                    -- invoice number, payment ref, etc.
source_type         text                    -- manual, sales_invoice, purchase_invoice, payment,
                                            -- bank_transaction, management_fee, rent_collection, credit_note
source_id           integer                 -- polymorphic ref to originating record
status              text NOT NULL DEFAULT 'draft'  -- draft, posted, reversed
reversed_by_id      integer                 -- FK self-ref
reversal_of_id      integer                 -- FK self-ref
financial_period_id integer                 -- FK financial_periods
total_debit         integer NOT NULL DEFAULT 0   -- pence (denormalized for validation)
total_credit        integer NOT NULL DEFAULT 0   -- pence
created_by          integer                 -- FK user
approved_by         integer                 -- FK user
approved_at         timestamp
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()
```

#### `journal_entry_lines` — Individual debit/credit lines
```
id              serial PK
journal_entry_id integer NOT NULL     -- FK journal_entries
line_number     integer NOT NULL
account_id      integer NOT NULL      -- FK chart_of_accounts
description     text
debit_amount    integer DEFAULT 0     -- pence
credit_amount   integer DEFAULT 0     -- pence
tax_rate_id     integer               -- FK tax_rates
tax_amount      integer DEFAULT 0     -- pence
entity_type     text                  -- landlord, tenant, property, contractor
entity_id       integer
created_at      timestamp NOT NULL DEFAULT now()
```
**Index:** `(journal_entry_id)`, `(account_id)`, `(entity_type, entity_id)`

#### `business_invoices` — Sales invoices the agency raises
```
id                  serial PK
invoice_number      text NOT NULL UNIQUE    -- formatted with prefix: 'INV-000042'
invoice_type        text NOT NULL           -- management_fee, lettings_commission, sales_commission,
                                            -- service_charge, professional_fee, other
status              text NOT NULL DEFAULT 'draft'  -- draft, sent, partially_paid, paid, overdue, void, credited
customer_type       text NOT NULL           -- landlord, tenant, vendor, other
customer_id         integer
-- Snapshot fields (frozen at invoice time)
customer_name       text NOT NULL
customer_email      text
customer_address    text
customer_vat_number text
invoice_date        timestamp NOT NULL
due_date            timestamp NOT NULL
subtotal            integer NOT NULL DEFAULT 0   -- pence
vat_amount          integer NOT NULL DEFAULT 0   -- pence
total_amount        integer NOT NULL DEFAULT 0   -- pence
amount_paid         integer NOT NULL DEFAULT 0   -- pence
balance_due         integer NOT NULL DEFAULT 0   -- pence
currency            text DEFAULT 'GBP'
payment_terms_days  integer DEFAULT 30
notes               text
terms_and_conditions text
property_id         integer                 -- optional property ref
tenancy_id          integer                 -- optional tenancy ref
-- Recurrence
is_recurring        boolean DEFAULT false
recurrence_pattern  text                    -- monthly, quarterly, annually
next_recurrence_date timestamp
-- Status dates
sent_at             timestamp
paid_at             timestamp
voided_at           timestamp
voided_reason       text
-- Accounting link
journal_entry_id    integer                 -- FK journal_entries
pdf_url             text
created_by          integer                 -- FK user
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()
```

#### `business_invoice_lines` — Line items on sales invoices
```
id              serial PK
invoice_id      integer NOT NULL      -- FK business_invoices
line_number     integer NOT NULL
description     text NOT NULL
quantity        decimal NOT NULL DEFAULT 1
unit_price      integer NOT NULL      -- pence
discount_percent decimal DEFAULT 0
discount_amount integer DEFAULT 0     -- pence
account_id      integer               -- FK chart_of_accounts (revenue account)
tax_rate_id     integer               -- FK tax_rates
tax_amount      integer DEFAULT 0     -- pence
line_total      integer NOT NULL      -- pence (after discount, before tax)
property_id     integer               -- optional per-line property ref
created_at      timestamp NOT NULL DEFAULT now()
```

#### `purchase_invoices` — Bills from suppliers/contractors
```
id                  serial PK
bill_number         text                    -- supplier's invoice number
internal_reference  text NOT NULL UNIQUE    -- our ref: 'PO-000012'
supplier_type       text NOT NULL           -- contractor, utility, professional_services, insurance, other
supplier_id         integer                 -- FK contractor (nullable)
-- Snapshot
supplier_name       text NOT NULL
supplier_address    text
supplier_vat_number text
status              text NOT NULL DEFAULT 'draft'  -- draft, approved, partially_paid, paid, overdue, void
invoice_date        timestamp NOT NULL
due_date            timestamp NOT NULL
received_date       timestamp
subtotal            integer NOT NULL DEFAULT 0   -- pence
vat_amount          integer NOT NULL DEFAULT 0   -- pence
total_amount        integer NOT NULL DEFAULT 0   -- pence
amount_paid         integer NOT NULL DEFAULT 0   -- pence
balance_due         integer NOT NULL DEFAULT 0   -- pence
payment_terms_days  integer
notes               text
property_id         integer                 -- expense relates to property
landlord_id         integer                 -- rechargeable to landlord
is_rechargeable     boolean DEFAULT false
journal_entry_id    integer                 -- FK journal_entries
pdf_url             text
approved_by         integer                 -- FK user
approved_at         timestamp
created_by          integer                 -- FK user
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()
```

#### `purchase_invoice_lines` — Line items on purchase invoices
```
id                  serial PK
purchase_invoice_id integer NOT NULL  -- FK purchase_invoices
line_number         integer NOT NULL
description         text NOT NULL
quantity            decimal NOT NULL DEFAULT 1
unit_price          integer NOT NULL  -- pence
account_id          integer           -- FK chart_of_accounts (expense account)
tax_rate_id         integer           -- FK tax_rates
tax_amount          integer DEFAULT 0 -- pence
line_total          integer NOT NULL  -- pence
property_id         integer           -- optional per-line property ref
created_at          timestamp NOT NULL DEFAULT now()
```

#### `credit_notes` — Sales or purchase credits
```
id                  serial PK
credit_note_number  text NOT NULL UNIQUE  -- 'CN-000001'
credit_type         text NOT NULL         -- sales_credit, purchase_credit
related_invoice_type text NOT NULL        -- business_invoice, purchase_invoice
related_invoice_id  integer NOT NULL
status              text NOT NULL DEFAULT 'draft'  -- draft, applied, void
credit_date         timestamp NOT NULL
subtotal            integer NOT NULL DEFAULT 0
vat_amount          integer NOT NULL DEFAULT 0
total_amount        integer NOT NULL DEFAULT 0
reason              text
journal_entry_id    integer               -- FK journal_entries
created_by          integer
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()
```

#### `payment_allocations` — Links payments to specific invoices
```
id                  serial PK
payment_source_type text NOT NULL         -- bank_transaction, stripe_payment, gocardless_payment, manual
payment_source_id   integer NOT NULL
allocated_to_type   text NOT NULL         -- business_invoice, purchase_invoice, credit_note, invoice (existing rent)
allocated_to_id     integer NOT NULL
amount              integer NOT NULL      -- pence
allocation_date     timestamp NOT NULL
notes               text
created_by          integer
created_at          timestamp NOT NULL DEFAULT now()
```
**Index:** `(payment_source_type, payment_source_id)`, `(allocated_to_type, allocated_to_id)`

#### `vat_returns` — Quarterly VAT return records
```
id              serial PK
period_start    timestamp NOT NULL
period_end      timestamp NOT NULL
status          text NOT NULL DEFAULT 'draft'  -- draft, calculated, submitted, accepted, rejected
-- HMRC VAT Return boxes
box1_vat_due_sales          integer DEFAULT 0  -- pence
box2_vat_due_acquisitions   integer DEFAULT 0  -- pence (post-Brexit, usually 0)
box3_total_vat_due          integer DEFAULT 0  -- pence (box1 + box2)
box4_vat_reclaimed          integer DEFAULT 0  -- pence
box5_net_vat               integer DEFAULT 0   -- pence (box3 - box4: positive = owe, negative = reclaim)
box6_total_sales_ex_vat    integer DEFAULT 0   -- pence
box7_total_purchases_ex_vat integer DEFAULT 0  -- pence
box8_total_supplies_eu     integer DEFAULT 0   -- pence
box9_total_acquisitions_eu integer DEFAULT 0   -- pence
submitted_at    timestamp
submitted_by    integer               -- FK user
hmrc_reference  text
journal_entry_id integer              -- FK journal_entries
notes           text
created_at      timestamp NOT NULL DEFAULT now()
updated_at      timestamp NOT NULL DEFAULT now()
```

#### `vat_return_transactions` — Transactions included in each VAT return
```
id                  serial PK
vat_return_id       integer NOT NULL      -- FK vat_returns
transaction_type    text NOT NULL         -- sales_invoice, purchase_invoice, credit_note, journal
transaction_id      integer NOT NULL
net_amount          integer NOT NULL      -- pence
vat_amount          integer NOT NULL      -- pence
vat_rate            decimal NOT NULL
created_at          timestamp NOT NULL DEFAULT now()
```

#### `recurring_invoice_templates` — Templates for auto-generated invoices
```
id                  serial PK
template_name       text NOT NULL
invoice_type        text NOT NULL         -- sales, purchase
customer_type       text                  -- landlord, tenant, vendor
customer_id         integer
line_items          json                  -- [{description, quantity, unitPrice, accountId, taxRateId}]
recurrence          text NOT NULL         -- weekly, monthly, quarterly, annually
day_of_month        integer               -- for monthly (1-28)
start_date          timestamp NOT NULL
end_date            timestamp               -- null = indefinite
next_generation_date timestamp
last_generated_date timestamp
is_active           boolean DEFAULT true
auto_send           boolean DEFAULT false
property_id         integer
notes               text
created_by          integer
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()
```

### 1.2 Business Settings Page

**Route:** `/crm/settings/business`
**File:** `client/src/pages/BusinessSettings.tsx`

**Sections:**
1. **Company Information** — Name, trading name, registration number, VAT number, tax references
2. **Registered Address** — Full UK address
3. **Contact Details** — Email, phone, website
4. **Bank Details** — For payment instructions printed on invoices
5. **VAT Configuration** — Scheme selection (standard/flat rate/cash accounting), flat rate %, MTD status
6. **Financial Year** — Start month (default April), current period display
7. **Invoice Numbering** — Prefixes and next numbers for invoices, credit notes, POs
8. **Invoice Defaults** — Payment terms, footer text, terms & conditions
9. **Logo Upload** — Company logo for invoice PDFs

**API Endpoints:**
```
GET    /api/accounting/business-settings
PUT    /api/accounting/business-settings
POST   /api/accounting/business-settings/logo    (multipart upload)
```

### 1.3 Files to Create/Modify

| Action | File |
|--------|------|
| ADD schema | `shared/schema.ts` — Add all 15 new table definitions |
| ADD routes | `server/accountingRoutes.ts` — New route file for all accounting endpoints |
| MODIFY | `server/index.ts` — Register accountingRoutes |
| ADD page | `client/src/pages/BusinessSettings.tsx` |
| MODIFY | `client/src/App.tsx` — Add new routes |

---

## Phase 2: Chart of Accounts & General Ledger

### 2.1 Chart of Accounts Page

**Route:** `/crm/accounting/chart-of-accounts`
**File:** `client/src/pages/ChartOfAccounts.tsx`

**Features:**
- Tree view of accounts grouped by type (Assets, Liabilities, Equity, Revenue, Expenses)
- Add/edit/deactivate accounts
- Set default tax rates per account
- Opening balances
- Prevent deletion of system accounts
- Search and filter

**API Endpoints:**
```
GET    /api/accounting/chart-of-accounts              -- list all, supports ?type= filter
POST   /api/accounting/chart-of-accounts              -- create account
PUT    /api/accounting/chart-of-accounts/:id           -- update account
DELETE /api/accounting/chart-of-accounts/:id           -- soft-delete (deactivate)
POST   /api/accounting/chart-of-accounts/seed          -- seed default accounts
GET    /api/accounting/chart-of-accounts/:id/balance   -- get current balance
```

### 2.2 General Ledger / Journal Entries

**Route:** `/crm/accounting/journal-entries`
**File:** `client/src/pages/JournalEntries.tsx`

**Features:**
- Create manual journal entries (debit/credit pairs)
- Validation: total debits must equal total credits
- Post/reverse entries
- Filter by date range, account, source type
- View individual entry with all lines
- Auto-generated entries shown with source links

**Route:** `/crm/accounting/general-ledger`
**File:** `client/src/pages/GeneralLedger.tsx`

**Features:**
- View all posted transactions for a selected account
- Running balance per account
- Date range filtering
- Export to CSV

**API Endpoints:**
```
GET    /api/accounting/journal-entries                 -- list, filter by date/account/source
POST   /api/accounting/journal-entries                 -- create manual entry
GET    /api/accounting/journal-entries/:id              -- get entry with lines
POST   /api/accounting/journal-entries/:id/post         -- post draft entry
POST   /api/accounting/journal-entries/:id/reverse      -- create reversal entry
GET    /api/accounting/general-ledger/:accountId        -- transactions for an account
```

### 2.3 Financial Periods

**API Endpoints:**
```
GET    /api/accounting/financial-periods
POST   /api/accounting/financial-periods               -- create period
POST   /api/accounting/financial-periods/:id/close      -- close period (prevents new entries)
POST   /api/accounting/financial-periods/generate       -- auto-generate monthly periods for a year
```

### 2.4 Tax Rates Management

**API Endpoints:**
```
GET    /api/accounting/tax-rates
POST   /api/accounting/tax-rates
PUT    /api/accounting/tax-rates/:id
POST   /api/accounting/tax-rates/seed
```

Managed within Business Settings page (tax rates section).

---

## Phase 3: Business Invoicing (Sales & Purchases)

### 3.1 Sales Invoices Page

**Route:** `/crm/accounting/invoices`
**File:** `client/src/pages/BusinessInvoices.tsx`

**Features:**
- **Create Invoice:** Select customer (landlord/tenant/vendor), add line items with descriptions, quantities, unit prices, VAT rates, revenue accounts
- **Line Items:** Each line maps to a chart of accounts revenue code
- **VAT Calculation:** Per-line VAT based on selected rate, totals auto-calculated
- **Invoice Preview:** PDF-style preview before sending
- **Send Invoice:** Email PDF to customer
- **Payment Tracking:** Mark as paid, record partial payments
- **Recurring Invoices:** Set up recurring with pattern (monthly/quarterly/annually)
- **Status Workflow:** Draft → Sent → Partially Paid → Paid (or Void/Credited)
- **Overdue Detection:** Automatic status change when past due date
- **Credit Notes:** Issue credit against an invoice

**Auto-generated invoices:**
- Management fee invoices auto-raised monthly (based on `management_fee` table, calculated as % of rent collected)
- Lettings/sales commission invoices on deal completion

**API Endpoints:**
```
GET    /api/accounting/business-invoices                    -- list with filters
POST   /api/accounting/business-invoices                    -- create invoice
GET    /api/accounting/business-invoices/:id                 -- get invoice with lines
PUT    /api/accounting/business-invoices/:id                 -- update draft invoice
POST   /api/accounting/business-invoices/:id/send            -- send via email
POST   /api/accounting/business-invoices/:id/void            -- void invoice
POST   /api/accounting/business-invoices/:id/record-payment  -- record payment
GET    /api/accounting/business-invoices/:id/pdf              -- generate PDF
POST   /api/accounting/business-invoices/generate-management-fees  -- bulk generate monthly
```

**Accounting integration:**
When an invoice is **posted/sent**, auto-create journal entry:
```
DR  Accounts Receivable (1200)     £1,200.00
    CR  Management Fee Income (4000)     £1,000.00
    CR  VAT Liability (2100)             £  200.00
```

When **payment received:**
```
DR  Bank Current Account (1100)    £1,200.00
    CR  Accounts Receivable (1200)       £1,200.00
```

### 3.2 Purchase Invoices / Bills Page

**Route:** `/crm/accounting/bills`
**File:** `client/src/pages/PurchaseInvoices.tsx`

**Features:**
- Record bills from contractors, suppliers, utilities
- Link to existing contractor records
- Mark as rechargeable to landlord (creates corresponding sales invoice)
- Approval workflow (draft → approved → paid)
- Per-property expense allocation
- Attach PDF/image of original invoice

**API Endpoints:**
```
GET    /api/accounting/purchase-invoices                    -- list with filters
POST   /api/accounting/purchase-invoices                    -- create bill
GET    /api/accounting/purchase-invoices/:id                 -- get bill with lines
PUT    /api/accounting/purchase-invoices/:id                 -- update
POST   /api/accounting/purchase-invoices/:id/approve         -- approve bill
POST   /api/accounting/purchase-invoices/:id/record-payment  -- record payment
POST   /api/accounting/purchase-invoices/:id/recharge        -- create sales invoice to landlord
```

**Accounting integration:**
When a bill is **approved**, auto-create journal entry:
```
DR  Maintenance Costs (5800)       £500.00
DR  VAT Input (2101)               £100.00
    CR  Accounts Payable (2000)          £600.00
```

When **payment made:**
```
DR  Accounts Payable (2000)        £600.00
    CR  Bank Current Account (1100)      £600.00
```

### 3.3 Credit Notes

**API Endpoints:**
```
GET    /api/accounting/credit-notes
POST   /api/accounting/credit-notes                        -- create credit note
POST   /api/accounting/credit-notes/:id/apply              -- apply to invoice
```

### 3.4 Payment Allocations

**API Endpoints:**
```
GET    /api/accounting/payment-allocations                  -- list allocations
POST   /api/accounting/payment-allocations                  -- allocate payment to invoice
DELETE /api/accounting/payment-allocations/:id               -- remove allocation
GET    /api/accounting/payment-allocations/unallocated       -- payments not yet allocated
```

### 3.5 Recurring Invoice Templates

**API Endpoints:**
```
GET    /api/accounting/recurring-templates
POST   /api/accounting/recurring-templates
PUT    /api/accounting/recurring-templates/:id
DELETE /api/accounting/recurring-templates/:id
POST   /api/accounting/recurring-templates/run               -- manually trigger generation
```

**Scheduler:** Add to `schedulerService.ts` — daily check for templates where `next_generation_date <= today`, auto-generate invoices.

---

## Phase 4: VAT Returns & Tax Reporting

### 4.1 VAT Returns Page

**Route:** `/crm/accounting/vat-returns`
**File:** `client/src/pages/VATReturns.tsx`

**Features:**
- View quarterly VAT periods (auto-generated based on financial year)
- **Calculate VAT return:** Pulls all sales invoices, purchase invoices, credit notes, and manual journal entries for the period
- **9-box VAT return** matching HMRC format
- Drill-down: click any box to see constituent transactions
- Submit status tracking
- Manual adjustment capability
- Historical returns list
- Print/export VAT return summary

**VAT Calculation Logic:**
- **Box 1:** Sum of VAT on all sales invoices + manual VAT journals (output tax)
- **Box 2:** VAT on EU acquisitions (typically £0 post-Brexit)
- **Box 3:** Box 1 + Box 2
- **Box 4:** Sum of VAT on all purchase invoices + manual input VAT journals (input tax)
- **Box 5:** Box 3 - Box 4 (positive = owe HMRC, negative = reclaim)
- **Box 6:** Total net sales (ex-VAT)
- **Box 7:** Total net purchases (ex-VAT)
- **Box 8/9:** EU trade (typically £0)

**API Endpoints:**
```
GET    /api/accounting/vat-returns                         -- list all returns
POST   /api/accounting/vat-returns                         -- create return period
GET    /api/accounting/vat-returns/:id                      -- get return with details
POST   /api/accounting/vat-returns/:id/calculate            -- calculate/recalculate
POST   /api/accounting/vat-returns/:id/submit               -- mark as submitted
GET    /api/accounting/vat-returns/:id/transactions          -- drill-down transactions
POST   /api/accounting/vat-returns/generate-periods          -- auto-generate quarterly periods
```

**Accounting integration:**
When a VAT return is submitted, create journal entry:
```
If owing HMRC (Box 5 positive):
DR  VAT Liability (2100)           £X
    CR  VAT Input (2101)                 £Y
    CR  VAT Payable (new sub-account)    £(X-Y)

If reclaiming (Box 5 negative):
DR  VAT Liability (2100)           £X
DR  VAT Receivable                 £(Y-X)
    CR  VAT Input (2101)                 £Y
```

### 4.2 Tax Reports Page

**Route:** `/crm/accounting/tax-reports`
**File:** `client/src/pages/TaxReports.tsx`

**Features:**
- **Corporation Tax Estimate:** Based on P&L for the financial year, apply current rate (25% / 19% small profits)
- **Annual Tax Summary:** Revenue, allowable expenses, taxable profit, estimated tax
- **VAT Summary:** Annual overview of all quarterly returns
- **Tax Calendar:** Key dates (VAT quarters, corporation tax payment, annual return)

**API Endpoints:**
```
GET    /api/accounting/tax-reports/corporation-tax?year=2025-26
GET    /api/accounting/tax-reports/annual-summary?year=2025-26
GET    /api/accounting/tax-reports/vat-annual-summary?year=2025-26
GET    /api/accounting/tax-reports/tax-calendar
```

---

## Phase 5: Financial Reports

### 5.1 Profit & Loss Statement

**Route:** `/crm/accounting/reports/profit-loss`
**File:** `client/src/pages/ProfitAndLoss.tsx`

**Layout:**
```
Revenue
  Management Fee Income          £XX,XXX
  Lettings Commission            £XX,XXX
  Sales Commission               £XX,XXX
  Other Income                   £XX,XXX
                                 --------
  Total Revenue                  £XX,XXX

Cost of Sales
  Maintenance Costs              £XX,XXX
  Contractor Payments            £XX,XXX
                                 --------
  Total Cost of Sales            £XX,XXX

GROSS PROFIT                     £XX,XXX

Operating Expenses
  Staff Costs                    £XX,XXX
  Office Rent                    £XX,XXX
  Marketing & Advertising        £XX,XXX
  ...
                                 --------
  Total Operating Expenses       £XX,XXX

NET PROFIT BEFORE TAX            £XX,XXX
  Corporation Tax                £XX,XXX
NET PROFIT AFTER TAX             £XX,XXX
```

**Features:**
- Date range selector (month, quarter, year, custom)
- Comparison mode (this period vs last period, vs same period last year)
- Drill-down: click any line to see constituent journal entries
- Export to PDF/CSV

### 5.2 Balance Sheet

**Route:** `/crm/accounting/reports/balance-sheet`
**File:** `client/src/pages/BalanceSheet.tsx`

**Layout:**
```
ASSETS
  Current Assets
    Bank Current Account         £XX,XXX
    Accounts Receivable          £XX,XXX
    VAT Input (Reclaimable)      £XX,XXX
    Prepayments                  £XX,XXX
                                 --------
    Total Current Assets         £XX,XXX

  Fixed Assets
    ...
                                 --------
  TOTAL ASSETS                   £XX,XXX

LIABILITIES
  Current Liabilities
    Accounts Payable             £XX,XXX
    VAT Liability                £XX,XXX
    PAYE/NI Payable              £XX,XXX
    Corporation Tax Payable      £XX,XXX
                                 --------
    Total Current Liabilities    £XX,XXX

  TOTAL LIABILITIES              £XX,XXX

EQUITY
  Share Capital                  £XX,XXX
  Retained Earnings              £XX,XXX
                                 --------
  TOTAL EQUITY                   £XX,XXX

TOTAL LIABILITIES + EQUITY       £XX,XXX
```

### 5.3 Trial Balance

**Route:** `/crm/accounting/reports/trial-balance`
**File:** `client/src/pages/TrialBalance.tsx`

All accounts with their debit/credit balances. Must balance (total debits = total credits).

### 5.4 Aged Debtors Report

**Route:** `/crm/accounting/reports/aged-debtors`
**File:** `client/src/pages/AgedDebtors.tsx`

Outstanding sales invoices grouped by customer, aged into buckets: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days.

### 5.5 Aged Creditors Report

**Route:** `/crm/accounting/reports/aged-creditors`
**File:** `client/src/pages/AgedCreditors.tsx`

Outstanding purchase invoices grouped by supplier, same ageing buckets.

### 5.6 Cash Flow Statement

**Route:** `/crm/accounting/reports/cash-flow`
**File:** `client/src/pages/CashFlowStatement.tsx`

Bank account movements categorized: Operating, Investing, Financing activities.

**API Endpoints for all reports:**
```
GET    /api/accounting/reports/profit-loss?from=&to=&compare=
GET    /api/accounting/reports/balance-sheet?as_at=
GET    /api/accounting/reports/trial-balance?as_at=
GET    /api/accounting/reports/aged-debtors?as_at=
GET    /api/accounting/reports/aged-creditors?as_at=
GET    /api/accounting/reports/cash-flow?from=&to=
```

---

## Phase 6: Integration with Existing System

### 6.1 Bridge Existing Financial Data → Accounting

**Automatic journal entry generation from existing operations:**

| Existing Event | Journal Entry |
|---|---|
| Rent invoice created (`invoice` table) | DR Accounts Receivable / CR Rent Collected (Client) |
| Rent payment received (`payment` table) | DR Bank / CR Accounts Receivable |
| Management fee calculated | DR Accounts Receivable (landlord) / CR Management Fee Income + CR VAT Liability |
| Bank transaction matched (`bank_transaction`) | Creates corresponding journal via payment allocation |
| GoCardless payment collected | DR Bank / CR Accounts Receivable |
| Stripe payment collected | DR Bank / CR Accounts Receivable |
| Maintenance expense paid | DR Maintenance Costs / CR Bank |
| Landlord statement generated | No new entry (summary of existing entries for period) |

### 6.2 Modifications to Existing Code

| File | Change |
|------|--------|
| `server/financeRoutes.ts` | Add hooks to create journal entries when invoices/payments are created |
| `server/crmRoutes.ts` | Add hooks for management fee invoice generation |
| `server/schedulerService.ts` | Add daily recurring invoice generation, overdue invoice detection |
| `client/src/pages/BankReconciliation.tsx` | Add "Create Journal Entry" action when matching transactions |
| `client/src/pages/InvoiceManagement.tsx` | Link to accounting journal entries |

### 6.3 Navigation Updates

Add new **Accounting** section to CRM sidebar navigation:

```
📊 Accounting
  ├── Business Settings      /crm/settings/business
  ├── Chart of Accounts       /crm/accounting/chart-of-accounts
  ├── Sales Invoices          /crm/accounting/invoices
  ├── Purchase Invoices       /crm/accounting/bills
  ├── Credit Notes            /crm/accounting/credit-notes
  ├── Journal Entries         /crm/accounting/journal-entries
  ├── General Ledger          /crm/accounting/general-ledger
  ├── Bank Reconciliation     /crm/bank-reconciliation (existing)
  ├── VAT Returns             /crm/accounting/vat-returns
  ├── Tax Reports             /crm/accounting/tax-reports
  └── Reports
      ├── Profit & Loss       /crm/accounting/reports/profit-loss
      ├── Balance Sheet        /crm/accounting/reports/balance-sheet
      ├── Trial Balance        /crm/accounting/reports/trial-balance
      ├── Aged Debtors         /crm/accounting/reports/aged-debtors
      ├── Aged Creditors       /crm/accounting/reports/aged-creditors
      └── Cash Flow            /crm/accounting/reports/cash-flow
```

---

## Implementation Order

| Phase | What | New Files | Estimated Scope |
|-------|------|-----------|-----------------|
| **1** | Schema + Business Settings | schema.ts additions, accountingRoutes.ts, BusinessSettings.tsx | Foundation |
| **2** | Chart of Accounts + Journal Entries + Tax Rates | ChartOfAccounts.tsx, JournalEntries.tsx, GeneralLedger.tsx | Core bookkeeping |
| **3** | Sales & Purchase Invoices + Credit Notes | BusinessInvoices.tsx, PurchaseInvoices.tsx | Revenue/expense tracking |
| **4** | VAT Returns + Tax Reporting | VATReturns.tsx, TaxReports.tsx | Tax compliance |
| **5** | Financial Reports | ProfitAndLoss.tsx, BalanceSheet.tsx, TrialBalance.tsx, AgedDebtors/Creditors.tsx, CashFlowStatement.tsx | Reporting |
| **6** | Integration hooks | Modify financeRoutes.ts, crmRoutes.ts, schedulerService.ts | Auto journal entries |

---

## Key Design Decisions

1. **All amounts in pence (integer)** — Matches existing convention, avoids floating point issues
2. **Double-entry bookkeeping** — Every transaction has balanced debit/credit entries via `journal_entries` + `journal_entry_lines`
3. **Separate `business_invoices` from existing `invoice`** — Existing `invoice` table handles rent invoices and is tightly coupled to tenants/properties. New `business_invoices` handles agency sales invoices (management fees, commissions, service charges). Both generate journal entries.
4. **Snapshot customer details on invoices** — Customer name/address frozen at invoice time so historical invoices remain accurate even if customer details change
5. **VAT-first design** — Every line item has a tax rate, enabling accurate quarterly VAT returns
6. **Financial periods** — Prevent backdating entries into closed periods
7. **Rechargeable expenses** — Purchase invoices can be marked rechargeable, auto-generating a corresponding sales invoice to the landlord
8. **UK-specific** — VAT scheme options (standard, flat rate, cash accounting), corporation tax rates, HMRC 9-box return format, April financial year default
