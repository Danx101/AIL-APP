// Database wrapper to use MySQL exclusively

const mysqlConnection = require('./mysql-connection');

// MySQL wrapper with SQLite-like interface for compatibility
const db = {
  pool: null,
  initialized: false,
  
  // Initialize MySQL connection pool
  async init() {
    if (!this.initialized) {
      await mysqlConnection.initializeDatabase();
      this.pool = mysqlConnection.getConnection();
      this.initialized = true;
    }
  },
  
  // Ensure pool is initialized
  async ensurePool() {
    if (!this.initialized) {
      await this.init();
    }
  },
  
  // Get a connection from the pool
  async getPoolConnection() {
    await this.ensurePool();
    return await this.pool.getConnection();
  },
  
  // SQLite-like get method for MySQL (supports both callback and promise)
  get(query, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const promise = (async () => {
      let connection = null;
      let retries = 3;
      
      while (retries > 0) {
        try {
          connection = await this.getPoolConnection();
          const [rows] = await connection.execute(query, params);
          return rows[0] || null;
        } catch (error) {
          console.error('MySQL get error:', error.code || error.message);
          
          // Handle connection timeouts and connection errors
          if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || 
              error.code === 'PROTOCOL_CONNECTION_LOST') {
            retries--;
            if (retries > 0) {
              console.log(`Retrying query... ${retries} attempts left`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              continue;
            }
          }
          
          console.error('Query:', query);
          console.error('Params:', params);
          throw error;
        } finally {
          if (connection) {
            connection.release();
          }
        }
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
      let connection = null;
      let retries = 3;
      
      while (retries > 0) {
        try {
          connection = await this.getPoolConnection();
          const [rows] = await connection.execute(query, params);
          return rows;
        } catch (error) {
          console.error('MySQL all error:', error.code || error.message);
          
          // Handle connection timeouts and connection errors
          if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || 
              error.code === 'PROTOCOL_CONNECTION_LOST') {
            retries--;
            if (retries > 0) {
              console.log(`Retrying query... ${retries} attempts left`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              continue;
            }
          }
          
          console.error('Query:', query);
          console.error('Params:', params);
          throw error;
        } finally {
          if (connection) {
            connection.release();
          }
        }
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
      let connection = null;
      let retries = 3;
      
      while (retries > 0) {
        try {
          connection = await this.getPoolConnection();
          let result;
          
          // Use query() for transaction control statements instead of execute()
          if (query.trim().toUpperCase().startsWith('START TRANSACTION') || 
              query.trim().toUpperCase().startsWith('COMMIT') || 
              query.trim().toUpperCase().startsWith('ROLLBACK')) {
            [result] = await connection.query(query);
          } else {
            [result] = await connection.execute(query, params);
          }
          
          return {
            lastID: result.insertId,
            changes: result.affectedRows,
            insertId: result.insertId // Add both for compatibility
          };
        } catch (error) {
          console.error('MySQL run error:', error.code || error.message);
          
          // Handle connection timeouts and connection errors
          if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || 
              error.code === 'PROTOCOL_CONNECTION_LOST') {
            retries--;
            if (retries > 0) {
              console.log(`Retrying query... ${retries} attempts left`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              continue;
            }
          }
          
          console.error('Query:', query);
          console.error('Params:', params);
          throw error;
        } finally {
          if (connection) {
            connection.release();
          }
        }
      }
    })();
    
    if (callback) {
      promise.then(result => callback.call(result, null)).catch(err => callback(err));
      return;
    }
    
    return promise;
  },
  
  // Transaction support for MySQL
  async beginTransaction() {
    const connection = await this.getPoolConnection();
    await connection.query('START TRANSACTION');
    return connection;
  },

  async commit(connection) {
    if (connection) {
      await connection.query('COMMIT');
      connection.release();
    }
  },

  async rollback(connection) {
    if (connection) {
      await connection.query('ROLLBACK');
      connection.release();
    }
  },

  // Close connection pool
  async close() {
    if (this.pool) {
      await mysqlConnection.closeConnection();
      this.pool = null;
      this.initialized = false;
    }
  },
  
  // SQLite-compatible serialize method (for backward compatibility)
  serialize(callback) {
    // In MySQL with connection pooling, we don't need to serialize
    // Just execute the callback
    if (callback) {
      callback();
    }
  }
};

module.exports = db;