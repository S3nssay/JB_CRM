const { Pool } = require("pg");
const { scrypt, randomBytes } = require("crypto");
const { promisify } = require("util");
require("dotenv").config({ path: "c:/Users/ziaa/Dropbox/ZA/DEV/PROJECTS/JB_CRM/.env" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sa = promisify(scrypt);

async function hp(p) {
  const s = randomBytes(16).toString("hex");
  const b = await sa(p, s, 64);
  return b.toString("hex") + "." + s;
}

async function main() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    // 1. LANDLORD
    let r = await c.query(
      "INSERT INTO landlord (name,email,phone,mobile,landlord_type,address_line1,address_line2,city,postcode,bank_name,bank_account_number,bank_sort_code,bank_account_holder_name,is_active,status,notes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14,$15,NOW(),NOW()) RETURNING id",
      ["Mr James Test-Landlord","james.landlord@test.com","020 7946 0001","07700 900001","individual","45 Maida Vale","Flat 3","London","W9 1SD","HSBC UK","12345678","40-01-01","James Test-Landlord","active","Test landlord"]
    );
    const lid = r.rows[0].id;
    console.log("Landlord:", lid);

    // 2. PROPERTY
    r = await c.query(
      "INSERT INTO property (address_line1,address_line2,city,postcode,property_type,bedrooms,bathrooms,receptions,is_managed,is_listed,is_rental,landlord_id,management_type,management_fee_type,management_fee_value,management_start_date,rent_amount,deposit,status,description,title,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,false,true,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW()) RETURNING id",
      ["12 Randolph Avenue","Garden Flat","London","W9 1BJ","flat",2,1,1,lid,"full","percentage",12,"2025-06-01",220000,253846,"active","2-bed garden flat in Maida Vale","2 Bed Garden Flat Randolph Avenue"]
    );
    const pid = r.rows[0].id;
    console.log("Property:", pid);

    // 3. TENANT USER
    r = await c.query('SELECT id FROM "user" WHERE username=$1', ["tenant"]);
    let tuid;
    if (r.rows.length > 0) {
      tuid = r.rows[0].id;
      await c.query('UPDATE "user" SET full_name=$1, email=$2 WHERE id=$3', ["Sarah Test-Tenant","sarah.tenant@test.com",tuid]);
    } else {
      const h = await hp("tenant123");
      r = await c.query('INSERT INTO "user" (username,password,email,full_name,role) VALUES ($1,$2,$3,$4,$5) RETURNING id', ["tenant",h,"sarah.tenant@test.com","Sarah Test-Tenant","tenant"]);
      tuid = r.rows[0].id;
    }
    await c.query("UPDATE tenant SET user_id=NULL WHERE user_id=$1", [tuid]);
    console.log("User:", tuid);

    // 4. TENANT RECORD
    r = await c.query(
      "INSERT INTO tenant (name,email,phone,mobile,user_id,property_id,landlord_id,address_line1,address_line2,city,postcode,employer,job_title,annual_income,move_in_date,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,id_verified,status,notes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true,$19,$20,NOW(),NOW()) RETURNING id",
      ["Sarah Test-Tenant","sarah.tenant@test.com","020 7946 0002","07700 900002",tuid,pid,lid,"12 Randolph Avenue","Garden Flat","London","W9 1BJ","Acme Corp Ltd","Marketing Manager",55000,"2025-09-01","John Emergency","07700 900099","Brother","active","Test tenant"]
    );
    const tid = r.rows[0].id;
    console.log("Tenant:", tid);

    // 5. TENANCY CONTRACT
    r = await c.query(
      "INSERT INTO tenancy_contract (property_id,landlord_id,tenant_id,start_date,end_date,period_months,is_periodic,rent_amount,rent_frequency,deposit_amount,deposit_held_by,deposit_protection_scheme,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING id",
      [pid,lid,tid,"2025-09-01","2026-09-01",12,2200,"Calendar Monthly",2538.46,"John Barclay","TDS","active"]
    );
    const cid = r.rows[0].id;
    console.log("Contract:", cid);
    await c.query("UPDATE tenant SET tenancy_contract_id=$1 WHERE id=$2", [cid,tid]);

    // 6. TENANCY (full details)
    r = await c.query(
      "INSERT INTO tenancy (property_id,landlord_id,tenant_id,start_date,end_date,period_months,is_periodic,rent_amount,rent_frequency,rent_due_day,deposit_amount,deposit_scheme,deposit_holder_type,deposit_certificate_number,deposit_protected_date,guarantor_name,guarantor_email,guarantor_phone,guarantor_address,tenancy_type,status,notes,break_clause_date,break_clause_notice_period,special_terms,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW()) RETURNING id",
      [pid,lid,tid,"2025-09-01","2026-09-01",12,2200,"monthly",1,2538.46,"TDS","agency_custodial","TDS-2025-JB-00123","2025-09-15","Robert Test-Guarantor","robert.guarantor@test.com","07700 900003","78 Elgin Ave W9 2HP","ast","active","12-month AST with break clause","2026-03-01",2,"Pet allowed. No smoking."]
    );
    const tnid = r.rows[0].id;
    console.log("Tenancy:", tnid);

    // 7. CHECKLIST ITEMS (19 types)
    const items = [
      ["tenancy_agreement",true,"Signed by both parties 28/08/2025"],
      ["notices",true,"Section 21 and How to Rent guide served"],
      ["guarantors_agreement",true,"Signed by Robert Test-Guarantor"],
      ["inventory",true,"Full inventory by ABC Inventories"],
      ["authorization_to_landlord",true,"Signed authorization for managing agent"],
      ["terms_and_conditions_to_landlord",true,"T&Cs sent and acknowledged"],
      ["information_sheet_to_landlord",true,"Landlord info sheet provided"],
      ["deposits_and_rent",true,"First month rent + deposit received"],
      ["standing_order",true,"SO set up for 1st of each month"],
      ["deposit_protection_tds",true,"Protected with TDS cert TDS-2025-JB-00123"],
      ["deposit_protection_dps",false,"N/A - using TDS"],
      ["deposit_held_by_landlord",false,"N/A - held by agency"],
      ["gas_safety_certificate",true,"Valid until 14/08/2026"],
      ["work_reference",true,"Confirmed employment at Acme Corp"],
      ["bank_reference",true,"Satisfactory reference from Barclays"],
      ["previous_landlord_reference",true,"Good reference no arrears"],
      ["tenants_id",true,"Passport verified Right to Rent passed"],
      ["keys_given_to_tenant",true,"2 sets of keys given on move-in"],
      ["spare_keys_in_office",true,"1 spare set at JB office"]
    ];
    for (const [t,d,n] of items) {
      await c.query(
        "INSERT INTO tenancy_checklist_item (tenancy_id,item_type,is_completed,completed_at,notes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())",
        [cid,t,d,d?"2025-09-01":null,n]
      );
    }
    console.log("Checklist:", items.length);

    // 8. DOCUMENTS (15)
    const docs = [
      ["Tenancy Agreement","tenancy_agreement","tenancy",tnid,"tenancy","AST 12 months from Sep 2025","2025-08-28","2026-09-01"],
      ["Inventory Report","inventory","tenancy",tnid,"tenancy","Full check-in inventory with photos","2025-09-01",null],
      ["Check-In Report","check_in","tenancy",tnid,"tenancy","Condition report at move-in","2025-09-01",null],
      ["Gas Safety Certificate 2025","gas_safety","property",pid,"compliance","Annual gas safety check","2025-08-15","2026-08-14"],
      ["EPC Rating B","epc","property",pid,"compliance","Energy Performance Certificate B (82)","2024-03-10","2034-03-10"],
      ["EICR Report 2025","eicr","property",pid,"compliance","EICR Satisfactory","2025-07-20","2030-07-20"],
      ["Passport - Sarah","passport","tenant",tid,"identity","British passport verified","2025-08-25","2033-05-15"],
      ["Proof of Address","proof_of_address","tenant",tid,"identity","Thames Water utility bill","2025-08-25",null],
      ["Work Reference - Acme Corp","reference","tenant",tid,"references","Employment confirmed by Acme Corp HR","2025-08-20",null],
      ["Bank Reference - Barclays","reference","tenant",tid,"references","Satisfactory bank reference","2025-08-22",null],
      ["Previous Landlord Reference","reference","tenant",tid,"references","Good reference from prev landlord","2025-08-18",null],
      ["Landlord ID","id_document","landlord",lid,"identity","Passport copy for KYC/AML","2025-06-01","2031-11-20"],
      ["Management Agreement","other","landlord",lid,"management","Full management agreement","2025-06-01",null],
      ["Deposit Protection Certificate","certificate","tenancy",tnid,"financial","TDS cert TDS-2025-JB-00123","2025-09-15",null],
      ["Standing Order Confirmation","other","tenant",tid,"financial","SO confirmation from bank","2025-09-01",null]
    ];
    for (const [nm,dt,et,eid,cat,desc,dd,exp] of docs) {
      await c.query(
        "INSERT INTO document (name,original_name,document_type,size,storage_url,entity_type,entity_id,property_id,landlord_id,tenant_id,tenancy_id,status,description,document_date,expiry_date,mime_type,storage_provider,created_at,updated_at) VALUES ($1,$1,$2,1024,'/uploads/documents/test-' || $1 || '.pdf',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())",
        [nm,dt,et,eid,pid,lid,tid,tnid,"active",desc,dd,exp,"application/pdf","local"]
      );
    }
    console.log("Documents:", docs.length);

    // 9. SUPPORT TICKET
    await c.query(
      "INSERT INTO support_ticket (tenant_id,property_id,ticket_number,category,subject,description,priority,status,workflow_status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())",
      [tid,pid,"JB260308TEST","maintenance_issue","Kitchen tap leaking","Kitchen mixer tap drips constantly. Worse on hot water side. Water pooling under sink.","high","open","new"]
    );
    console.log("Support ticket created");

    await c.query("COMMIT");
    console.log("\n========================================");
    console.log("TEST SCENARIO CREATED SUCCESSFULLY");
    console.log("========================================");
    console.log("Landlord:", lid, "- Mr James Test-Landlord");
    console.log("Property:", pid, "- 12 Randolph Avenue, W9 1BJ");
    console.log("Tenant User:", tuid, "- login: tenant / tenant123");
    console.log("Tenant:", tid, "- Sarah Test-Tenant");
    console.log("Contract:", cid);
    console.log("Tenancy:", tnid);
    console.log("Checklist: 19 items (17 done, 2 N/A)");
    console.log("Documents: 15");
    console.log("Ticket: JB260308TEST");
    console.log("========================================");

  } catch(e) {
    await c.query("ROLLBACK");
    console.error("ROLLED BACK:", e.message);
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

main();
