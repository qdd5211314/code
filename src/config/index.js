/**
 * 应用配置
 * @author 樊高工
 */
require('dotenv').config();

module.exports = {
  // 服务配置
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // MySQL 配置
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DATABASE || 'user_management_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },
  
  // Redis 配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: 0
  },
  
  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    expiresIn: '24h',
    refreshExpiresIn: '7d'
  },
  
  // bcrypt 配置
  bcrypt: {
    saltRounds: 10
  },
  
  // 短信验证码配置
  sms: {
    ttl: 300,           // 验证码有效期 5 分钟
    maxRetries: 3,      // 最多重试 3 次
    cooldown: 60        // 冷却时间 60 秒
  },
  
  // 登录失败限制
  login: {
    maxFailCount: 5,       // 最大失败次数
    lockDuration: 1800     // 锁定时长 30 分钟
  }
};
