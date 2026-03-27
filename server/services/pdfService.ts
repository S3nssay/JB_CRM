/**
 * Branded PDF Generation Service
 *
 * Generates John Barclay branded PDFs for landlord statements, tenant invoices,
 * and payment receipts. Uses PDFKit with purple (#791E75) and gold (#F8B324)
 * brand colours.
 */
import PDFDocument from 'pdfkit';

// Brand colours
const PURPLE = '#791E75';
const GOLD = '#F8B324';
const DARK = '#333333';
const LIGHT_BG = '#f3f4f6';
const MUTED = '#888888';

// ============================================================
// Type Definitions
// ============================================================

export interface StatementPDFData {
  statementNumber: string;
  landlordName: string;
  propertyAddress: string;
  periodStart: Date;
  periodEnd: Date;
  lineItems: Array<{ date: Date; description: string; amount: number }>; // pence, positive=income, negative=deduction
  totalRentCollected: number; // pence
  managementFees: number; // pence
  maintenanceDeductions: number; // pence
  otherDeductions: number; // pence
  vatOnFees: number; // pence
  netPayable: number; // pence
}

export interface InvoicePDFData {
  invoiceNumber: string;
  tenantName: string;
  propertyAddress: string;
  dueDate: Date;
  lineItems: Array<{ description: string; amount: number }>; // pence
  totalAmount: number; // pence
  vatAmount: number; // pence
  paymentInstructions?: string;
}

export interface ReceiptPDFData {
  receiptNumber: string;
  tenantName: string;
  propertyAddress: string;
  amount: number; // pence
  paymentDate: Date;
  paymentReference: string;
  paymentMethod?: string;
}

// ============================================================
// Helpers
// ============================================================

function formatPence(pence: number): string {
  const pounds = Math.abs(pence) / 100;
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pounds);
  return pence < 0 ? `-${formatted}` : formatted;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function drawHeader(doc: PDFKit.PDFDocument, subtitle: string): void {
  // Purple header bar
  doc.rect(0, 0, doc.page.width, 80).fill(PURPLE);
  doc.fontSize(22).fillColor('white').text('John Barclay Estate & Management', 50, 25);
  // Gold accent subtitle
  doc.fontSize(12).fillColor(GOLD).text(subtitle, 50, 52);
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  const footerY = 740;
  doc.moveTo(50, footerY).lineTo(550, footerY).stroke(PURPLE);
  doc.fontSize(8).fillColor(MUTED);
  doc.text('John Barclay Estate & Management', 50, footerY + 8);
  doc.text('51 Lancaster Gate, London W2 3NA | Tel: 020 7262 4400 | info@johnbarclay.co.uk', 50, footerY + 20);
  doc.text('Registered in England No. 06874473 | VAT No. 974 2396 49', 50, footerY + 32);
}

function collectBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

// ============================================================
// Statement PDF
// ============================================================

/**
 * Generate a branded landlord statement PDF.
 */
