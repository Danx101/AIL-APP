const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

async function verifyDatabase() {
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
    console.log('✅ Connected to MySQL database\n');

    // Verification queries
    const verifications = [
      {
        name: '📍 Studio Unique Identifiers',
        query: 'SELECT id, name, city, unique_identifier FROM studios'
      },
      {
        name: '👥 Customers with Registration Codes',
        query: `SELECT 
                  id, 
                  CONCAT(contact_first_name, ' ', contact_last_name) as name,
                  registration_code,
                  has_app_access,
                  total_sessions_purchased,
                  customer_since
                FROM customers 
                LIMIT 10`
      },
      {
        name: '📊 Customer Registration Status',
        query: `SELECT 
                  has_app_access,
                  COUNT(*) as count,
                  AVG(total_sessions_purchased) as avg_sessions
                FROM customers 
                GROUP BY has_app_access`
      },
      {
        name: '🎯 Lead Status Distribution',
        query: `SELECT 
                  status,
                  is_archived,
                  COUNT(*) as count
                FROM leads 
                GROUP BY status, is_archived
                ORDER BY is_archived, status`
      },
      {
        name: '📅 Appointment Person Types',
        query: `SELECT 
                  person_type,
                  COUNT(*) as count
                FROM appointments 
                GROUP BY person_type`
      },
      {
        name: '🔄 Lead Activities',
        query: `SELECT 
                  activity_type,
                  COUNT(*) as count
                FROM lead_activities 
                GROUP BY activity_type`
      },
      {
        name: '⚠️ Customers Without Sessions',
        query: `SELECT 
                  id,
                  CONCAT(contact_first_name, ' ', contact_last_name) as name,
                  registration_code,
                  total_sessions_purchased
                FROM customers 
                WHERE total_sessions_purchased = 0`
      },
      {
        name: '✅ Registration Code Uniqueness Check',
        query: `SELECT 
                  registration_code,
                  COUNT(*) as count
                FROM customers 
                GROUP BY registration_code 
                HAVING count > 1`
      }
    ];

    for (const verification of verifications) {
      console.log(`\n${verification.name}:`);
      console.log('─'.repeat(60));
      try {
        const [rows] = await connection.execute(verification.query);
        if (rows.length === 0) {
          console.log('  ✓ No records found (this may be expected)');
        } else {
          console.table(rows);
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
      }
    }

    // Check views
    console.log('\n📊 Database Views:');
    console.log('─'.repeat(60));
    const [views] = await connection.execute(
      "SELECT table_name FROM information_schema.views WHERE table_schema = ?",
      [dbConfig.database]
    );
    if (views.length > 0) {
      console.table(views);
    } else {
      console.log('  No views found');
    }

    // Summary
    const [customerCount] = await connection.execute('SELECT COUNT(*) as total FROM customers');
    const [leadCount] = await connection.execute('SELECT COUNT(*) as total FROM leads WHERE is_archived = FALSE');
    const [appointmentCount] = await connection.execute('SELECT COUNT(*) as total FROM appointments WHERE appointment_date >= CURDATE()');
    
    console.log('\n📈 Database Summary:');
    console.log('─'.repeat(60));
    console.log(`  Total Customers: ${customerCount[0].total}`);
    console.log(`  Active Leads: ${leadCount[0].total}`);
    console.log(`  Upcoming Appointments: ${appointmentCount[0].total}`);
    
    console.log('\n✅ Database verification completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔒 Database connection closed');
    }
  }
}

// Run the verification
verifyDatabase().catch(console.error);