#!/usr/bin/env node

const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fixMaxStudios() {
  console.log('🔧 Fixing Max\'s studio issue...\n');

  // MySQL connection
  const mysqlConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'hopper.proxy.rlwy.net',
    port: process.env.DB_PORT || process.env.MYSQLPORT || 34671,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'bbr1hm1gPbZdyKSrAeRepjooYRiSayER',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
    ssl: { rejectUnauthorized: false }
  };

  const connection = await mysql.createConnection(mysqlConfig);

  try {
    // Get Max's user ID
    const [maxUser] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      ['maxberger@ail.com']
    );

    if (maxUser.length === 0) {
      console.log('❌ Max user not found!');
      return;
    }

    const maxUserId = maxUser[0].id;
    console.log(`📊 Max's user ID: ${maxUserId}`);

    // Get Max's studios
    const [studios] = await connection.execute(
      'SELECT * FROM studios WHERE owner_id = ? ORDER BY id',
      [maxUserId]
    );

    console.log(`\n📊 Max currently has ${studios.length} studios:`);
    for (const studio of studios) {
      // Get customer count for each studio
      const [customers] = await connection.execute(`
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        JOIN activation_codes ac ON u.id = ac.used_by_user_id
        WHERE ac.studio_id = ? AND u.role = 'customer'
      `, [studio.id]);

      console.log(`  - Studio ${studio.id}: ${studio.name} (${studio.city}) - ${customers[0].count} customers`);
    }

    if (studios.length <= 1) {
      console.log('\n✅ Max already has only one studio or less. No fix needed.');
      return;
    }

    // Studio 3 (AiL Berlin) has more customers, so we'll keep it as the primary
    console.log('\n🔄 Merging studios - keeping Studio 3 (AiL Berlin) as primary...');

    // Start transaction
    await connection.beginTransaction();

    try {
      // 1. Move all activation codes from Studio 1 to Studio 3
      console.log('  - Moving activation codes...');
      await connection.execute(
        'UPDATE activation_codes SET studio_id = 3 WHERE studio_id = 1'
      );

      // 2. Move any appointments from Studio 1 to Studio 3
      console.log('  - Moving appointments...');
      await connection.execute(
        'UPDATE appointments SET studio_id = 3 WHERE studio_id = 1'
      );

      // 3. Move any customer sessions from Studio 1 to Studio 3
      console.log('  - Moving customer sessions...');
      await connection.execute(
        'UPDATE customer_sessions SET studio_id = 3 WHERE studio_id = 1'
      );

      // 4. Move any leads from Studio 1 to Studio 3
      console.log('  - Moving leads...');
      await connection.execute(
        'UPDATE leads SET studio_id = 3 WHERE studio_id = 1'
      );

      // 5. Move any appointment types from Studio 1 to Studio 3
      console.log('  - Moving appointment types...');
      await connection.execute(
        'UPDATE appointment_types SET studio_id = 3 WHERE studio_id = 1'
      );

      // 6. Delete Studio 1
      console.log('  - Deleting duplicate studio...');
      await connection.execute(
        'DELETE FROM studios WHERE id = 1'
      );

      // Commit transaction
      await connection.commit();
      console.log('\n✅ Successfully merged studios!');

      // Verify the result
      const [finalCheck] = await connection.execute(`
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        JOIN activation_codes ac ON u.id = ac.used_by_user_id
        WHERE ac.studio_id = 3 AND u.role = 'customer'
      `);

      console.log(`\n📊 Studio 3 (AiL Berlin) now has ${finalCheck[0].count} customers`);

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixMaxStudios();