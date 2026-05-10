/**
 * MySQL 数据库连接池
 * @author 樊高工
 */
const mysql = require('mysql2/promise');
const config = require('../config');

// 创建连接池
const pool = mysql.createPool(config.mysql);

/**
 * 测试连接
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('[DB] MySQL connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('[DB] MySQL connection failed:', error.message);
    return false;
  }
}

module.exports = { pool, testConnection };
