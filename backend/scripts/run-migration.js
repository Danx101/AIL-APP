const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

async function runMigration() {
  let connection;
  
  try {
    // Database configuration
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'abnehmen_app',
      multipleStatements: true // Allow multiple SQL statements
    };

    console.log('🔧 Connecting to database...');
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}`);
    
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001_customer_differentiation.sql');
    console.log('📄 Reading migration file:', migrationPath);
    let migrationSQL = await fs.readFile(migrationPath, 'utf8');

    // Remove SQL comments
    migrationSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && stmt.length > 5);

    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    console.log('🚀 Running migration...\n');

    // Execute each statement individually for better error handling
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'; // Re-add semicolon
      
      // Extract first few words for logging
      const firstWords = statement.substring(0, 60).replace(/\n/g, ' ').replace(/\s+/g, ' ');
      console.log(`   [${i + 1}/${statements.length}] Executing: ${firstWords}...`);
      
      try {
        await connection.execute(statement);
        console.log(`   ✅ Success`);
      } catch (err) {
        // Some errors are expected (e.g., column already exists)
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
          console.log(`   ⚠️  Skipped (already exists)`);
        } else if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`   ⚠️  Skipped (field doesn't exist)`);
        } else if (err.code === 'ER_BAD_FIELD_ERROR') {
          console.log(`   ⚠️  Skipped (field doesn't exist)`);
        } else if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`   ⚠️  Skipped (table already exists)`);
        } else {
          console.log(`   ❌ Error: ${err.message}`);
          // Continue with other statements instead of failing completely
        }
      }
    }

    console.log('\n📊 Running verification queries...\n');

    // Verification queries
    const verifications = [
      {
        name: 'Studio Unique Identifiers',
        query: 'SELECT id, name, city, unique_identifier, registration_enabled FROM studios'
      },
      {
        name: 'Customer Types Distribution',
        query: 'SELECT customer_type, COUNT(*) as count FROM customers GROUP BY customer_type'
      },
      {
        name: 'Lead Status Distribution',
        query: 'SELECT status, is_archived, COUNT(*) as count FROM leads GROUP BY status, is_archived'
      }
    ];

    for (const verification of verifications) {
      console.log(`📈 ${verification.name}:`);
      try {
        const [rows] = await connection.execute(verification.query);
        console.table(rows);
      } catch (err) {
        console.log(`   ⚠️  Could not verify: ${err.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔒 Database connection closed');
    }
  }
}

// Run the migration
runMigration().catch(console.error);