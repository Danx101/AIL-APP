#!/usr/bin/env node

const { initializeDatabase } = require('../src/database/mysql-connection');

async function main() {
  console.log('🚀 Initializing MySQL database tables...');
  
  try {
    await initializeDatabase();
    console.log('✅ MySQL database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ MySQL database initialization failed:', error.message);
    process.exit(1);
  }
}

main();