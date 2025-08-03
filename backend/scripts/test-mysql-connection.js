const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('🔌 Testing Railway MySQL connection...');
    
    // Use the connection URL directly
    const connection = await mysql.createConnection('mysql://root:bbr1hm1gPbZdyKSrAeRepjooYRiSayER@hopper.proxy.rlwy.net:34671/railway?ssl={"rejectUnauthorized":false}');
    
    // Test query
    const [version] = await connection.execute('SELECT VERSION() as version');
    console.log('✅ Connected successfully!');
    console.log('MySQL Version:', version[0].version);
    
    // Show tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\n📊 Existing tables:');
    tables.forEach(table => {
      console.log('  -', Object.values(table)[0]);
    });
    
    // Check users count
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log('\n👥 Current users in MySQL:', users[0].count);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
  }
}

testConnection();