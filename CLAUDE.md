# Project: JB_CRM

## CRITICAL: Following These Rules

**These rules are mandatory and must be followed exactly.** Before ANY action:
1. Re-read the relevant section of this file
2. Follow each step in order - do not skip steps
3. If a rule says "NEVER" or "ALWAYS", there are NO exceptions
4. If unsure, ASK the user rather than guessing

**Failure to follow these rules wastes time and causes production errors.**

---

## Code Migration & Conversion Rules

When converting code patterns (e.g., ORM to raw SQL, renaming columns, changing APIs):

1. **Search the ENTIRE codebase first** - Before making any changes, search for ALL instances of the pattern using grep/search
2. **List every instance** - Document every file and line number where the pattern exists
3. **Convert ALL instances** - Fix every single occurrence before reporting the task complete
4. **Verify with final search** - Run a final grep/search to confirm ZERO instances of the old pattern remain
5. **Never fix reactively** - When an error reveals a pattern issue, immediately search for and fix ALL instances of that pattern, not just the one that caused the error

## Verification Requirements

After any code migration or conversion task:
- Run grep/search to confirm zero remaining instances of the old pattern
- Test the affected endpoints/functionality
- Only mark the task complete after verification passes

## Multi-Step Work Requirements

For any task involving multiple similar changes:
1. Create a numbered checklist of ALL items BEFORE starting
2. Check off each item as completed
3. Do not skip items or mark task complete until all items are checked

## Database & Schema Rules

- This project uses PostgreSQL with Drizzle ORM
- Use Drizzle ORM for queries - it provides type safety when used correctly
- PM (Property Management) tables use the `pm_` prefix: `pm_landlords`, `pm_tenants`, `pm_properties`, `pm_tenancies`, `pm_tenancy_checklist`

### KNOWN WRONG COLUMN NAMES - NEVER USE THESE:
- `bank_account_no` - WRONG, use `bank_account_number`
- `fullName` or `full_name` - WRONG, use `name`
- `deposit_reference` - WRONG, use `deposit_certificate_number`

## BEFORE ANY DATABASE OPERATION (MANDATORY - NO EXCEPTIONS)

### For ANY database query:
1. Run: `grep "pgTable.*table_name" shared/schema.ts` to find the table definition
2. Copy the EXACT column names from the schema output
3. Use ONLY those names in your query
4. If unsure about a column name, ASK - do not guess

### For ANY schema change (adding/modifying columns):

**STEP 1: Query the LIVE database first**
```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'TABLE_NAME' ORDER BY ordinal_position\")
  .then(r => { console.log(r.rows); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
"
```

**STEP 2: Read the schema.ts definition**
```bash
grep -A 30 "pgTable.*TABLE_NAME" shared/schema.ts
```

**STEP 3: Compare database vs schema**
- List columns that exist in DB but not in schema
- List columns that exist in schema but not in DB
- ONLY proceed when you understand the differences

**STEP 4: Make changes**
- If adding a column: Add to schema.ts, then run `npm run db:push` or direct SQL
- If column already exists in DB but not schema: Add to schema.ts only
- If column exists in schema but not DB: Run migration only

**STEP 5: Verify**
- Re-run the database query from Step 1
- Confirm the column now exists with correct type

### NEVER DO THIS:
- Assume a column exists or doesn't exist
- Add columns to schema without checking DB first
- Run migrations without knowing current DB state
- Skip any of the above steps

### CRITICAL: Code Must Only Reference Existing Columns

**You must NEVER write code that references a column that does not exist in the database.**

If you need to use a column that doesn't exist:
1. STOP writing code immediately
2. Update the database schema (schema.ts)
3. Run the migration (`npm run db:push` or direct SQL)
4. VERIFY the column exists by querying the database
5. ONLY THEN continue writing code that uses that column

**The order is always: Schema first, verify, then code. Never code first.**

This is non-negotiable. Assuming database state without verification is unacceptable and causes production errors.

## Pre-Commit Check

Before committing any database-related code, verify no wrong column names exist:
```bash
# This should return NO matches - if it does, fix them first
grep -r "bank_account_no\|\.fullName\|full_name" server/
```

## PM Tables Schema Reference

### pm_landlords
- id, name, email, phone, mobile, address, address_line1, address_line2, city, postcode
- landlord_type, company_name, company_registration_no, company_vat_no, company_address
- bank_name, bank_account_number, bank_sort_code, bank_account_holder_name
- status, notes, created_at, updated_at

### pm_tenants
- id, name, email, phone, mobile
- address, address_line1, address_line2, city, postcode
- emergency_contact_name, emergency_contact_phone, emergency_contact_relationship
- status, notes, created_at, updated_at

### pm_properties
- id, address, address_line1, address_line2, city, postcode
- property_type, property_category, bedrooms, bathrooms
- landlord_id, is_managed, is_listed_rental, is_listed_sale
- management_fee_type, management_fee_value, management_start_date
- status, created_at, updated_at

### pm_tenancies
- id, property_id, landlord_id, tenant_id
- start_date, end_date, period_months
- rent_amount, rent_frequency
- deposit_amount, deposit_scheme, deposit_certificate_number
- status, created_at, updated_at

### pm_tenancy_checklist
- id, tenancy_id, item_type, is_completed, completed_at, document_url, notes

## Key Files

- `server/crmRoutes.ts` - Main API routes
- `server/db.ts` - Database connection pool
- `shared/schema.ts` - Database schema definitions (SOURCE OF TRUTH)
