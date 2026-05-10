/**
 * JWT 认证中间件
 * @author 樊高工
 */
const { verifyToken, verifyRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

/**
 * 基础 JWT 认证
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - 下一个中间件
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 1006, 'Token 无效或缺失');
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return error(res, 1006, 'Token 无效或已过期');
  }
  
  // 将用户信息附加到请求对象
  req.userId = decoded.userId;
  req.username = decoded.username;
  req.roleId = decoded.roleId;
  req.roleCode = decoded.roleCode;
  
  next();
}

/**
 * 管理员权限校验
 * @param {Array<string>} allowedRoles - 允许的角色编码列表
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.roleCode) {
      return error(res, 1007, '请先登录');
    }
    
    if (!allowedRoles.includes(req.roleCode)) {
      return error(res, 1007, '权限不足');
    }
    
    next();
  };
}

module.exports = { authenticate, requireRole };
