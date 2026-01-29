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
- **IMPORTANT: Use the `properties` table for ALL property operations**
  - Use `isManaged`, `isListedRental`, `isListedSale` flags to filter properties
- Property Management tables: `landlords`, `tenant` (singular), `tenancies`, `tenancyChecklistItems`
- Document storage: `document` table (singular, unified storage for all entity documents)
- Ownership tables: `beneficialOwner` (singular), `corporateOwner` (singular)

### DEPRECATED TABLES - NEVER USE:
- **`pm_properties`** - DEPRECATED, use `properties` table with `isManaged = true`
- **`pm_landlords`** - DEPRECATED, use `landlords` table
- **`pm_tenants`** - DEPRECATED, use `tenant` table (singular)
- **`pm_tenancies`** - DEPRECATED, use `tenancies` table
- **Any table with `pm_` prefix** - These are all deprecated and should NEVER be referenced in new code
- **`contracts`** - DEPRECATED, use `documents` table with appropriate `documentType`
- **`tenancyContracts`** - DEPRECATED, use `tenancies` table instead

### Properties Table - Key Flags:
- `is_managed` - Property is under John Barclay management
- `is_listed_rental` - Property is listed for rental
- `is_listed_sale` - Property is listed for sale

### KNOWN WRONG COLUMN NAMES - NEVER USE THESE:
- `bank_account_no` - WRONG, use `bank_account_number`
- `fullName` or `full_name` - WRONG, use `name`
- `deposit_reference` - WRONG, use `deposit_certificate_number`
- `is_published_on_the_market` - WRONG, use `is_published_onthemarket`

### Properties Table - Publishing Columns (EXACT NAMES):
- `is_published_website`
- `is_published_zoopla`
- `is_published_rightmove`
- `is_published_onthemarket` (NOTE: no underscores in "onthemarket")
- `is_published_social`

## BEFORE ANY CODE THAT USES DATABASE FIELDS (MANDATORY - NO EXCEPTIONS)

**STOP. Before writing ANY code that references database fields, you MUST:**
1. Run a grep/search on schema.ts to get the EXACT column names
2. Copy-paste the column names - DO NOT type them from memory
3. If you cannot find the column, STOP and ask the user

**This applies to ALL code, including:**
- Backend: Raw SQL queries, Drizzle ORM queries
- Backend: API response objects that return database fields
- Frontend: Code that reads fields from API responses
- Frontend: Form fields that map to database columns
- Frontend: Any variable names derived from database column names

**The database schema is the source of truth for ALL field names across the entire stack.**

**If you skip this step, you WILL break the application.**

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

## Tables Schema Reference

### landlords
- id, name, email, phone, mobile, address, address_line1, address_line2, city, postcode
- landlord_type, company_name, company_registration_no, company_vat_no, company_address
- bank_name, bank_account_number, bank_sort_code, bank_account_holder_name
- status, notes, created_at, updated_at

### tenant (NOTE: table name is singular "tenant", not "tenants")
- id, name, email, phone, mobile
- user_id, property_id, landlord_id, tenancy_contract_id, contract_id, rental_agreement_id (FK relationships)
- address, address_line1, address_line2, city, postcode
- emergency_contact_name, emergency_contact_phone, emergency_contact_relationship
- status, notes, created_at, updated_at

### document (NOTE: singular name in Drizzle, DB table is "document")
- id, name, original_name, document_type, description
- mime_type, size, storage_url, storage_provider
- entity_type, entity_id (polymorphic reference)
- property_id, landlord_id, tenant_id, tenancy_id, beneficial_owner_id, corporate_owner_id (direct FK references)
- document_date, expiry_date, status, is_required, is_verified, verified_at, verified_by
- category, version, previous_version_id, uploaded_by
- created_at, updated_at

### beneficialOwner (NOTE: singular name in Drizzle, DB table is "beneficial_owners")
- id, landlord_id, name, date_of_birth, nationality
- address, address_line1, address_line2, city, postcode, country
- ownership_percentage, verification_status, verification_date
- id_document_type, id_document_number, id_document_expiry
- pep_status, sanctions_check_status, notes
- created_at, updated_at

### corporateOwner (NOTE: singular name in Drizzle, DB table is "corporate_owners")
- id, landlord_id, company_name, company_registration_number, company_type
- registered_address, country_of_incorporation, date_of_incorporation
- vat_number, tax_reference, verification_status
- created_at, updated_at

### properties (Main properties table)
- id, address, address_line1, address_line2, city, postcode
- property_type, is_residential, bedrooms, bathrooms, receptions, square_footage
- is_managed, is_listed_rental, is_listed_sale (key flags for filtering)
- landlord_id, vendor_id, property_manager_id, agent_id
- management_type, management_fee_type, management_fee_value, management_start_date
- rent_amount, rent_period, deposit, price, price_qualifier
- is_published_website, is_published_zoopla, is_published_rightmove, is_published_onthemarket, is_published_social
- images, floor_plan, features, amenities, description, title
- status, notes, created_at, updated_at

### tenancy_contracts (Drizzle: tenancyContracts)
- id, property_id, landlord_id, tenant_id
- start_date, end_date, period_months
- rent_amount, rent_frequency
- deposit_amount, deposit_scheme, deposit_certificate_number
- status, created_at, updated_at

### tenancy_checklist_items (Drizzle: tenancyChecklistItems)
- id, tenancy_id, item_type, is_completed, completed_at, document_url, notes

### leads
- id, name, email, phone, mobile
- status (new, contacted, qualified, negotiating, converted, lost)
- source (website, portal, referral, walk_in, phone, social, voice_agent)
- lead_type (buyer, seller, tenant, landlord)
- assigned_agent_id, property_interest_ids
- notes, budget_min, budget_max
- created_at, updated_at, last_contact_at

### Related Lead Tables
- `lead_property_views` - Properties a lead has viewed
- `lead_communications` - Email/SMS/call history
- `lead_viewings` - Scheduled/completed viewings
- `lead_activities` - Activity tracking
- `proactive_leads` - AI-identified potential leads
- `voice_lead_property_interests` - Voice call property discussions

## Key Files

- `server/crmRoutes.ts` - Main API routes
- `server/db.ts` - Database connection pool
- `shared/schema.ts` - Database schema definitions (SOURCE OF TRUTH)
