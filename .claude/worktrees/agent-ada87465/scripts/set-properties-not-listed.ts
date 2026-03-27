import { db } from "../server/db";
import { pmProperties } from "../shared/schema";

async function setAllPropertiesNotListed() {
  console.log("Setting all PM properties to 'not listed'...");
  
  try {
    const result = await db
      .update(pmProperties)
      .set({
        isListedRental: false,
        isListedSale: false
      })
      .returning({ id: pmProperties.id });
    
    console.log(`Updated ${result.length} properties to 'not listed'`);
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Error updating properties:", error);
    process.exit(1);
  }
}

setAllPropertiesNotListed();
