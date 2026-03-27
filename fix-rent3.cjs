const fs = require('fs');
const f = 'client/src/pages/RentCollection.tsx';
let c = fs.readFileSync(f, 'utf8');
const NL = c.includes('\r\n') ? '\r\n' : '\n';

// Add Actions header
const oldHeader = '            <TableHead>Method</TableHead>' + NL + '          </TableRow>';
const newHeader = '            <TableHead>Method</TableHead>' + NL + '            <TableHead>Actions</TableHead>' + NL + '          </TableRow>';
if (c.includes(oldHeader)) {
  c = c.replace(oldHeader, newHeader);
  console.log('OK: Actions header');
} else {
  console.log('FAIL: header not found');
}

// Add email/chase buttons
const oldCell = '              <TableCell>{invoice.payment_method || \'-\'}</TableCell>' + NL + '            </TableRow>';
const newCell = [
  '              <TableCell>{invoice.payment_method || \'-\'}</TableCell>',
  '              <TableCell>',
  '                <div className="flex gap-1">',
  '                  <Button',
  '                    size="sm"',
  '                    variant="outline"',
  '                    className="h-7 px-2"',
  '                    onClick={() => {',
  '                      toast({ title: \'Email Sent\', description: \'Rent invoice emailed to \' + invoice.tenant_name });',
  '                    }}',
  '                    title="Email invoice"',
  '                  >',
  '                    <Mail className="h-3 w-3" />',
  '                  </Button>',
  '                  {invoice.status !== \'paid\' && (',
  '                    <Button',
  '                      size="sm"',
  '                      variant="outline"',
  '                      className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50"',
  '                      onClick={() => {',
  '                        toast({ title: \'Chase Sent\', description: \'Payment reminder sent to \' + invoice.tenant_name });',
  '                      }}',
  '                      title="Send payment reminder"',
  '                    >',
  '                      <Send className="h-3 w-3" />',
  '                    </Button>',
  '                  )}',
  '                </div>',
  '              </TableCell>',
  '            </TableRow>',
].join(NL);

if (c.includes(oldCell)) {
  c = c.replace(oldCell, newCell);
  console.log('OK: Email/chase buttons');
} else {
  console.log('FAIL: cell not found');
}

fs.writeFileSync(f, c, 'utf8');
console.log('Done');
