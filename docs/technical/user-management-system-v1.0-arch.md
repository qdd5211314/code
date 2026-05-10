# 用户管理系统 技术方案 v1.0-arch

**对齐PRD版本**：v1.0  
**输出时间**：2026-05-10  
**作者**：高总（技术架构师）

---

## 1. 技术选型说明

| 组件 | 选型 | 版本 | 选型理由 |
| :--- | :--- | :--- | :--- |
| 后端框架 | Node.js + Express | v18 LTS + v4.x | 轻量、团队熟悉、生态成熟、1000 QPS足够 |
| 数据库 | MySQL | 8.0+ | 关系型数据、事务支持、10000用户规模足够 |
| 缓存 | Redis | 6.x+ | 验证码/会话/Token黑名单，5分钟有效期天然适配 |
| 认证方案 | JWT + bcrypt | - | 无状态认证、密码加密cost=10符合PRD安全要求 |
| API规范 | RESTful + OpenAPI 3.0 | - | 前后端契约、便于Mock和联调 |
| 日志存储 | MySQL（同库） | - | 90天自动清理，10000用户规模无需独立ES |
| 短信服务 | 阿里云/腾讯云 | - | PRD指定，验证码有效期5分钟 |
| 进程管理 | PM2 | v5.x | 集群模式、自动重启、日志管理 |

---

## 2. 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                            客户端层                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Web 浏览器  │  │  移动端H5   │  │  管理员后台  │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
└─────────┼────────────────┼────────────────┼─────────────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │ HTTPS (443)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         接入层 (Nginx)                               │
│  • HTTPS终止/强制跳转  • 限流 (全局+IP)  • 静态资源缓存  • 访问日志   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      应用服务层 (Express + PM2)                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  中间件层：CORS / 限流 / JWT校验 / 日志 / 异常处理               ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │  路由层：auth / users / roles / profile / logs                  ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │  业务逻辑层：用户服务 / 认证服务 / 权限服务 / 日志服务           ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    MySQL 8.0    │     │    Redis 6.x    │     │   短信服务 API   │
│  (用户/角色/日志)│     │ (验证码/会话)   │     │  (阿里云/腾讯云) │
│  端口: 3306     │     │  端口: 6379     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 3. 数据库设计

### 3.1 ER图

```
┌──────────────────┐       ┌──────────────────┐
│      users       │       │      roles       │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │◄──────│ id (PK)          │
│ username         │       │ name             │
│ phone            │       │ code             │
│ password         │       │ permissions      │
│ nickname         │       │ created_at       │
│ avatar           │       │ updated_at       │
│ email            │       └──────────────────┘
│ role_id (FK)     │
│ status           │       ┌──────────────────┐
│ login_fail_count │       │  operation_logs  │
│ locked_until     │       ├──────────────────┤
│ last_login_at    │       │ id (PK)          │
│ last_login_ip    │       │ user_id          │
│ created_at       │       │ action           │
│ updated_at       │       │ detail (JSON)    │
│ deleted_at       │       │ ip_address       │
└──────────────────┘       │ user_agent       │
                           │ created_at       │
┌──────────────────┐       └──────────────────┘
│   login_logs     │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │
│ login_at         │
│ ip_address       │
│ user_agent       │
│ login_status     │
│ fail_reason      │
└──────────────────┘
```

### 3.2 表结构设计

