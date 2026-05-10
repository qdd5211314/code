/**
 * 个人信息路由 /api/v1/profile
 * @author 樊高工
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const profileService = require('../services/profile.service');

const router = express.Router();

// 所有个人信息接口需要登录
router.use(authenticate);

const getLimiter = rateLimit({ windowMs: 60000, max: 100 });
const updateLimiter = rateLimit({ windowMs: 60000, max: 20 });
const pwdLimiter = rateLimit({ windowMs: 60000, max: 10 });
const logsLimiter = rateLimit({ windowMs: 60000, max: 50 });

// 4.4.1 获取个人信息
router.get('/', getLimiter, async (req, res) => {
  try {
    const result = await profileService.get(req.userId);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '查询失败');
  }
});

// 4.4.2 编辑个人信息
router.put('/', updateLimiter, async (req, res) => {
  try {
    const result = await profileService.update(req.userId, req.body);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '更新失败');
  }
});

// 4.4.3 修改密码
router.put('/password', pwdLimiter, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return error(res, 1001, '旧密码和新密码不能为空');
    }
    
    const result = await profileService.changePassword(req.userId, old_password, new_password);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '修改密码失败');
  }
});

// 4.4.4 登录记录
router.get('/login-logs', logsLimiter, async (req, res) => {
  try {
    const { limit } = req.query;
    const result = await profileService.loginLogs(req.userId, parseInt(limit) || 10);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '查询失败');
  }
});

module.exports = router;