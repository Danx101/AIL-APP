// Database wrapper to use MySQL exclusively

const mysqlConnection = require('./mysql-connection');

// MySQL wrapper with SQLite-like interface for compatibility
const db = {
  connection: null,
  initialized: false,
  
  // Initialize MySQL connection
  async init() {
    if (!this.initialized) {
      await mysqlConnection.initializeDatabase();
      this.connection = mysqlConnection.getConnection();
      this.initialized = true;
    }
  },
  
  // Ensure connection is alive and ready
  async ensureConnection() {
    if (!this.initialized) {
      await this.init();
      return;
    }
    
    // Check if connection is still alive
    try {
      if (!this.connection || this.connection.destroyed) {
        await this.reconnect();
      }
    } catch (error) {
      console.log('Connection check failed, reconnecting...');
      await this.reconnect();
    }
  },
  
  // Reconnect to MySQL
  async reconnect() {
    console.log('🔄 Reconnecting to MySQL...');
    try {
      if (this.connection) {
        try {
          await this.connection.end();
        } catch (e) {
          // Ignore errors when closing dead connections
        }
      }
      
      this.initialized = false;
      this.connection = null;
      
      await this.init();
      console.log('✅ MySQL reconnection successful');
    } catch (error) {
      console.error('❌ MySQL reconnection failed:', error);
      throw error;
    }
  },
  
  // SQLite-like get method for MySQL (supports both callback and promise)
  get(query, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const promise = (async () => {
      await this.ensureConnection();
      
      try {
        const [rows] = await this.connection.execute(query, params);
        return rows[0] || null;
      } catch (error) {
        console.error('MySQL get error:', error);
        console.error('Query:', query);
        console.error('Params:', params);
        
        // Try to reconnect on connection errors
        if (error.message.includes('closed state') || error.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('🔄 Attempting to reconnect to MySQL...');
          await this.reconnect();
          const [rows] = await this.connection.execute(query, params);
          return rows[0] || null;
        }
        
        throw error;
      }
    })();
    
    if (callback) {
      promise.then(result => callback(null, result)).catch(err => callback(err));
      return;
    }
    
    return promise;
  },
  
  // SQLite-like all method for MySQL (supports both callback and promise)
  all(query, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const promise = (async () => {
      await this.ensureConnection();
      
      try {
        const [rows] = await this.connection.execute(query, params);
        return rows;
      } catch (error) {
        console.error('MySQL all error:', error);
        console.error('Query:', query);
        console.error('Params:', params);
        
        // Try to reconnect on connection errors
        if (error.message.includes('closed state') || error.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('🔄 Attempting to reconnect to MySQL...');
          await this.reconnect();
          const [rows] = await this.connection.execute(query, params);
          return rows;
        }
        
        throw error;
      }
    })();
    
    if (callback) {
      promise.then(result => callback(null, result)).catch(err => callback(err));
      return;
    }
    
    return promise;
  },
  
  // SQLite-like run method for MySQL (supports both callback and promise)
  run(query, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const promise = (async () => {
      await this.ensureConnection();
      
      try {
        const [result] = await this.connection.execute(query, params);
        return {
          lastID: result.insertId,
          changes: result.affectedRows
        };
      } catch (error) {
        console.error('MySQL run error:', error);
        
        // Try to reconnect on connection errors
        if (error.message.includes('closed state') || error.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('🔄 Attempting to reconnect to MySQL...');
          await this.reconnect();
          const [result] = await this.connection.execute(query, params);
          return {
            lastID: result.insertId,
            changes: result.affectedRows
          };
        }
        
        throw error;
      }
    })();
    
    if (callback) {
      promise.then(result => callback.call(result, null)).catch(err => callback(err));
      return;
    }
    
    return promise;
  },
  
  // Close connection
  async close() {
    if (this.connection) {
      await mysqlConnection.closeConnection();
    }
  }
};

module.exports = db;