```sql
-- ============================================
-- 用户表
-- ============================================
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  phone VARCHAR(11) NOT NULL UNIQUE COMMENT '手机号',
  password VARCHAR(255) NOT NULL COMMENT 'bcrypt加密密码 (cost=10)',
  nickname VARCHAR(50) DEFAULT '' COMMENT '昵称',
  avatar VARCHAR(255) DEFAULT '' COMMENT '头像URL',
  email VARCHAR(100) DEFAULT '' COMMENT '邮箱 (可选)',
  role_id BIGINT DEFAULT 3 COMMENT '角色ID，默认普通用户',
  status TINYINT DEFAULT 1 COMMENT '状态：1启用 0禁用',
  login_fail_count INT DEFAULT 0 COMMENT '登录失败次数',
  locked_until DATETIME DEFAULT NULL COMMENT '锁定截止时间',
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  last_login_ip VARCHAR(50) DEFAULT '' COMMENT '最后登录IP',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at DATETIME DEFAULT NULL COMMENT '软删除时间 (保留90天)',
  INDEX idx_phone (phone),
  INDEX idx_username (username),
  INDEX idx_role_id (role_id),
  INDEX idx_status (status),
  INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 角色表
-- ============================================
CREATE TABLE roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '角色ID',
  name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名称',
  code VARCHAR(50) NOT NULL UNIQUE COMMENT '角色编码 (super_admin/admin/user)',
  permissions TEXT COMMENT '权限列表 (JSON格式)',
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
CREATE TABLE operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
  user_id BIGINT NOT NULL COMMENT '操作用户ID',
  action VARCHAR(50) NOT NULL COMMENT '操作类型 (LOGIN/CREATE_USER/UPDATE_USER/DELETE_USER/CHANGE_ROLE/ENABLE_USER/DISABLE_USER/RESET_PASSWORD)',
  detail JSON COMMENT '操作详情 (JSON)',
  ip_address VARCHAR(50) DEFAULT '' COMMENT '操作IP',
  user_agent VARCHAR(255) DEFAULT '' COMMENT '用户代理',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- ============================================
-- 登录日志表
-- ============================================
CREATE TABLE login_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  ip_address VARCHAR(50) DEFAULT '' COMMENT '登录IP',
  user_agent VARCHAR(255) DEFAULT '' COMMENT '用户代理/设备信息',
  login_status TINYINT DEFAULT 1 COMMENT '登录状态：1成功 0失败',
  fail_reason VARCHAR(100) DEFAULT '' COMMENT '失败原因 (密码错误/验证码错误/账号锁定等)',
  INDEX idx_user_id (user_id),
  INDEX idx_login_at (login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录日志表';

-- ============================================
-- 定时清理任务 (每日凌晨1点执行)
-- ============================================
-- 操作日志清理 (保留90天)
-- DELETE FROM operation_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- 软删除用户清理 (保留90天)
-- DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### 3.3 Redis Key设计

| Key | 类型 | TTL | 说明 |
| :--- | :--- | :--- | :--- |
| `sms_code:{phone}` | String | 300s | 短信验证码 |
| `verify_fail:{phone}` | String | 600s | 验证码错误计数 (3次锁定10分钟) |
| `login_fail:{phone}` | String | 1800s | 登录失败计数 (5次锁定30分钟) |
| `token_blacklist:{jti}` | String | 剩余有效期 | 退出登录Token黑名单 |
| `user_lock:{userId}` | String | 动态 | 用户锁定状态 (禁用时) |

---

## 4. API接口定义

### 4.1 认证模块 `/api/v1/auth`

#### 4.1.1 发送验证码
```yaml
路径: /api/v1/auth/sms-code
方法: POST
鉴权: 否
限流: 10 req/min/手机号
请求参数:
  phone: string (必填) - 手机号
响应格式:
  code: number - 错误码 (0=成功)
  message: string - 提示信息
  data:
    expire_in: number - 验证码有效期 (秒)
错误码:
  1001: 手机号格式错误
  1002: 该手机号已注册
  1003: 发送频率过高，请稍后重试
  1004: 验证码发送失败，请稍后重试
```

#### 4.1.2 手机号+验证码登录
```yaml
路径: /api/v1/auth/login-sms
方法: POST
鉴权: 否
限流: 20 req/min
请求参数:
  phone: string (必填) - 手机号
  code: string (必填) - 验证码
  remember: boolean (可选) - 是否记住登录 (默认false)
