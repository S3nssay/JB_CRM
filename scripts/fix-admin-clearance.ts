/**
 * Fix admin user security clearance
 * Sets all users with role='admin' to security_clearance=10
 */

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function fixAdminClearance() {
  try {
    // Find all admin users
    const adminUsers = await db.select()
      .from(users)
      .where(eq(users.role, 'admin'));

    console.log(`Found ${adminUsers.length} admin user(s)`);

    for (const admin of adminUsers) {
      console.log(`- ${admin.username} (ID: ${admin.id}): current clearance = ${admin.securityClearance}`);
    }

    // Update all admin users to have clearance level 10
    const result = await db.update(users)
      .set({ securityClearance: 10 })
      .where(eq(users.role, 'admin'))
      .returning();

    console.log(`\nUpdated ${result.length} admin user(s) to security_clearance = 10`);

    for (const admin of result) {
      console.log(`- ${admin.username}: now has clearance = ${admin.securityClearance}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAdminClearance();
