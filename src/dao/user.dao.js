/**
 * 用户数据访问层
 * @author 樊高工
 */
const { pool } = require('../utils/db');

class UserDAO {
  // ==================== 查询方法 ====================
  
  /**
   * 根据手机号查询用户
   */
  async findByPhone(phone) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL',
      [phone]
    );
    return rows[0] || null;
  }
  
  /**
   * 根据用户名查询用户
   */
  async findByUsername(username) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? AND deleted_at IS NULL',
      [username]
    );
    return rows[0] || null;
  }
  
  /**
   * 根据 ID 查询用户详情（包含角色名）
   */
  async findByIdWithRole(id) {
    const [rows] = await pool.execute(`
      SELECT u.*, r.name as role_name, r.code as role_code
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.deleted_at IS NULL
    `, [id]);
    return rows[0] || null;
  }
  
  /**
   * 分页查询用户列表（管理员用）
   */
  async findPage({ page = 1, pageSize = 20, keyword, roleId, status }) {
    const offset = (page - 1) * pageSize;
    
    let whereClauses = ['u.deleted_at IS NULL'];
    let params = [];
    
    if (keyword) {
      whereClauses.push('(u.username LIKE ? OR u.phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    if (roleId) {
      whereClauses.push('u.role_id = ?');
      params.push(roleId);
    }
    
    if (status !== undefined && status !== null) {
      whereClauses.push('u.status = ?');
      params.push(status);
    }
    
    const whereSQL = whereClauses.join(' AND ');
    
    // 查询总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM users u WHERE ${whereSQL}`,
      params
    );
    const total = countRows[0].total;
    
    // 查询列表
    const [rows] = await pool.execute(`
      SELECT u.id, u.username, u.phone, u.nickname, u.avatar, 
             u.role_id, r.name as role_name, u.status, 
             u.created_at, u.last_login_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ${whereSQL}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);
    
    return { list: rows, total, page, pageSize };
  }
  
  // ==================== 创建/更新方法 ====================
  
  /**
   * 注册新用户
   */
  async create(params) {
    const { username, phone, password, nickname, email, roleId = 3 } = params;
    
    const [result] = await pool.execute(
      `INSERT INTO users (username, phone, password, nickname, email, role_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [username, phone, password, nickname || '', email || '', roleId]
    );
    
    return result.insertId;
  }
  
  /**
   * 更新用户信息
   */
  async updateById(id, updates) {
    const allowedFields = ['username', 'nickname', 'email', 'role_id', 'phone', 'avatar'];
    const fields = Object.keys(updates).filter(k => allowedFields.includes(k));
    
    if (fields.length === 0) return false;
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...fields.map(f => updates[f]), id];
    
    const [result] = await pool.execute(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
      values
    );
    
    return result.affectedRows > 0;
  }
  
  /**
   * 更新用户登录失败计数
   */
  async updateLoginFailCount(phone, count, lockedUntil = null) {
    await pool.execute(
      `UPDATE users SET login_fail_count = ?, locked_until = ? WHERE phone = ?`,
      [count, lockedUntil, phone]
    );
  }
  
  /**
   * 重置登录失败计数
   */
  async resetLoginFailCount(userId) {
    await pool.execute(
      `UPDATE users SET login_fail_count = 0, locked_until = NULL WHERE id = ?`,
      [userId]
    );
  }
  
  /**
   * 更新最后登录信息
   */
  async updateLastLogin(userId, ip) {
    await pool.execute(
      `UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?`,
      [ip, userId]
    );
  }
  
  /**
   * 禁用/启用用户
   */
  async updateStatus(id, status) {
    const [result] = await pool.execute(
      `UPDATE users SET status = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
      [status, id]
    );
    return result.affectedRows > 0;
  }
  
  /**
   * 软删除用户
   */
  async softDelete(id) {
    const [result] = await pool.execute(
      `UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return result.affectedRows > 0;
  }
  
  /**
   * 检查用户名是否存在
   */
  async isUsernameExists(username) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE username = ? AND deleted_at IS NULL',
      [username]
    );
    return rows[0].count > 0;
  }
  
  /**
   * 检查手机号是否已注册
   */
  async isPhoneRegistered(phone) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE phone = ? AND deleted_at IS NULL',
      [phone]
    );
    return rows[0].count > 0;
  }
}

module.exports = new UserDAO();
