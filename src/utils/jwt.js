/**
 * JWT 工具类
 * @author 樊高工
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 生成 Access Token
 * @param {Object} payload - 载荷数据 { userId, username, roleId }
 * @returns {string} JWT Token
 */
function generateToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

/**
 * 生成 Refresh Token
 * @param {Object} payload - 载荷数据 { userId }
 * @returns {string} Refresh Token
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { 
    expiresIn: config.jwt.refreshExpiresIn,
    subject: 'refresh_token'
  });
}

/**
 * 验证并解析 Token
 * @param {string} token - JWT Token
 * @returns {Object|null} 解析后的载荷，无效则返回 null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    console.error('[JWT] Token verification failed:', error.message);
    return null;
  }
}

/**
 * 验证 Refresh Token
 * @param {string} refreshToken - Refresh Token
 * @returns {Object|null} 解析后的载荷，无效则返回 null
 */
function verifyRefreshToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret, { 
      audience: 'refresh_token' 
    });
    return decoded;
  } catch (error) {
    console.error('[JWT] Refresh token verification failed:', error.message);
    return null;
  }
}

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken
};
