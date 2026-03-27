
import { db } from "./server/db";
import { properties, rentalAgreements } from "./shared/schema";
import { eq, inArray } from "drizzle-orm";

async function fixPropertyStatus() {
    console.log("Updating property statuses based on active rental agreements...");

    // Get all active rental agreements
    const activeAgreements = await db.select()
        .from(rentalAgreements)
        .where(eq(rentalAgreements.status, 'active'));

    const propertyIds = activeAgreements.map(a => a.propertyId);

    if (propertyIds.length > 0) {
        console.log(`Found ${propertyIds.length} properties with active agreements. Setting status to 'let'.`);

        await db.update(properties)
            .set({ status: 'let' })
            .where(inArray(properties.id, propertyIds));

        // Set all others to 'available'? 
        // Maybe not safe if some are 'sold' or 'withdrawn'.
        // But since import set everything to 'available', we can assume 'let' is the only deviation for now.
    }

    console.log("Property statuses updated.");
    process.exit(0);
}

fixPropertyStatus().catch(console.error);
