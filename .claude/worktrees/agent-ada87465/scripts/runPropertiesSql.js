// Simple Node.js script to run the properties SQL
import { readFileSync } from 'fs';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const client = postgres(connectionString);

async function runPropertiesSQL() {
  try {
    console.log('🌱 Starting to insert properties...');

    // Read the SQL file
    const sqlContent = readFileSync('scripts/insert_properties_only.sql', 'utf8');

    // Split by semicolons to get individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📄 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          await client.unsafe(statement);
          console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
        } catch (error) {
          console.log(`❌ Error in statement ${i + 1}:`, error.message);
        }
      }
    }

    // Get final count
    const result = await client`
      SELECT
        COUNT(*) as total_properties,
        COUNT(CASE WHEN property_type = 'house' THEN 1 END) as houses,
        COUNT(CASE WHEN property_type = 'flat' THEN 1 END) as flats,
        COUNT(CASE WHEN property_type = 'commercial' THEN 1 END) as commercial
      FROM properties;
    `;

    console.log('🎉 Properties insertion completed!');
    console.log('📊 Final count:');
    console.log(`   • Total properties: ${result[0].total_properties}`);
    console.log(`   • Houses: ${result[0].houses}`);
    console.log(`   • Flats: ${result[0].flats}`);
    console.log(`   • Commercial: ${result[0].commercial}`);

  } catch (error) {
    console.error('❌ Error running properties SQL:', error);
  } finally {
    await client.end();
  }
}

runPropertiesSQL();