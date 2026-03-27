# Supabase Migration Guide

This guide helps migrate the John Barclay estate agent website from Neon PostgreSQL to Supabase.

## Step 1: Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: john-barclay-estate
   - **Database Password**: Choose a strong password
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Start with the free tier

## Step 2: Get Your Supabase Credentials

Once your project is created, go to **Settings > API** and copy:

- **Project URL**: `https://your-project-ref.supabase.co`
- **Project API Keys**:
  - `anon` key (public key)
  - `service_role` key (secret key, for server-side operations)

## Step 3: Get Your Database Connection String

Go to **Settings > Database** and copy the connection string:
- Format: `postgresql://postgres.PROJECT_REF:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`
- Replace `[PASSWORD]` with your database password

## Step 4: Update Environment Variables

Update your `.env` file with the new Supabase credentials:

```env
# Replace with your Supabase values
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Keep existing
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key
```

## Step 5: Run the Migration

The database schema has been exported to `migrations/0000_handy_the_captain.sql`. To apply it:

### Option A: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Click on **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `migrations/0000_handy_the_captain.sql`
5. Click **Run**

### Option B: Using Drizzle Kit (Recommended)
```bash
npm run db:push
```

## Step 6: Verify the Migration

1. Check that all tables were created in your Supabase dashboard
2. Go to **Table Editor** and verify you see:
   - contacts
   - london_areas
   - properties
   - property_inquiries
   - users
   - valuations

## Step 7: Test the Application

1. Start the development server: `npm run dev`
2. Visit `http://localhost:5000`
3. Test the AI chat functionality
4. Verify database operations are working

## Step 8: Authentication Migration (Next Phase)

The current system uses custom authentication. To fully leverage Supabase:

1. **Enable Authentication** in your Supabase project
2. Configure authentication providers (email/password, Google, etc.)
3. Update the frontend to use Supabase Auth
4. Migrate existing user accounts

## Troubleshooting

### Common Issues:

1. **Connection errors**: Double-check your DATABASE_URL format and credentials
2. **SSL errors**: Ensure you're using the connection pooler URL
3. **Permission errors**: Make sure you're using the correct database password

### Rollback Plan:

If you need to rollback to Neon:
1. Update DATABASE_URL back to your Neon connection string
2. Remove SUPABASE_URL and SUPABASE_ANON_KEY from .env
3. Restart the server

## Benefits of Supabase

- **Built-in Authentication**: Row-level security, social logins
- **Real-time subscriptions**: Live updates for property listings
- **Auto-generated APIs**: REST and GraphQL APIs
- **Dashboard**: Easy database management
- **Storage**: File uploads for property images
- **Edge Functions**: Serverless functions for complex operations

## Next Steps

1. Set up authentication
2. Implement real-time property updates
3. Add file storage for property images
4. Configure row-level security policies