响应格式:
  code: number
  message: string
  data:
    token: string - JWT Token
    refresh_token: string - 刷新Token
    expires_in: number - Token有效期 (秒)
    user:
      id: number
      username: string
      nickname: string
      avatar: string
      role: string
错误码:
  0: 成功
  1001: 验证码错误或已过期
  1005: 账号已被禁用
  1006: 登录失败次数过多，账号已锁定
  1007: 手机号未注册
```

#### 4.1.3 账号密码登录
```yaml
路径: /api/v1/auth/login-password
方法: POST
鉴权: 否
限流: 10 req/min
请求参数:
  username: string (必填) - 用户名或手机号
  password: string (必填) - 密码
  remember: boolean (可选) - 是否记住登录 (默认false)
响应格式: 同 login-sms
错误码:
  0: 成功
  1004: 密码错误
  1005: 账号已被禁用
  1006: 登录失败次数过多，账号已锁定 (连续5次失败锁定30分钟)
  1008: 用户不存在
```

#### 4.1.4 注册
```yaml
路径: /api/v1/auth/register
方法: POST
鉴权: 否
限流: 5 req/min
请求参数:
  phone: string (必填) - 手机号
  code: string (必填) - 验证码
  username: string (必填) - 用户名
  password: string (必填) - 密码 (6-20位，含字母和数字)
  nickname: string (可选) - 昵称
响应格式:
  code: number
  message: string
  data:
    user_id: number
错误码:
  0: 成功
  1001: 手机号格式错误
  1002: 该手机号已注册
  1003: 用户名已存在
  1004: 验证码错误或已过期
  1009: 密码格式不符合要求
```

#### 4.1.5 找回密码
```yaml
路径: /api/v1/auth/reset-password
方法: POST
鉴权: 否
限流: 5 req/min
请求参数:
  phone: string (必填) - 手机号
  code: string (必填) - 验证码
  new_password: string (必填) - 新密码
响应格式:
  code: number
  message: string
错误码:
  0: 成功
  1001: 手机号未注册
  1004: 验证码错误或已过期
  1009: 密码格式不符合要求
```

#### 4.1.6 退出登录
```yaml
路径: /api/v1/auth/logout
方法: POST
鉴权: 是 (Bearer Token)
限流: -
请求参数:
  token: string (可选) - 要注销的Token (不传则注销当前Token)
响应格式:
  code: number
  message: string
错误码:
  0: 成功
  1006: Token无效
```

#### 4.1.7 刷新Token
```yaml
路径: /api/v1/auth/refresh
方法: POST
鉴权: 是 (Bearer Refresh Token)
限流: 30 req/min
请求参数:
  refresh_token: string (必填) - 刷新Token
响应格式:
  code: number
  message: string
  data:
    token: string - 新JWT Token
    expires_in: number - 有效期 (秒)
错误码:
  0: 成功
  1006: Refresh Token无效或已过期
  1005: 账号已被禁用
```

### 4.2 用户管理 `/api/v1/users` (管理员)

#### 4.2.1 用户列表
```yaml
路径: /api/v1/users
方法: GET
鉴权: 是 (admin/super_admin)
限流: 100 req/min
请求参数:
  page: number (可选) - 页码 (默认1)
  page_size: number (可选) - 每页数量 (默认20, 支持10/20/50)
  keyword: string (可选) - 搜索关键词 (用户名/手机号模糊搜索)
  role_id: number (可选) - 角色筛选
  status: number (可选) - 状态筛选 (1启用/0禁用)
响应格式:
  code: number
  message: string
  data:
    list:
      - id: number
        username: string
        phone: string
        nickname: string
        avatar: string
        role_id: number
        role_name: string
        status: number
        created_at: string
        last_login_at: string
    total: number
    page: number
    page_size: number
错误码:
  0: 成功
  1007: 权限不足
