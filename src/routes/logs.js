/**
 * 操作日志路由 /api/v1/logs
 * @author 樊高工
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { success, error } = require('../utils/response');
const { authenticate, requireRole } = require('../middleware/auth');
const logService = require('../services/log.service');

const router = express.Router();
const listLimiter = rateLimit({ windowMs: 60000, max: 100 });

// 4.5.1 日志列表
router.get('/', authenticate, requireRole('admin', 'super_admin'), listLimiter, async (req, res) => {
  try {
    const { page, page_size, user_id, action, start_time, end_time } = req.query;
    const result = await logService.list({
      page: parseInt(page) || 1,
      pageSize: parseInt(page_size) || 20,
      userId: user_id ? parseInt(user_id) : undefined,
      action,
      startTime: start_time,
      endTime: end_time
    });
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '查询失败');
  }
});

module.exports = router;