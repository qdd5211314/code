/**
 * 认证服务层
 * @author 樊高工
 */
const { getRedisClient } = require('../utils/redis');
const { hashPassword, verifyPassword, validatePasswordFormat } = require('../utils/password');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const userDao = require('../dao/user.dao');
const logDao = require('../dao/log.dao');
const config = require('../config');

class AuthService {
  /**
   * 发送短信验证码
   */
  async sendSmsCode(phone) {
    const redis = await getRedisClient();
    
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw { code: 1001, message: '手机号格式错误' };
    }
    
    // 检查是否已注册
    const exists = await userDao.isPhoneRegistered(phone);
    if (!exists) {
      throw { code: 1002, message: '该手机号未注册' };
    }
    
    // 生成验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    
    // TODO: 调用实际短信服务 API
    console.log(`[SMS] 验证码发送给 ${phone}: ${code}`);
    
    // 存储验证码
    await redis.setEx(`sms_code:${phone}`, config.sms.ttl, code);
    
    return { expire_in: config.sms.ttl };
  }
  
  /**
   * 手机号 + 验证码登录
   */
  async loginWithSms(phone, code, remember = false) {
    const redis = await getRedisClient();
    
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw { code: 1001, message: '手机号格式错误' };
    }
    
    // 查询用户
    const user = await userDao.findByPhone(phone);
    if (!user) {
      throw { code: 1007, message: '手机号未注册' };
    }
    
    // 检查账号状态
    if (user.status === 0) {
      throw { code: 1005, message: '账号已被禁用' };
    }
    
    // 检查锁定状态
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      throw { code: 1006, message: '账号已锁定，请稍后再试' };
    }
    
    // 验证验证码
    const storedCode = await redis.get(`sms_code:${phone}`);
    if (!storedCode || storedCode !== code) {
      throw { code: 1001, message: '验证码错误或已过期' };
    }
    
    // 删除验证码（一次性）
    await redis.del(`sms_code:${phone}`);
    
    // 重置登录失败计数
    await userDao.resetLoginFailCount(user.id);
    
    // 更新最后登录信息
    await userDao.updateLastLogin(user.id, '');
    
    // 记录成功登录日志
    await logDao.recordLogin(user.id, '', '', 1);
    
    // 生成 Token
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      roleCode: '' // Will be filled by role lookup
    };
    
    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user.id });
    
    // 获取角色信息
    const [userData] = await require('../utils/db').pool.execute(`
      SELECT u.*, r.code as role_code 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [user.id]);
    
    return {
      token,
      refresh_token: refreshToken,
      expires_in: parseInt(config.jwt.expiresIn) || 86400,
      user: {
        id: userData[0].id,
        username: userData[0].username,
        nickname: userData[0].nickname,
        avatar: userData[0].avatar,
        role: userData[0].role_code
      }
    };
  }
  
  /**
   * 账号密码登录
   */
  async loginWithPassword(username, password) {
    const redis = await getRedisClient();
    
    // 根据用户名或手机号查询
    let user = await userDao.findByUsername(username);
    if (!user) {
      user = await userDao.findByPhone(username);
    }
    
    if (!user) {
      await this.handleLoginFail(null, '', username, '用户不存在');
      throw { code: 1008, message: '用户名或密码错误' };
    }
    
    // 检查账号状态
    if (user.status === 0) {
      throw { code: 1005, message: '账号已被禁用' };
    }
    
    // 检查锁定状态
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      throw { code: 1006, message: '账号已锁定，请稍后再试' };
    }
    
    // 验证密码
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      await this.handleLoginFail(user.id, user.phone, username, '密码错误');
      throw { code: 1004, message: '用户名或密码错误' };
    }
    
    // 重置登录失败计数
    await userDao.resetLoginFailCount(user.id);
    
    // 更新最后登录信息
    await userDao.updateLastLogin(user.id, '');
    
    // 记录成功登录日志
    await logDao.recordLogin(user.id, '', '', 1);
    
    // 生成 Token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      roleCode: ''
    });
    const refreshToken = generateRefreshToken({ userId: user.id });
    
    // 获取角色信息
    const [userData] = await require('../utils/db').pool.execute(`
      SELECT u.*, r.code as role_code 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [user.id]);
    
    return {
      token,
      refresh_token: refreshToken,
      expires_in: parseInt(config.jwt.expiresIn) || 86400,
      user: {
        id: userData[0].id,
        username: userData[0].username,
        nickname: userData[0].nickname,
        avatar: userData[0].avatar,
        role: userData[0].role_code
      }
    };
  }
  
  /**
   * 处理登录失败
   */
  async handleLoginFail(userId, phone, username, reason) {
    if (!userId || !phone) return;
    
    const redis = await getRedisClient();
    const failCountKey = `login_fail:${phone}`;
    
    // 获取当前失败次数
    const currentCount = parseInt(await redis.get(failCountKey) || '0');
    const newCount = currentCount + 1;
    
    // 记录失败日志
    await logDao.recordLogin(userId, '', '', 0, reason);
    
    if (newCount >= config.login.maxFailCount) {
      // 超过最大失败次数，锁定账号
      const lockUntil = new Date(Date.now() + config.login.lockDuration * 1000);
      await userDao.updateLoginFailCount(phone, newCount, lockUntil);
      await redis.setEx(failCountKey, config.login.lockDuration, String(newCount));
    } else {
      await userDao.updateLoginFailCount(phone, newCount, null);
      await redis.setEx(failCountKey, config.login.lockDuration * 2, String(newCount));
    }
  }
  
  /**
   * 注册用户
   */
  async register(phone, code, username, password, nickname = '') {
    const redis = await getRedisClient();
    
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw { code: 1001, message: '手机号格式错误' };
    }
    
    // 检查手机号是否已注册
    const isRegistered = await userDao.isPhoneRegistered(phone);
    if (isRegistered) {
      throw { code: 1002, message: '该手机号已注册' };
    }
    
    // 检查用户名是否存在
    const isUsernameExists = await userDao.isUsernameExists(username);
    if (isUsernameExists) {
      throw { code: 1003, message: '用户名已存在' };
    }
    
    // 验证验证码
    const storedCode = await redis.get(`sms_code:${phone}`);
    if (!storedCode || storedCode !== code) {
      throw { code: 1004, message: '验证码错误或已过期' };
    }
    
    // 验证密码格式
    if (!validatePasswordFormat(password)) {
      throw { code: 1009, message: '密码格式不符合要求（6-20 位，含字母和数字）' };
    }
    
    // 加密密码并创建用户
    const hashedPassword = await hashPassword(password);
    const userId = await userDao.create({
      username,
      phone,
      password: hashedPassword,
      nickname
    });
    
    // 删除验证码
    await redis.del(`sms_code:${phone}`);
    
    // 记录操作日志
    await logDao.recordOperation(userId, 'REGISTER', { phone, username }, '', '');
    
    return { user_id: userId };
  }
  
  /**
   * 找回密码
   */
  async resetPassword(phone, code, newPassword) {
    const redis = await getRedisClient();
    
    // 检查手机号是否已注册
    const user = await userDao.findByPhone(phone);
    if (!user) {
      throw { code: 1001, message: '手机号未注册' };
    }
    
    // 验证验证码
    const storedCode = await redis.get(`sms_code:${phone}`);
    if (!storedCode || storedCode !== code) {
      throw { code: 1004, message: '验证码错误或已过期' };
    }
    
    // 验证新密码格式
    if (!validatePasswordFormat(newPassword)) {
      throw { code: 1009, message: '密码格式不符合要求' };
    }
    
    // 更新密码
    const hashedPassword = await hashPassword(newPassword);
    await pool.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', 
      [hashedPassword, user.id]);
    
    // 删除验证码
    await redis.del(`sms_code:${phone}`);
    
    // 记录操作日志
    await logDao.recordOperation(user.id, 'RESET_PASSWORD', { phone }, '', '');
    
    return {};
  }
}

const pool = require('../utils/db').pool;

module.exports = new AuthService();
