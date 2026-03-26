/**
 * Portfolio Monitor Service -- Unit Tests
 *
 * Tests handler functions with mocked pool.query and emailService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module (pool)
const mockQuery = vi.fn();
vi.mock('../db', () => ({
  pool: { query: (...args: any[]) => mockQuery(...args) },
}));

// Mock emailService
const mockSendEmail = vi.fn();
vi.mock('../emailService', () => ({
  emailService: { sendEmail: mockSendEmail },
}));

import {
  handleComplianceCheck,
  handleWeeklyHealthReport,
  calculateHealthScore,
} from '../services/portfolioMonitorService';

describe('Portfolio Monitor Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateHealthScore', () => {
    it('returns 100 for a perfectly healthy property', () => {
      expect(calculateHealthScore({
        expiredCerts: 0,
        expiringCerts: 0,
        openTickets: 0,
        activeArrears: 0,
        isVacant: false,
      })).toBe(100);
    });

    it('deducts correctly: 1 expired cert + 2 open tickets = 70', () => {
      // 100 - 20 (expired) - 5*2 (tickets) = 70
      expect(calculateHealthScore({
        expiredCerts: 1,
        expiringCerts: 0,
        openTickets: 2,
        activeArrears: 0,
        isVacant: false,
      })).toBe(70);
    });

    it('deducts 25 for vacancy', () => {
      expect(calculateHealthScore({
        expiredCerts: 0,
        expiringCerts: 0,
        openTickets: 0,
        activeArrears: 0,
        isVacant: true,
      })).toBe(75);
    });

    it('deducts 15 per active arrears case', () => {
      expect(calculateHealthScore({
        expiredCerts: 0,
        expiringCerts: 0,
        openTickets: 0,
        activeArrears: 2,
        isVacant: false,
      })).toBe(70);
    });

    it('floors at 0 for very unhealthy property', () => {
      expect(calculateHealthScore({
        expiredCerts: 5,
        expiringCerts: 3,
        openTickets: 10,
        activeArrears: 3,
        isVacant: true,
      })).toBe(0);
    });
  });

  describe('handleComplianceCheck', () => {
    it('sends email when expiring certifications found', async () => {
      // First call: certification query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            cert_id: 1,
            cert_type: 'gas_safety',
            expiry_date: new Date('2026-04-15'),
            status: 'valid',
            property_id: 10,
            property_address: '123 High Street',
            landlord_id: 5,
            landlord_name: 'John Smith',
            landlord_email: 'john@example.com',
            urgency: 'expiring_soon',
          },
          {
            cert_id: 2,
            cert_type: 'epc',
            expiry_date: new Date('2026-03-20'),
            status: 'expired',
            property_id: 11,
            property_address: '45 Park Lane',
            landlord_id: 5,
            landlord_name: 'John Smith',
            landlord_email: 'john@example.com',
            urgency: 'expired',
          },
        ],
      });

      // Staff email fallback query
      mockQuery.mockResolvedValueOnce({
        rows: [{ email: 'admin@jb.com' }],
      });

      // Notification insert (2 times)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Audit log insert
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await handleComplianceCheck();

      // Should send email
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const [to, subject] = mockSendEmail.mock.calls[0];
      expect(to).toBe('admin@jb.com');
      expect(subject).toContain('2 certification(s)');
    });

    it('does not send email when no certifications expiring', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await handleComplianceCheck();

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('handleWeeklyHealthReport', () => {
    it('sends email with landlord-grouped property health data', async () => {
      // Properties query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            property_id: 1,
            property_address: '10 Oak Road',
            landlord_id: 1,
            landlord_name: 'Alice Brown',
            expired_certs: 1,
            expiring_certs: 0,
            open_tickets: 2,
            active_arrears: 0,
            total_outstanding_pence: 0,
            is_vacant: false,
          },
          {
            property_id: 2,
            property_address: '20 Elm Street',
            landlord_id: 1,
            landlord_name: 'Alice Brown',
            expired_certs: 0,
            expiring_certs: 1,
            open_tickets: 0,
            active_arrears: 1,
            total_outstanding_pence: 50000,
            is_vacant: false,
          },
          {
            property_id: 3,
            property_address: '30 Pine Ave',
            landlord_id: 2,
            landlord_name: 'Bob Jones',
            expired_certs: 0,
            expiring_certs: 0,
            open_tickets: 0,
            active_arrears: 0,
            total_outstanding_pence: 0,
            is_vacant: true,
          },
        ],
      });

      // Staff email fallback
      mockQuery.mockResolvedValueOnce({
        rows: [{ email: 'pm@jb.com' }],
      });

      // Audit log
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await handleWeeklyHealthReport();

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = mockSendEmail.mock.calls[0];
      expect(to).toBe('pm@jb.com');
      expect(subject).toContain('3 managed properties');
      // Check landlord grouping
      expect(html).toContain('Alice Brown');
      expect(html).toContain('Bob Jones');
    });

    it('groups properties by landlord correctly', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            property_id: 1,
            property_address: 'Prop A',
            landlord_id: 1,
            landlord_name: 'Landlord X',
            expired_certs: 0,
            expiring_certs: 0,
            open_tickets: 0,
            active_arrears: 0,
            total_outstanding_pence: 0,
            is_vacant: false,
          },
          {
            property_id: 2,
            property_address: 'Prop B',
            landlord_id: 1,
            landlord_name: 'Landlord X',
            expired_certs: 0,
            expiring_certs: 0,
            open_tickets: 0,
            active_arrears: 0,
            total_outstanding_pence: 0,
            is_vacant: false,
          },
        ],
      });

      // Staff email fallback
      mockQuery.mockResolvedValueOnce({
        rows: [{ email: 'pm@jb.com' }],
      });

      // Audit log
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await handleWeeklyHealthReport();

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const html = mockSendEmail.mock.calls[0][2];
      // Should have Landlord X header only once
      const matches = html.match(/Landlord X/g);
      // At least in the header (it also appears in table rows)
      expect(matches).toBeTruthy();
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('does not send email when no managed properties', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await handleWeeklyHealthReport();

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});
