import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdmin() {
  console.log('Creating admin user...');

  // Check if admin already exists
  const existing = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);

  if (existing.length > 0) {
    console.log('Admin user already exists with id:', existing[0].id);
    console.log('Updating password...');

    const hashedPassword = await hashPassword('admin123');
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.username, 'admin'));

    console.log('Admin password updated successfully!');
  } else {
    // Create new admin user
    const hashedPassword = await hashPassword('admin123');

    const [newAdmin] = await db.insert(users).values({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@johnbarclay.co.uk',
      fullName: 'System Administrator',
      role: 'admin',
      securityClearance: 10,
      isActive: true
    }).returning();

    console.log('Admin user created with id:', newAdmin.id);
  }

  console.log('\nAdmin credentials:');
  console.log('  Username: admin');
  console.log('  Password: admin123');

  process.exit(0);
}

createAdmin().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
