import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseDatabaseUrl = process.env.DATABASE_URL; // This will be the Supabase postgres URL

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check SUPABASE_URL and SUPABASE_ANON_KEY');
}

if (!supabaseDatabaseUrl) {
  throw new Error('Missing DATABASE_URL for Supabase postgres connection');
}

// Create Supabase client for auth and realtime features
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create Drizzle client for database operations using the direct postgres connection
const postgresClient = postgres(supabaseDatabaseUrl);
export const db = drizzle(postgresClient, { schema });