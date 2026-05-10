/**
 * Redis 连接池
 * @author 樊高工
 */
const { createClient } = require('redis');
const config = require('../config');

let redisClient = null;

/**
 * 初始化 Redis 客户端
 */
async function initRedis() {
  if (redisClient) return redisClient;
  
  redisClient = createClient({
    url: `redis://${config.redis.host}:${config.redis.port}`,
    password: config.redis.password || undefined,
    database: config.redis.db
  });
  
  redisClient.on('error', (err) => {
    console.error('[Redis] Client error:', err.message);
  });
  
  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });
  
  await redisClient.connect();
  return redisClient;
}

/**
 * 关闭连接
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Connection closed');
  }
}

module.exports = { initRedis, closeRedis, getRedisClient: () => redisClient };
