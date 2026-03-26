/**
 * PDF Service Tests
 *
 * Verifies that branded PDF generation functions produce valid Buffer outputs.
 */
import { describe, it, expect } from 'vitest';
import {
  generateStatementPDF,
  generateInvoicePDF,
  generateReceiptPDF,
  type StatementPDFData,
  type InvoicePDFData,
  type ReceiptPDFData,
} from '../services/pdfService';

const mockStatementData: StatementPDFData = {
  statementNumber: 'STMT-202604-1',
  landlordName: 'John Smith',
  propertyAddress: '123 High Street, London W1 1AA',
  periodStart: new Date('2026-04-01'),
  periodEnd: new Date('2026-04-30'),
  lineItems: [
    { date: new Date('2026-04-30'), description: 'Rent collected', amount: 150000 },
    { date: new Date('2026-04-30'), description: 'Management fee (13%)', amount: -19500 },
    { date: new Date('2026-04-30'), description: 'VAT on management fee', amount: -3900 },
  ],
  totalRentCollected: 150000,
  managementFees: 19500,
  maintenanceDeductions: 0,
  otherDeductions: 0,
  vatOnFees: 3900,
  netPayable: 126600,
};

const mockInvoiceData: InvoicePDFData = {
  invoiceNumber: 'INV-202604-42',
  tenantName: 'Jane Doe',
  propertyAddress: '456 Park Lane, London SW1 2BB',
  dueDate: new Date('2026-04-15'),
  lineItems: [
    { description: 'Monthly rent', amount: 150000 },
    { description: 'Service charge (monthly)', amount: 5000 },
  ],
  totalAmount: 155000,
  vatAmount: 0,
  paymentInstructions: 'Pay via Stripe or GoCardless link provided separately.',
};

const mockReceiptData: ReceiptPDFData = {
  receiptNumber: 'REC-202604-42',
  tenantName: 'Jane Doe',
  propertyAddress: '456 Park Lane, London SW1 2BB',
  amount: 155000,
  paymentDate: new Date('2026-04-15'),
  paymentReference: 'pi_abc123',
  paymentMethod: 'Stripe',
};

describe('PDF Service -- Statement Generation', () => {
  it('generateStatementPDF returns a Buffer with length > 0', async () => {
    const buffer = await generateStatementPDF(mockStatementData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('PDF Service -- Invoice Generation', () => {
  it('generateInvoicePDF returns a Buffer with length > 0', async () => {
    const buffer = await generateInvoicePDF(mockInvoiceData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('PDF Service -- Receipt Generation', () => {
  it('generateReceiptPDF returns a Buffer with length > 0', async () => {
    const buffer = await generateReceiptPDF(mockReceiptData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
