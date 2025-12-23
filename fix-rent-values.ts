
import { db } from "./server/db";
import { rentalAgreements } from "./shared/schema";
import { eq, lt, sql } from "drizzle-orm";

async function fixRentValues() {
    console.log("Checking for incorrectly scaled rent amounts...");

    // Find agreements with rent < 100 or deposit < 100
    // These are clearly erroneous (e.g. £32.00 instead of £3200)
    // We assume any rent < £100/month is an error and should be multiplied by 100.

    const lowRentAgreements = await db.select()
        .from(rentalAgreements)
        .where(lt(rentalAgreements.rentAmount, 200)); // Using 200 as safe threshold

    console.log(`Found ${lowRentAgreements.length} agreements with rent < 200.`);

    for (const agreement of lowRentAgreements) {
        if (agreement.rentAmount > 0) {
            console.log(`Fixing Agreement ${agreement.id}: Rent ${agreement.rentAmount} -> ${agreement.rentAmount * 100}`);

            await db.update(rentalAgreements)
                .set({
                    rentAmount: Math.round(agreement.rentAmount * 100),
                    // Also check deposit
                    depositAmount: agreement.depositAmount < 200 ? Math.round(agreement.depositAmount * 100) : agreement.depositAmount
                })
                .where(eq(rentalAgreements.id, agreement.id));
        }
    }

    // Also check deposits independently?
    const lowDepositAgreements = await db.select()
        .from(rentalAgreements)
        .where(lt(rentalAgreements.depositAmount, 200));

    console.log(`Found ${lowDepositAgreements.length} agreements with deposit < 200.`);

    for (const agreement of lowDepositAgreements) {
        // Only fix if not already fixed above (though update shouldn't hurt)
        if (agreement.depositAmount > 0) {
            // Double check we didn't just fix it
            const current = await db.select().from(rentalAgreements).where(eq(rentalAgreements.id, agreement.id));
            if (current[0].depositAmount < 200) {
                console.log(`Fixing Agreement ${agreement.id}: Deposit ${agreement.depositAmount} -> ${agreement.depositAmount * 100}`);
                await db.update(rentalAgreements)
                    .set({
                        depositAmount: Math.round(agreement.depositAmount * 100)
                    })
                    .where(eq(rentalAgreements.id, agreement.id));
            }
        }
    }

    console.log("Rent values fixed.");
    process.exit(0);
}

fixRentValues().catch(console.error);
