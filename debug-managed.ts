
import { db } from "./server/db";
import { rentalAgreements, properties, propertyChecklists } from "./shared/schema";
import { eq } from "drizzle-orm";

async function debugManaged() {
    console.log("Debugging Managed Properties...");

    const agreements = await db.select().from(rentalAgreements);
    console.log(`Found ${agreements.length} rental agreements.`);

    if (agreements.length === 0) {
        process.exit(0);
    }

    // Check first 5
    for (const agreement of agreements.slice(0, 5)) {
        console.log(`Agreement ${agreement.id}: propertyId=${agreement.propertyId}, tenantId=${agreement.tenantId}, status=${agreement.status}`);

        // Check if property exists
        const property = await db.select().from(properties).where(eq(properties.id, agreement.propertyId));
        if (property.length === 0) {
            console.log(`  -> Property ${agreement.propertyId} NOT FOUND!`);
        } else {
            console.log(`  -> Property Found: ${property[0].addressLine1}, status=${property[0].status}`);
        }

        // Check checklists
        try {
            const checklists = await db.select().from(propertyChecklists).where(eq(propertyChecklists.contractId, agreement.id));
            console.log(`  -> Checklists: ${checklists.length}`);
        } catch (e: any) {
            console.log(`  -> Checklists Query FAILED: ${e.message}`);
        }
    }

    process.exit(0);
}

debugManaged().catch(console.error);
