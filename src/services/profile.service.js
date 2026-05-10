/**
 * 个人信息服务层
 * @author 樊高工
 */
const { hashPassword, verifyPassword, validatePasswordFormat } = require('../utils/password');
const userDao = require('../dao/user.dao');
const logDao = require('../dao/log.dao');
const { getRedisClient } = require('../utils/redis');

class ProfileService {
  /**
   * 获取个人信息
   */
  async get(userId) {
    const user = await userDao.findByIdWithRole(userId);
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
      created_at: user.created_at
    };
  }
  
  /**
   * 编辑个人信息
   */
  async update(userId, params) {
    const user = await userDao.findByIdWithRole(userId);
    if (!user) {
      throw { code: 1003, message: '用户不存在' };
    }
    
    // 如果修改手机号，需验证码
    if (params.phone && params.phone !== user.phone) {
      if (!params.verify_code) {
        throw { code: 1004, message: '修改手机号需提供验证码' };
      }
      
      const redis = await getRedisClient();
      const storedCode = await redis.get(`sms_code:${params.phone}`);
      if (!storedCode || storedCode !== params.verify_code) {
        throw { code: 1004, message: '验证码错误或已过期' };
      }
      
      // 检查新手机号是否已注册
      const phoneExists = await userDao.isPhoneRegistered(params.phone);
      if (phoneExists) {
        throw { code: 1002, message: '手机号已注册' };
      }
    }
    
    // 构建更新数据
    const updates = {};
    if (params.nickname) updates.nickname = params.nickname;
    if (params.avatar) updates.avatar = params.avatar;
    if (params.email) updates.email = params.email;
    if (params.phone && params.verify_code) updates.phone = params.phone;
    
    const updated = await userDao.updateById(userId, updates);
    if (!updated) {
      throw { code: 1011, message: '数据已被修改，请刷新后重试' };
    }
    
    // 记录操作日志
    await logDao.recordOperation(userId, 'UPDATE_PROFILE', updates);
    
    return {};
  }
  
  /**
   * 修改密码
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await userDao.findByIdWithRole(userId);
    if (!user) {
      throw { code: 1003, message: '用户不存在' };
    }
    
    // 验证旧密码
    const isValid = await verifyPassword(oldPassword, user.password);
    if (!isValid) {
      throw { code: 1004, message: '旧密码错误' };
    }
    
    // 验证新密码格式
    if (!validatePasswordFormat(newPassword)) {
      throw { code: 1009, message: '密码格式不符合要求（6-20位，含字母和数字）' };
    }
    
    // 更新密码
    const hashedPassword = await hashPassword(newPassword);
    await userDao.updateById(userId, { password: hashedPassword });
    
    // 记录操作日志
    await logDao.recordOperation(userId, 'CHANGE_PASSWORD', {});
    
    return {};
  }
  
  /**
   * 登录记录
   */
  async loginLogs(userId, limit = 10) {
    limit = Math.min(Math.max(1, limit), 50);
    const logs = await logDao.findUserLoginLogs(userId, limit);
    return { list: logs };
  }
}

module.exports = new ProfileService();