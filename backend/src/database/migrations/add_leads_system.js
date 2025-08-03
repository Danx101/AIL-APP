const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '../../../../database.sqlite');

const migration = {
  up: (db) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Create leads table
        db.run(`
          CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            studio_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            email TEXT,
            source TEXT DEFAULT 'manual',
            status TEXT DEFAULT 'new',
            notes TEXT,
            google_sheets_row_id INTEGER,
            google_sheets_sync_id TEXT,
            last_contacted DATETIME,
            next_follow_up DATETIME,
            lead_score INTEGER DEFAULT 0,
            conversion_status TEXT DEFAULT 'lead',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
          )
        `, function(err) {
          if (err) {
            console.error('Error creating leads table:', err);
            reject(err);
            return;
          }
          console.log('✅ Created leads table');
        });

        // Create lead_call_logs table
        db.run(`
          CREATE TABLE IF NOT EXISTS lead_call_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            studio_id INTEGER NOT NULL,
            initiated_by_user_id INTEGER NOT NULL,
            twilio_call_sid TEXT,
            call_status TEXT NOT NULL,
            call_direction TEXT NOT NULL,
            duration_seconds INTEGER DEFAULT 0,
            recording_url TEXT,
            notes TEXT,
            scheduled_at DATETIME,
            started_at DATETIME,
            ended_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
            FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
            FOREIGN KEY (initiated_by_user_id) REFERENCES users(id)
          )
        `, function(err) {
          if (err) {
            console.error('Error creating lead_call_logs table:', err);
            reject(err);
            return;
          }
          console.log('✅ Created lead_call_logs table');
        });

        // Create google_sheets_integrations table
        db.run(`
          CREATE TABLE IF NOT EXISTS google_sheets_integrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            studio_id INTEGER NOT NULL,
            sheet_id TEXT NOT NULL,
            sheet_name TEXT,
            last_sync_at DATETIME,
            sync_status TEXT DEFAULT 'active',
            column_mapping TEXT, -- JSON string for column mapping
            auto_sync_enabled BOOLEAN DEFAULT 1,
            sync_frequency_minutes INTEGER DEFAULT 30,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
          )
        `, function(err) {
          if (err) {
            console.error('Error creating google_sheets_integrations table:', err);
            reject(err);
            return;
          }
          console.log('✅ Created google_sheets_integrations table');
        });

        // Create dialogflow_conversations table
        db.run(`
          CREATE TABLE IF NOT EXISTS dialogflow_conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            call_log_id INTEGER,
            session_id TEXT NOT NULL,
            intent_name TEXT,
            confidence_score REAL,
            user_message TEXT,
            bot_response TEXT,
            context_data TEXT, -- JSON string
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
            FOREIGN KEY (call_log_id) REFERENCES lead_call_logs(id) ON DELETE SET NULL
          )
        `, function(err) {
          if (err) {
            console.error('Error creating dialogflow_conversations table:', err);
            reject(err);
            return;
          }
          console.log('✅ Created dialogflow_conversations table');
        });

        // Create indexes for better performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_leads_studio_id ON leads(studio_id)`, (err) => {
          if (err) console.error('Error creating leads studio_id index:', err);
          else console.log('✅ Created leads studio_id index');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`, (err) => {
          if (err) console.error('Error creating leads status index:', err);
          else console.log('✅ Created leads status index');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone_number)`, (err) => {
          if (err) console.error('Error creating leads phone index:', err);
          else console.log('✅ Created leads phone index');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON lead_call_logs(lead_id)`, (err) => {
          if (err) console.error('Error creating call_logs lead_id index:', err);
          else console.log('✅ Created call_logs lead_id index');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_call_logs_twilio_sid ON lead_call_logs(twilio_call_sid)`, (err) => {
          if (err) console.error('Error creating call_logs twilio_sid index:', err);
          else console.log('✅ Created call_logs twilio_sid index');
        });

        // Resolve after all tables and indexes are created
        setTimeout(() => {
          console.log('🎉 Lead system migration completed successfully!');
          resolve();
        }, 100);
      });
    });
  },

  down: (db) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DROP TABLE IF EXISTS dialogflow_conversations', (err) => {
          if (err) console.error('Error dropping dialogflow_conversations:', err);
        });
        
        db.run('DROP TABLE IF EXISTS lead_call_logs', (err) => {
          if (err) console.error('Error dropping lead_call_logs:', err);
        });
        
        db.run('DROP TABLE IF EXISTS google_sheets_integrations', (err) => {
          if (err) console.error('Error dropping google_sheets_integrations:', err);
        });
        
        db.run('DROP TABLE IF EXISTS leads', (err) => {
          if (err) console.error('Error dropping leads:', err);
          else console.log('✅ Dropped leads system tables');
        });

        setTimeout(() => {
          console.log('🗑️ Lead system migration rollback completed!');
          resolve();
        }, 100);
      });
    });
  }
};

// Run migration if called directly
if (require.main === module) {
  const db = new sqlite3.Database(dbPath);
  
  migration.up(db)
    .then(() => {
      console.log('✅ Migration completed successfully');
      db.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      db.close();
      process.exit(1);
    });
}

module.exports = migration;