/**
 * 角色服务层
 * @author 樊高工
 */
const roleDao = require('../dao/role.dao');

class RoleService {
  /**
   * 获取角色列表
   */
  async list() {
    const roles = await roleDao.findAll();
    return {
      list: roles.map(r => ({
        id: r.id,
        name: r.name,
        code: r.code,
        permissions: JSON.parse(r.permissions || '[]')
      }))
    };
  }
}

module.exports = new RoleService();