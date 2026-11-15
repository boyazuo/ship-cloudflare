站点或产品 / 域名 / 负责人：Ship SaaS / 占位 staging.example.com 与 www.example.com / 模板使用者
业务目标及用户地区（是否包含中国大陆）：公开营销页需要被索引。应用壳在登录后显示当前用户，设置页可以改资料、导出会话、导出账户和删除账户。不预设中国大陆网络。使用者上线前自行填写。
第 2 节类型：复杂 SaaS 的骨架。本期只有一个 Worker、一个 D1，没有租户行。
偏离第 1 节默认答案的题目、触发条件和批准人：无。公开页用 Astro 静态生成。不能预渲染的部分只有 /api。不使用 Next.js。不因为习惯引入 SSR。
渲染框架与版本、Node、Wrangler、compatibility_date：Astro 7.4.12（静态输出，无 Cloudflare adapter）、Vite 8.3.8、React 19.3.1、TanStack Router 1.170.46、Hono 4.13.18、Drizzle ORM 0.45.4、Zod 4.6.7、Tailwind CSS 4.3.5、TypeScript 5.9.3、Node.js 22、pnpm 10.33.0、Wrangler 4.162.0、Vitest 4.1.12、compatibility_date 2026-11-14。Astro 使用当前稳定主版本 7，而不是方案草稿里的 5。TypeScript 不用 7.0.2，因为 typescript-eslint 8.72.2 要求 typescript <6.1。Vitest 不用 5，因为 @cloudflare/vitest-plugin 1.8.2 要求 vitest ^4.1.0。原先的 @cloudflare/vitest-pool-workers 已改名为这个包。不手写 nodejs_compat。
Worker 数量、Static Assets 文件数估计、路由、是否开启 Workers Cache 及缓存键：一个 Worker。公开 HTML 由资产层返回。run_worker_first 只包含 /api/_、/app 和 /app/_。文件数远低于上限。不开启 Workers Cache。公开页使用 404-page，真实 404。
D1：库数量、是否固定分片、预计容量和写入、索引、Sessions / bookmark：一个库，不分片。表是 app_meta、user、session、audit_event。邮箱和会话令牌哈希有唯一索引。不用 Sessions API，因为会话权威在这张 session 表，每次请求直接读。本地 ID 为全零。staging 与 production 的 UUID 是占位，部署前替换。
租户模型：共享表 / 固定分片 / 一租户一库；tenant_id 的来源：不适用。认证只做用户，不建租户，没有 tenant_id。user_id 来自已校验的会话。以后属于用户的表从创建它的那次迁移就带非空 user_id。
KV：用途、可接受的陈旧时间；权威源在：不适用。没有允许延迟的公开配置。
R2：桶、私有或公开、预签名有效期、CORS、备份：不适用。没有文件。存储插件到来时再加私有桶。
Durable Objects：实体键、事务边界、热点；若无，写不适用：不适用。没有单实体协调。
Queues / Workflows / K2：事件 ID、幂等、重试、死信、补偿；若无，写不适用：不适用。请求内可以完成。
身份与会话存储、对象授权、CSRF、CORS、限流层级、密钥：自建在 D1。Cookie 名 __Host-session，HttpOnly、Secure、SameSite=Lax，库里只存令牌的 SHA-256，每次请求读库。变更状态的请求校验 Origin。未登录写请求返回 401 auth_required。登录使用 LOGIN_RATE_LIMITER，每 IP 每 60 秒 10 次。注册用 Turnstile Siteverify，核对 hostname 和 action。密钥是 TURNSTILE_SECRET_KEY 和 RESEND_API_KEY。没有跨源 CORS。API 响应带 private, no-store。
支付、邮件、CMS、外部 IdP 或数据库：供应商与例外到期日：邮件例外已登记。供应商 Resend，只发密码重置这一封。处理的数据是收件人地址和重置链接。地域随 Resend 账户，上线前由使用者核对。退出方式是换掉 plugins/auth 里的 sendResetEmail。费用按 Resend 账单。本地占位密钥 re_local_unset 让重置对所有人返回 email_unconfigured，不暴露邮箱是否存在。复审日 2027-11-15。支付、CMS、外部 IdP 和外部数据库不适用。定价页只展示配置里的文案。
客户域名（Cloudflare for SaaS）或客户代码（Workers for Platforms）：不适用。一个由本团队部署的 Worker。
环境、账户、资源 ID、域名、部署权限：本地、staging、production 分开写绑定和 vars。预览不指向生产库。CI 只对顶层配置 dry-run，不持有 API token，也不做远程迁移。
峰值、预算、配额余量、超额时拒绝还是放行：公开静态页在未开启 Workers Cache 时不计 Worker 请求费。/api 与 /app 计入 Worker 请求。口令哈希是 PBKDF2-SHA-256、100000 次，Free 的 10ms CPU 不够，需要 Workers Paid。登录超过每 IP 每 60 秒 10 次时拒绝。模板不设置 spending limit。预算由使用者在上线前填写。
备份位置、RPO、RTO、最近一次演练结果与负责人：D1 的 Time Travel 只覆盖这个库，包括用户、会话和审计行。没有独立备份演练。使用者在放入真实数据前按规范第 11 节填写 RPO、RTO 和负责人。审计行在删除账户后保留用户 id，不保留邮箱。
日志采样、保留、值班：observability 已打开 logs 和 traces，采样率都是 1。API 失败用结构化 JSON 和 console.error，不记录正文。接到真实流量后按规范第 4.1 节下调 traces。值班人由使用者指定。
迁移顺序、兼容期限、回滚和前向修复：迁移文件在 apps/saas/migrations，只追加。顺序是本地，然后 staging --remote，批准后再 production --remote。代码回滚不恢复 D1。破坏性变更以后走 expand 到 contract，本期没有这类变更。
风险、未决问题、批准人、下次复审日期：占位域名和占位数据库 UUID 不能部署。/app 下未知路径回应用壳并返回 200，公开未知路径返回 404。插件数组是 auth。Resend 例外复审日 2027-11-15。复审由使用者在替换资源 ID、域名和发信密钥时进行。
