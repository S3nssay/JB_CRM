const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const UPLOAD_DIR = path.join(__dirname, "../uploads/documents");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function createPDF(filename, contentFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const filepath = path.join(UPLOAD_DIR, filename);
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    contentFn(doc);
    doc.end();
    stream.on("finish", () => {
      const stats = fs.statSync(filepath);
      resolve({ filepath, size: stats.size, url: "/uploads/documents/" + filename });
    });
    stream.on("error", reject);
  });
}

function header(doc, title, subtitle) {
  doc.fontSize(10).fillColor("#666").text("JOHN BARCLAY", { align: "center" });
  doc.fontSize(8).text("Estate & Management", { align: "center" });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#8B5CF6");
  doc.moveDown(0.5);
  doc.fontSize(18).fillColor("#1a1a1a").text(title, { align: "center" });
  if (subtitle) doc.fontSize(11).fillColor("#666").text(subtitle, { align: "center" });
  doc.moveDown(1);
}

function field(doc, label, value) {
  doc.fontSize(9).fillColor("#666").text(label, { continued: true });
  doc.fillColor("#1a1a1a").text("  " + value);
  doc.moveDown(0.3);
}

function section(doc, title) {
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#8B5CF6").text(title);
  doc.moveTo(50, doc.y).lineTo(300, doc.y).stroke("#ddd");
  doc.moveDown(0.3);
  doc.fillColor("#1a1a1a").fontSize(10);
}

function footer(doc, text) {
  doc.moveDown(2);
  doc.fontSize(8).fillColor("#999").text(text || "John Barclay Estate & Management | 020 7224 8884 | www.johnbarclay.co.uk", { align: "center" });
  doc.text("This document is confidential and intended for the named recipient only.", { align: "center" });
}

