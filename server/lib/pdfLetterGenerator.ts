import PDFDocument from 'pdfkit';

interface MergeData { [key: string]: string | number | undefined; }

const BRAND_PURPLE = '#791E75';

export function generateLetterPDF(bodyHtml: string, mergeData: MergeData, options?: { subject?: string; recipientAddress?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(16).fillColor(BRAND_PURPLE).text('John Barclay', { align: 'left' });
    doc.fontSize(8).fillColor('#666').text('Lettings & Management');
    doc.fontSize(8).text('Unit 2.03, 332 Ladbroke Grove, London W10 5AD');
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#000').text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    doc.moveDown(0.5);

    if (options?.recipientAddress) { doc.text(options.recipientAddress); doc.moveDown(1); }
    if (options?.subject) {
      doc.fontSize(11).font('Helvetica-Bold').text(replaceMergeFields(options.subject, mergeData));
      doc.moveDown(0.5);
    }

    const plainBody = stripHtml(bodyHtml);
    const mergedBody = replaceMergeFields(plainBody, mergeData);
    doc.fontSize(10).font('Helvetica').text(mergedBody, { lineGap: 4 });
    doc.moveDown(2);
    doc.text('Yours sincerely,');
    doc.moveDown(1);
    doc.text('John Barclay Lettings & Management');
    doc.end();
  });
}

function replaceMergeFields(text: string, data: MergeData): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    const value = data[field];
    return value !== undefined ? String(value) : match;
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export const AVAILABLE_MERGE_FIELDS = [
  'tenant_name', 'tenant_email', 'tenant_phone',
  'landlord_name', 'landlord_email', 'landlord_phone',
  'property_address', 'property_postcode',
  'rent_amount', 'rent_period', 'arrears_balance',
  'tenancy_start_date', 'tenancy_end_date',
  'deposit_amount', 'deposit_scheme',
  'today_date', 'agent_name', 'agent_email',
];
