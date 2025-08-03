#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

// Path to SQLite database
const DB_PATH = path.join(__dirname, '../database.sqlite');
const OUTPUT_DIR = path.join(__dirname, '../migrations/data');

// Table export order (respecting foreign key dependencies)
const TABLES_TO_EXPORT = [
  'users',
  'studios', 
  'activation_codes',
  'manager_codes',
  'appointments',
  'leads',
  'lead_call_logs',
  'google_sheets_integrations',
  'dialogflow_conversations',
  'customer_sessions',
  'session_blocks',
  'session_transactions'
];

class SQLiteExporter {
  constructor() {
    this.db = null;
    this.exportData = {};
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(new Error(`Failed to open SQLite database: ${err.message}`));
        } else {
          console.log('✅ Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async checkTableExists(tableName) {
    return new Promise((resolve, reject) => {
      const query = `SELECT name FROM sqlite_master WHERE type='table' AND name=?`;
      this.db.get(query, [tableName], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  async getTableData(tableName) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM ${tableName}`;
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getTableSchema(tableName) {
    return new Promise((resolve, reject) => {
      const query = `PRAGMA table_info(${tableName})`;
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  escapeValue(value, type) {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    
    if (type === 'TEXT' || type === 'VARCHAR' || type === 'DATETIME' || type === 'TIMESTAMP') {
      // Escape single quotes and wrap in quotes
      return `'${String(value).replace(/'/g, "''")}'`;
    }
    
    if (type === 'BOOLEAN') {
      return value ? 'TRUE' : 'FALSE';
    }
    
    // For INTEGER, REAL, etc.
    return String(value);
  }

  generateInsertStatements(tableName, data, schema) {
    if (!data || data.length === 0) {
      return `-- No data found for table: ${tableName}\n`;
    }

    const columns = schema.map(col => col.name);
    const columnTypes = schema.reduce((acc, col) => {
      acc[col.name] = col.type;
      return acc;
    }, {});

    let sql = `-- Data for table: ${tableName}\n`;
    sql += `-- Total records: ${data.length}\n\n`;

    // Generate INSERT statements
    for (const row of data) {
      const values = columns.map(col => {
        return this.escapeValue(row[col], columnTypes[col]);
      }).join(', ');

      sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});\n`;
    }

    sql += '\n';
    return sql;
  }

  async exportTable(tableName) {
    try {
      const exists = await this.checkTableExists(tableName);
      if (!exists) {
        console.log(`⚠️  Table '${tableName}' does not exist, skipping...`);
        return null;
      }

      console.log(`📤 Exporting table: ${tableName}`);
      
      const [data, schema] = await Promise.all([
        this.getTableData(tableName),
        this.getTableSchema(tableName)
      ]);

      const insertStatements = this.generateInsertStatements(tableName, data, schema);
      
      console.log(`   → Found ${data.length} records`);
      
      return {
        tableName,
        recordCount: data.length,
        sql: insertStatements
      };

    } catch (error) {
      console.error(`❌ Error exporting table ${tableName}:`, error.message);
      return null;
    }
  }

  async exportAllTables() {
    console.log('🚀 Starting SQLite data export...\n');

    // Ensure output directory exists
    try {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error.message);
      return;
    }

    const exportResults = [];
    let totalRecords = 0;

    // Export each table
    for (const tableName of TABLES_TO_EXPORT) {
      const result = await this.exportTable(tableName);
      if (result) {
        exportResults.push(result);
        totalRecords += result.recordCount;
      }
    }

    // Generate combined SQL file
    let combinedSQL = `-- SQLite to MySQL Data Export
-- Generated on: ${new Date().toISOString()}
-- Total tables: ${exportResults.length}
-- Total records: ${totalRecords}

SET FOREIGN_KEY_CHECKS = 0;

`;

    // Add all insert statements
    for (const result of exportResults) {
      combinedSQL += result.sql;
    }

    combinedSQL += `
SET FOREIGN_KEY_CHECKS = 1;

-- Export completed successfully
`;

    // Write combined file
    const outputPath = path.join(OUTPUT_DIR, 'sqlite_export.sql');
    await fs.writeFile(outputPath, combinedSQL, 'utf8');

    // Generate individual table files
    for (const result of exportResults) {
      const tablePath = path.join(OUTPUT_DIR, `${result.tableName}.sql`);
      await fs.writeFile(tablePath, result.sql, 'utf8');
    }

    // Generate export summary
    const summary = {
      exportDate: new Date().toISOString(),
      totalTables: exportResults.length,
      totalRecords: totalRecords,
      tables: exportResults.map(r => ({
        name: r.tableName,
        records: r.recordCount
      }))
    };

    const summaryPath = path.join(OUTPUT_DIR, 'export_summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

    console.log('\n✅ Export completed successfully!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📄 Combined SQL file: ${outputPath}`);
    console.log(`📊 Export summary: ${summaryPath}`);
    console.log(`📦 Total records exported: ${totalRecords}`);
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          } else {
            console.log('🔌 Database connection closed');
          }
          resolve();
        });
      });
    }
  }
}

// Main execution
async function main() {
  const exporter = new SQLiteExporter();
  
  try {
    await exporter.initialize();
    await exporter.exportAllTables();
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  } finally {
    await exporter.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SQLiteExporter;