```

#### 4.2.2 用户详情
```yaml
路径: /api/v1/users/:id
方法: GET
鉴权: 是 (admin/super_admin)
限流: 100 req/min
响应格式:
  code: number
  message: string
  data:
    id: number
    username: string
    phone: string
    nickname: string
    avatar: string
    email: string
    role_id: number
    role_name: string
    status: number
    created_at: string
    updated_at: string
    last_login_at: string
    last_login_ip: string
错误码:
  0: 成功
  1003: 用户不存在
  1007: 权限不足
```

#### 4.2.3 新增用户
```yaml
路径: /api/v1/users
方法: POST
鉴权: 是 (admin/super_admin)
限流: 20 req/min
请求参数:
  username: string (必填) - 用户名
  phone: string (必填) - 手机号
  password: string (必填) - 初始密码
  nickname: string (可选) - 昵称
  role_id: number (必填) - 角色ID
响应格式:
  code: number
  message: string
  data:
    user_id: number
错误码:
  0: 成功
  1002: 手机号已注册
  1003: 用户名已存在
  1007: 权限不足
  1010: 角色不存在
```

#### 4.2.4 编辑用户
```yaml
路径: /api/v1/users/:id
方法: PUT
鉴权: 是 (admin/super_admin)
限流: 50 req/min
请求参数:
  username: string (可选) - 用户名
  nickname: string (可选) - 昵称
  email: string (可选) - 邮箱
  role_id: number (可选) - 角色ID
  phone: string (可选) - 手机号 (修改需验证码)
  verify_code: string (可选) - 手机验证码 (修改手机号时必填)
响应格式:
  code: number
  message: string
错误码:
  0: 成功
  1002: 手机号已注册
  1003: 用户不存在
  1007: 权限不足
  1010: 角色不存在
  1011: 数据已被修改，请刷新后重试 (乐观锁)
```

#### 4.2.5 删除用户 (软删除)
```yaml
路径: /api/v1/users/:id
方法: DELETE
鉴权: 是 (admin/super_admin)
限流: 20 req/min
响应格式:
  code: number
  message: string
错误码:
  0: 成功
  1003: 用户不存在
  1007: 权限不足
  1012: 不能删除自己
```

#### 4.2.6 禁用/启用用户
```yaml
路径: /api/v1/users/:id/status
方法: PUT
鉴权: 是 (admin/super_admin)
限流: 20 req/min
请求参数:
  status: number (必填) - 状态 (1启用/0禁用)
响应格式:
  code: number
  message: string
错误码:
  0: 成功
  1003: 用户不存在
  1007: 权限不足
  1012: 不能操作自己
```

#### 4.2.7 重置密码
```yaml
路径: /api/v1/users/:id/password/reset
方法: PUT
鉴权: 是 (admin/super_admin)
限流: 10 req/min
请求参数:
  new_password: string (必填) - 新密码
响应格式:
  code: number
  message: string
错误码:
  0: 成功
  1003: 用户不存在
  1007: 权限不足
  1009: 密码格式不符合要求
  1012: 不能重置自己密码
```

### 4.3 角色管理 `/api/v1/roles`

#### 4.3.1 角色列表
```yaml
路径: /api/v1/roles
方法: GET
鉴权: 是 (admin/super_admin)
限流: 100 req/min
响应格式:
  code: number
  message: string
  data:
    list:
      - id: number
        name: string
        code: string
        permissions: array
错误码:
  0: 成功
  1007: 权限不足
```

### 4.4 个人信息 `/api/v1/profile`

#### 4.4.1 获取个人信息
```yaml
路径: /api/v1/profile
方法: GET
鉴权: 是
限流: 100 req/min
响应格式:
  code: number
  message: string
  data:
    id: number
    username: string
    phone: string
    nickname: string
    avatar: string
    email: string
    role_id: number
    role_name: string
    created_at: string
错误码:
  0: 成功
  1006: Token无效
