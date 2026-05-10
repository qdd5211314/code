/**
 * 用户管理路由 /api/v1/users（管理员）
 * @author 樊高工
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { success, error } = require('../utils/response');
const { authenticate, requireRole } = require('../middleware/auth');
const userService = require('../services/user.service');

const router = express.Router();

// 所有用户管理接口都需要 admin/super_admin 权限
router.use(authenticate);
router.use(requireRole('admin', 'super_admin'));

const listLimiter = rateLimit({ windowMs: 60000, max: 100 });
const createLimiter = rateLimit({ windowMs: 60000, max: 20 });
const updateLimiter = rateLimit({ windowMs: 60000, max: 50 });
const deleteLimiter = rateLimit({ windowMs: 60000, max: 20 });
const resetPwdLimiter = rateLimit({ windowMs: 60000, max: 10 });

// 4.2.1 用户列表
router.get('/', listLimiter, async (req, res) => {
  try {
    const { page, page_size, keyword, role_id, status } = req.query;
    const result = await userService.list({
      page: parseInt(page) || 1,
      pageSize: parseInt(page_size) || 20,
      keyword,
      roleId: role_id ? parseInt(role_id) : undefined,
      status: status ? parseInt(status) : undefined
    });
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '查询失败');
  }
});

// 4.2.2 用户详情
router.get('/:id', listLimiter, async (req, res) => {
  try {
    const result = await userService.getById(parseInt(req.params.id));
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '查询失败');
  }
});

// 4.2.3 新增用户
router.post('/', createLimiter, async (req, res) => {
  try {
    const { username, phone, password, nickname, role_id } = req.body;
    if (!username || !phone || !password || !role_id) {
      return error(res, 1001, '必填参数不能为空');
    }
    
    const result = await userService.create(req.body, req.userId);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '创建失败');
  }
});

// 4.2.4 编辑用户
router.put('/:id', updateLimiter, async (req, res) => {
  try {
    const result = await userService.update(parseInt(req.params.id), req.body, req.userId);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '更新失败');
  }
});

// 4.2.5 删除用户（软删除）
router.delete('/:id', deleteLimiter, async (req, res) => {
  try {
    const result = await userService.delete(parseInt(req.params.id), req.userId);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '删除失败');
  }
});

// 4.2.6 禁用/启用用户
router.put('/:id/status', deleteLimiter, async (req, res) => {
  try {
    const { status } = req.body;
    if (status === undefined) return error(res, 1001, '状态不能为空');
    
    const result = await userService.updateStatus(parseInt(req.params.id), parseInt(status), req.userId);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '操作失败');
  }
});

// 4.2.7 重置密码
router.put('/:id/password/reset', resetPwdLimiter, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password) return error(res, 1001, '新密码不能为空');
    
    const result = await userService.resetPassword(parseInt(req.params.id), new_password, req.userId);
    return success(res, result);
  } catch (err) {
    if (err.code) return error(res, err.code, err.message);
    return error(res, 5000, '重置密码失败');
  }
});

module.exports = router;