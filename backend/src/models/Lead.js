const db = require("../database/database-wrapper");
const LeadActivityLogger = require("../utils/LeadActivityLogger");

class Lead {
  constructor(data) {
    this.id = data.id || null;
    this.studio_id = data.studio_id;
    this.name = data.name;
    // Handle both phone_number (SQLite) and phone (MySQL) columns
    this.phone_number = data.phone_number || data.phone;
    this.email = data.email || null;
    this.source = data.source || 'manual';
    this.status = data.status || 'NEW';
    this.notes = data.notes || null;
    this.google_sheets_row_id = data.google_sheets_row_id || null;
    this.google_sheets_sync_id = data.google_sheets_sync_id || null;
    this.last_contacted = data.last_contacted || null;
    this.next_follow_up = data.next_follow_up || null;
    this.lead_score = data.lead_score || 0;
    this.conversion_status = data.conversion_status || 'lead';
    this.source_type = data.source_type || 'manual';
    this.created_by_manager_id = data.created_by_manager_id || null;
    this.created_by_user_id = data.created_by_user_id || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
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
   * Create a new lead or update existing lead
   */
  async save(userId = null) {
    const isUpdate = !!this.id;
    
    return new Promise(async (resolve, reject) => {
      try {
        if (isUpdate) {
          // Get original lead data for comparison
          const originalLead = await Lead.findById(this.id);
          if (!originalLead) {
            reject(new Error('Lead not found for update'));
            return;
          }

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

          db.run(sql, params, async (err) => {
            if (err) {
              reject(err);
            } else {
              try {
                // Only track status changes (no general updates)
                const oldStatus = originalLead.status;
                const newStatus = this.status;
                
                if (oldStatus !== newStatus) {
                  await LeadActivityLogger.logStatusChange(
                    this.id,
                    this.studio_id,
                    userId || null, // Allow null userId
                    oldStatus,
                    newStatus,
                    this.notes
                  );
                }
                resolve(this.id);
              } catch (activityErr) {
                console.error('Error logging status change activity:', activityErr);
                // Don't fail the save due to activity logging error
                resolve(this.id);
              }
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
              // No automatic logging of lead creation as requested
              resolve(this.lastID);
            }
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Compare this lead with another lead to find changes
   * @private
   */
  _getChanges(originalLead) {
    const changes = {};
    const fieldsToCheck = [
      'name', 'phone_number', 'email', 'source', 'status', 'notes',
      'lead_score', 'conversion_status', 'next_follow_up'
    ];

    fieldsToCheck.forEach(field => {
      if (this[field] !== originalLead[field]) {
        changes[field] = {
          old: originalLead[field],
          new: this[field]
        };
      }
    });

    return changes;
  }

  /**
   * Find lead by ID
   */
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT l.*, s.name as studio_name, s.city as studio_city
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
  async updateStatus(newStatus, notes = null, userId = null) {
    return new Promise(async (resolve, reject) => {
      try {
        const oldStatus = this.status;
        
        const sql = `
          UPDATE leads SET 
            status = ?, 
            last_contacted = CURRENT_TIMESTAMP,
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        db.run(sql, [newStatus, notes, this.id], async (err) => {
          if (err) {
            reject(err);
          } else {
            try {
              // Update local status
              this.status = newStatus;
              if (notes) this.notes = notes;
              
              // Always log status changes (even without userId)
              if (oldStatus !== newStatus) {
                await LeadActivityLogger.logStatusChange(
                  this.id,
                  this.studio_id,
                  userId || null,
                  oldStatus,
                  newStatus,
                  notes
                );
              }
              
              resolve(this);
            } catch (activityErr) {
              console.error('Error logging status change activity:', activityErr);
              // Don't fail the update due to activity logging error
              resolve(this);
            }
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Bulk import leads from Google Sheets with duplicate prevention
   */
  static async bulkImport(studioId, leadsData, syncId, managerId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('START TRANSACTION');
        
        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];
        const importDetails = [];

        const processPromises = leadsData.map((leadData, index) => {
          return new Promise(async (resolveProcess) => {
            try {
              // Check if lead already exists by phone number and studio
              const existingLead = await Lead.findByPhoneAndStudio(
                leadData.phone_number, 
                studioId
              );

              if (existingLead) {
                // Update existing lead with new data from Google Sheets
                existingLead.name = leadData.name;
                existingLead.email = leadData.email || existingLead.email;
                existingLead.notes = leadData.notes || existingLead.notes;
                existingLead.google_sheets_row_id = leadData.row_id;
                existingLead.google_sheets_sync_id = syncId;
                existingLead.source_type = 'imported';
                existingLead.updated_at = new Date().toISOString();

                await existingLead.save(managerId);
                updatedCount++;
                importDetails.push({
                  row: leadData.row_id,
                  name: leadData.name,
                  action: 'updated',
                  leadId: existingLead.id
                });
                resolveProcess({ status: 'updated', id: existingLead.id });
              } else {
                // Create new lead
                const lead = new Lead({
                  studio_id: studioId,
                  name: leadData.name,
                  phone_number: leadData.phone_number,
                  email: leadData.email,
                  source: 'google_sheets',
                  status: 'NEW',
                  notes: leadData.notes,
                  google_sheets_row_id: leadData.row_id,
                  google_sheets_sync_id: syncId,
                  source_type: 'imported',
                  created_by_manager_id: managerId
                });

                const leadId = await lead.save(managerId);
                importedCount++;
                importDetails.push({
                  row: leadData.row_id,
                  name: leadData.name,
                  action: 'imported',
                  leadId: leadId
                });
                resolveProcess({ status: 'imported', id: leadId });
              }
            } catch (error) {
              errorCount++;
              errors.push({ 
                row: leadData.row_id || index + 2, 
                name: leadData.name,
                phone: leadData.phone_number,
                error: error.message 
              });
              resolveProcess({ status: 'error', error: error.message });
            }
          });
        });

        Promise.all(processPromises)
          .then((results) => {
            // Only rollback if ALL operations failed
            if (importedCount === 0 && updatedCount === 0 && errorCount === leadsData.length) {
              db.run('ROLLBACK', () => {
                resolve({ 
                  success: false, 
                  imported: 0,
                  updated: 0,
                  skipped: 0,
                  errors: errorCount,
                  errorDetails: errors,
                  message: 'All leads failed to import'
                });
              });
            } else {
              db.run('COMMIT', (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({ 
                    success: true, 
                    imported: importedCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    errors: errorCount,
                    errorDetails: errors,
                    importDetails: importDetails,
                    totalProcessed: leadsData.length,
                    message: `Import complete: ${importedCount} new, ${updatedCount} updated, ${errorCount} errors`
                  });
                }
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