```

#### 4.4.2 编辑个人信息
```yaml
路径: /api/v1/profile
方法: PUT
鉴权: 是
限流: 20 req/min
请求参数:
  nickname: string (可选) - 昵称
  avatar: string (可选) - 头像URL (上传后返回的URL)
  email: string (可选) - 邮箱
  phone: string (可选) - 手机号 (修改需验证码)
  verify_code: string (可选) - 手机验证码 (修改手机号时必填)
响应格式:
  code: number
  message: string
错误码:
  0: 成功
  1002: 手机号已注册
  1006: Token无效
  1011: 数据已被修改，请刷新后重试
```

#### 4.4.3 修改密码
```yaml
路径: /api/v1/profile/password
方法: PUT
鉴权: 是
限流: 10 req/min
请求参数:
  old_password: string (必填) - 旧密码
  new_password: string (必填) - 新密码
响应格式:
  code: number
  message: string
错误码:
  0: 成功
  1004: 旧密码错误
  1006: Token无效
  1009: 密码格式不符合要求
```

#### 4.4.4 登录记录
```yaml
路径: /api/v1/profile/login-logs
方法: GET
鉴权: 是
限流: 50 req/min
请求参数:
  limit: number (可选) - 返回条数 (默认10, 最大50)
响应格式:
  code: number
  message: string
  data:
    list:
      - login_at: string
        ip_address: string
        user_agent: string
        login_status: number
        fail_reason: string
错误码:
  0: 成功
  1006: Token无效
```

### 4.5 操作日志 `/api/v1/logs`

#### 4.5.1 日志列表
```yaml
路径: /api/v1/logs
方法: GET
鉴权: 是 (admin/super_admin)
限流: 100 req/min
请求参数:
  page: number (可选) - 页码 (默认1)
  page_size: number (可选) - 每页数量 (默认20)
  user_id: number (可选) - 操作人筛选
  action: string (可选) - 操作类型筛选
  start_time: string (可选) - 开始时间 (YYYY-MM-DD HH:mm:ss)
  end_time: string (可选) - 结束时间 (YYYY-MM-DD HH:mm:ss)
响应格式:
  code: number
  message: string
  data:
    list:
      - id: number
        user_id: number
        username: string
        action: string
        detail: object
        ip_address: string
        created_at: string
    total: number
    page: number
    page_size: number
错误码:
  0: 成功
  1007: 权限不足
```

### 4.6 统一响应格式

```json
// 成功响应
{
  "code": 0,
  "message": "success",
  "data": {}
}

// 错误响应
{
  "code": 1001,
  "message": "验证码错误或已过期",
  "data": null
}

// 分页响应
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

### 4.7 错误码总表

| 错误码 | 说明 | 处理建议 |
| :--- | :--- | :--- |
| 0 | 成功 | - |
| 1001 | 手机号格式错误/验证码错误 | 检查输入 |
| 1002 | 手机号已注册 | 直接登录或找回密码 |
| 1003 | 用户不存在 | 检查输入或联系管理员 |
| 1004 | 密码错误 | 重试或找回密码 |
| 1005 | 账号已被禁用 | 联系管理员 |
| 1006 | Token无效或已过期 | 重新登录 |
| 1007 | 权限不足 | 联系管理员分配权限 |
| 1008 | 用户不存在 (登录时) | 检查用户名 |
| 1009 | 密码格式不符合要求 | 6-20位，含字母和数字 |
| 1010 | 角色不存在 | 联系管理员 |
| 1011 | 数据已被修改 (乐观锁) | 刷新后重试 |
| 1012 | 不能操作自己 | - |
| 2001 | 参数校验失败 | 检查请求参数 |
| 2002 | 请求频率超限 | 稍后重试 |
| 9999 | 服务器内部错误 | 联系技术支持 |

---

## 5. 非功能性设计

### 5.1 性能指标

