#!/usr/bin/env node

const fetch = require('node-fetch');

async function checkRailwayDb() {
  console.log('🔍 Checking which database Railway is using...\n');

  const baseUrl = 'https://ail-app-production.up.railway.app';
  
  // First, let's check the environment
  try {
    console.log('📋 Checking /api/v1/debug/check-env...');
    const envResponse = await fetch(`${baseUrl}/api/v1/debug/check-env`);
    const envData = await envResponse.json();
    
    console.log('Environment info:');
    console.log(`  NODE_ENV: ${envData.environment.NODE_ENV}`);
    console.log(`  Database Type: ${envData.environment.databaseType}`);
    console.log(`  Has MySQL vars: ${envData.environment.hasMySQLVars ? 'Yes' : 'No'}\n`);
  } catch (err) {
    console.log('❌ Could not fetch environment info\n');
  }

  // Check table counts
  try {
    console.log('📋 Checking /api/v1/debug/check-tables...');
    const tablesResponse = await fetch(`${baseUrl}/api/v1/debug/check-tables`);
    const tablesData = await tablesResponse.json();
    
    console.log('Table counts:');
    Object.entries(tablesData.tables).forEach(([table, count]) => {
      console.log(`  ${table}: ${count} records`);
    });
  } catch (err) {
    console.log('❌ Could not fetch table info\n');
  }

  console.log('\n🔍 Analysis:');
  console.log('If you see low record counts (like users: 1-2), the app is likely still using SQLite.');
  console.log('If you see higher counts (users: 12, studios: 3), it\'s using MySQL correctly.');
}

checkRailwayDb();