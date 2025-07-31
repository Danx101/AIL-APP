const sqlite3 = require('sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.get('SELECT * FROM users WHERE email = ?', ['maxberger@ail.com'], async (err, user) => {
  if (err) {
    console.log('Error:', err);
    return;
  }
  
  if (!user) {
    console.log('User not found in SQLite');
    return;
  }
  
  console.log('User found in SQLite:', user.email, user.first_name, user.last_name);
  
  try {
    const isValid = await bcrypt.compare('IchbinMax123', user.password_hash);
    console.log('Password valid in SQLite:', isValid);
    console.log('Stored hash:', user.password_hash);
  } catch (error) {
    console.log('Password check error:', error.message);
  }
  
  db.close();
});