| 指标 | 目标值 | 实现方案 |
| :--- | :--- | :--- |
| 页面加载 | < 2秒 | 前端资源CDN + 后端接口P99 < 500ms |
| 并发能力 | 1000 QPS | Redis缓存 + MySQL连接池 (50-100) + PM2集群 |
| 登录响应 | < 300ms | 验证码Redis缓存，bcrypt异步校验 |
| 列表查询 | < 500ms | 数据库索引优化 + 分页限制 |

### 5.2 安全设计

| 安全项 | 实现方案 |
| :--- | :--- |
| 密码加密 | bcrypt cost=10，禁止明文存储 |
| 传输安全 | Nginx强制HTTPS，HTTP自动跳转 |
| Token机制 | JWT有效期2小时，Refresh Token 7天 |
| 登录保护 | 连续5次失败锁定30分钟 (Redis计数) |
| 验证码保护 | 连续3次错误锁定10分钟，5分钟有效期 |
| 接口限流 | 按IP + 用户维度限流，防止暴力攻击 |
| SQL注入防护 | 参数化查询 + ORM预处理 |
| XSS防护 | 响应头X-Content-Type-Options + 输入过滤 |
| 敏感操作日志 | 登录/改密/权限变更全部记录 |
| 禁用即时生效 | Redis维护用户锁定状态，Token校验时拦截 |

### 5.3 数据保留策略

| 数据类型 | 保留策略 | 清理方式 |
| :--- | :--- | :--- |
| 操作日志 | 90天 | 每日凌晨1点定时任务清理 |
| 软删除用户 | 90天 | 每日凌晨1点定时任务清理 |
| 验证码 | 5分钟 | Redis TTL自动失效 |
| 登录失败计数 | 30分钟 | Redis TTL自动失效 |
| Token黑名单 | Token剩余有效期 | Redis TTL自动失效 |

### 5.4 可扩展性预留

| 扩展点 | 当前设计 | 未来扩展 |
| :--- | :--- | :--- |
| 角色模型 | 单用户单角色 | 预留user_roles中间表支持多角色 |
| 头像存储 | URL字符串 | 可对接OSS/CDN |
| 短信服务 | 阿里云/腾讯云 | 抽象Provider接口，支持切换 |
| 日志存储 | MySQL同库 | 用户量>10万迁移ES |
| 认证方式 | 手机号+验证码/密码 | 预留OAuth接口 (微信/钉钉) |

---

## 6. 部署架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         生产环境部署架构                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Nginx (HTTPS 443)                        │   │
│  │  • 强制HTTP→HTTPS跳转  • 限流  • 静态资源  • 访问日志轮转    │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Node.js 应用 (PM2 集群模式)                     │   │
│  │  • 实例数 = CPU核心数  • 端口: 3000  • 自动重启  • 日志管理  │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│  │  MySQL 8.0  │     │  Redis 6.x  │     │  日志文件   │          │
│  │  端口:3306  │     │  端口:6379  │     │ /var/log/   │          │
│  │  数据持久化  │     │  数据持久化  │     │ 按天轮转    │          │
│  └─────────────┘     └─────────────┘     └─────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.1 环境要求

| 组件 | 配置要求 | 备注 |
| :--- | :--- | :--- |
| 应用服务器 | 2核4G 起步 | PM2集群模式，1000 QPS足够 |
| MySQL | 2核4G | 10000用户规模，InnoDB引擎 |
| Redis | 1核2G | 主要存验证码/会话/计数 |
| Node.js | v18+ LTS | 生产环境，禁用--inspect |
| 带宽 | 5Mbps 起步 | 根据实际流量调整 |

### 6.2 环境变量配置

