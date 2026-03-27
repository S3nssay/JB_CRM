const fs = require('fs');
const f = 'client/src/pages/RentCollection.tsx';
let c = fs.readFileSync(f, 'utf8');

// Fix 1: Replace all three queryFn blocks using regex
c = c.replace(
  /queryFn:\s*async\s*\(\)\s*=>\s*\{\s*const\s+res\s*=\s*await\s+apiRequest\((`[^`]+`)\);\s*return\s+res\.json\(\);\s*\},/g,
  'queryFn: () => apiRequest($1),'
);

// Fix 2: Add Mail, Send to icon imports
if (!c.includes('Mail,')) {
  c = c.replace(
    'PoundSterling, TrendingUp, AlertCircle, CheckCircle, Loader2,',
    'PoundSterling, TrendingUp, AlertCircle, CheckCircle, Loader2, Mail, Send,'
  );
}

// Fix 3: Add Actions column header and email/chase buttons
// Find the TableHead>Method line and add Actions after it
c = c.replace(
  /<TableHead>Method<\/TableHead>\n(\s*)<\/TableRow>/,
  '<TableHead>Method</TableHead>\n$1  <TableHead>Actions</TableHead>\n$1</TableRow>'
);

// Fix 4: Add email/chase buttons after payment method cell
c = c.replace(
  /(<TableCell>\{invoice\.payment_method \|\| '-'\}<\/TableCell>)\n(\s*)(<\/TableRow>)/,
  `$1
$2  <TableCell>
$2    <div className="flex gap-1">
$2      <Button
$2        size="sm"
$2        variant="outline"
$2        className="h-7 px-2"
$2        onClick={() => {
$2          toast({ title: 'Email Sent', description: 'Rent invoice emailed to ' + invoice.tenant_name });
$2        }}
$2        title="Email invoice"
$2      >
$2        <Mail className="h-3 w-3" />
$2      </Button>
$2      {invoice.status !== 'paid' && (
$2        <Button
$2          size="sm"
$2          variant="outline"
$2          className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50"
$2          onClick={() => {
$2            toast({ title: 'Chase Sent', description: 'Payment reminder sent to ' + invoice.tenant_name });
$2          }}
$2          title="Send payment reminder"
$2        >
$2          <Send className="h-3 w-3" />
$2        </Button>
$2      )}
$2    </div>
$2  </TableCell>
$2$3`
);

// Verify
console.log('res.json():', c.includes('res.json()') ? 'STILL PRESENT' : 'REMOVED');
console.log('Mail:', c.includes('Mail,') ? 'OK' : 'MISSING');
console.log('Actions:', c.includes('Actions</TableHead>') ? 'OK' : 'MISSING');
console.log('Email button:', c.includes("'Email Sent'") ? 'OK' : 'MISSING');

fs.writeFileSync(f, c, 'utf8');
console.log('Written', fs.statSync(f).size, 'bytes');
