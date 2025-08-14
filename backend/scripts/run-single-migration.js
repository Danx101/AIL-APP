const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

async function runMigration(migrationFile) {
  let connection;
  
  try {
    // Database configuration
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'abnehmen_app'
    };

    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations', migrationFile);
    console.log('📄 Reading migration file:', migrationPath);
    let migrationSQL = await fs.readFile(migrationPath, 'utf8');

    // Remove SQL comments
    migrationSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && stmt.length > 5);

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      const firstWords = statement.substring(0, 60).replace(/\n/g, ' ').replace(/\s+/g, ' ');
      console.log(`[${i + 1}/${statements.length}] ${firstWords}...`);
      
      try {
        const [result] = await connection.execute(statement);
        console.log(`   ✅ Success (${result.affectedRows || 0} rows affected)`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`   ⚠️  Column already exists`);
        } else if (err.code === 'ER_DUP_KEYNAME') {
          console.log(`   ⚠️  Index already exists`);
        } else if (err.code === 'ER_BAD_FIELD_ERROR') {
          console.log(`   ⚠️  Field doesn't exist`);
        } else {
          console.log(`   ❌ Error: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔒 Database connection closed');
    }
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-single-migration.js <migration-file>');
  process.exit(1);
}

runMigration(migrationFile).catch(console.error);