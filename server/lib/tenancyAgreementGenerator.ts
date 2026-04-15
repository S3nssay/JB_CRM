import PDFDocument from 'pdfkit';

interface TenancyData {
  landlordName: string;
  landlordAddress: string;
  tenantName: string;
  tenantAddress?: string;
  propertyAddress: string;
  rentAmount: number; // pence
  rentPeriod: string;
  depositAmount: number; // pence
  depositScheme?: string;
  startDate: string;
  endDate: string;
  periodMonths: number;
  specialTerms?: string;
}

export function generateTenancyAgreement(data: TenancyData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const rent = `£${(data.rentAmount / 100).toFixed(2)}`;
    const deposit = `£${(data.depositAmount / 100).toFixed(2)}`;

    doc.fontSize(18).font('Helvetica-Bold').text('ASSURED SHORTHOLD TENANCY AGREEMENT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Housing Act 1988 (as amended)', { align: 'center' });
    doc.moveDown(2);

    const sections = [
      {
        title: '1. PARTIES',
        body: `Landlord: ${data.landlordName}\nAddress: ${data.landlordAddress}\n\nTenant: ${data.tenantName}${data.tenantAddress ? '\nCurrent Address: ' + data.tenantAddress : ''}`,
      },
      {
        title: '2. PROPERTY',
        body: `The property known as: ${data.propertyAddress}`,
      },
      {
        title: '3. TERM',
        body: `Fixed term of ${data.periodMonths} months.\nStart Date: ${data.startDate}\nEnd Date: ${data.endDate}`,
      },
      {
        title: '4. RENT',
        body: `The rent shall be ${rent} per ${data.rentPeriod}, payable in advance.`,
      },
      {
        title: '5. DEPOSIT',
        body: `A deposit of ${deposit} shall be paid and protected in an approved scheme.${data.depositScheme ? '\nScheme: ' + data.depositScheme : ''}`,
      },
      {
        title: '6. TENANT OBLIGATIONS',
        body: 'The Tenant agrees to pay rent on time, keep the property in good condition, not cause nuisance, and comply with all obligations under the tenancy.',
      },
      {
        title: '7. LANDLORD OBLIGATIONS',
        body: 'The Landlord agrees to maintain the structure and exterior, keep installations in working order, and comply with all statutory obligations.',
      },
      {
        title: '8. TERMINATION',
        body: 'Either party may terminate by giving at least two months written notice, to expire at the end of the fixed term or any period thereafter.',
      },
    ];

    for (const s of sections) {
      doc.fontSize(12).font('Helvetica-Bold').text(s.title);
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(s.body);
      doc.moveDown(1);
    }

    if (data.specialTerms) {
      doc.fontSize(12).font('Helvetica-Bold').text('9. SPECIAL TERMS');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(data.specialTerms);
      doc.moveDown(1);
    }

    doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').text('SIGNATURES');
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica');
    doc.text('Signed by the Landlord: ____________________________    Date: ____________');
    doc.moveDown(1);
    doc.text(`Name: ${data.landlordName}`);
    doc.moveDown(2);
    doc.text('Signed by the Tenant: ____________________________    Date: ____________');
    doc.moveDown(1);
    doc.text(`Name: ${data.tenantName}`);
    doc.end();
  });
}
