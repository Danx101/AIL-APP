#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function fixIncrementalExport() {
  console.log('🔧 Fixing incremental export for MySQL compatibility...\n');

  const inputFile = path.join(__dirname, '../migrations/data/incremental_export.sql');
  const outputFile = path.join(__dirname, '../migrations/data/incremental_export_fixed.sql');
  
  try {
    // Read the original export
    const sqlContent = await fs.readFile(inputFile, 'utf8');
    console.log(`✅ Read ${inputFile}`);
    
    let fixedContent = sqlContent;
    
    // Fix 1: Convert ISO datetime to MySQL format
    // '2025-07-21T14:23:49.427Z' -> '2025-07-21 14:23:49'
    console.log('🔄 Converting ISO datetimes to MySQL format...');
    fixedContent = fixedContent.replace(
      /'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})\.\d{3}Z'/g,
      "'$1 $2'"
    );
    
    // Fix 2: Add seconds to time values
    // '09:30' -> '09:30:00'
    console.log('🔄 Adding seconds to time values...');
    fixedContent = fixedContent.replace(
      /, (\d{2}:\d{2}), (\d{2}:\d{2}),/g,
      ', $1:00, $2:00,'
    );
    
    // Fix 3: Change phone_number to phone in leads table
    console.log('🔄 Fixing column name: phone_number -> phone...');
    fixedContent = fixedContent.replace(
      /INSERT INTO leads \([^)]*phone_number[^)]*\)/g,
      (match) => match.replace('phone_number', 'phone')
    );
    
    // Fix 4: Remove columns that don't exist yet from studios
    console.log('🔄 Removing non-existent columns from studios...');
    const studioInsertRegex = /INSERT INTO studios \(([^)]+)\) VALUES \(([^)]+)\)/g;
    fixedContent = fixedContent.replace(studioInsertRegex, (match, columns, values) => {
      const colArray = columns.split(', ');
      const valArray = values.split(', ');
      
      // Remove the problematic columns
      const columnsToRemove = [
        'cancellation_advance_hours',
        'postponement_advance_hours', 
        'max_advance_booking_days',
        'settings_updated_at'
      ];
      
      const filteredCols = [];
      const filteredVals = [];
      
      colArray.forEach((col, index) => {
        if (!columnsToRemove.includes(col.trim())) {
          filteredCols.push(col);
          filteredVals.push(valArray[index]);
        }
      });
      
      return `INSERT INTO studios (${filteredCols.join(', ')}) VALUES (${filteredVals.join(', ')})`;
    });
    
    // Fix 5: Remove columns that don't exist yet from manager_codes
    console.log('🔄 Removing non-existent columns from manager_codes...');
    const managerCodesRegex = /INSERT INTO manager_codes \(([^)]+)\) VALUES \(([^)]+)\)/g;
    fixedContent = fixedContent.replace(managerCodesRegex, (match, columns, values) => {
      const colArray = columns.split(', ');
      const valArray = values.split(', ');
      
      const columnsToRemove = [
        'intended_owner_name',
        'intended_city',
        'intended_studio_name'
      ];
      
      const filteredCols = [];
      const filteredVals = [];
      
      colArray.forEach((col, index) => {
        if (!columnsToRemove.includes(col.trim())) {
          filteredCols.push(col);
          filteredVals.push(valArray[index]);
        }
      });
      
      return `INSERT INTO manager_codes (${filteredCols.join(', ')}) VALUES (${filteredVals.join(', ')})`;
    });
    
    // Fix 6: Remove columns that don't exist yet from google_sheets_integrations
    console.log('🔄 Removing non-existent columns from google_sheets_integrations...');
    const sheetsRegex = /INSERT INTO google_sheets_integrations \(([^)]+)\) VALUES \(([^)]+)\)/g;
    fixedContent = fixedContent.replace(sheetsRegex, (match, columns, values) => {
      const colArray = columns.split(', ');
      const valArray = values.split(', ');
      
      const columnsToRemove = [
        'last_sync_at',
        'sync_status',
        'column_mapping',
        'auto_sync_enabled',
        'sync_frequency_minutes'
      ];
      
      const filteredCols = [];
      const filteredVals = [];
      
      colArray.forEach((col, index) => {
        if (!columnsToRemove.includes(col.trim())) {
          filteredCols.push(col);
          filteredVals.push(valArray[index]);
        }
      });
      
      return `INSERT INTO google_sheets_integrations (${filteredCols.join(', ')}) VALUES (${filteredVals.join(', ')})`;
    });
    
    // Write the fixed content
    await fs.writeFile(outputFile, fixedContent);
    console.log(`✅ Created fixed export: ${outputFile}`);
    
    // Count the changes
    const originalLines = sqlContent.split('\n').length;
    const fixedLines = fixedContent.split('\n').length;
    console.log(`📊 Original: ${originalLines} lines`);
    console.log(`📊 Fixed: ${fixedLines} lines`);
    console.log(`\n🎉 Export fixed and ready for import!`);
    
  } catch (error) {
    console.error('❌ Error fixing export:', error.message);
    process.exit(1);
  }
}

fixIncrementalExport();