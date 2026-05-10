/**
 * 全局错误处理中间件
 * @author 樊高工
 */

/**
 * 错误处理器
 * @param {Error} err - 错误对象
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - 下一个中间件
 */
function errorHandler(err, req, res, next) {
  console.error('[Error] ', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    message: err.message,
    stack: err.stack
  });
  
  // MySQL 唯一约束冲突
  if (err.code === 'ER_DUP_ENTRY') {
    const fields = err.sqlMessage.match(/Duplicate entry '(.*)'/);
    return res.status(400).json({
      code: 1003,
      message: '数据已存在'
    });
  }
  
  // 外键约束错误
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_FOREIGN_KEY Constraint') {
    return res.status(400).json({
      code: 1010,
      message: '引用数据不存在'
    });
  }
  
  // 默认错误响应
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 5000;
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? '服务器内部错误' 
    : err.message;
  
  return res.status(statusCode).json({
    code: errorCode,
    message: errorMessage
  });
}

module.exports = errorHandler;
