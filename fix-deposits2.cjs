const fs = require('fs');
const bf = 'server/pmWorkflowRoutes.ts';
let bc = fs.readFileSync(bf, 'utf8');

// Find the deposits GET handler using regex that handles both LF and CRLF
const depositsRegex = /pmWorkflowRouter\.get\("\/deposits", requireAgent, async \(req, res\) => \{[\s\S]*?res\.json\(result\.rows\);[\s\S]*?\}\);/;

const match = bc.match(depositsRegex);
if (match) {
  console.log('Found deposits handler, length:', match[0].length);
  
  // Detect line ending from the match
  const nl = match[0].includes('\r\n') ? '\r\n' : '\n';
  
  const newHandler = [
    'pmWorkflowRouter.get("/deposits", requireAgent, async (req, res) => {',
    '  try {',
    '    const { status } = req.query;',
    '    let sql = "SELECT t.id as tenancy_id, t.deposit_amount, t.deposit_scheme, t.deposit_certificate_number, t.deposit_protected_date, t.deposit_holder_type, t.start_date, t.end_date, t.status as tenancy_status, p.address as property_address, p.postcode as property_postcode, te.name as tenant_name, te.email as tenant_email, l.name as landlord_name FROM tenancy t LEFT JOIN property p ON t.property_id = p.id LEFT JOIN tenant te ON t.tenant_id = te.id LEFT JOIN landlord l ON t.landlord_id = l.id WHERE t.deposit_amount IS NOT NULL";',
    '    const params: any[] = [];',
    '',
    '    if (status === "protected") {',
    '      sql += " AND t.deposit_certificate_number IS NOT NULL AND t.deposit_certificate_number != \'\'";',
    '    } else if (status === "unprotected") {',
    '      sql += " AND (t.deposit_certificate_number IS NULL OR t.deposit_certificate_number = \'\')";',
    '    }',
    '',
    '    sql += " ORDER BY t.created_at DESC";',
    '',
    '    const result = await pool.query(sql, params);',
    '    const rows = result.rows;',
    '',
    '    // Compute stats',
    '    const protectedCount = rows.filter((r: any) => r.deposit_certificate_number).length;',
    '    const totalValue = rows.reduce((sum: number, r: any) => sum + parseFloat(r.deposit_amount || \'0\'), 0);',
    '',
    '    // Map rows to expected shape',
    '    const deposits = rows.map((r: any) => ({',
    '      tenancy_id: r.tenancy_id,',
    '      tenant_name: r.tenant_name || \'\',',
    '      tenant_email: r.tenant_email || \'\',',
    '      property_address: r.property_address || \'\',',
    '      landlord_name: r.landlord_name || \'\',',
    '      deposit_amount: Math.round(parseFloat(r.deposit_amount || \'0\') * 100),',
    '      deposit_scheme: r.deposit_scheme,',
    '      deposit_holder_type: r.deposit_holder_type,',
    '      deposit_certificate_number: r.deposit_certificate_number,',
    '      protected_date: r.deposit_protected_date,',
    '    }));',
    '',
    '    res.json({',
    '      deposits,',
    '      stats: {',
    '        total: rows.length,',
    '        protected: protectedCount,',
    '        unprotected: rows.length - protectedCount,',
    '        totalValue: Math.round(totalValue * 100),',
    '      },',
    '    });',
    '  } catch (error: any) {',
    '    console.error("Error fetching deposits:", error);',
    '    res.status(500).json({ error: error.message });',
    '  }',
    '});',
  ].join(nl);
  
  bc = bc.replace(depositsRegex, newHandler);
  console.log('OK: Deposits handler replaced');
} else {
  console.log('FAIL: Could not find deposits handler with regex');
}

fs.writeFileSync(bf, bc, 'utf8');
console.log('Done');
