/**
 * 角色路由 /api/v1/roles
 * @author 樊高工
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { success, error } = require('../utils/response');
const { authenticate, requireRole } = require('../middleware/auth');
const roleService = require('../services/role.service');

const router = express.Router();
const listLimiter = rateLimit({ windowMs: 60000, max: 100 });

// 4.3.1 角色列表
router.get('/', authenticate, requireRole('admin', 'super_admin'), listLimiter, async (req, res) => {
  try {
    const result = await roleService.list();
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '查询失败');
  }
});

module.exports = router;