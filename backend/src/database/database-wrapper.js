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
      const connection = await this.getPoolConnection();
      
      try {
        const [rows] = await connection.execute(query, params);
        return rows[0] || null;
      } catch (error) {
        console.error('MySQL get error:', error);
        console.error('Query:', query);
        console.error('Params:', params);
        throw error;
      } finally {
        // Always release the connection back to the pool
        connection.release();
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
      const connection = await this.getPoolConnection();
      
      try {
        const [rows] = await connection.execute(query, params);
        return rows;
      } catch (error) {
        console.error('MySQL all error:', error);
        console.error('Query:', query);
        console.error('Params:', params);
        throw error;
      } finally {
        // Always release the connection back to the pool
        connection.release();
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
      const connection = await this.getPoolConnection();
      
      try {
        const [result] = await connection.execute(query, params);
        return {
          lastID: result.insertId,
          changes: result.affectedRows
        };
      } catch (error) {
        console.error('MySQL run error:', error);
        throw error;
      } finally {
        // Always release the connection back to the pool
        connection.release();
      }
    })();
    
    if (callback) {
      promise.then(result => callback.call(result, null)).catch(err => callback(err));
      return;
    }
    
    return promise;
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