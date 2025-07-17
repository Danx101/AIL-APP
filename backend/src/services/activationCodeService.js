const crypto = require('crypto');
const db = require('../database/connection');

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
  async createCodes(studioId, count = 1, expiresAt = null) {
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
        db.run(
          'INSERT INTO activation_codes (code, studio_id, expires_at) VALUES (?, ?, ?)',
          [code, studioId, expiresAt],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      codes.push({
        id: codeId,
        code,
        studioId,
        expiresAt,
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
        'SELECT * FROM activation_codes WHERE code = ? AND is_used = 0 AND (expires_at IS NULL OR expires_at > datetime("now"))',
        [code],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    return activationCode;
  }

  // Mark code as used
  async markCodeAsUsed(code, userId) {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE activation_codes SET is_used = 1, used_by_user_id = ? WHERE code = ?',
        [userId, code],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Get codes for a studio
  async getStudioCodes(studioId, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    
    const codes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT ac.*, u.email as used_by_email, u.first_name, u.last_name 
         FROM activation_codes ac 
         LEFT JOIN users u ON ac.used_by_user_id = u.id 
         WHERE ac.studio_id = ? 
         ORDER BY ac.created_at DESC 
         LIMIT ? OFFSET ?`,
        [studioId, limit, offset],
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
          SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used,
          SUM(CASE WHEN is_used = 0 AND (expires_at IS NULL OR expires_at > datetime("now")) THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN is_used = 0 AND expires_at IS NOT NULL AND expires_at <= datetime("now") THEN 1 ELSE 0 END) as expired
         FROM activation_codes 
         WHERE studio_id = ?`,
        [studioId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    return stats;
  }

  // Delete expired codes
  async cleanupExpiredCodes(studioId) {
    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM activation_codes WHERE studio_id = ? AND is_used = 0 AND expires_at IS NOT NULL AND expires_at <= datetime("now")',
        [studioId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    return result;
  }
}

module.exports = new ActivationCodeService();