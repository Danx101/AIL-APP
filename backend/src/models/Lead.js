const db = require('../database/connection');

class Lead {
  constructor(data) {
    this.id = data.id;
    this.studio_id = data.studio_id;
    this.name = data.name;
    this.phone_number = data.phone_number;
    this.email = data.email;
    this.source = data.source || 'manual';
    this.status = data.status || 'neu';
    this.notes = data.notes;
    this.google_sheets_row_id = data.google_sheets_row_id;
    this.google_sheets_sync_id = data.google_sheets_sync_id;
    this.last_contacted = data.last_contacted;
    this.next_follow_up = data.next_follow_up;
    this.lead_score = data.lead_score || 0;
    this.conversion_status = data.conversion_status || 'lead';
    this.source_type = data.source_type || 'manual';
    this.created_by_manager_id = data.created_by_manager_id;
    this.created_by_user_id = data.created_by_user_id;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Valid statuses for leads
  static get STATUSES() {
    return {
      NEW: 'neu',
      CONTACTED: 'kontaktiert',
      CONVERTED: 'konvertiert',
      NOT_INTERESTED: 'nicht_interessiert'
    };
  }

  // Valid sources for leads
  static get SOURCES() {
    return {
      MANUAL: 'manual',
      GOOGLE_SHEETS: 'google_sheets',
      WEBSITE: 'website',
      REFERRAL: 'referral',
      ADVERTISEMENT: 'advertisement',
      SOCIAL_MEDIA: 'social_media'
    };
  }

  // Valid conversion statuses
  static get CONVERSION_STATUSES() {
    return {
      LEAD: 'lead',
      PROSPECT: 'prospect',
      CUSTOMER: 'customer',
      LOST: 'lost'
    };
  }

  /**
   * Create a new lead
   */
  async save() {
    return new Promise((resolve, reject) => {
      if (this.id) {
        // Update existing lead
        const sql = `
          UPDATE leads SET 
            studio_id = ?, name = ?, phone_number = ?, email = ?, source = ?, 
            status = ?, notes = ?, google_sheets_row_id = ?, google_sheets_sync_id = ?,
            last_contacted = ?, next_follow_up = ?, lead_score = ?, conversion_status = ?,
            source_type = ?, created_by_manager_id = ?, created_by_user_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        const params = [
          this.studio_id, this.name, this.phone_number, this.email, this.source,
          this.status, this.notes, this.google_sheets_row_id, this.google_sheets_sync_id,
          this.last_contacted, this.next_follow_up, this.lead_score, this.conversion_status,
          this.source_type, this.created_by_manager_id, this.created_by_user_id,
          this.id
        ];

        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      } else {
        // Create new lead
        const sql = `
          INSERT INTO leads (
            studio_id, name, phone_number, email, source, status, notes,
            google_sheets_row_id, google_sheets_sync_id, last_contacted, 
            next_follow_up, lead_score, conversion_status, source_type,
            created_by_manager_id, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
          this.studio_id, this.name, this.phone_number, this.email, this.source,
          this.status, this.notes, this.google_sheets_row_id, this.google_sheets_sync_id,
          this.last_contacted, this.next_follow_up, this.lead_score, this.conversion_status,
          this.source_type, this.created_by_manager_id, this.created_by_user_id
        ];

        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        });
      }
    });
  }

  /**
   * Find lead by ID
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT l.*, s.studio_name, s.city as studio_city
        FROM leads l
        LEFT JOIN studios s ON l.studio_id = s.id
        WHERE l.id = ?
      `;
      
      db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new Lead(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Find leads by studio ID
   */
  static async findByStudioId(studioId, options = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT l.*, s.name as studio_name, s.city as studio_city
        FROM leads l
        LEFT JOIN studios s ON l.studio_id = s.id
        WHERE l.studio_id = ?
      `;
      const params = [studioId];

      // Add filters
      if (options.status) {
        console.log('🔍 BACKEND: Filtering by status:', options.status);
        if (options.status === 'aktiv') {
          // "aktiv" means all leads that are not "neu" (being worked on)
          console.log('🔍 BACKEND: Using aktiv filter - selecting all leads that are NOT neu');
          sql += ' AND l.status != ?';
          params.push('neu');
        } else {
          console.log('🔍 BACKEND: Using exact status filter:', options.status);
          sql += ' AND l.status = ?';
          params.push(options.status);
        }
        console.log('🔍 BACKEND: SQL after status filter:', sql);
        console.log('🔍 BACKEND: Params:', params);
      }
      
      if (options.source) {
        sql += ' AND l.source = ?';
        params.push(options.source);
      }

      if (options.search) {
        sql += ' AND (l.name LIKE ? OR l.phone_number LIKE ? OR l.email LIKE ?)';
        const searchTerm = `%${options.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Add ordering
      sql += ' ORDER BY ';
      if (options.sort_by) {
        sql += `l.${options.sort_by} ${options.sort_order || 'DESC'}`;
      } else {
        sql += 'l.created_at DESC';
      }

      // Add pagination
      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(options.limit));
        
        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(parseInt(options.offset));
        }
      }

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const leads = rows.map(row => new Lead(row));
          resolve(leads);
        }
      });
    });
  }

  /**
   * Find lead by phone number and studio
   */
  static async findByPhoneAndStudio(phoneNumber, studioId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM leads WHERE phone_number = ? AND studio_id = ?';
      
      db.get(sql, [phoneNumber, studioId], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new Lead(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Get lead statistics for a studio
   */
  static async getStudioStats(studioId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status = 'neu' THEN 1 END) as new_leads,
          COUNT(CASE WHEN status = 'kontaktiert' THEN 1 END) as contacted_leads,
          COUNT(CASE WHEN status = 'konvertiert' THEN 1 END) as qualified_leads,
          COUNT(CASE WHEN status = 'konvertiert' THEN 1 END) as converted_leads,
          COUNT(CASE WHEN conversion_status = 'customer' THEN 1 END) as customers,
          AVG(lead_score) as avg_lead_score,
          COUNT(CASE WHEN source = 'google_sheets' THEN 1 END) as google_sheets_leads,
          COUNT(CASE WHEN last_contacted IS NOT NULL THEN 1 END) as contacted_count
        FROM leads 
        WHERE studio_id = ?
      `;
      
      db.get(sql, studioId, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Delete a lead
   */
  async delete() {
    return new Promise((resolve, reject) => {
      if (!this.id) {
        reject(new Error('Cannot delete lead without ID'));
        return;
      }

      const sql = 'DELETE FROM leads WHERE id = ?';
      db.run(sql, [this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Update lead status and last contacted
   */
  async updateStatus(newStatus, notes = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE leads SET 
          status = ?, 
          last_contacted = CURRENT_TIMESTAMP,
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      db.run(sql, [newStatus, notes, this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Bulk import leads from Google Sheets
   */
  static async bulkImport(studioId, leadsData, syncId, managerId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        const insertPromises = leadsData.map((leadData, index) => {
          return new Promise((resolveInsert, rejectInsert) => {
            const lead = new Lead({
              studio_id: studioId,
              name: leadData.name,
              phone_number: leadData.phone_number,
              email: leadData.email,
              source: 'google_sheets',
              status: 'neu',
              notes: leadData.notes,
              google_sheets_row_id: leadData.row_id,
              google_sheets_sync_id: syncId,
              source_type: 'imported',
              created_by_manager_id: managerId
            });

            lead.save()
              .then((result) => {
                successCount++;
                resolveInsert(result);
              })
              .catch((error) => {
                errorCount++;
                errors.push({ row: index + 1, error: error.message });
                resolveInsert(null); // Continue with other inserts
              });
          });
        });

        Promise.all(insertPromises)
          .then(() => {
            if (errorCount === 0) {
              db.run('COMMIT', (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({ 
                    success: true, 
                    imported: successCount, 
                    errors: errorCount,
                    errorDetails: errors 
                  });
                }
              });
            } else {
              db.run('ROLLBACK', () => {
                resolve({ 
                  success: false, 
                  imported: successCount, 
                  errors: errorCount,
                  errorDetails: errors 
                });
              });
            }
          })
          .catch((error) => {
            db.run('ROLLBACK', () => {
              reject(error);
            });
          });
      });
    });
  }
}

module.exports = Lead;