async function generateAll() {
  const docs = [];

  // =============================================
  // 1. TENANCY AGREEMENT
  // =============================================
  const tenancyAgreement = await createPDF("test-tenancy-agreement.pdf", (doc) => {
    header(doc, "ASSURED SHORTHOLD TENANCY AGREEMENT", "Under the Housing Act 1988 (as amended)");

    section(doc, "Parties");
    field(doc, "Landlord:", "Mr James Test-Landlord");
    field(doc, "Landlord Address:", "45 Maida Vale, Flat 3, London W9 1SD");
    field(doc, "Tenant:", "Sarah Test-Tenant");
    field(doc, "Managing Agent:", "John Barclay Estate & Management");

    section(doc, "Property");
    field(doc, "Address:", "12 Randolph Avenue, Garden Flat, London W9 1BJ");
    field(doc, "Type:", "2 Bedroom Flat");
    field(doc, "Furnishing:", "Unfurnished");

    section(doc, "Term");
    field(doc, "Start Date:", "1 September 2025");
    field(doc, "End Date:", "1 September 2026");
    field(doc, "Period:", "12 Months (Fixed Term AST)");
    field(doc, "Break Clause:", "6 months from commencement, 2 months notice required");

    section(doc, "Rent");
    field(doc, "Monthly Rent:", "£2,200.00 pcm");
    field(doc, "Payment Date:", "1st of each calendar month");
    field(doc, "Payment Method:", "Standing Order");
    field(doc, "Bank:", "John Barclay Client Account, HSBC");
    field(doc, "Sort Code:", "40-03-19");
    field(doc, "Account:", "71842356");

    section(doc, "Deposit");
    field(doc, "Amount:", "£2,538.46 (5 weeks rent)");
    field(doc, "Scheme:", "Tenancy Deposit Scheme (TDS)");
    field(doc, "Holder:", "John Barclay (Custodial)");
    field(doc, "Certificate No:", "TDS-2025-JB-00123");

    section(doc, "Guarantor");
    field(doc, "Name:", "Robert Test-Guarantor");
    field(doc, "Address:", "78 Elgin Avenue, London W9 2HP");
    field(doc, "Contact:", "07700 900003 / robert.guarantor@test.com");

    section(doc, "Special Terms");
    doc.fontSize(10).text("1. The Tenant may keep one small pet (cat) with prior written consent from the Landlord.");
    doc.text("2. No smoking is permitted on the premises.");
    doc.text("3. The Tenant agrees to maintain the garden area in reasonable condition.");
    doc.text("4. Professional cleaning of the property is required at end of tenancy.");

    doc.moveDown(2);
    section(doc, "Signatures");
    doc.fontSize(10).text("Landlord: ____________________     Date: 28/08/2025");
    doc.moveDown(0.5);
    doc.text("Tenant:   ____________________     Date: 28/08/2025");
    doc.moveDown(0.5);
    doc.text("Witness:  ____________________     Date: 28/08/2025");

    footer(doc);
  });
  docs.push({ id: 4, ...tenancyAgreement, name: "test-tenancy-agreement.pdf" });

  // =============================================
  // 2. INVENTORY REPORT
  // =============================================
  const inventory = await createPDF("test-inventory-report.pdf", (doc) => {
    header(doc, "INVENTORY & SCHEDULE OF CONDITION", "Check-In Report");

    field(doc, "Property:", "12 Randolph Avenue, Garden Flat, London W9 1BJ");
    field(doc, "Date:", "1 September 2025");
    field(doc, "Clerk:", "ABC Inventories Ltd");
    field(doc, "Tenant Present:", "Yes - Sarah Test-Tenant");

    const rooms = [
      { name: "Entrance Hall", items: ["Walls: Magnolia emulsion, good condition", "Flooring: Oak laminate, good condition, minor scratch by door", "Lighting: Ceiling pendant, working", "Smoke alarm: Tested and working", "Door: White gloss, good condition"] },
      { name: "Living Room", items: ["Walls: Light grey emulsion, good condition", "Flooring: Oak laminate, good condition", "Windows: Double glazed sash, good condition, blinds fitted", "Radiator: Working, no marks", "Fireplace: Decorative, sealed, good condition", "Light switch: Working, no marks"] },
      { name: "Kitchen", items: ["Units: White gloss, good condition", "Worktop: Grey quartz, good condition", "Oven: Bosch integrated, clean, working", "Hob: 4-burner gas, clean, working", "Fridge/Freezer: Bosch, clean, working", "Dishwasher: Integrated Bosch, working", "Sink: Stainless steel mixer tap, good condition", "Flooring: Ceramic tiles, good condition", "Extractor: Working"] },
      { name: "Bedroom 1 (Master)", items: ["Walls: White emulsion, good condition", "Flooring: Carpet, beige, good condition", "Windows: Double glazed sash, curtains fitted", "Wardrobe: Built-in double, good condition", "Radiator: Working"] },
      { name: "Bedroom 2", items: ["Walls: Light blue emulsion, good condition", "Flooring: Carpet, beige, good condition", "Windows: Double glazed, blinds fitted", "Radiator: Working"] },
      { name: "Bathroom", items: ["Bath: White acrylic with shower over, good condition", "Basin: White ceramic, pedestal, good condition", "WC: White, close coupled, working", "Tiles: White metro, floor to ceiling, good condition", "Mirror: Wall-mounted, good condition", "Towel rail: Chrome heated, working", "Flooring: Ceramic tiles, good condition", "Extractor fan: Working"] },
      { name: "Garden", items: ["Patio: Flagstone, good condition", "Lawn: Well maintained", "Fencing: Wooden panel, good condition", "Shed: Small wooden, fair condition, key provided"] },
    ];

    for (const room of rooms) {
      section(doc, room.name);
      for (const item of room.items) {
        doc.fontSize(9).text("  • " + item);
      }
    }

    section(doc, "Meter Readings");
    field(doc, "Electric:", "45,231 kWh");
    field(doc, "Gas:", "12,847 m³");
    field(doc, "Water:", "Metered - 1,234 m³");

    section(doc, "Keys Provided");
    doc.fontSize(9).text("  • 2 x Front door keys (Yale)");
    doc.text("  • 2 x Mortice lock keys");
    doc.text("  • 1 x Garden shed key");
    doc.text("  • 1 x Mailbox key");

    doc.moveDown(1);
    doc.fontSize(10).text("Tenant Signature: ____________________     Date: 01/09/2025");
    doc.moveDown(0.5);
    doc.text("Clerk Signature:  ____________________     Date: 01/09/2025");
    footer(doc);
  });
  docs.push({ id: 5, ...inventory, name: "test-inventory-report.pdf" });

  // =============================================
  // 3. CHECK-IN REPORT
  // =============================================
  const checkin = await createPDF("test-checkin-report.pdf", (doc) => {
    header(doc, "CHECK-IN REPORT", "Property Condition at Commencement of Tenancy");

    field(doc, "Property:", "12 Randolph Avenue, Garden Flat, London W9 1BJ");
    field(doc, "Date:", "1 September 2025");
    field(doc, "Tenant:", "Sarah Test-Tenant");
    field(doc, "Agent:", "John Barclay Estate & Management");

    section(doc, "Property Condition Summary");
    doc.fontSize(10).text("The property was inspected on 1 September 2025 and found to be in good overall condition, consistent with the inventory prepared by ABC Inventories Ltd.");
    doc.moveDown(0.5);
    doc.text("All appliances were tested and confirmed working. Heating system tested satisfactorily. Hot and cold water supply confirmed throughout the property.");

    section(doc, "Items Noted");
    doc.fontSize(9).text("  • Minor scratch on hallway laminate flooring near front door (noted in inventory)");
    doc.text("  • Small paint touch-up needed on bedroom 2 window frame (cosmetic only)");
    doc.text("  • Garden shed door slightly stiff - WD40 applied");

    section(doc, "Safety Checks Confirmed");
    doc.fontSize(9).text("  ✓ Smoke alarms tested - all working (hallway, kitchen, both bedrooms)");
    doc.text("  ✓ Carbon monoxide detector tested - working (kitchen)");
    doc.text("  ✓ Gas Safety Certificate valid until 14/08/2026");
    doc.text("  ✓ EPC Rating B (82) - valid until 10/03/2034");
    doc.text("  ✓ EICR satisfactory - valid until 20/07/2030");

    section(doc, "Documents Provided to Tenant");
    doc.fontSize(9).text("  ✓ How to Rent Guide (current edition)");
    doc.text("  ✓ Gas Safety Certificate (copy)");
    doc.text("  ✓ EPC (copy)");
    doc.text("  ✓ Deposit Protection Certificate (TDS-2025-JB-00123)");
    doc.text("  ✓ Tenancy Agreement (signed copy)");
    doc.text("  ✓ Inventory Report");

    section(doc, "Keys Handed Over");
    doc.fontSize(9).text("Set 1: 2 x Yale, 2 x Mortice, 1 x Shed, 1 x Mailbox");
    doc.text("Set 2: 2 x Yale, 2 x Mortice");
    doc.text("Spare set retained at John Barclay office: 1 x Yale, 1 x Mortice");

    doc.moveDown(1);
    doc.fontSize(10).text("Tenant: ____________________     Date: 01/09/2025");
    doc.moveDown(0.5);
    doc.text("Agent:  ____________________     Date: 01/09/2025");
    footer(doc);
  });
  docs.push({ id: 6, ...checkin, name: "test-checkin-report.pdf" });

  // =============================================
  // 4. GAS SAFETY CERTIFICATE
  // =============================================
  const gasSafety = await createPDF("test-gas-safety-certificate.pdf", (doc) => {
    header(doc, "GAS SAFETY RECORD", "Gas Safety (Installation and Use) Regulations 1998");

    doc.rect(50, doc.y, 495, 25).fill("#f0f0f0");
    doc.fillColor("#333").fontSize(11).text("  LANDLORD'S GAS SAFETY RECORD (CP12)", 55, doc.y + 7);
    doc.moveDown(1.5);

    section(doc, "Property Details");
    field(doc, "Address:", "12 Randolph Avenue, Garden Flat, London W9 1BJ");
    field(doc, "Landlord:", "Mr James Test-Landlord");
    field(doc, "Managing Agent:", "John Barclay Estate & Management");

    section(doc, "Engineer Details");
    field(doc, "Name:", "David Smith");
    field(doc, "Company:", "British Gas Services");
    field(doc, "Gas Safe No:", "123456");
    field(doc, "ID Card Expiry:", "15/03/2027");

    section(doc, "Inspection Details");
    field(doc, "Date of Inspection:", "15 August 2025");
    field(doc, "Next Inspection Due:", "14 August 2026");
    field(doc, "Certificate Reference:", "GSC-2025-4412");

    section(doc, "Appliances Tested");
    doc.fontSize(9);
    doc.text("Appliance 1: Vaillant ecoTEC Plus 832 Combi Boiler");
    doc.text("  Location: Kitchen utility cupboard");
    doc.text("  Flue Type: Room sealed");
    doc.text("  Operating Pressure: 20 mbar | Gas Rate: 2.83 m³/h");
    doc.text("  Safety Devices: All satisfactory");
    doc.text("  Result: PASS");
    doc.moveDown(0.5);
    doc.text("Appliance 2: Belling 4-burner Gas Hob");
    doc.text("  Location: Kitchen");
    doc.text("  Flame supervision: All burners satisfactory");
    doc.text("  Result: PASS");

    section(doc, "Overall Assessment");
    doc.rect(50, doc.y, 495, 30).fill("#d4edda");
    doc.fillColor("#155724").fontSize(14).text("  SATISFACTORY", 55, doc.y + 8);
    doc.fillColor("#1a1a1a");
    doc.moveDown(1.5);
    doc.fontSize(9).text("All gas appliances and flues have been tested and found to be safe for continued use.");

    doc.moveDown(1);
    doc.fontSize(10).text("Engineer Signature: ____________________     Date: 15/08/2025");
    footer(doc);
  });
  docs.push({ id: 7, ...gasSafety, name: "test-gas-safety-certificate.pdf" });

  // =============================================
  // 5. EPC CERTIFICATE
  // =============================================
  const epc = await createPDF("test-epc-rating-b.pdf", (doc) => {
    header(doc, "ENERGY PERFORMANCE CERTIFICATE", "Non-Domestic and Domestic Buildings");

    field(doc, "Address:", "12 Randolph Avenue, Garden Flat, London W9 1BJ");
    field(doc, "Date of Assessment:", "10 March 2024");
    field(doc, "Valid Until:", "10 March 2034");
    field(doc, "Certificate Number:", "9876-5432-1098-7654-3210");
    field(doc, "Assessor:", "Michael Green BSc (Hons) MRICS");
    field(doc, "Accreditation:", "Elmhurst Energy");

    section(doc, "Energy Rating");
    doc.moveDown(0.5);
    const ratings = [
      { band: "A", range: "92+", color: "#008054", width: 180 },
      { band: "B", range: "81-91", color: "#19b459", width: 210 },
      { band: "C", range: "69-80", color: "#8dce46", width: 240 },
      { band: "D", range: "55-68", color: "#ffd500", width: 270 },
      { band: "E", range: "39-54", color: "#fcaa65", width: 300 },
      { band: "F", range: "21-38", color: "#ef8023", width: 330 },
      { band: "G", range: "1-20", color: "#e9153b", width: 360 },
    ];
    let y = doc.y;
    for (const r of ratings) {
      doc.rect(50, y, r.width, 20).fill(r.color);
      doc.fillColor("#fff").fontSize(10).text(r.band + " (" + r.range + ")", 55, y + 5);
      if (r.band === "B") {
        doc.rect(r.width + 55, y, 60, 20).fill("#333");
        doc.fillColor("#fff").fontSize(10).text("82 | B", r.width + 60, y + 5);
      }
      y += 24;
    }
    doc.y = y + 10;
    doc.fillColor("#1a1a1a");

    section(doc, "Property Summary");
    field(doc, "Type:", "Ground floor flat");
    field(doc, "Total Floor Area:", "72 m²");
    field(doc, "Main Heating:", "Gas combi boiler (Vaillant ecoTEC Plus)");
    field(doc, "Hot Water:", "From main system");
    field(doc, "Windows:", "Double glazed throughout");
    field(doc, "Walls:", "Solid brick with internal insulation");

    section(doc, "Recommendations");
    doc.fontSize(9).text("  • Loft insulation (if accessible) - potential saving £50/year");
    doc.text("  • Smart heating controls - potential saving £75/year");
    doc.text("  • LED lighting throughout - potential saving £30/year");

    footer(doc);
  });
  docs.push({ id: 8, ...epc, name: "test-epc-rating-b.pdf" });

  // =============================================
  // 6. EICR REPORT
  // =============================================
  const eicr = await createPDF("test-eicr-report.pdf", (doc) => {
    header(doc, "ELECTRICAL INSTALLATION CONDITION REPORT", "BS 7671 - IET Wiring Regulations");

    field(doc, "Property:", "12 Randolph Avenue, Garden Flat, London W9 1BJ");
    field(doc, "Date of Inspection:", "20 July 2025");
    field(doc, "Next Inspection Due:", "20 July 2030");
    field(doc, "Report Reference:", "EICR-2025-RAN12");

    section(doc, "Inspector Details");
    field(doc, "Name:", "Paul Johnson");
    field(doc, "Company:", "London Electrical Contractors Ltd");
    field(doc, "Registration No:", "NICEIC/E/12345");
    field(doc, "Qualification:", "City & Guilds 2391-52");

    section(doc, "Installation Details");
    field(doc, "Type of Supply:", "Single phase 230V AC");
    field(doc, "Consumer Unit:", "Hager 10-way, RCD protected");
    field(doc, "Earthing:", "TN-S");
    field(doc, "No. of Circuits:", "8");

    section(doc, "Overall Assessment");
    doc.rect(50, doc.y, 495, 30).fill("#d4edda");
    doc.fillColor("#155724").fontSize(14).text("  SATISFACTORY", 55, doc.y + 8);
    doc.fillColor("#1a1a1a");
    doc.moveDown(1.5);

    section(doc, "Circuit Schedule");
    const circuits = [
      ["C1", "Lighting Ground Floor", "B6", "Pass"],
      ["C2", "Ring Main - Living/Bedrooms", "B32", "Pass"],
      ["C3", "Ring Main - Kitchen", "B32", "Pass"],
      ["C4", "Cooker", "B32", "Pass"],
      ["C5", "Shower (Electric)", "B40", "Pass"],
      ["C6", "Boiler", "B6", "Pass"],
      ["C7", "Smoke/CO Alarms", "B6", "Pass"],
      ["C8", "Garden External", "B16", "Pass"],
    ];
    doc.fontSize(8).text("Circuit  | Description                    | MCB    | Result");
    doc.text("---------|--------------------------------|--------|-------");
    for (const [num, desc, mcb, result] of circuits) {
      doc.text(num.padEnd(9) + "| " + desc.padEnd(31) + "| " + mcb.padEnd(7) + "| " + result);
    }

    section(doc, "Observations");
    doc.fontSize(9).text("No Code 1 (Danger present), Code 2 (Potentially dangerous), or Code 3 (improvement recommended) observations recorded.");
    doc.moveDown(0.5);
    doc.text("FI (Further Investigation) items: None");

    doc.moveDown(1);
    doc.fontSize(10).text("Inspector Signature: ____________________     Date: 20/07/2025");
    footer(doc);
  });
  docs.push({ id: 9, ...eicr, name: "test-eicr-report.pdf" });

  // =============================================
  // 7. PASSPORT (Tenant ID)
  // =============================================
  const passport = await createPDF("test-passport-sarah.pdf", (doc) => {
    header(doc, "IDENTITY VERIFICATION RECORD", "Right to Rent Check - Immigration Act 2014");

    section(doc, "Document Verified");
    field(doc, "Document Type:", "British Passport");
    field(doc, "Passport Number:", "543218765");
    field(doc, "Full Name:", "SARAH JANE TEST-TENANT");
    field(doc, "Date of Birth:", "15 May 1992");
    field(doc, "Place of Birth:", "London");
    field(doc, "Nationality:", "British Citizen");
    field(doc, "Issue Date:", "20 May 2023");
    field(doc, "Expiry Date:", "15 May 2033");

    section(doc, "Right to Rent Verification");
    doc.rect(50, doc.y, 495, 30).fill("#d4edda");
    doc.fillColor("#155724").fontSize(12).text("  RIGHT TO RENT CONFIRMED", 55, doc.y + 8);
    doc.fillColor("#1a1a1a");
    doc.moveDown(1.5);

    field(doc, "Verification Date:", "25 August 2025");
    field(doc, "Verified By:", "Jane Williams, John Barclay");
    field(doc, "Follow-up Date:", "N/A (British Citizen - no expiry)");

    section(doc, "Notes");
    doc.fontSize(9).text("Original passport presented in person. Copy taken and filed. Document appears genuine. Photo matches person presenting. No further checks required for British Citizen.");

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#999").text("[REDACTED PASSPORT COPY - Original held on secure file]", { align: "center" });
    footer(doc);
  });
  docs.push({ id: 10, ...passport, name: "test-passport-sarah.pdf" });

  // =============================================
  // 8. PROOF OF ADDRESS
  // =============================================
  const proofAddr = await createPDF("test-proof-of-address.pdf", (doc) => {
    header(doc, "PROOF OF ADDRESS VERIFICATION", "Document Record");

    section(doc, "Document Details");
    field(doc, "Document Type:", "Utility Bill (Water)");
    field(doc, "Provider:", "Thames Water");
    field(doc, "Bill Date:", "15 July 2025");
    field(doc, "Account Holder:", "Sarah Test-Tenant");
    field(doc, "Address on Bill:", "43 Sutherland Avenue, Flat 2, London W9 2QR");

    section(doc, "Verification");
    field(doc, "Verified By:", "Jane Williams, John Barclay");
    field(doc, "Verification Date:", "25 August 2025");
    field(doc, "Notes:", "Utility bill dated within 3 months. Previous address confirmed.");

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#999").text("[COPY OF UTILITY BILL ON FILE]", { align: "center" });
    footer(doc);
  });
  docs.push({ id: 11, ...proofAddr, name: "test-proof-of-address.pdf" });

  // =============================================
  // 9. WORK REFERENCE
  // =============================================
  const workRef = await createPDF("test-work-reference.pdf", (doc) => {
    header(doc, "EMPLOYMENT REFERENCE", "Confidential");

    doc.fontSize(10).text("To Whom It May Concern,");
    doc.moveDown(0.5);
    doc.text("Re: Sarah Test-Tenant - Employment Reference");
    doc.moveDown(0.5);
    doc.text("I write to confirm the following details regarding the above-named individual:");
    doc.moveDown(0.5);

    field(doc, "Employee Name:", "Sarah Test-Tenant");
    field(doc, "Position:", "Marketing Manager");
    field(doc, "Employment Start Date:", "March 2021");
    field(doc, "Employment Status:", "Permanent, Full-Time");
    field(doc, "Annual Salary:", "£55,000");
    field(doc, "Employer:", "Acme Corp Ltd");
    field(doc, "Address:", "100 Oxford Street, London W1D 1LL");

    doc.moveDown(0.5);
    doc.fontSize(10).text("Ms Test-Tenant has been a reliable and valued member of our team. Her employment is on a permanent basis and we have no reason to believe this will change in the foreseeable future.");
    doc.moveDown(0.5);
    doc.text("Should you require any further information, please do not hesitate to contact us.");
    doc.moveDown(1);
    doc.text("Yours faithfully,");
    doc.moveDown(0.5);
    doc.text("Helen Roberts");
    doc.text("Head of Human Resources");
    doc.text("Acme Corp Ltd");
    doc.text("hr@acmecorp.example.com");
    doc.text("Date: 20 August 2025");
    footer(doc);
  });
  docs.push({ id: 12, ...workRef, name: "test-work-reference.pdf" });

  // =============================================
  // 10. BANK REFERENCE
  // =============================================
  const bankRef = await createPDF("test-bank-reference.pdf", (doc) => {
    header(doc, "BANK REFERENCE", "Confidential - Barclays Bank plc");

    doc.fontSize(10).text("Our Ref: BR/2025/ST/45678");
    doc.text("Date: 22 August 2025");
    doc.moveDown(0.5);
    doc.text("To: John Barclay Estate & Management");
    doc.moveDown(0.5);
    doc.text("Re: Sarah Test-Tenant");
    doc.moveDown(0.5);
    doc.text("In response to your enquiry, we confirm the following:");
    doc.moveDown(0.5);

    field(doc, "Customer Name:", "Ms Sarah J Test-Tenant");
    field(doc, "Account Type:", "Personal Current Account");
    field(doc, "Account Held Since:", "2018");
    field(doc, "Conduct of Account:", "Satisfactory");

    doc.moveDown(0.5);
    doc.text("We consider Ms Test-Tenant good for the rental commitment of £2,200 per calendar month.");
    doc.moveDown(0.5);
    doc.text("This reference is given in strict confidence and without responsibility on the part of the Bank.");
    doc.moveDown(1);
    doc.text("For and on behalf of Barclays Bank plc");
    doc.text("Credit References Department");
    footer(doc);
  });
  docs.push({ id: 13, ...bankRef, name: "test-bank-reference.pdf" });

  // =============================================
  // 11. PREVIOUS LANDLORD REFERENCE
  // =============================================
  const landlordRef = await createPDF("test-previous-landlord-reference.pdf", (doc) => {
    header(doc, "PREVIOUS LANDLORD REFERENCE", "Confidential");

    doc.fontSize(10).text("Date: 18 August 2025");
    doc.moveDown(0.5);
    doc.text("To: John Barclay Estate & Management");
    doc.moveDown(0.5);
    doc.text("Re: Sarah Test-Tenant - Tenant Reference for 43 Sutherland Avenue, Flat 2, London W9 2QR");
    doc.moveDown(0.5);

    field(doc, "Tenant Name:", "Sarah Test-Tenant");
    field(doc, "Property:", "43 Sutherland Avenue, Flat 2, London W9 2QR");
    field(doc, "Tenancy Period:", "September 2022 to August 2025 (3 years)");
    field(doc, "Rent:", "£1,800 pcm");

    section(doc, "Reference Questions");
    doc.fontSize(10);
    doc.text("Was rent always paid on time?  Yes");
    doc.text("Were there any rent arrears?  No");
    doc.text("Was the property maintained in good condition?  Yes, excellent condition");
    doc.text("Were there any complaints from neighbours?  No");
    doc.text("Would you rent to this tenant again?  Yes, without reservation");
    doc.text("Any damage beyond fair wear and tear?  No");

    doc.moveDown(0.5);
    doc.text("Ms Test-Tenant was an exemplary tenant for three years. She kept the property in excellent condition, always paid rent on time, and was respectful of neighbours. I would happily recommend her as a tenant.");
    doc.moveDown(1);
    doc.text("Yours sincerely,");
    doc.moveDown(0.5);
    doc.text("Mr Richard Davies");
    doc.text("Previous Landlord");
    doc.text("richard.davies@example.com");
    footer(doc);
  });
  docs.push({ id: 14, ...landlordRef, name: "test-previous-landlord-reference.pdf" });

  // =============================================
  // 12. LANDLORD ID
  // =============================================
  const landlordID = await createPDF("test-landlord-id.pdf", (doc) => {
    header(doc, "LANDLORD IDENTITY VERIFICATION", "KYC/AML Compliance Record");

    section(doc, "Landlord Details");
    field(doc, "Name:", "Mr James Test-Landlord");
    field(doc, "Address:", "45 Maida Vale, Flat 3, London W9 1SD");
    field(doc, "Date of Birth:", "22 November 1975");

    section(doc, "Document Verified");
    field(doc, "Document Type:", "British Passport");
    field(doc, "Passport Number:", "987654321");
    field(doc, "Issue Date:", "20 November 2021");
    field(doc, "Expiry Date:", "20 November 2031");

    section(doc, "AML/KYC Checks");
    doc.fontSize(9).text("  ✓ Identity verified - original passport presented");
    doc.text("  ✓ Address verified - council tax bill provided");
    doc.text("  ✓ PEP check: Clear");
    doc.text("  ✓ Sanctions check: Clear");
    doc.text("  ✓ Adverse media check: Clear");

    field(doc, "Verified By:", "Jane Williams, John Barclay");
    field(doc, "Verification Date:", "1 June 2025");

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#999").text("[REDACTED PASSPORT COPY ON SECURE FILE]", { align: "center" });
    footer(doc);
  });
  docs.push({ id: 15, ...landlordID, name: "test-landlord-id.pdf" });

  // =============================================
  // 13. MANAGEMENT AGREEMENT
  // =============================================
  const mgmtAgreement = await createPDF("test-management-agreement.pdf", (doc) => {
    header(doc, "PROPERTY MANAGEMENT AGREEMENT", "Between Landlord and Managing Agent");

    section(doc, "Parties");
    field(doc, "Landlord:", "Mr James Test-Landlord");
    field(doc, "Agent:", "John Barclay Estate & Management");
    field(doc, "Property:", "12 Randolph Avenue, Garden Flat, London W9 1BJ");

    section(doc, "Agreement Terms");
    field(doc, "Start Date:", "1 June 2025");
    field(doc, "Type:", "Full Management");
    field(doc, "Fee:", "12% of monthly rent (inclusive of VAT)");
    field(doc, "Rent Collection:", "Included");
    field(doc, "Maintenance Co-ordination:", "Included");
    field(doc, "Periodic Inspections:", "Quarterly");
    field(doc, "Tenant Finding:", "Included (first tenancy)");

    section(doc, "Agent Responsibilities");
    doc.fontSize(9).text("  1. Collect rent and forward to landlord (less fees) by the 15th of each month");
    doc.text("  2. Handle all tenant communications and complaints");
    doc.text("  3. Arrange and supervise maintenance and repairs");
    doc.text("  4. Conduct quarterly property inspections with written reports");
    doc.text("  5. Ensure compliance with all landlord legal obligations");
    doc.text("  6. Manage deposit protection and end-of-tenancy process");
    doc.text("  7. Serve all required statutory notices");
    doc.text("  8. Arrange annual gas safety checks and maintain compliance certificates");

    section(doc, "Payment Details");
    field(doc, "Landlord Bank:", "HSBC UK");
    field(doc, "Sort Code:", "40-01-01");
    field(doc, "Account Number:", "12345678");
    field(doc, "Account Name:", "James Test-Landlord");

    doc.moveDown(1);
    doc.fontSize(10).text("Landlord: ____________________     Date: 01/06/2025");
    doc.moveDown(0.5);
    doc.text("Agent:    ____________________     Date: 01/06/2025");
    footer(doc);
  });
  docs.push({ id: 16, ...mgmtAgreement, name: "test-management-agreement.pdf" });

  // =============================================
  // 14. DEPOSIT PROTECTION CERTIFICATE
  // =============================================
  const depositCert = await createPDF("test-deposit-protection-certificate.pdf", (doc) => {
    header(doc, "DEPOSIT PROTECTION CERTIFICATE", "Tenancy Deposit Scheme (TDS)");

    doc.rect(50, doc.y, 495, 30).fill("#e8f4fd");
    doc.fillColor("#0c5460").fontSize(12).text("  Certificate Number: TDS-2025-JB-00123", 55, doc.y + 8);
    doc.fillColor("#1a1a1a");
    doc.moveDown(1.5);

    section(doc, "Deposit Details");
    field(doc, "Amount Protected:", "£2,538.46");
    field(doc, "Date Protected:", "15 September 2025");
    field(doc, "Scheme:", "Tenancy Deposit Scheme (TDS) - Custodial");
    field(doc, "Lead Tenant:", "Sarah Test-Tenant");

    section(doc, "Property");
    field(doc, "Address:", "12 Randolph Avenue, Garden Flat, London W9 1BJ");

    section(doc, "Landlord / Agent");
    field(doc, "Name:", "John Barclay Estate & Management (on behalf of Mr James Test-Landlord)");
    field(doc, "Address:", "35 St John's Wood High Street, London NW8 7NH");

    section(doc, "Tenancy Details");
    field(doc, "Start Date:", "1 September 2025");
    field(doc, "End Date:", "1 September 2026");
    field(doc, "Monthly Rent:", "£2,200.00");

    section(doc, "Important Information");
    doc.fontSize(9).text("This certificate confirms that the deposit has been protected in accordance with the Housing Act 2004. The tenant has been provided with the Prescribed Information within 30 days of receipt.");
    doc.moveDown(0.5);
    doc.text("To check the status of your deposit or raise a dispute, visit: www.tenancydepositscheme.com");
    doc.text("TDS Contact: 0300 037 1000");

    footer(doc);
  });
  docs.push({ id: 17, ...depositCert, name: "test-deposit-protection-certificate.pdf" });

  // =============================================
  // 15. STANDING ORDER CONFIRMATION
  // =============================================
  const soConfirm = await createPDF("test-standing-order-confirmation.pdf", (doc) => {
    header(doc, "STANDING ORDER CONFIRMATION", "Rent Payment Arrangement");

    section(doc, "Payer Details");
    field(doc, "Name:", "Ms Sarah Test-Tenant");
    field(doc, "Bank:", "Barclays Bank plc");
    field(doc, "Account:", "****4567");
    field(doc, "Sort Code:", "20-**-**");

    section(doc, "Payee Details");
    field(doc, "Name:", "John Barclay Client Account");
    field(doc, "Bank:", "HSBC UK");
    field(doc, "Sort Code:", "40-03-19");
    field(doc, "Account:", "71842356");
    field(doc, "Reference:", "JB-RAN12-TENANT");

    section(doc, "Payment Schedule");
    field(doc, "Amount:", "£2,200.00");
    field(doc, "Frequency:", "Monthly");
    field(doc, "Payment Date:", "1st of each month");
    field(doc, "First Payment:", "1 October 2025");
    field(doc, "Last Payment:", "1 August 2026");

    doc.moveDown(0.5);
    doc.fontSize(9).text("Note: First month's rent was paid by bank transfer on 29 August 2025.");
    doc.text("Standing order commences from the second month.");

    footer(doc);
  });
  docs.push({ id: 18, ...soConfirm, name: "test-standing-order-confirmation.pdf" });

  // =============================================
  // UPDATE DATABASE WITH ACTUAL FILE PATHS AND SIZES
  // =============================================
  console.log("\nUpdating database records...");
  for (const d of docs) {
    await pool.query(
      "UPDATE document SET storage_url=$1, size=$2, original_name=$3 WHERE id=$4",
      [d.url, d.size, d.name, d.id]
    );
    console.log("  Updated doc", d.id, "->", d.url, "(" + d.size + " bytes)");
  }

  // =============================================
  // ALSO UPDATE CHECKLIST ITEMS WITH DOCUMENT URLS
  // =============================================
  console.log("\nUpdating checklist document URLs...");
  const checklistDocMap = {
    tenancy_agreement: "/uploads/documents/test-tenancy-agreement.pdf",
    inventory: "/uploads/documents/test-inventory-report.pdf",
    gas_safety_certificate: "/uploads/documents/test-gas-safety-certificate.pdf",
    tenants_id: "/uploads/documents/test-passport-sarah.pdf",
    deposit_protection_tds: "/uploads/documents/test-deposit-protection-certificate.pdf",
    standing_order: "/uploads/documents/test-standing-order-confirmation.pdf",
    work_reference: "/uploads/documents/test-work-reference.pdf",
    bank_reference: "/uploads/documents/test-bank-reference.pdf",
    previous_landlord_reference: "/uploads/documents/test-previous-landlord-reference.pdf",
    guarantors_agreement: "/uploads/documents/test-tenancy-agreement.pdf",
    authorization_to_landlord: "/uploads/documents/test-management-agreement.pdf",
    terms_and_conditions_to_landlord: "/uploads/documents/test-management-agreement.pdf",
    information_sheet_to_landlord: "/uploads/documents/test-management-agreement.pdf",
  };

  for (const [itemType, url] of Object.entries(checklistDocMap)) {
    await pool.query(
      "UPDATE tenancy_checklist_item SET document_url=$1, document_name=$2 WHERE tenancy_id=6 AND item_type=$3",
      [url, path.basename(url), itemType]
    );
    console.log("  Checklist:", itemType, "->", path.basename(url));
  }

  await pool.end();
  console.log("\n========================================");
  console.log("ALL DOCUMENTS GENERATED SUCCESSFULLY");
  console.log("========================================");
  console.log("Total PDFs:", docs.length);
  console.log("Location:", UPLOAD_DIR);
  console.log("========================================");
}

generateAll().catch(e => { console.error("ERROR:", e.message); pool.end(); });
