/**
 * 认证路由 /api/v1/auth
 * @author 樊高工
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const authService = require('../services/auth.service');
const { getRedisClient } = require('../utils/redis');
const { verifyToken, verifyRefreshToken, generateToken } = require('../utils/jwt');

const router = express.Router();

// 限流配置
const smsLimiter = rateLimit({ windowMs: 60000, max: 10, keyGenerator: req => req.body.phone || req.ip });
const loginSmsLimiter = rateLimit({ windowMs: 60000, max: 20 });
const loginPasswordLimiter = rateLimit({ windowMs: 60000, max: 10 });
const registerLimiter = rateLimit({ windowMs: 60000, max: 5 });
const resetPasswordLimiter = rateLimit({ windowMs: 60000, max: 5 });
const refreshLimiter = rateLimit({ windowMs: 60000, max: 30 });

// 4.1.1 发送验证码
router.post('/sms-code', smsLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return error(res, 1001, '手机号不能为空');
    
    const result = await authService.sendSmsCode(phone);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 1004, '验证码发送失败，请稍后重试');
  }
});

// 4.1.2 手机号+验证码登录
router.post('/login-sms', loginSmsLimiter, async (req, res) => {
  try {
    const { phone, code, remember } = req.body;
    if (!phone || !code) return error(res, 1001, '手机号和验证码不能为空');
    
    const result = await authService.loginWithSms(phone, code, remember);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '登录失败');
  }
});

// 4.1.3 账号密码登录
router.post('/login-password', loginPasswordLimiter, async (req, res) => {
  try {
    const { username, password, remember } = req.body;
    if (!username || !password) return error(res, 1001, '用户名和密码不能为空');
    
    const result = await authService.loginWithPassword(username, password);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '登录失败');
  }
});

// 4.1.4 注册
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { phone, code, username, password, nickname } = req.body;
    if (!phone || !code || !username || !password) {
      return error(res, 1001, '必填参数不能为空');
    }
    
    const result = await authService.register(phone, code, username, password, nickname);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '注册失败');
  }
});

// 4.1.5 找回密码
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  try {
    const { phone, code, new_password } = req.body;
    if (!phone || !code || !new_password) {
      return error(res, 1001, '必填参数不能为空');
    }
    
    const result = await authService.resetPassword(phone, code, new_password);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '重置密码失败');
  }
});

// 4.1.6 退出登录
router.post('/logout', authenticate, async (req, res) => {
  try {
    const redis = await getRedisClient();
    const token = req.headers.authorization.substring(7);
    
    // 将 Token 加入黑名单
    const decoded = verifyToken(token);
    if (decoded) {
      const expiresIn = decoded.exp * 1000 - Date.now();
      if (expiresIn > 0) {
        await redis.setEx(`token_blacklist:${decoded.jti || token}`, Math.ceil(expiresIn / 1000), '1');
      }
    }
    
    return success(res, null, '退出登录成功');
  } catch (err) {
    return error(res, 1006, 'Token无效');
  }
});

// 4.1.7 刷新Token
router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return error(res, 1006, 'Refresh Token 不能为空');
    
    const decoded = verifyRefreshToken(refresh_token);
    if (!decoded) return error(res, 1006, 'Refresh Token无效或已过期');
    
    // 生成新 Token
    const newToken = generateToken({
      userId: decoded.userId
    });
    
    return success(res, {
      token: newToken,
      expires_in: parseInt('24h') || 86400
    });
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 1006, '刷新失败');
  }
});

module.exports = router;