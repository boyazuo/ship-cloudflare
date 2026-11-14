站点或产品 / 域名 / 负责人：Ship Web / 占位 staging.example.com 与 www.example.com / 模板使用者
业务目标及用户地区（是否包含中国大陆）：静态内容站，另有一个不保存数据的浏览器计数器。公开 URL 在构建时生成，可以被索引。不预设中国大陆网络。使用者上线前自行填写。
第 2 节类型：纯静态内容站
偏离第 1 节默认答案的题目、触发条件和批准人：无。页面在发布时生成，使用 Astro 静态输出和真实 404。计数器仍是一张预渲染页面，不因为有一段浏览器脚本改用 Vite SPA。
渲染框架与版本、Node、Wrangler、compatibility_date：Astro 7.4.12（静态输出，无 Cloudflare adapter）、TypeScript 5.9.3、Node.js 22、pnpm 10.33.0、Wrangler 4.162.0、compatibility_date 2026-11-14。不引入 React 或 TanStack Router。TypeScript 不用 7.0.2，因为 typescript-eslint 8.72.2 要求 typescript <6.1。不手写 nodejs_compat，兼容日期已经包含 Node.js 兼容。
Worker 数量、Static Assets 文件数估计、路由、是否开启 Workers Cache 及缓存键：没有 main 脚本，由静态资源 Worker 提供。文件数远低于每个版本 20,000 的上限。not_found_handling 为 404-page，html_handling 为 drop-trailing-slash。不开启 Workers Cache。
D1：库数量、是否固定分片、预计容量和写入、索引、Sessions / bookmark：不适用。没有本团队持有的关系数据。
租户模型：共享表 / 固定分片 / 一租户一库；tenant_id 的来源：不适用。没有用户数据。
KV：用途、可接受的陈旧时间；权威源在：不适用。没有允许延迟的公开配置。
R2：桶、私有或公开、预签名有效期、CORS、备份：不适用。没有文件。
Durable Objects：实体键、事务边界、热点；若无，写不适用：不适用。没有单实体协调。
Queues / Workflows / K2：事件 ID、幂等、重试、死信、补偿；若无，写不适用：不适用。没有需要削峰或补偿的工作。
身份与会话存储、对象授权、CSRF、CORS、限流层级、密钥：不适用。没有登录、跨源 API 或密钥。
支付、邮件、CMS、外部 IdP 或数据库：供应商与例外到期日：不适用。
客户域名（Cloudflare for SaaS）或客户代码（Workers for Platforms）：不适用。
环境、账户、资源 ID、域名、部署权限：本地使用 wrangler dev。staging 与 production 的 Custom Domain 是占位主机名，部署前替换成同一账户里已启用的 zone。CI 只做顶层配置的 deploy --dry-run，不持有 API token。
峰值、预算、配额余量、超额时拒绝还是放行：未开启 Workers Cache 时，命中的静态资源不计 Worker 请求费。模板不设置 spending limit。预算由使用者在上线前填写。
备份位置、RPO、RTO、最近一次演练结果与负责人：不适用。没有权威数据。源码在 Git。
日志采样、保留、值班：observability 已打开 logs 和 traces，head_sampling_rate 都是 1，因为模板流量极小。接到真实流量后按规范第 4.1 节下调 traces。值班人由使用者指定。
迁移顺序、兼容期限、回滚和前向修复：不适用。没有数据库。回滚是发布上一个静态资源版本。
风险、未决问题、批准人、下次复审日期：canonical 目前指向本地预览地址，上线前要改 src/site.ts。占位域名不能直接部署。复审由使用者在替换域名时进行。
