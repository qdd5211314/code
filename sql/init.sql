-- ============================================
-- 用户管理系统 v1.0-arch - 数据库初始化脚本
-- 作者：樊高工 (后端开发)
-- 基于技术方案：user-management-system-v1.0-arch.md
-- ============================================

CREATE DATABASE IF NOT EXISTS user_management_system 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE user_management_system;

-- ============================================
-- 用户表
-- ============================================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户 ID',
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  phone VARCHAR(11) NOT NULL UNIQUE COMMENT '手机号',
  password VARCHAR(255) NOT NULL COMMENT 'bcrypt 加密密码 (cost=10)',
  nickname VARCHAR(50) DEFAULT '' COMMENT '昵称',
  avatar VARCHAR(255) DEFAULT '' COMMENT '头像 URL',
  email VARCHAR(100) DEFAULT '' COMMENT '邮箱 (可选)',
  role_id BIGINT DEFAULT 3 COMMENT '角色 ID，默认普通用户',
  status TINYINT DEFAULT 1 COMMENT '状态：1 启用 0 禁用',
  login_fail_count INT DEFAULT 0 COMMENT '登录失败次数',
  locked_until DATETIME DEFAULT NULL COMMENT '锁定截止时间',
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  last_login_ip VARCHAR(50) DEFAULT '' COMMENT '最后登录 IP',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at DATETIME DEFAULT NULL COMMENT '软删除时间 (保留 90 天)',
  INDEX idx_phone (phone),
  INDEX idx_username (username),
  INDEX idx_role_id (role_id),
  INDEX idx_status (status),
  INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 角色表
-- ============================================
DROP TABLE IF EXISTS roles;
CREATE TABLE roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '角色 ID',
  name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名称',
  code VARCHAR(50) NOT NULL UNIQUE COMMENT '角色编码 (super_admin/admin/user)',
  permissions TEXT COMMENT '权限列表 (JSON 格式)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 初始化角色数据
INSERT INTO roles (name, code, permissions) VALUES
('超级管理员', 'super_admin', '["*"]'),
('管理员', 'admin', '["user:*","role:view","log:*"]'),
('普通用户', 'user', '["profile:*"]');

-- ============================================
-- 操作日志表
-- ============================================
DROP TABLE IF EXISTS operation_logs;
CREATE TABLE operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志 ID',
  user_id BIGINT NOT NULL COMMENT '操作用户 ID',
  action VARCHAR(50) NOT NULL COMMENT '操作类型',
  detail JSON COMMENT '操作详情 (JSON)',
  ip_address VARCHAR(50) DEFAULT '' COMMENT '操作 IP',
  user_agent VARCHAR(255) DEFAULT '' COMMENT '用户代理',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- ============================================
-- 登录日志表
-- ============================================
DROP TABLE IF EXISTS login_logs;
CREATE TABLE login_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志 ID',
  user_id BIGINT NOT NULL COMMENT '用户 ID',
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  ip_address VARCHAR(50) DEFAULT '' COMMENT '登录 IP',
  user_agent VARCHAR(255) DEFAULT '' COMMENT '用户代理/设备信息',
  login_status TINYINT DEFAULT 1 COMMENT '登录状态：1 成功 0 失败',
  fail_reason VARCHAR(100) DEFAULT '' COMMENT '失败原因',
  INDEX idx_user_id (user_id),
  INDEX idx_login_at (login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录日志表';

-- 验证建表结果
SELECT 'Database initialized successfully' AS status;
SHOW TABLES;
