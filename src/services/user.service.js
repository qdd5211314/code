/**
 * 用户管理服务层（管理员接口）
 * @author 樊高工
 */
const { hashPassword, validatePasswordFormat } = require('../utils/password');
const userDao = require('../dao/user.dao');
const logDao = require('../dao/log.dao');

class UserService {
  /**
   * 用户列表（分页 + 筛选）
   */
  async list({ page, pageSize, keyword, roleId, status }) {
    pageSize = [10, 20, 50].includes(pageSize) ? pageSize : 20;
    page = Math.max(1, page);
    
    const result = await userDao.findPage({ page, pageSize, keyword, roleId, status });
    return result;
  }
  
  /**
   * 用户详情
   */
  async getById(id) {
    const user = await userDao.findByIdWithRole(id);
    if (!user) {
      throw { code: 1003, message: '用户不存在' };
    }
    
    return {
      id: user.id,
      username: user.username,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login_at: user.last_login_at,
      last_login_ip: user.last_login_ip
    };
  }
  
  /**
   * 新增用户（管理员）
   */
  async create(params, operatorId) {
    // 检查手机号是否已注册
    const phoneExists = await userDao.isPhoneRegistered(params.phone);
    if (phoneExists) {
      throw { code: 1002, message: '手机号已注册' };
    }
    
    // 检查用户名是否存在
    const usernameExists = await userDao.isUsernameExists(params.username);
    if (usernameExists) {
      throw { code: 1003, message: '用户名已存在' };
    }
    
    // 加密密码
    const hashedPassword = await hashPassword(params.password);
    
    const userId = await userDao.create({
      username: params.username,
      phone: params.phone,
      password: hashedPassword,
      nickname: params.nickname,
      role_id: params.role_id
    });
    
    // 记录操作日志
    await logDao.recordOperation(operatorId, 'CREATE_USER', {
      user_id: userId,
      username: params.username,
      phone: params.phone,
      role_id: params.role_id
    });
    
    return { user_id: userId };
  }
  
  /**
   * 编辑用户（管理员）
   */
  async update(id, params, operatorId) {
    // 检查用户是否存在
    const user = await userDao.findByIdWithRole(id);
    if (!user) {
      throw { code: 1003, message: '用户不存在' };
    }
    
    // 如果修改手机号，需验证码
    if (params.phone && params.phone !== user.phone) {
      if (!params.verify_code) {
        throw { code: 1004, message: '修改手机号需提供验证码' };
      }
      // 检查新手机号是否已注册
      const phoneExists = await userDao.isPhoneRegistered(params.phone);
      if (phoneExists) {
        throw { code: 1002, message: '手机号已注册' };
      }
    }
    
    // 构建更新数据
    const updates = {};
    if (params.username) updates.username = params.username;
    if (params.nickname) updates.nickname = params.nickname;
    if (params.email) updates.email = params.email;
    if (params.role_id) updates.role_id = params.role_id;
    if (params.phone && params.verify_code) updates.phone = params.phone;
    
    const updated = await userDao.updateById(id, updates);
    if (!updated) {
      throw { code: 1011, message: '数据已被修改，请刷新后重试' };
    }
    
    // 记录操作日志
    await logDao.recordOperation(operatorId, 'UPDATE_USER', {
      target_user_id: id,
      updates
    });
    
    return {};
  }
  
  /**
   * 删除用户（软删除）
   */
  async delete(id, operatorId) {
    // 不能删除自己
    if (id === operatorId) {
      throw { code: 1012, message: '不能删除自己' };
    }
    
    const user = await userDao.findByIdWithRole(id);
    if (!user) {
      throw { code: 1003, message: '用户不存在' };
    }
    
    await userDao.softDelete(id);
    
    // 记录操作日志
    await logDao.recordOperation(operatorId, 'DELETE_USER', {
      target_user_id: id,
      username: user.username
    });
    
    return {};
  }
  
  /**
   * 禁用/启用用户
   */
  async updateStatus(id, status, operatorId) {
    if (id === operatorId) {
      throw { code: 1012, message: '不能操作自己' };
    }
    
    const user = await userDao.findByIdWithRole(id);
    if (!user) {
      throw { code: 1003, message: '用户不存在' };
    }
    
    await userDao.updateStatus(id, status);
    
    // 记录操作日志
    await logDao.recordOperation(operatorId, status === 1 ? 'ENABLE_USER' : 'DISABLE_USER', {
      target_user_id: id
    });
    
    return {};
  }
  
  /**
   * 重置密码（管理员）
   */
  async resetPassword(id, newPassword, operatorId) {
    if (id === operatorId) {
      throw { code: 1012, message: '不能重置自己密码' };
    }
    
    // 验证密码格式
    if (!validatePasswordFormat(newPassword)) {
      throw { code: 1009, message: '密码格式不符合要求（6-20位，含字母和数字）' };
    }
    
    const user = await userDao.findByIdWithRole(id);
    if (!user) {
      throw { code: 1003, message: '用户不存在' };
    }
    
    const hashedPassword = await hashPassword(newPassword);
    await userDao.updateById(id, { password: hashedPassword });
    
    // 记录操作日志
    await logDao.recordOperation(operatorId, 'RESET_PASSWORD', {
      target_user_id: id
    });
    
    return {};
  }
}

module.exports = new UserService();