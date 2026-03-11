const { Pool } = require("pg");
require("dotenv").config({ path: "c:/Users/ziaa/Dropbox/ZA/DEV/PROJECTS/JB_CRM/.env" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    // Seed compliance requirements
    const reqs = [
      ["gas_safety", "Gas Safety Certificate (CP12)", "Annual gas safety inspection by Gas Safe registered engineer", "safety", true, false, false, 12, 30],
      ["epc", "Energy Performance Certificate", "Energy efficiency rating for the property", "energy", true, false, false, 120, 90],
      ["eicr", "Electrical Installation Condition Report", "Periodic inspection of fixed electrical installations", "safety", true, false, false, 60, 90],
      ["pat", "Portable Appliance Testing", "Testing of portable electrical appliances", "safety", true, false, false, 12, 30],
      ["fire_safety", "Fire Risk Assessment", "Assessment of fire risks and safety measures", "safety", true, false, false, 12, 30],
      ["legionella", "Legionella Risk Assessment", "Assessment of waterborne bacteria risk", "health", true, false, false, 24, 60],
    ];

    const reqIds = {};
    for (const [code, name, desc, category, prop, ll, ten, freq, reminder] of reqs) {
      const r = await c.query(
        "INSERT INTO compliance_requirement (code, name, description, category, applies_to_property, applies_to_landlord, applies_to_tenant, frequency_months, reminder_days_before, is_active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW()) ON CONFLICT DO NOTHING RETURNING id",
        [code, name, desc, category, prop, ll, ten, freq, reminder]
      );
      if (r.rows.length > 0) {
        reqIds[code] = r.rows[0].id;
        console.log("Requirement:", code, "->", r.rows[0].id);
      } else {
        const existing = await c.query("SELECT id FROM compliance_requirement WHERE code=$1", [code]);
        reqIds[code] = existing.rows[0]?.id;
        console.log("Requirement (existing):", code, "->", reqIds[code]);
      }
    }

    // Seed compliance status for property 853
    const statuses = [
      ["gas_safety", "compliant", "2025-08-15", "2026-08-14", "/uploads/documents/test-gas-safety-certificate.pdf", "GSC-2025-4412"],
      ["epc", "compliant", "2024-03-10", "2034-03-10", "/uploads/documents/test-epc-rating-b.pdf", "EPC-9876-5432"],
      ["eicr", "compliant", "2025-07-20", "2030-07-20", "/uploads/documents/test-eicr-report.pdf", "EICR-2025-RAN12"],
    ];

    for (const [code, status, completed, expiry, docUrl, certNo] of statuses) {
      await c.query(
        "INSERT INTO compliance_status (requirement_id, property_id, landlord_id, status, completed_date, expiry_date, document_url, certificate_number, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())",
        [reqIds[code], 853, 380, status, completed, expiry, docUrl, certNo, code + " for test property"]
      );
      console.log("Status:", code, "-> compliant");
    }

    await c.query("COMMIT");
    console.log("\nCompliance data seeded for property 853");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("FAIL:", e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
main();
