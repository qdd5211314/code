/**
 * 密码加密/验证工具类
 * @author 樊高工
 */
const bcrypt = require('bcryptjs');
const config = require('../config');

/**
 * 密码加密
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 加密后的密码
 */
async function hashPassword(password) {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
}

/**
 * 密码验证
 * @param {string} password - 明文密码
 * @param {string} hashedPassword - 加密后的密码
 * @returns {Promise<boolean>} 是否匹配
 */
async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * 生成随机密码
 * @param {number} length - 密码长度
 * @returns {string} 随机密码
 */
function generatePassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * 验证密码格式（6-20 位，含字母和数字）
 * @param {string} password - 密码
 * @returns {boolean} 是否符合要求
 */
function validatePasswordFormat(password) {
  const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,20}$/;
  return regex.test(password);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generatePassword,
  validatePasswordFormat
};
