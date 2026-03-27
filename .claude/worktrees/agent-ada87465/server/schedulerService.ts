import { pool, db } from './db';
import { storage } from './storage';
import { isGoCardlessConfigured, collectPayment } from './gocardlessService';
import { emailConnections, processedEmails } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function runArrearsDetection() {
  try {
    console.log('[Scheduler] Running arrears detection...');
    const overdue = await pool.query(`
      SELECT i.id, i.tenant_id, i.property_id, i.tenancy_id, i.total_amount, i.due_date
      FROM invoice i
      WHERE i.status IN ('sent', 'overdue')
        AND i.due_date < NOW()
        AND NOT EXISTS (
          SELECT 1 FROM arrears a WHERE a.invoice_id = i.id AND a.status = 'active'
        )
    `);

    let newCases = 0;
    for (const inv of overdue.rows) {
      const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
      let dunningLevel = 1;
      if (daysOverdue > 90) dunningLevel = 5;
      else if (daysOverdue > 60) dunningLevel = 4;
      else if (daysOverdue > 30) dunningLevel = 3;
      else if (daysOverdue > 14) dunningLevel = 2;

      await pool.query(`UPDATE invoice SET status = 'overdue', updated_at = NOW() WHERE id = $1`, [inv.id]);

      await storage.createArrears({
        tenantId: inv.tenant_id,
        propertyId: inv.property_id,
        tenancyId: inv.tenancy_id,
        invoiceId: inv.id,
        amount: inv.total_amount,
        daysOverdue,
        dunningLevel,
        status: 'active',
      });
      newCases++;
    }

    // Update existing arrears
    await pool.query(`
      UPDATE arrears SET
        days_overdue = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400)::int,
        dunning_level = CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400 > 90 THEN 5
          WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400 > 60 THEN 4
          WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400 > 30 THEN 3
          WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400 > 14 THEN 2
          ELSE 1
        END,
        updated_at = NOW()
      WHERE status = 'active' AND invoice_id IS NOT NULL
    `);

    console.log(`[Scheduler] Arrears detection complete. ${newCases} new cases.`);
  } catch (error) {
    console.error('[Scheduler] Arrears detection error:', error);
  }
}

async function runRenewalCheck() {
  try {
    console.log('[Scheduler] Running renewal check...');
    const thresholds = [90, 60, 30, 14];
    let created = 0;

    for (const days of thresholds) {
      const expiring = await storage.getExpiringTenancies(days);
      const reminderType = `${days}_day`;

      for (const tenancy of expiring) {
        const existing = await pool.query(
          `SELECT id FROM renewal_reminder WHERE tenancy_id = $1 AND reminder_type = $2`,
          [tenancy.id, reminderType]
        );
        if (existing.rows.length > 0) continue;

        await storage.createRenewalReminder({
          tenancyId: tenancy.id,
          propertyId: tenancy.propertyId,
          landlordId: tenancy.landlordId,
          tenantId: tenancy.tenantId,
          expiryDate: tenancy.endDate,
          reminderType,
          status: 'pending',
        });
        created++;
      }
    }

    console.log(`[Scheduler] Renewal check complete. ${created} new reminders.`);
  } catch (error) {
    console.error('[Scheduler] Renewal check error:', error);
  }
}

async function runDDAutoCollection() {
  if (!isGoCardlessConfigured()) return;

  try {
    console.log('[Scheduler] Running DD auto-collection...');

    // Find unpaid invoices due today that have an active mandate for their tenant
    const today = new Date().toISOString().slice(0, 10);
    const result = await pool.query(`
      SELECT i.id as invoice_id, i.tenant_id, i.total_amount, i.invoice_number,
             gm.id as mandate_id
      FROM invoice i
      INNER JOIN gocardless_mandate gm ON gm.tenant_id = i.tenant_id AND gm.status = 'active'
      WHERE i.status IN ('sent', 'overdue')
        AND DATE(i.due_date) <= $1::date
        AND NOT EXISTS (
          SELECT 1 FROM gocardless_payment gp WHERE gp.invoice_id = i.id AND gp.status NOT IN ('failed', 'cancelled')
        )
    `, [today]);

    let collected = 0;
    for (const row of result.rows) {
      try {
        await collectPayment(
          row.mandate_id,
          row.invoice_id,
          row.total_amount,
          `Rent payment - ${row.invoice_number}`
        );
        collected++;
      } catch (e) {
        console.error(`[Scheduler] DD collection failed for invoice ${row.invoice_id}:`, e);
      }
    }

    console.log(`[Scheduler] DD auto-collection complete. ${collected} payments initiated.`);
  } catch (error) {
    console.error('[Scheduler] DD auto-collection error:', error);
  }
}

