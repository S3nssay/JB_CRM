
import { db } from './server/db';
import * as schema from './shared/schema';
import { writeFileSync } from 'fs';
import path from 'path';

async function exportData() {
    console.log('Starting full database data export...');
    const backup: Record<string, any> = {};

    // List of tables to export - based on schema
    const tables = [
        'users',
        'properties',
        'landlords',
        'tenants',
        'rentalAgreements',
        'maintenanceTickets',
        'maintenanceTicketUpdates',
        'maintenanceCategories',
        'contractors',
        'contractorQuotes',
        'complianceStatus',
        'propertyChecklists',
        'salesProgression',
        'managedProperties',
        'unifiedContacts',
        'companyDetails',
        'kycDocuments',
        'bankDetails'
    ];

    for (const tableName of tables) {
        try {
            console.log(`Exporting table: ${tableName}...`);
            const table = (schema as any)[tableName];
            if (!table) {
                console.warn(`Table ${tableName} not found in schema export.`);
                continue;
            }
            const data = await db.select().from(table);
            backup[tableName] = data;
        } catch (error: any) {
            console.error(`Error exporting ${tableName}:`, error.message);
        }
    }

    const backupPath = path.join(process.cwd(), 'jb_crm_db_backup.json');
    writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`\nBackup complete! Data saved to: ${backupPath}`);
    console.log(`Total tables exported: ${Object.keys(backup).length}`);
    process.exit(0);
}

exportData().catch(err => {
    console.error('Export failed:', err);
    process.exit(1);
});
