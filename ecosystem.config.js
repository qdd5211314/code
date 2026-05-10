/**
 * PM2 集群部署配置
 * @author 樊高工
 */
module.exports = {
  apps: [{
    name: 'user-management-system',
    script: 'src/app.js',
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '200M',
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    restart_time: 60000
  }]
};