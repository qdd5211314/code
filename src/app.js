/**
 * 用户管理系统 v1.0-backend - 应用入口
 * @author 樊高工
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const { testConnection } = require('./utils/db');
const { initRedis, closeRedis } = require('./utils/redis');
const errorHandler = require('./middleware/error-handler');

// 路由模块
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const profileRoutes = require('./routes/profile');
const logRoutes = require('./routes/logs');

const app = express();

// ==================== 中间件 ====================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ==================== 路由 ====================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/logs', logRoutes);

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 错误处理 ====================
app.use(errorHandler);

// ==================== 启动服务 ====================
async function startServer() {
  try {
    // 测试 MySQL 连接
    const dbOk = await testConnection();
    if (!dbOk) {
      console.error('[Startup] MySQL connection failed, exiting...');
      process.exit(1);
    }
    
    // 初始化 Redis
    await initRedis();
    
    // 启动 HTTP 服务
    app.listen(config.server.port, () => {
      console.log(`[Startup] Server running on port ${config.server.port}`);
      console.log(`[Startup] Environment: ${config.server.env}`);
      console.log(`[Startup] User Management System v1.0-backend ready`);
    });
  } catch (err) {
    console.error('[Startup] Failed to start:', err.message);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('[Shutdown] Closing server...');
  await closeRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Shutdown] Closing server...');
  await closeRedis();
  process.exit(0);
});

startServer();

module.exports = app;