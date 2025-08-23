const fs = require('fs');
const path = require('path');
const db = require('./src/database/database-wrapper');

async function runMigration() {
  console.log('🔄 Running migration 010_add_verification_attempts.sql');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '010_add_verification_attempts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration content:');
    console.log(migrationSQL);
    console.log('\n🚀 Executing migration...');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`   Executing: ${statement.substring(0, 50)}...`);
        await db.run(statement);
        console.log('   ✅ Success');
      }
    }

    // Verify the column was added
    console.log('\n🔍 Verifying migration...');
    try {
      const testQuery = await db.get('SELECT verification_attempts FROM users LIMIT 1');
      console.log('✅ verification_attempts column exists and is accessible');
    } catch (error) {
      console.log('❌ verification_attempts column verification failed:', error.message);
    }

    // Show updated schema for users table
    console.log('\n📋 Current users table structure:');
    try {
      const columns = await db.all("SHOW COLUMNS FROM users");
      console.log('Columns:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default ? `default: ${col.Default}` : ''}`);
      });
    } catch (error) {
      console.log('Could not retrieve table structure:', error.message);
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    
    // Check if column already exists
    if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️  Column already exists - migration may have been run before');
      
      // Verify it exists
      try {
        const testQuery = await db.get('SELECT verification_attempts FROM users LIMIT 1');
        console.log('✅ verification_attempts column confirmed to exist');
      } catch (verifyError) {
        console.log('❌ Column exists but is not accessible:', verifyError.message);
      }
    }
  } finally {
    // Close database connection
    try {
      if (db.close) {
        await db.close();
      }
    } catch (error) {
      console.log('Note: Could not close database connection cleanly');
    }
  }
}

// Run the migration
runMigration().catch(console.error);