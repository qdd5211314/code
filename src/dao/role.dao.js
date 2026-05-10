/**
 * 角色数据访问层
 * @author 樊高工
 */
const { pool } = require('../utils/db');

class RoleDAO {
  /**
   * 查询所有角色
   */
  async findAll() {
    const [rows] = await pool.execute(
      'SELECT id, name, code, permissions FROM roles ORDER BY id'
    );
    return rows;
  }
  
  /**
   * 根据 ID 查询角色
   */
  async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, name, code, permissions FROM roles WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }
  
  /**
   * 根据编码查询角色
   */
  async findByCode(code) {
    const [rows] = await pool.execute(
      'SELECT id, name, code, permissions FROM roles WHERE code = ?',
      [code]
    );
    return rows[0] || null;
  }
}

module.exports = new RoleDAO();
