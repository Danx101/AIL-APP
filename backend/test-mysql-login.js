const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testLogin() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('Connected to MySQL');

    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      ['maxberger@ail.com']
    );

    if (rows.length === 0) {
      console.log('User not found in MySQL');
      return;
    }

    const user = rows[0];
    console.log('User found in MySQL:', user.email, user.first_name, user.last_name);
    console.log('Stored hash in MySQL:', user.password_hash);

    try {
      const isValid = await bcrypt.compare('IchbinMax123', user.password_hash);
      console.log('Password valid in MySQL:', isValid);
    } catch (error) {
      console.log('Password check error:', error.message);
    }

    await connection.end();
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

testLogin();