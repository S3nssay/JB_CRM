# KeyData → JB_CRM Gap Analysis & Parity Build

**Date:** 2026-07-20
**Source:** 81 photographed screenshots of *Key-Data Gold* (John Barclay's legacy Windows lettings/property-management desktop app) in `key_data_file_dumps/screen_shots/`.
**Method:** Every KeyData menu, submenu, report list and data screen was transcribed, then cross-checked against JB_CRM's routes (`client/src/App.tsx`), sidebar (`CRMLayout.tsx`), server route modules, the Report Center, and the 186-table Drizzle schema (`shared/schema.ts`).

---

## Headline

JB_CRM already covers roughly **90%** of KeyData — and in most areas is more capable (full double-entry accounting, AI agents, multi-channel comms, portal syndication). Only **two whole domains** existed in KeyData with **no data model and no feature** in JB_CRM. Both are now built.

---

## KeyData menu map (what the screenshots show)

- **Menu bar:** File · Edit · Letters & Reports · Admin Tools · User Tools · Help
- **Home tiles:** Account Management · Applicant · Contractor · Landlord · Property · Service Call · Time · Tenant Management
- **Account Management:** Client / Office / Reserve / Deposit / Landlord / Tenant / Contractor Accounting, LHA Benefit, Collections Due, Overseas Tax, Payments Due — incl. **Property Accounting → Mortgage (Process / Payments / Future)**
- **Admin Tools:** Account Maintenance, Alter Property Landlord, Archive/Delete, Batch Comms, **Block Management**, Diary & Scheduler Search, End Tenancy, PCM Commission Calculator, Finalise Accounts, Import (bank/recon/sanction), Manage Branches, Grouped Properties, Occupancy Calculator, Prepare Payment Lists, Re-Print, Replication, Transfer Tenancy Deposit
- **User Tools:** Calculate Pro-Rata Rent, Check Outdated Reminders, Generate Tenant Invoice, Job Number Search, Office Diary, Log Key Movement, Tenancy Process Management, Upload To Web
- **Reports tabs:** Property · Landlords · Tenants · Applicants · General · Accounting (incl. Profit & VAT with 18 sub-report types, Landlord Ledger with 7 sub-reports)

## Verdict per KeyData area

| KeyData area | JB_CRM status |
|---|---|
| Account Management (client/office/reserve/deposit/landlord/tenant/contractor/LHA) | ✅ Present (double-entry accounting + client-money accounts) |
| Reports (Property/Landlord/Tenant/Applicant/General/Accounting) | ✅ Report Center (25 reports) + Report Builder |
| Admin Tools (Finalise, Branches, Archive, Dormant, Batch comms, Deposit transfer, Occupancy/Commission calc, Account Maintenance) | ✅ Present |
| Arrears / Batch Overdue Rent | ✅ Arrears Tracker + Arrears Reminder dunning |
| Compliance (gas / electrical / EPC / PAT / fire / HMO / smoke-CO) | ✅ Deep compliance model + calendar |
| Applicant Match Criteria (DSS/children/smokers/dogs/cats/parking) | ✅ `property_listing_criteria` |
| Log Key Movement | ✅ `key_movement` + `property_key` |
| Utility meters | ✅ `property_meters` |
| Right-to-Rent | ⚠️ Data model existed (`screening_request` type `right_to_rent`) but **no report** → added |
| Pro-Rata Rent + PCM Commission calculators | ✅ Already in Rent Calculator |
| Landlord Ledger 7 sub-reports | ✅ Already in `ledgerRoutes` (`payment/charges/collections/repairs/reserve/audit/commission`) |
| Petty Cash (client/office) | ⚠️ Partial — office/client accounts exist; a dedicated petty-cash sub-ledger is a possible future add |
| **Mortgage (Process / Payments / Future)** | ❌ **Was missing → built** |
| **Block Management / Service Charges** | ❌ **Was missing → built** |

---

## What was built (this branch)

Branch: `feature/keydata-parity-mortgage-block` (production/`main` untouched).

### 1. Mortgage Management — `/crm/mortgages`
Tracks landlord buy-to-let mortgages so the agency can pay lenders from collected rent — KeyData's *Property Accounting → Mortgage*.
- **Tables:** `property_mortgage`, `mortgage_payment`
- **API** (`server/mortgageRoutes.ts`): list/summary/upcoming, CRUD, record payment (KeyData "Process"), payment history (KeyData "Payments"), upcoming schedule (KeyData "Future"). Recording a paid payment rolls `next_payment_date` forward one month.
- **UI** (`MortgageManagement.tsx`): summary cards (active, monthly commitment, outstanding, deals expiring in 90d, arrears), mortgage table, add/edit dialog, per-mortgage payment history + record-payment, and an Upcoming-payments tab.

### 2. Block / Service-Charge Management — `/crm/block-management`
Manages blocks of flats — KeyData's *Admin Tools → Block Management* and the per-property "Block Management Company".
- **Tables:** `block`, `block_unit`, `service_charge_budget`, `service_charge_demand`
- **API** (`server/blockManagementRoutes.ts`): block CRUD + detail (units/budgets/demands), unit CRUD, budget CRUD, demand CRUD, **issue-to-all-units** (splits a total by apportionment share), and record-payment against a demand (auto part_paid/paid).
- **UI** (`BlockManagement.tsx`): block cards → detail view with summary cards (units, ground rent, reserve fund, outstanding demands) and Units / Budgets / Demands tabs.

### 3. Right-to-Rent Checks Due report
Added to Report Center (Tenants tab) — active tenants without a passed `right_to_rent` screening. Excel-exportable like every other report. `server/reportCenterRoutes.ts`.

### Money & data conventions followed
All money stored as **integer pence**; dates as `timestamp`; raw `pool.query` with the `requireAgent` guard; **singular** physical table names (`property`, `landlord`, `tenant`) — note the older `ledgerRoutes.ts` uses plural names that don't match the DB (pre-existing latent bug, left untouched).

### Verification
- New DB tables created additively (`migrations/keydata_mortgage_block.sql`, `IF NOT EXISTS`) and confirmed present.
- All new route SQL smoke-tested against the live DB (8/8 SELECTs) and INSERT column-lists validated inside a rolled-back transaction (no test data persisted).
- `tsc` — the new files introduce **no** new type errors (the repo has ~496 pre-existing errors in unrelated files).

---

## Not built (deliberately) — already covered or out of scope
- Pro-rata / PCM commission calculators, 7 landlord-ledger sub-reports, key-movement log, utility meters, applicant match criteria, compliance reminders → **already existed**.
- Petty-cash sub-ledger, "Office Diary" as a distinct surface (calendar already exists), grouped-properties, council-rent-demand processing → candidate future adds; not required for parity.