export async function generateStatementPDF(data: StatementPDFData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const bufferPromise = collectBuffer(doc);

  const monthName = data.periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Header
  drawHeader(doc, `Landlord Statement - ${monthName}`);

  // Statement details
  let y = 110;
  doc.fillColor(DARK).fontSize(10);
  doc.font('Helvetica-Bold').text(`Statement No: ${data.statementNumber}`, 50, y);
  doc.font('Helvetica');
  doc.text(`Landlord: ${data.landlordName}`, 50, y + 18);
  doc.text(`Property: ${data.propertyAddress}`, 50, y + 36);
  doc.text(`Period: ${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`, 50, y + 54);
  doc.text(`Generated: ${formatDate(new Date())}`, 50, y + 72);

  y += 110;

  // Line items table header
  doc.rect(50, y, 500, 25).fill(LIGHT_BG);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9);
  doc.text('Date', 60, y + 8, { width: 80 });
  doc.text('Description', 150, y + 8, { width: 260 });
  doc.text('Amount', 420, y + 8, { width: 110, align: 'right' });

  y += 30;
  doc.font('Helvetica').fontSize(9);

  // Line items
  for (const item of data.lineItems) {
    doc.fillColor(DARK);
    doc.text(formatDate(item.date), 60, y, { width: 80 });
    doc.text(item.description, 150, y, { width: 260 });
    doc.fillColor(item.amount < 0 ? '#cc0000' : DARK);
    doc.text(formatPence(item.amount), 420, y, { width: 110, align: 'right' });
    y += 18;
  }

  // Divider
  y += 5;
  doc.moveTo(50, y).lineTo(550, y).stroke(PURPLE);
  y += 15;

  // Summary section
  doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK);
  const summaryItems = [
    ['Total Rent Collected', formatPence(data.totalRentCollected)],
    ['Management Fees', formatPence(-data.managementFees)],
    ['Maintenance Deductions', formatPence(-data.maintenanceDeductions)],
    ['Other Deductions', formatPence(-data.otherDeductions)],
    ['VAT on Fees', formatPence(-data.vatOnFees)],
  ];

  for (const [label, value] of summaryItems) {
    doc.font('Helvetica').text(label, 300, y, { width: 160 });
    doc.text(value, 460, y, { width: 70, align: 'right' });
    y += 18;
  }

  y += 5;
  doc.moveTo(300, y).lineTo(550, y).stroke(GOLD);
  y += 10;

  doc.font('Helvetica-Bold').fontSize(12).fillColor(PURPLE);
  doc.text('Net Payable:', 300, y, { width: 160 });
  doc.text(formatPence(data.netPayable), 460, y, { width: 70, align: 'right' });

  // Footer
  drawFooter(doc);

  doc.end();
  return bufferPromise;
}

// ============================================================
// Invoice PDF
// ============================================================

/**
 * Generate a branded tenant invoice PDF.
 */
export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const bufferPromise = collectBuffer(doc);

  // Header
  drawHeader(doc, 'Tenant Invoice');

  // Invoice details
  let y = 110;
  doc.fillColor(DARK).fontSize(10);
  doc.font('Helvetica-Bold').text(`Invoice No: ${data.invoiceNumber}`, 50, y);
  doc.font('Helvetica');
  doc.text(`Tenant: ${data.tenantName}`, 50, y + 18);
  doc.text(`Property: ${data.propertyAddress}`, 50, y + 36);
  doc.text(`Due Date: ${formatDate(data.dueDate)}`, 50, y + 54);

  y += 90;

  // Line items table header
  doc.rect(50, y, 500, 25).fill(LIGHT_BG);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9);
  doc.text('Description', 60, y + 8, { width: 340 });
  doc.text('Amount', 420, y + 8, { width: 110, align: 'right' });

  y += 30;
  doc.font('Helvetica').fontSize(9);

  // Line items
  for (const item of data.lineItems) {
    doc.fillColor(DARK);
    doc.text(item.description, 60, y, { width: 340 });
    doc.text(formatPence(item.amount), 420, y, { width: 110, align: 'right' });
    y += 18;
  }

  // VAT line (if applicable)
  if (data.vatAmount > 0) {
    doc.text('VAT', 60, y, { width: 340 });
    doc.text(formatPence(data.vatAmount), 420, y, { width: 110, align: 'right' });
    y += 18;
  }

  // Total
  y += 5;
  doc.moveTo(50, y).lineTo(550, y).stroke(PURPLE);
  y += 10;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(PURPLE);
  doc.text('Total Due:', 60, y, { width: 340 });
  doc.text(formatPence(data.totalAmount + data.vatAmount), 420, y, { width: 110, align: 'right' });

  // Payment instructions
  if (data.paymentInstructions) {
    y += 40;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GOLD);
    doc.text('Payment Instructions', 50, y);
    y += 18;
    doc.font('Helvetica').fontSize(9).fillColor(DARK);
    doc.text(data.paymentInstructions, 50, y, { width: 500 });
  }

  // Footer
  drawFooter(doc);

  doc.end();
  return bufferPromise;
}

