
import { storage } from "./server/storage";
import { db } from "./server/db";
import { rentalAgreements } from "./shared/schema";

async function debugStorage() {
    console.log("Debugging Storage.getManagedProperties...");

    const res = await storage.getManagedProperties();
    console.log(`getManagedProperties returned: ${res.length} items.`);

    if (res.length === 0) {
        const agreements = await db.select().from(rentalAgreements);
        console.log(`Direct DB Agreements: ${agreements.length}`);

        if (agreements.length > 0) {
            const first = agreements[0];
            console.log(`Checking Agreement ${first.id}, Property ID: ${first.propertyId} (${typeof first.propertyId})`);

            const prop = await storage.getProperty(first.propertyId);
            console.log(`storage.getProperty(${first.propertyId}) returned:`, prop);

            if (!prop) {
                console.log("FAILED to find property via storage.getProperty!");
                // Try direct DB
                const props = await db.select().from(properties).where(eq(properties.id, first.propertyId));
                console.log("Direct DB property lookup:", props);
            }
        }
    }

    process.exit(0);
}

// Helper for "properties" import since I missed it above
import { properties } from "./shared/schema";
import { eq } from "drizzle-orm";

debugStorage().catch(console.error);