```bash
# 应用配置
NODE_ENV=production
APP_PORT=3000
APP_NAME=user_management

# JWT配置
JWT_SECRET=<32位随机字符串>
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d

# Redis配置
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=<可选>
REDIS_DB=0

# MySQL配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=user_management
DB_USER=app_user
DB_PASSWORD=<强密码>
DB_POOL_MIN=5
DB_POOL_MAX=50

# 短信服务配置
SMS_PROVIDER=aliyun  # 或 tencent
SMS_ACCESS_KEY=<AccessKey>
SMS_ACCESS_SECRET=<AccessSecret>
SMS_SIGN_NAME=<短信签名>
SMS_TEMPLATE_CODE=<验证码模板CODE>

# 安全配置
LOGIN_FAIL_LIMIT=5
LOGIN_LOCK_DURATION=1800  # 30分钟
VERIFY_FAIL_LIMIT=3
VERIFY_LOCK_DURATION=600  # 10分钟
CODE_EXPIRE_IN=300  # 5分钟

# 日志配置
LOG_LEVEL=info
LOG_DIR=/var/log/user_management
LOG_MAX_FILES=90  # 保留90天
```

### 6.3 PM2配置文件 (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'user-management',
    script: './src/app.js',
    instances: 'max',  // CPU核心数
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '500M',
    restart_delay: 4000
  }]
};
```

### 6.4 Nginx配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # 限流
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }

    # 访问日志
    access_log /var/log/nginx/user_management_access.log;
    error_log /var/log/nginx/user_management_error.log;
}
```

---

## 7. 技术风险评估

| 风险 | 等级 | 影响 | 应对措施 |
| :--- | :--- | :--- | :--- |
| 短信服务不稳定 | 中 | 用户无法登录/注册 | 接入备用服务商 + 失败重试 + 降级邮件验证码 |
| 日志表数据增长快 | 低 | 查询性能下降 | 90天自动清理 + 按月分表预留 |
| JWT无法主动失效 | 低 | 退出登录后Token仍可用至过期 | Redis维护Token黑名单 |
| 单点故障 (MySQL/Redis) | 中 | 服务不可用 | 后续升级MySQL主从 + Redis哨兵 |
| 并发超1000 QPS | 低 | 响应变慢 | 水平扩展应用实例 + Redis集群 |
| 头像上传安全风险 | 中 | 恶意文件上传 | 文件类型校验 + 大小限制 + 重命名存储 |

---

## 8. 技术债务记录

| 债务 | 原因 | 影响 | 偿还计划 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| 日志同库存储 | v1.0用户量少，简化部署 | 日志量大时影响查询性能 | 用户量>10万时迁移到ES | P2 |
| 单Redis实例 | 初期成本低 | Redis故障影响验证码/会话 | QPS>5000时升级哨兵模式 | P2 |
| 无监控告警 | v1.0优先级低 | 故障发现依赖人工 | 上线后接入Prometheus+Grafana | P1 |
| 无单元测试 | 赶工期 | 回归测试成本高 | 核心模块补充单元测试 | P1 |
| 单用户单角色 | PRD简化设计 | 复杂权限场景不支持 | 有需求时引入user_roles中间表 | P3 |

---

## 9. 待确认事项

| 编号 | 事项 | 负责人 | 截止时间 |
| :--- | :--- | :--- | :--- |
| Q01 | 短信服务商确认 (阿里云/腾讯云) | 屈总 | 开发前 |
| Q02 | 域名及SSL证书准备 | 运维 | 上线前 |
| Q03 | 服务器资源申请 (2核4G x 2) | 管总 | 开发前 |
| Q04 | 头像上传OSS还是本地存储 | 高总 | 开发前 |

---

**技术方案版本**：v1.0-arch  
**对齐PRD版本**：v1.0  
**输出时间**：2026-05-10  
**作者**：高总

---

## 下一步工作

- [ ] **后端开发**：按API定义实现接口，核心模块完成后提交评审
- [ ] **前端开发**：按API定义Mock，联调前同步接口变更
- [ ] **运维工程师**：准备服务器环境，部署MySQL/Redis/Nginx
- [ ] **测试工程师**：根据API定义编写测试用例

**接口定义即契约**——实现过程中如有问题先沟通，不要自行修改接口。