// ============================================================
// Receipt PDF
// ============================================================

/**
 * Generate a branded payment receipt PDF.
 */
export async function generateReceiptPDF(data: ReceiptPDFData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const bufferPromise = collectBuffer(doc);

  // Header
  drawHeader(doc, 'Payment Receipt');

  // Receipt details
  let y = 110;
  doc.fillColor(DARK).fontSize(10);
  doc.font('Helvetica-Bold').text(`Receipt No: ${data.receiptNumber}`, 50, y);
  doc.font('Helvetica');
  doc.text(`Tenant: ${data.tenantName}`, 50, y + 18);
  doc.text(`Property: ${data.propertyAddress}`, 50, y + 36);
  doc.text(`Payment Date: ${formatDate(data.paymentDate)}`, 50, y + 54);
  doc.text(`Reference: ${data.paymentReference}`, 50, y + 72);
  if (data.paymentMethod) {
    doc.text(`Method: ${data.paymentMethod}`, 50, y + 90);
  }

  y += 130;

  // Amount box
  doc.rect(50, y, 500, 60).fill(LIGHT_BG);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(PURPLE);
  doc.text('Amount Paid', 60, y + 10, { width: 200 });
  doc.fontSize(18).text(formatPence(data.amount), 300, y + 10, { width: 230, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(DARK);
  doc.text('Payment confirmed. Thank you.', 60, y + 38, { width: 460 });

  // Footer
  drawFooter(doc);

  doc.end();
  return bufferPromise;
}

// ============================================================
// Outreach Letter PDF
// ============================================================

export interface OutreachLetterData {
  recipientName: string;
  recipientAddress: string;
  propertyAddress: string;
  leadSource: string;
  personalizedMessage: string;
  date: Date;
}

/**
 * Generate a branded outreach letter PDF for manual posting.
 * Used by Charlie (Property Sourcing Agent) for letter-based outreach.
 */
export async function generateOutreachLetterPDF(data: OutreachLetterData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const bufferPromise = collectBuffer(doc);

  // Header
  drawHeader(doc, 'Property Opportunity');

  // Date (right-aligned)
  let y = 110;
  doc.fillColor(DARK).fontSize(10).font('Helvetica');
  doc.text(formatDate(data.date), 50, y, { width: 500, align: 'right' });

  // Recipient address block
  y += 30;
  doc.text(data.recipientName, 50, y);
  const addressLines = data.recipientAddress.split(/[,\n]/).map(l => l.trim()).filter(Boolean);
  for (const line of addressLines) {
    y += 16;
    doc.text(line, 50, y);
  }

  // Salutation
  y += 35;
  const salutation = data.recipientName && data.recipientName !== 'Property Owner'
    ? `Dear ${data.recipientName},`
    : 'Dear Property Owner,';
  doc.font('Helvetica').text(salutation, 50, y);

  // Body (the AI-drafted personalized message)
  y += 25;
  doc.fontSize(10).fillColor(DARK);
  const paragraphs = data.personalizedMessage.split('\n').filter(p => p.trim());
  for (const para of paragraphs) {
    // Skip if it starts with "Dear" (already added salutation)
    if (para.trim().startsWith('Dear ')) continue;
    doc.text(para.trim(), 50, y, { width: 500, lineGap: 4 });
    y += doc.heightOfString(para.trim(), { width: 500, lineGap: 4 }) + 10;
  }

  // Sign-off
  y += 15;
  doc.text('Yours sincerely,', 50, y);
  y += 40;
  doc.font('Helvetica-Bold').text('John Barclay Estate Agents', 50, y);
  y += 16;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED);
  doc.text('W9 | W10 | W11 | NW6 | NW8', 50, y);
  y += 16;
  doc.text('Tel: 020 7262 4400 | info@johnbarclay.co.uk | www.johnbarclay.co.uk', 50, y);

  // Footer
  drawFooter(doc);

  doc.end();
  return bufferPromise;
}
