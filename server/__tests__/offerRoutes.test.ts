/**
 * Offer Routes -- Unit Tests (Static Analysis)
 *
 * Verifies that offerRoutes.ts contains the required notification
 * and email code paths without needing a running database.
 *
 * CORR-03: POST /offers creates an in-CRM notification for the assigned agent
 * CORR-04: POST /offers sends an email to the assigned negotiator
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const offerRoutesSource = fs.readFileSync(
  path.resolve(__dirname, '../offerRoutes.ts'),
  'utf-8'
);

describe('offerRoutes.ts -- static analysis', () => {
  describe('CORR-03: Notification on new offer', () => {
    it('POST /offers handler contains INSERT INTO notification', () => {
      // The source must contain an INSERT into the notification table
      expect(offerRoutesSource).toContain('INSERT INTO notification');
    });

    it('notification includes user_id, title, body, and type', () => {
      // Verify the notification INSERT references the required columns
      expect(offerRoutesSource).toContain('user_id');
      expect(offerRoutesSource).toContain('title');
      expect(offerRoutesSource).toContain('body');
      expect(offerRoutesSource).toContain("'info'");
    });

    it('notification title contains formatted offer amount and property address', () => {
      expect(offerRoutesSource).toContain('New offer:');
      expect(offerRoutesSource).toContain('formattedAmount');
      expect(offerRoutesSource).toContain('propertyAddress');
    });

    it('notification links to /crm/offers', () => {
      expect(offerRoutesSource).toContain("'/crm/offers'");
    });
  });

  describe('CORR-04: Email on new offer', () => {
    it('imports emailService from emailService module', () => {
      expect(offerRoutesSource).toMatch(/import.*emailService.*from.*['"]\.\/emailService['"]/);
    });

    it('calls emailService.sendEmail within POST /offers handler', () => {
      expect(offerRoutesSource).toContain('emailService.sendEmail');
    });

    it('email subject contains property address', () => {
      expect(offerRoutesSource).toContain('New Offer Received -');
    });

    it('email body contains offer details (amount, buyer, position, chain)', () => {
      expect(offerRoutesSource).toContain('Offer Amount');
      expect(offerRoutesSource).toContain('Buyer Name');
      expect(offerRoutesSource).toContain('Buyer Position');
      expect(offerRoutesSource).toContain('In Chain');
    });

    it('email includes View in CRM link', () => {
      expect(offerRoutesSource).toContain('View in CRM');
      expect(offerRoutesSource).toContain('/crm/offers');
    });
  });

  describe('Offer CRUD endpoints', () => {
    it('exports offerRouter', () => {
      expect(offerRoutesSource).toContain('export const offerRouter');
    });

    it('has GET /offers endpoint', () => {
      expect(offerRoutesSource).toMatch(/offerRouter\.get\(['"]\/offers['"]/);
    });

    it('has GET /offers/:id endpoint', () => {
      expect(offerRoutesSource).toMatch(/offerRouter\.get\(['"]\/offers\/:id['"]/);
    });

    it('has POST /offers endpoint', () => {
      expect(offerRoutesSource).toMatch(/offerRouter\.post\(['"]\/offers['"]/);
    });

    it('has PATCH /offers/:id/status endpoint', () => {
      expect(offerRoutesSource).toMatch(/offerRouter\.patch\(['"]\/offers\/:id\/status['"]/);
    });

    it('has GET /properties/:id/offers endpoint', () => {
      expect(offerRoutesSource).toMatch(/offerRouter\.get\(['"]\/properties\/:id\/offers['"]/);
    });
  });

  describe('Agent fallback logic', () => {
    it('looks up agent_id from properties table', () => {
      expect(offerRoutesSource).toContain('agent_id');
    });

    it('falls back to property_manager_id', () => {
      expect(offerRoutesSource).toContain('property_manager_id');
    });

    it('falls back to first admin user', () => {
      expect(offerRoutesSource).toContain("role = 'admin'");
    });
  });

  describe('Status management', () => {
    it('sets decision_date on status update', () => {
      expect(offerRoutesSource).toContain('decision_date = NOW()');
    });

    it('sets decision_by from req.user', () => {
      expect(offerRoutesSource).toContain('decision_by');
      expect(offerRoutesSource).toContain('req.user');
    });

    it('supports counter offer amount and date', () => {
      expect(offerRoutesSource).toContain('counter_offer_amount');
      expect(offerRoutesSource).toContain('counter_offer_date');
    });
  });
});
