// Simple utility to print the current email configuration
// Run with `tsx server/test-config.ts`

console.log(`=== Email Configuration Test ===`);
console.log(`SMTP_HOST: ${process.env.SMTP_HOST || 'Not set'}`);
console.log(`SMTP_PORT: ${process.env.SMTP_PORT || 'Not set'}`);
console.log(`SMTP_SECURE: ${process.env.SMTP_SECURE || 'Not set'}`);
console.log(`SMTP_USERNAME: ${process.env.SMTP_USERNAME || 'Not set'}`);
console.log(`SMTP_PASSWORD set: ${process.env.SMTP_PASSWORD ? 'Yes' : 'No'}`);
console.log(`============================`);

if (process.env.SMTP_PORT === '993') {
  console.warn("WARNING: Port 993 is typically used for IMAP, not SMTP!");
  console.warn("Common SMTP ports are: 25, 465, 587");
}

if (process.env.SMTP_SECURE && process.env.SMTP_SECURE !== 'true' && process.env.SMTP_SECURE !== 'false') {
  console.warn(`WARNING: SMTP_SECURE should be 'true' or 'false', not '${process.env.SMTP_SECURE}'`);
}