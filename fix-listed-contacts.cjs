const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  const contacts = await pool.query(
    "SELECT id, full_name, inquiry_type, property_address, postcode, property_type, bedrooms, valuation_amount FROM contact WHERE workflow_stage = 'listed' AND linked_property_id IS NULL"
  );

  for (const c of contacts.rows) {
    const isRental = c.inquiry_type === 'letting';
    const title = (c.property_type || 'Property') + ' in ' + (c.postcode || '');

    const prop = await pool.query(
      `INSERT INTO property (
        title, description, address_line1, postcode, property_type, bedrooms, bathrooms,
        tenure, price, status, is_listed, is_rental, is_published_website,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 1, 'freehold', $7, 'active', true, $8, false, NOW(), NOW())
      RETURNING id`,
      [title, title, c.property_address || '', c.postcode || '', c.property_type || 'house', c.bedrooms || 3, c.valuation_amount || 0, isRental]
    );

    const propId = prop.rows[0].id;
    await pool.query('UPDATE contact SET linked_property_id = $1 WHERE id = $2', [propId, c.id]);
    console.log('Fixed contact', c.id, c.full_name, '-> property', propId);
  }

  await pool.end();
}

fix().catch(e => { console.error(e); process.exit(1); });
