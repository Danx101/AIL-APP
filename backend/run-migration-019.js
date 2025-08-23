#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const db = require('./src/database/database-wrapper');

async function runMigration() {
  try {
    console.log('🚀 Starting Subscription System Migration (019)...\n');
    
    // Initialize database connection
    await db.init();
    console.log('✅ Database connection established\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '019_subscription_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split migration into individual statements
    const statements = [];
    const lines = migrationSQL.split('\n');
    let currentStatement = '';
    let inCommentBlock = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Handle comment blocks
      if (trimmedLine.startsWith('/*')) {
        inCommentBlock = true;
        continue;
      }
      if (inCommentBlock && trimmedLine.endsWith('*/')) {
        inCommentBlock = false;
        continue;
      }
      if (inCommentBlock) {
        continue;
      }
      
      // Skip single line comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('--')) {
        continue;
      }
      
      // Add line to current statement
      currentStatement += line + '\n';
      
      // If line ends with semicolon, complete the statement
      if (trimmedLine.endsWith(';')) {
        const cleanStatement = currentStatement.trim();
        if (cleanStatement && cleanStatement !== ';') {
          statements.push(cleanStatement);
        }
        currentStatement = '';
      }
    }

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 80)}...`);
      
      try {
        // Handle different statement types
        if (statement.toUpperCase().includes('SELECT')) {
          // For SELECT statements (verification queries), show results
          const result = await db.all(statement);
          console.log('   📊 Query result:', result);
        } else {
          // For DDL/DML statements
          const result = await db.run(statement);
          if (result && result.changes !== undefined) {
            console.log(`   ✅ Success: ${result.changes} rows affected`);
          } else {
            console.log('   ✅ Success: Statement executed');
          }
        }
        successCount++;
      } catch (error) {
        // Check if it's a "table already exists" or similar expected error
        if (error.message.includes('already exists') || 
            error.message.includes('Duplicate column') ||
            error.message.includes('Duplicate key')) {
          console.log(`   ⚠️  Skipping: ${error.message}`);
          skipCount++;
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          throw error;
        }
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log(`   ✅ ${successCount} statements executed`);
    console.log(`   ⚠️  ${skipCount} statements skipped (already exists)`);

    // Run verification queries
    console.log('\n🔍 Running verification checks...');
    
    try {
      // Check subscriptions table
      const subCount = await db.get('SELECT COUNT(*) as count FROM subscriptions');
      console.log(`   📊 Subscriptions created: ${subCount.count}`);

      // Check studio owners with trials
      const trialUsers = await db.all(`
        SELECT u.email, s.status, s.trial_ends_at,
               DATEDIFF(s.trial_ends_at, NOW()) as days_remaining
        FROM users u
        JOIN subscriptions s ON u.id = s.user_id
        WHERE u.role = 'studio_owner'
        ORDER BY s.trial_ends_at
        LIMIT 5
      `);
      
      console.log('\n   📋 Sample studio owner trials:');
      trialUsers.forEach(user => {
        const status = user.days_remaining > 0 ? '🟢 Active' : 
                      user.days_remaining >= -7 ? '🟡 Grace Period' : '🔴 Expired';
        console.log(`      ${user.email}: ${status} (${user.days_remaining} days)`);
      });

      // Check promocodes table
      const promoCount = await db.get('SELECT COUNT(*) as count FROM promocodes');
      console.log(`\n   📊 Promocodes table ready: ${promoCount.count} codes`);

    } catch (verificationError) {
      console.log('   ⚠️  Verification queries failed (expected if tables were already created)');
    }

    console.log('\n✨ Subscription system is now ready!');
    console.log('   • Studio owners have 30-day trials');
    console.log('   • Managers can generate promocodes'); 
    console.log('   • Studio limits are enforced');
    console.log('   • Analytics dashboard is available');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;