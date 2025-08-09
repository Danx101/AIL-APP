const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const Lead = require('../models/Lead');
const db = require("../database/database-wrapper");

class GoogleSheetsService {
  constructor() {
    this.initialized = false;
    this.serviceAccountAuth = null;
    
    this.initialize();
  }

  initialize() {
    try {
      // Check if Google service account credentials are available
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
      
      if (!serviceAccountEmail || !serviceAccountKey) {
        console.warn('⚠️ Google Sheets credentials not found. Google Sheets integration will be disabled.');
        return;
      }

      // Initialize JWT authentication
      this.serviceAccountAuth = new JWT({
        email: serviceAccountEmail,
        key: serviceAccountKey.replace(/\\n/g, '\n'), // Handle escaped newlines
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });

      this.initialized = true;
      console.log('✅ Google Sheets service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets service:', error);
    }
  }

  /**
   * Check if Google Sheets is properly configured
   */
  isConfigured() {
    return this.initialized && this.serviceAccountAuth !== null;
  }

  /**
   * Extract sheet ID from Google Sheets URL
   */
  extractSheetId(url) {
    try {
      // Handle different URL formats
      const patterns = [
        /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
        /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
        /^([a-zA-Z0-9-_]+)$/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return match[1];
        }
      }

      throw new Error('Invalid Google Sheets URL format');
    } catch (error) {
      throw new Error(`Failed to extract sheet ID: ${error.message}`);
    }
  }

  /**
   * Connect to a Google Spreadsheet
   */
  async connectToSheet(sheetUrl) {
    if (!this.isConfigured()) {
      throw new Error('Google Sheets service is not configured');
    }

    try {
      const sheetId = this.extractSheetId(sheetUrl);
      const doc = new GoogleSpreadsheet(sheetId, this.serviceAccountAuth);
      
      await doc.loadInfo();
      
      return {
        doc,
        sheetId,
        title: doc.title,
        sheetCount: doc.sheetCount,
        sheets: doc.sheetsByIndex.map(sheet => ({
          id: sheet.sheetId,
          title: sheet.title,
          rowCount: sheet.rowCount,
          columnCount: sheet.columnCount
        }))
      };

    } catch (error) {
      console.error('Error connecting to Google Sheet:', error);
      throw new Error(`Failed to connect to Google Sheet: ${error.message}`);
    }
  }

  /**
   * Preview data from a Google Sheet
   */
  async previewSheetData(sheetUrl, worksheetIndex = 0, maxRows = 10) {
    try {
      const { doc } = await this.connectToSheet(sheetUrl);
      const sheet = doc.sheetsByIndex[worksheetIndex];
      
      if (!sheet) {
        throw new Error('Worksheet not found');
      }

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: maxRows });

      const headers = sheet.headerValues;
      const sampleData = rows.map(row => {
        const rowData = {};
        headers.forEach(header => {
          rowData[header] = row.get(header) || '';
        });
        return rowData;
      });

      // Get actual row count with data (excluding empty rows)
      const allRows = await sheet.getRows();
      
      return {
        headers,
        sampleData,
        totalRows: allRows.length, // Actual rows with data
        worksheetTitle: sheet.title
      };

    } catch (error) {
      console.error('Error previewing sheet data:', error);
      throw new Error(`Failed to preview sheet data: ${error.message}`);
    }
  }

  /**
   * Import leads from Google Sheets
   */
  async importLeads(studioId, sheetUrl, columnMapping, managerId, worksheetIndex = 0) {
    try {
      const { doc, sheetId } = await this.connectToSheet(sheetUrl);
      const sheet = doc.sheetsByIndex[worksheetIndex];
      
      if (!sheet) {
        throw new Error('Worksheet not found');
      }

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows();

      // Validate column mapping
      const requiredFields = ['name', 'phone_number'];
      const mappedColumns = Object.keys(columnMapping);
      
      for (const field of requiredFields) {
        if (!columnMapping[field]) {
          throw new Error(`Missing required field mapping: ${field}`);
        }
        if (!sheet.headerValues.includes(columnMapping[field])) {
          throw new Error(`Column '${columnMapping[field]}' not found in sheet`);
        }
      }

      // Generate sync ID for this import
      const syncId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Transform sheet data to lead objects
      const leadsData = [];
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          const leadData = {
            name: row.get(columnMapping.name)?.trim(),
            phone_number: this.normalizePhoneNumber(row.get(columnMapping.phone_number)?.trim()),
            email: columnMapping.email ? row.get(columnMapping.email)?.trim() : null,
            notes: columnMapping.notes ? row.get(columnMapping.notes)?.trim() : null,
            row_id: i + 2 // Add 2 because Google Sheets is 1-indexed and we skip header
          };

          // Validate required fields
          if (!leadData.name || !leadData.phone_number) {
            errors.push({
              row: i + 2,
              error: 'Missing required fields (name or phone_number)'
            });
            continue;
          }

          // Validate phone number format
          if (!this.isValidPhoneNumber(leadData.phone_number)) {
            errors.push({
              row: i + 2,
              error: 'Invalid phone number format'
            });
            continue;
          }

          leadsData.push(leadData);

        } catch (rowError) {
          errors.push({
            row: i + 2,
            error: rowError.message
          });
        }
      }

      // Import leads to database
      const importResult = await Lead.bulkImport(studioId, leadsData, syncId, managerId);

      // Save integration record
      await this.saveIntegrationRecord(studioId, sheetId, doc.title, columnMapping, managerId);

      return {
        success: true,
        imported: importResult.imported,
        errors: importResult.errors + errors.length,
        errorDetails: [...(importResult.errorDetails || []), ...errors],
        syncId,
        totalRows: rows.length
      };

    } catch (error) {
      console.error('Error importing leads:', error);
      throw new Error(`Failed to import leads: ${error.message}`);
    }
  }

  /**
   * Sync leads from Google Sheets (for scheduled updates)
   */
  async syncLeads(integrationId) {
    try {
      const integration = await this.getIntegrationById(integrationId);
      if (!integration || !integration.auto_sync_enabled) {
        throw new Error('Integration not found or auto-sync disabled');
      }

      // Handle null or invalid column mapping
      let columnMapping;
      try {
        columnMapping = integration.column_mapping ? JSON.parse(integration.column_mapping) : null;
      } catch (parseError) {
        console.error('Error parsing column mapping:', parseError);
        columnMapping = null;
      }

      if (!columnMapping) {
        console.log(`⚠️ No column mapping found for integration ${integrationId}, skipping sync`);
        return {
          success: false,
          message: 'No column mapping configured for this integration'
        };
      }

      const result = await this.importLeads(
        integration.studio_id,
        `https://docs.google.com/spreadsheets/d/${integration.sheet_id}`,
        columnMapping,
        integration.manager_id
      );

      // Update last sync time
      await this.updateIntegrationSyncTime(integrationId);

      return result;

    } catch (error) {
      console.error('Error syncing leads:', error);
      throw error;
    }
  }

  /**
   * Save Google Sheets integration record
   */
  async saveIntegrationRecord(studioId, sheetId, sheetName, columnMapping, managerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO google_sheets_integrations 
        (studio_id, sheet_id, sheet_name, column_mapping, manager_id, last_sync_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      
      db.run(sql, [
        studioId, 
        sheetId, 
        sheetName, 
        JSON.stringify(columnMapping),
        managerId
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get integration by ID
   */
  async getIntegrationById(integrationId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM google_sheets_integrations WHERE id = ?';
      db.get(sql, [integrationId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get integrations by studio ID
   */
  async getStudioIntegrations(studioId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM google_sheets_integrations 
        WHERE studio_id = ? 
        ORDER BY updated_at DESC
      `;
      db.all(sql, [studioId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Update integration sync time
   */
  async updateIntegrationSyncTime(integrationId) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE google_sheets_integrations 
        SET last_sync_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      db.run(sql, [integrationId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Normalize phone number format
   */
  normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-digit characters except +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Add + if missing and number starts with country code
    if (!normalized.startsWith('+')) {
      // Assume German number if starts with 49 or local number
      if (normalized.startsWith('49')) {
        normalized = '+' + normalized;
      } else if (normalized.startsWith('0')) {
        // German local number, convert to international
        normalized = '+49' + normalized.substring(1);
      } else if (normalized.length >= 10) {
        // Assume it's already a valid international number
        normalized = '+' + normalized;
      }
    }
    
    return normalized;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber) return false;
    
    // Basic validation for international format
    const phoneRegex = /^\+?[1-9]\d{7,14}$/;
    return phoneRegex.test(phoneNumber.replace(/[^\d+]/g, ''));
  }

  /**
   * Get all active integrations for automatic sync
   */
  async getActiveIntegrations() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM google_sheets_integrations 
        WHERE auto_sync_enabled = 1 AND sync_status = 'active'
        ORDER BY last_sync_at ASC
      `;
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Schedule automatic sync for all active integrations
   */
  async scheduleAutoSync() {
    if (!this.isConfigured()) {
      console.log('⚠️ Google Sheets service not configured, skipping auto-sync');
      return;
    }

    try {
      const integrations = await this.getActiveIntegrations();
      
      for (const integration of integrations) {
        try {
          // Check if enough time has passed since last sync
          const lastSync = new Date(integration.last_sync_at || 0);
          const now = new Date();
          const minutesSinceLastSync = (now - lastSync) / (1000 * 60);
          
          if (minutesSinceLastSync >= integration.sync_frequency_minutes) {
            console.log(`🔄 Auto-syncing integration ${integration.id} for studio ${integration.studio_id}`);
            const result = await this.syncLeads(integration.id);
            if (result.success === false) {
              console.log(`⚠️ Auto-sync skipped for integration ${integration.id}: ${result.message}`);
            } else {
              console.log(`✅ Auto-sync completed for integration ${integration.id}`);
            }
          }
          
        } catch (syncError) {
          console.error(`❌ Auto-sync failed for integration ${integration.id}:`, syncError);
        }
      }
      
    } catch (error) {
      console.error('❌ Error in auto-sync scheduler:', error);
    }
  }
}

module.exports = new GoogleSheetsService();