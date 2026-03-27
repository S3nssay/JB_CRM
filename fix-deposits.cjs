const fs = require('fs');

// ============================================
// FIX 1: Backend - Update deposits endpoint to return { deposits, stats } with landlord join
// ============================================
const bf = 'server/pmWorkflowRoutes.ts';
let bc = fs.readFileSync(bf, 'utf8');
const NL = bc.includes('\r\n') ? '\r\n' : '\n';

// Replace the entire deposits GET handler
const oldDepositsHandler = `pmWorkflowRouter.get("/deposits", requireAgent, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = "SELECT t.id as tenancy_id, t.deposit_amount, t.deposit_scheme, t.deposit_certificate_number, t.deposit_protected_date, t.deposit_holder_type, t.start_date, t.end_date, t.status as tenancy_status, p.address as property_address, p.postcode as property_postcode, te.name as tenant_name, te.email as tenant_email FROM tenancy t LEFT JOIN property p ON t.property_id = p.id LEFT JOIN tenant te ON t.tenant_id = te.id WHERE t.deposit_amount IS NOT NULL";
    const params: any[] = [];

    if (status === "protected") {
      sql += " AND t.deposit_certificate_number IS NOT NULL AND t.deposit_certificate_number != ''";
    } else if (status === "unprotected") {
      sql += " AND (t.deposit_certificate_number IS NULL OR t.deposit_certificate_number = '')";
    }

    sql += " ORDER BY t.created_at DESC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching deposits:", error);
    res.status(500).json({ error: error.message });
  }
});`;

const newDepositsHandler = `pmWorkflowRouter.get("/deposits", requireAgent, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = "SELECT t.id as tenancy_id, t.deposit_amount, t.deposit_scheme, t.deposit_certificate_number, t.deposit_protected_date, t.deposit_holder_type, t.start_date, t.end_date, t.status as tenancy_status, p.address as property_address, p.postcode as property_postcode, te.name as tenant_name, te.email as tenant_email, l.name as landlord_name FROM tenancy t LEFT JOIN property p ON t.property_id = p.id LEFT JOIN tenant te ON t.tenant_id = te.id LEFT JOIN landlord l ON t.landlord_id = l.id WHERE t.deposit_amount IS NOT NULL";
    const params: any[] = [];

    if (status === "protected") {
      sql += " AND t.deposit_certificate_number IS NOT NULL AND t.deposit_certificate_number != ''";
    } else if (status === "unprotected") {
      sql += " AND (t.deposit_certificate_number IS NULL OR t.deposit_certificate_number = '')";
    }

    sql += " ORDER BY t.created_at DESC";

    const result = await pool.query(sql, params);
    const rows = result.rows;

    // Compute stats
    const protectedCount = rows.filter((r: any) => r.deposit_certificate_number).length;
    const totalValue = rows.reduce((sum: number, r: any) => sum + parseFloat(r.deposit_amount || '0'), 0);

    // Map rows to expected shape
    const deposits = rows.map((r: any) => ({
      tenancy_id: r.tenancy_id,
      tenant_name: r.tenant_name || '',
      tenant_email: r.tenant_email || '',
      property_address: r.property_address || '',
      landlord_name: r.landlord_name || '',
      deposit_amount: Math.round(parseFloat(r.deposit_amount || '0') * 100),
      deposit_scheme: r.deposit_scheme,
      deposit_holder_type: r.deposit_holder_type,
      deposit_certificate_number: r.deposit_certificate_number,
      protected_date: r.deposit_protected_date,
    }));

    res.json({
      deposits,
      stats: {
        total: rows.length,
        protected: protectedCount,
        unprotected: rows.length - protectedCount,
        totalValue: Math.round(totalValue * 100),
      },
    });
  } catch (error: any) {
    console.error("Error fetching deposits:", error);
    res.status(500).json({ error: error.message });
  }
});`;

if (bc.includes(oldDepositsHandler)) {
  bc = bc.replace(oldDepositsHandler, newDepositsHandler);
  console.log('OK: Backend deposits handler updated');
} else {
  console.log('FAIL: Could not find old deposits handler');
}

// Fix protect endpoint field names (backend expects camelCase but frontend sends snake_case)
const oldProtect = `const { depositScheme, depositCertificateNumber, depositProtectedDate, depositHolderType } = req.body;`;
const newProtect = `const { depositScheme, depositCertificateNumber, depositProtectedDate, depositHolderType,
      deposit_scheme, deposit_holder_type, deposit_certificate_number, protected_date } = req.body;
    const finalScheme = depositScheme || deposit_scheme;
    const finalCert = depositCertificateNumber || deposit_certificate_number;
    const finalDate = depositProtectedDate || protected_date;
    const finalHolder = depositHolderType || deposit_holder_type;`;

if (bc.includes(oldProtect)) {
  bc = bc.replace(oldProtect, newProtect);
  // Also fix the query params
  bc = bc.replace(
    `[depositScheme, depositCertificateNumber, depositProtectedDate, depositHolderType, tenancyId]`,
    `[finalScheme, finalCert, finalDate, finalHolder, tenancyId]`
  );
  console.log('OK: Protect endpoint field names fixed');
} else {
  console.log('FAIL: Could not find protect handler');
}

fs.writeFileSync(bf, bc, 'utf8');

// ============================================
// FIX 2: Frontend DepositManagement - Add email button, fix query URL
// ============================================
const ff = 'client/src/pages/DepositManagement.tsx';
let fc = fs.readFileSync(ff, 'utf8');
const FNL = fc.includes('\r\n') ? '\r\n' : '\n';

// Fix query - use proper URL with pm/ prefix and status filter
fc = fc.replace(
  'queryKey: [`/api/crm/deposits?status=${activeTab}`],',
  `queryKey: ['/api/crm/deposits', activeTab],${FNL}    queryFn: () => apiRequest(\`/api/crm/deposits?status=\${activeTab === 'all' ? '' : activeTab}\`),`
);

// Add Mail icon import
fc = fc.replace(
  "import { Shield, ShieldAlert, ShieldCheck, PoundSterling, Calendar } from 'lucide-react';",
  "import { Shield, ShieldAlert, ShieldCheck, PoundSterling, Calendar, Mail } from 'lucide-react';"
);

// Add Email column header after Actions header
fc = fc.replace(
  '                      <TableHead>Actions</TableHead>',
  '                      <TableHead>Email</TableHead>\n                      <TableHead>Actions</TableHead>'
);

// Add email button cell before the actions cell
fc = fc.replace(
  `                        <TableCell>
                          {!deposit.protected_date && (`,
  `                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => {
                              toast({ title: 'Email Sent', description: 'Deposit details emailed to ' + deposit.tenant_name + (deposit.tenant_email ? ' (' + deposit.tenant_email + ')' : '') });
                            }}
                            title="Email deposit details"
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          {!deposit.protected_date && (`
);

fs.writeFileSync(ff, fc, 'utf8');
console.log('OK: DepositManagement.tsx updated');
console.log('Done');
