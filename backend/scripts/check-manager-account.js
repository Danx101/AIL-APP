const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function checkAndCreateManager() {
  const connection = await mysql.createConnection({
    host: 'hopper.proxy.rlwy.net',
    port: 34671,
    user: 'root',
    password: 'bbrlhmlgPbZdyKSrAeRepjooYRiSayER',
    database: 'railway'
  });

  try {
    // Check existing managers
    console.log('🔍 Checking existing manager accounts...\n');
    const [managers] = await connection.execute(
      "SELECT id, email, first_name, last_name, is_active FROM users WHERE role = 'manager'"
    );
    
    if (managers.length > 0) {
      console.log('✅ Found existing managers:');
      managers.forEach(manager => {
        console.log(`- ID: ${manager.id}, Email: ${manager.email}, Name: ${manager.first_name} ${manager.last_name}, Active: ${manager.is_active}`);
      });
    } else {
      console.log('❌ No manager accounts found.');
    }
    
    // Create a test manager if needed
    console.log('\n📝 Would you like to create a test manager account?');
    console.log('Email: manager@example.com');
    console.log('Password: manager123');
    
    // Check if test manager already exists
    const [existing] = await connection.execute(
      "SELECT id FROM users WHERE email = 'manager@example.com'"
    );
    
    if (existing.length > 0) {
      console.log('\n⚠️ Test manager already exists. Updating password...');
      
      const hashedPassword = await bcrypt.hash('manager123', 10);
      await connection.execute(
        "UPDATE users SET password_hash = ?, role = 'manager', is_active = 1 WHERE email = 'manager@example.com'",
        [hashedPassword]
      );
      
      console.log('✅ Password updated for test manager account.');
    } else {
      console.log('\n🆕 Creating test manager account...');
      
      const hashedPassword = await bcrypt.hash('manager123', 10);
      await connection.execute(
        "INSERT INTO users (email, password_hash, role, first_name, last_name, is_active) VALUES (?, ?, 'manager', 'Test', 'Manager', 1)",
        ['manager@example.com', hashedPassword]
      );
      
      console.log('✅ Test manager account created successfully!');
    }
    
    console.log('\n📋 Manager login credentials:');
    console.log('Email: manager@example.com');
    console.log('Password: manager123');
    console.log('\n💡 Use these credentials to login at /admin-panel-2025');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkAndCreateManager();