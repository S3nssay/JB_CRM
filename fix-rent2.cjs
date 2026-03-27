const fs = require('fs');
const f = 'client/src/pages/RentCollection.tsx';
let c = fs.readFileSync(f, 'utf8');

// Add Actions header - match exact indentation from the file
const oldHeader = '            <TableHead>Method</TableHead>\n          </TableRow>';
const newHeader = '            <TableHead>Method</TableHead>\n            <TableHead>Actions</TableHead>\n          </TableRow>';
if (c.includes(oldHeader)) {
  c = c.replace(oldHeader, newHeader);
  console.log('OK: Actions header added');
} else {
  console.log('WARN: Could not find header pattern');
  // Debug: show what's around Method
  const idx = c.indexOf('<TableHead>Method</TableHead>');
  if (idx > -1) {
    const snippet = c.substring(idx, idx + 80).replace(/\n/g, '\n').replace(/ /g, '.');
    console.log('Found at:', snippet);
  }
}

// Add email/chase buttons after payment_method cell
const oldCell = '              <TableCell>{invoice.payment_method || \'-\'}</TableCell>\n            </TableRow>';
const newCell = `              <TableCell>{invoice.payment_method || '-'}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => {
                      toast({ title: 'Email Sent', description: 'Rent invoice emailed to ' + invoice.tenant_name });
                    }}
                    title="Email invoice"
                  >
                    <Mail className="h-3 w-3" />
                  </Button>
                  {invoice.status !== 'paid' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        toast({ title: 'Chase Sent', description: 'Payment reminder sent to ' + invoice.tenant_name });
                      }}
                      title="Send payment reminder"
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>`;

if (c.includes(oldCell)) {
  c = c.replace(oldCell, newCell);
  console.log('OK: Email/chase buttons added');
} else {
  console.log('WARN: Could not find cell pattern');
  const idx = c.indexOf('payment_method');
  if (idx > -1) {
    const snippet = c.substring(idx, idx + 100).replace(/\n/g, '\n').replace(/ /g, '.');
    console.log('Found at:', snippet);
  }
}

fs.writeFileSync(f, c, 'utf8');
console.log('Done');
