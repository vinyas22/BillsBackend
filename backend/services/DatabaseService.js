const db = require('../db');

class DatabaseService {
  // Generic query executor with error handling
  static async query(sql, params = []) {
    try {
      console.log(`🔍 Database query: ${sql.substring(0, 100)}...`);
      const result = await db.query(sql, params);
      console.log(`✅ Query returned ${result.rows.length} rows`);
      return result.rows;
    } catch (error) {
      console.error('❌ Database query error:', { sql, params, error: error.message });
      throw error;
    }
  }

  // Get single record
  static async findOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  // Check if record exists
  static async exists(sql, params = []) {
    const result = await this.query(sql, params);
    return result.length > 0;
  }

  // Transactional operations
  static async transaction(callback) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Common aggregations
  static async sum(table, column, whereClause = '', params = []) {
    const sql = `SELECT COALESCE(SUM(${column}), 0) as total FROM ${table} ${whereClause}`;
    const result = await this.findOne(sql, params);
    return parseFloat(result.total);
  }

  static async count(table, whereClause = '', params = []) {
    const sql = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
    const result = await this.findOne(sql, params);
    return parseInt(result.count);
  }

  // Batch operations
  static async insertBatch(table, columns, values) {
    if (!values.length) return [];
    
    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');
    
    const flatValues = values.flat();
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders} RETURNING *`;
    
    return await this.query(sql, flatValues);
  }

  // Update by condition
  static async updateWhere(table, updates, whereClause, params = []) {
    const setClause = Object.keys(updates).map((key, i) => 
      `${key} = $${i + 1}`
    ).join(', ');
    
    const updateParams = Object.values(updates);
    const allParams = [...updateParams, ...params];
    
    const sql = `UPDATE ${table} SET ${setClause} ${whereClause} RETURNING *`;
    return await this.query(sql, allParams);
  }

  // Delete by condition
  static async deleteWhere(table, whereClause, params = []) {
    const sql = `DELETE FROM ${table} ${whereClause} RETURNING *`;
    return await this.query(sql, params);
  }
}

module.exports = DatabaseService;
