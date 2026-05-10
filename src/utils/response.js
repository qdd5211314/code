/**
 * 统一响应格式工具类
 * @author 樊高工
 */

/**
 * 成功响应
 * @param {Object} res - Express 响应对象
 * @param {*} data - 返回数据
 * @param {string} message - 提示信息
 * @returns {void}
 */
function success(res, data = null, message = 'success') {
  return res.json({
    code: 0,
    message,
    data
  });
}

/**
 * 错误响应
 * @param {Object} res - Express 响应对象
 * @param {number} code - 错误码
 * @param {string} message - 错误信息
 * @returns {void}
 */
function error(res, code, message) {
  return res.status(code >= 400 ? code : 400).json({
    code,
    message
  });
}

module.exports = { success, error };
