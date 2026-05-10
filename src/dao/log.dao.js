/**
 * 日志数据访问层
 * @author 樊高工
 */
const { pool } = require('../utils/db');

class LogDAO {
  // ==================== 操作日志 ====================
  
  /**
   * 记录操作日志
   */
  async recordOperation(userId, action, detail, ip = '', userAgent = '') {
    await pool.execute(
      `INSERT INTO operation_logs (user_id, action, detail, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, action, JSON.stringify(detail), ip, userAgent]
    );
  }
  
  /**
   * 分页查询操作日志
   */
  async findPage({ page = 1, pageSize = 20, userId, action, startTime, endTime }) {
    const offset = (page - 1) * pageSize;
    
    let whereClauses = [];
    let params = [];
    
    if (userId) {
      whereClauses.push('o.user_id = ?');
      params.push(userId);
    }
    
    if (action) {
      whereClauses.push('o.action = ?');
      params.push(action);
    }
    
    if (startTime) {
      whereClauses.push('o.created_at >= ?');
      params.push(startTime);
    }
    
    if (endTime) {
      whereClauses.push('o.created_at <= ?');
      params.push(endTime);
    }
    
    const whereSQL = whereClauses.length > 0 
      ? 'WHERE ' + whereClauses.join(' AND ')
      : '';
    
    // 查询总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM operation_logs o ${whereSQL}`,
      params
    );
    const total = countRows[0].total;
    
    // 查询列表
    const [rows] = await pool.execute(`
      SELECT o.id, o.user_id, u.username, o.action, o.detail, 
             o.ip_address, o.user_agent, o.created_at
      FROM operation_logs o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereSQL}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);
    
    return { list: rows, total, page, pageSize };
  }
  
  // ==================== 登录日志 ====================
  
  /**
   * 记录登录日志
   */
  async recordLogin(userId, ip, userAgent, loginStatus = 1, failReason = '') {
    await pool.execute(
      `INSERT INTO login_logs (user_id, ip_address, user_agent, login_status, fail_reason)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, ip, userAgent, loginStatus, failReason]
    );
  }
  
  /**
   * 查询用户登录记录
   */
  async findUserLoginLogs(userId, limit = 10) {
    const [rows] = await pool.execute(
      `SELECT login_at, ip_address, user_agent, login_status, fail_reason
       FROM login_logs
       WHERE user_id = ?
       ORDER BY login_at DESC
       LIMIT ?`,
      [userId, Math.min(limit, 50)]
    );
    return rows;
  }
}

module.exports = new LogDAO();