async function runMailboxSync() {
  try {
    // Find all active M365 connections with sync enabled
    const connections = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.provider, 'microsoft'),
          eq(emailConnections.status, 'active'),
          eq(emailConnections.syncEnabled, true)
        )
      );

    if (connections.length === 0) return;

    console.log(`[Scheduler] Syncing ${connections.length} M365 mailbox(es)...`);

    const { graphAuthService } = await import('./services/microsoft/graphAuthService');
    const { createGraphClient } = await import('./services/microsoft/graphApiClient');
    const { emailProcessor } = await import('./services/email/emailProcessor');

    for (const connection of connections) {
      try {
        // Get valid access token
        const tokenResult = await graphAuthService.getValidAccessToken(
          connection.accessToken,
          connection.refreshToken,
          connection.tokenExpiresAt,
          connection.tenantId
        );

        // Update tokens if refreshed
        if (tokenResult.needsUpdate) {
          await db
            .update(emailConnections)
            .set({
              accessToken: tokenResult.newAccessToken!,
              refreshToken: tokenResult.newRefreshToken!,
              tokenExpiresAt: tokenResult.newExpiresAt!,
              updatedAt: new Date(),
            })
            .where(eq(emailConnections.id, connection.id));
        }

        // Fetch recent messages from inbox
        const graphClient = createGraphClient(tokenResult.accessToken);
        const fiveMinAgo = new Date(Date.now() - FIVE_MINUTES_MS).toISOString();
        const messages = await graphClient.getMessages({
          folderId: 'inbox',
          top: 50,
          filter: `receivedDateTime ge ${fiveMinAgo}`,
          orderBy: 'receivedDateTime desc',
        });

        if (!messages.value || messages.value.length === 0) continue;

        let processed = 0;
        for (const msg of messages.value) {
          try {
            // Check if already processed
            const existing = await db
              .select({ id: processedEmails.id })
              .from(processedEmails)
              .where(
                and(
                  eq(processedEmails.graphMessageId, msg.id),
                  eq(processedEmails.connectionId, connection.id)
                )
              )
              .limit(1);

            if (existing.length > 0) continue;

            await emailProcessor.processEmail(msg.id, connection.id, connection.userId);
            processed++;
          } catch (err) {
            console.error(`[Scheduler] Failed to process M365 email ${msg.id}:`, err);
          }
        }

        // Update last sync timestamp
        await db
          .update(emailConnections)
          .set({ lastSyncAt: new Date(), updatedAt: new Date() })
          .where(eq(emailConnections.id, connection.id));

        if (processed > 0) {
          console.log(`[Scheduler] M365 connection ${connection.id}: processed ${processed} new email(s)`);
        }
      } catch (err) {
        console.error(`[Scheduler] Failed to sync M365 connection ${connection.id}:`, err);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Mailbox sync error:', error);
  }
}

export function startScheduler() {
  console.log('[Scheduler] Starting daily scheduler...');

  // Run immediately on startup
  setTimeout(() => {
    runArrearsDetection();
    runRenewalCheck();
    runDDAutoCollection();
  }, 10000); // Wait 10s for DB to be ready

  // Run mailbox sync after 30s, then every 5 minutes
  setTimeout(() => {
    runMailboxSync();
  }, 30000);
  setInterval(runMailboxSync, FIVE_MINUTES_MS);

  // Then run daily
  setInterval(() => {
    runArrearsDetection();
    runRenewalCheck();
    runDDAutoCollection();
  }, ONE_DAY_MS);
}
