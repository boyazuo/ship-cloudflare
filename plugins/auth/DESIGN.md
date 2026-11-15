# auth

TinyShip 的认证是 Better Auth 1.4.10：Drizzle 的 sqlite 适配器、邮箱密码、Resend 发重置信。它同时打开了社交登录、管理员、手机号，口令哈希是 `@noble/hashes` 的 scrypt（N=16384、r=16）。本插件只保留邮箱密码这一条路径。

## 三件事先定下来

1. **不把 Better Auth 打进 Worker。** 它的 Drizzle 适配器可以指到 D1，默认也不开 `db.transaction()`，所以没有 Node 原生模块这条本身不是障碍。不能用它的原因是：默认哈希不是 Web Crypto；`create-context` 会静态引入 scrypt；注册时的用户、凭证和会话是多次独立写入，审计行放不进同一次 `DB.batch()`。规范要求 Paid 上用 Web Crypto，计划要求登录、登出、删除的审计和业务写入同一次 `batch()`。
2. **口令用 PBKDF2-SHA-256，100000 次，经 `crypto.subtle`。** 2026-11-15 在本机 Node WebCrypto 上单次约 70ms；workerd 里一次注册（哈希加 D1 写入）约 50ms。同一算法 600000 次在 Node 上约 400ms，也进得了 Paid 的请求 CPU，但登录还要读 D1，所以先用 100000。Free 的 10ms 跑不了这组参数。不引入 bcrypt、Argon2 或 scrypt。
3. **账户恢复走邮件，不走通行密钥。** 和 TinyShip 一样：注册不要求先验证邮箱，忘记密码用 `/app/reset`。本阶段只发这一封事务邮件，用 Resend 的 HTTPS 接口，不引入邮件 SDK，也不加队列。阶段 3 再把发信收成 `email` 插件。

## 数据

`user`、`session`、`audit_event`。没有租户，没有 `tenant_id`，没有角色。密码哈希和未完成的重置令牌哈希放在 `user` 上，因为只有一种登录方式，不建 TinyShip 的 `account` 表。

会话 cookie 名是 `__Host-session`。值是 32 字节随机数，D1 里只存它的 SHA-256。每次 `requirePrincipal()` 都读 D1。过期会话视为不存在，读会话不写库。

`audit_event` 只记 `sign_in`、`sign_out`、`delete`。删除账户时会话和用户行去掉，审计行留下用户 id，不留邮箱。`shortcut: 审计行不清理，出现保留期要求后再做幂等删除。`

会话列表最多 20 条。`shortcut: 固定上限，超过一页再改游标。`

## 入口

- 注册校验 Turnstile。Worker 调 Siteverify，要求 `success`、`hostname` 等于本次请求的主机名、`action` 为 `sign-up`。开发环境如果用文档里的始终通过测试密钥，响应固定是 `hostname: example.com` 且没有 `action`，只在 `APP_ENV=development` 接受这一组。
- 登录先走 `LOGIN_RATE_LIMITER`（每 IP 每 60 秒 10 次）。这是近似限额。精确配额以后写 D1。
- 变更状态的 `/api` 请求必须带匹配的 `Origin`。开发环境另外允许 Vite 的 `127.0.0.1:5174` 和 `localhost:5174`。

## 密钥

`TURNSTILE_SECRET_KEY`、`RESEND_API_KEY` 是 Worker Secret。`AUTH_EMAIL_FROM` 是公开 var。本地占位 `re_local_unset` 表示还没接发信：重置接口对所有人返回 `email_unconfigured`，不查用户是否存在。
