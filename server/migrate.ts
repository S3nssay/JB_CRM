import { db } from './db';
import { sql } from 'drizzle-orm';

async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Create users table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        phone TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Users table created or verified');
    
    // Add userId column to properties table if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'properties' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE properties ADD COLUMN user_id INTEGER REFERENCES users(id);
        END IF;
      END $$;
    `);
    console.log('✅ Added user_id to properties table (if needed)');
    
    // Add userId column to contacts table if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'contacts' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE contacts ADD COLUMN user_id INTEGER REFERENCES users(id);
        END IF;
      END $$;
    `);
    console.log('✅ Added user_id to contacts table (if needed)');
    
    // Add userId column to valuations table if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'valuations' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE valuations ADD COLUMN user_id INTEGER REFERENCES users(id);
        END IF;
      END $$;
    `);
    console.log('✅ Added user_id to valuations table (if needed)');
    
    // Add userId column to ownerships table if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'ownerships' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE ownerships ADD COLUMN user_id INTEGER REFERENCES users(id);
        END IF;
      END $$;
    `);
    console.log('✅ Added user_id to ownerships table (if needed)');
    
    // Create session table for passport/connect-pg-simple
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    console.log('✅ Session table created or verified');
    
    console.log('✅ All migrations completed successfully');
    
    // Disconnect when done
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();