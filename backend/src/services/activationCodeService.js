const crypto = require('crypto');
const db = require("../database/database-wrapper");

class ActivationCodeService {
  // Generate a secure activation code
  generateCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  // Create multiple activation codes
  async createCodes(studioId, count = 1, expiresAt = null, expiresInDays = null) {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      let code;
      let isUnique = false;
      
      // Generate unique code
      while (!isUnique) {
        code = this.generateCode();
        
        // Check if code already exists
        const existingCode = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM activation_codes WHERE code = ?', [code], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (!existingCode) {
          isUnique = true;
        }
      }
      
      // Insert code into database
      const codeId = await new Promise((resolve, reject) => {
        // Use MySQL DATE_ADD for expires_at if expiresInDays is provided
        if (expiresInDays) {
          db.run(
            'INSERT INTO activation_codes (code, studio_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
            [code, studioId, expiresInDays],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        } else {
          db.run(
            'INSERT INTO activation_codes (code, studio_id, expires_at) VALUES (?, ?, ?)',
            [code, studioId, expiresAt],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        }
      });
      
      codes.push({
        id: codeId,
        code,
        studioId,
        expiresAt: expiresInDays ? `${expiresInDays} days from now` : expiresAt,
        isUsed: false,
        createdAt: new Date().toISOString()
      });
    }
    
    return codes;
  }

  // Validate activation code
  async validateCode(code) {
    const activationCode = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM activation_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > NOW())',
        [code],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    return activationCode;
  }

  // Delete code after use (replacing markCodeAsUsed)
  async deleteCode(code) {
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM activation_codes WHERE code = ?',
        [code],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Get codes for a studio
  async getStudioCodes(studioId, options = {}) {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;
    
    // MySQL doesn't support placeholders for LIMIT and OFFSET, 
    // so we need to use template literals (safe since these are integers)
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    
    let query = `SELECT ac.*
         FROM activation_codes ac 
         WHERE ac.studio_id = ?
         ORDER BY ac.created_at DESC 
         LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const params = [studioId];
    
    const codes = await new Promise((resolve, reject) => {
      db.all(query, params,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    const totalCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM activation_codes WHERE studio_id = ?',
        [studioId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    return {
      codes,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    };
  }

  // Get code statistics
  async getCodeStats(studioId) {
    const stats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN expires_at IS NULL OR expires_at > NOW() THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 1 ELSE 0 END) as expired
         FROM activation_codes 
         WHERE studio_id = ?`,
        [studioId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    return {
      ...stats,
      used: 0 // Since we delete codes after use, used count is always 0
    };
  }

  // Delete expired codes
  async cleanupExpiredCodes(studioId) {
    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM activation_codes WHERE studio_id = ? AND expires_at IS NOT NULL AND expires_at <= NOW()',
        [studioId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    return result;
  }

  // Generate activation codes (alias for createCodes for controller compatibility)
  // Studio owners can only generate one code at a time with 3-day validity
  async generateCodes(studioId, count = 1, expiresInDays = 3) {
    // Override count to 1 for studio owners (business rule)
    const actualCount = 1;
    // Override expiry to 3 days (business rule)
    const actualExpiryDays = 3;
    
    return await this.createCodes(studioId, actualCount, null, actualExpiryDays);
  }
}

module.exports = new ActivationCodeService();