import { db } from "../server/db";
import { pmTenancyChecklist, pmTenancies, pmTenants, pmProperties, pmLandlords } from "../shared/schema";

async function clearAllPMData() {
  console.log("Clearing all PM data...\n");
  
  try {
    // Delete in order of dependencies (child tables first)
    console.log("1. Deleting tenancy checklist items...");
    const checklistResult = await db.delete(pmTenancyChecklist).returning({ id: pmTenancyChecklist.id });
    console.log(`   Deleted ${checklistResult.length} checklist items`);
    
    console.log("2. Deleting tenancies...");
    const tenanciesResult = await db.delete(pmTenancies).returning({ id: pmTenancies.id });
    console.log(`   Deleted ${tenanciesResult.length} tenancies`);
    
    console.log("3. Deleting tenants...");
    const tenantsResult = await db.delete(pmTenants).returning({ id: pmTenants.id });
    console.log(`   Deleted ${tenantsResult.length} tenants`);
    
    console.log("4. Deleting properties...");
    const propertiesResult = await db.delete(pmProperties).returning({ id: pmProperties.id });
    console.log(`   Deleted ${propertiesResult.length} properties`);
    
    console.log("5. Deleting landlords...");
    const landlordsResult = await db.delete(pmLandlords).returning({ id: pmLandlords.id });
    console.log(`   Deleted ${landlordsResult.length} landlords`);
    
    console.log("\n✓ All PM data has been cleared!");
    process.exit(0);
  } catch (error) {
    console.error("Error clearing data:", error);
    process.exit(1);
  }
}

clearAllPMData();
