# Ship Cloudflare

一套可直接克隆、本地运行并部署到 Cloudflare 的开源模板。同一个 monorepo 里有两个互相独立的部署单元：纯静态内容站，以及带公开页、应用壳、只读 API 和一个 D1 的 SaaS 骨架。

认证、支付、国际化和文件存储只定了插件契约，还没有实现。平台限额、安全和发布规则以 [技术选型与开发规范](docs/0.%20Cloudflare%20技术选型与开发规范.md) 为准；目录、构建和数据路径的实现说明见 [技术方案](docs/1.%20Ship%20Cloudflare%20技术方案.md)。

## 目录

- [模板](#模板)
- [请求怎么走](#请求怎么走)
- [技术栈](#技术栈)
- [仓库结构](#仓库结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [脚本](#脚本)
- [内容站](#内容站)
- [SaaS 骨架](#saas-骨架)
- [插件](#插件)
- [质量与 CI](#质量与-ci)
- [当前范围](#当前范围)
- [文档](#文档)

## 模板

每个模板是一次独立部署。两者不合成一个 Worker，也不按租户拆目录。

| 模板 | 包名 | 目录 | 部署形态 | 适合 |
| --- | --- | --- | --- | --- |
| 内容站 | `@ship/web` | [`apps/web`](apps/web) | Workers Static Assets。没有 Worker 脚本，没有数据库，没有密钥 | 可索引的内容页，以及不保存数据的浏览器工具 |
| SaaS 骨架 | `@ship/saas` | [`apps/saas`](apps/saas) | 一个 Worker：静态公开页、`/app` 应用壳、Hono API、一个 D1 | 以后要接登录和写接口的应用 |

需要账号、支付或服务端数据的功能放在 SaaS 模板里。内容站保持静态，未知路径返回真实 404。

## 请求怎么走

内容站的页面在构建时生成。浏览器只碰到静态资源。

```text
apps/web
  浏览器 → Workers Static Assets
           /  /guide  /tools/counter  /privacy  /terms → 对应 HTML
           未知路径                  → 404 页面，状态码 404
```

SaaS 把可索引的页面留在资产层。只有 API 和应用壳的深链进入 Worker。

```text
apps/saas
  浏览器 → /  /pricing  /privacy  /terms  带哈希的静态文件 → 资产层
         → 未知公开路径                  → 404 页面，状态码 404
         → /app  /app/*                  → Worker → 对应文件，否则 /app/index.html
         → /api/*                         → Worker → Hono → D1.app_meta
```

公开 HTML 不读数据库、不写 Cookie。`/api/*` 的响应带 `Cache-Control: private, no-store`。写请求在认证插件接上之前默认拒绝。

## 技术栈

版本以锁文件为准。下面是本期锁定的主版本。

| 层 | 选择 |
| --- | --- |
| 运行时与包管理 | Node.js 22、pnpm 10.33.0、Turborepo 2 |
| 语言 | TypeScript 5.9（strict、ESM） |
| 公开页面 | Astro 7，`output: 'static'`。内容站整站，以及 SaaS 的首页和定价页 |
| 应用壳 | Vite 8、React 19、TanStack Router，`base` 为 `/app/` |
| API | Hono 4，只处理 `/api/*` 和应用壳回退 |
| 校验 | Zod 4，用于 API 入参和 `app.config.ts` |
| 数据 | D1、Drizzle ORM（sqlite 方言）、Wrangler migrations。多语句用 `DB.batch()` |
| 界面 | Tailwind CSS 4。shadcn/ui 组件以源码放在 `@ship/ui`。内容站只用设计令牌，不加载 React |
| 测试 | Vitest 4。碰到绑定的测试用 `@cloudflare/vitest-plugin` 跑在 workerd 里 |
| 部署 | Wrangler 4，`wrangler.jsonc`。绑定类型由 `wrangler types` 生成 |

内容站和 SaaS 公开页都不走服务端渲染。Worker 只存在于 `apps/saas`。

## 仓库结构

```text
ship-cloudflare/
├── apps/
│   ├── web/                 # @ship/web，静态内容站
│   └── saas/                # @ship/saas，一个 Worker
│       ├── site/            # Astro 公开页
│       ├── app/             # Vite SPA，base=/app/
│       ├── worker/          # Hono 入口与插件注册
│       ├── db/              # Drizzle schema 与 D1 客户端
│       └── migrations/      # Wrangler 读取的 SQL，只追加
├── packages/
│   ├── ui/                  # @ship/ui，设计令牌与 React 组件
│   ├── worker-kit/          # @ship/worker-kit，Hono 工厂、错误体、安全响应头
│   ├── plugin-sdk/          # @ship/plugin-sdk，插件类型，无运行时副作用
│   └── tsconfig/            # 共享 TypeScript 配置
├── plugins/                 # 本期只有启用说明，没有插件包
└── docs/                    # 选型规范与实现方案
```

共享包导出 TypeScript 源码，由应用的 Vite 或 Wrangler 打包。`pnpm-workspace.yaml` 包含 `apps/*`、`packages/*`、`plugins/*`。

## 环境要求

- Node.js 22.12 或更高
- pnpm 10.33.0（`packageManager` 已固定）
- 部署到 Cloudflare 时需要已登录的 Wrangler，以及目标账户里启用的 zone

本地检查和 CI 的 dry-run 不需要 Cloudflare API token。

## 快速开始

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm cf:check
```

启动内容站（Astro，<http://127.0.0.1:4322>）：

```bash
pnpm dev:web
```

启动 SaaS。第一次会先完整构建，再同时打开三个进程：

| 进程 | 地址 | 用途 |
| --- | --- | --- |
| Astro | <http://127.0.0.1:4321> | 改公开页 |
| Vite | <http://127.0.0.1:5174/app/> | 改应用壳，`/api` 代理到 Worker |
| Wrangler | <http://127.0.0.1:8787> | API、本地 D1、合并后的资产 |

```bash
pnpm dev:saas
```

合并后的行为和部署预览不要用单独的 Vite 或 Astro 验收：

```bash
pnpm --filter @ship/web preview    # http://127.0.0.1:4173
pnpm --filter @ship/saas preview   # http://127.0.0.1:8787
```

内容站预览应看到：`/`、`/guide`、`/tools/counter`、`/privacy`、`/terms` 为 200，刷新工具页仍是该页，未知路径为 404。SaaS 预览应看到：`/`、`/pricing`、`/privacy`、`/terms` 为 200，未知公开路径为 404，刷新 `/app/settings` 仍是应用壳，`GET /api/health` 与 `GET /api/meta` 带 `Cache-Control: private, no-store`，`POST /api/meta` 返回 401，错误体为 `{ "error": "auth_required" }`。

## 脚本

根 `package.json` 只做转发。

| 命令 | 行为 |
| --- | --- |
| `pnpm dev:web` | 启动内容站的 Astro 开发服务器 |
| `pnpm dev:saas` | 构建一次，再同时启动 SaaS 的 Astro、Vite 和 `wrangler dev` |
| `pnpm build` | Turborepo 构建两个应用 |
| `pnpm typecheck` | 各包类型检查 |
| `pnpm test` | 各包 Vitest |
| `pnpm cf:types` | 在 `apps/saas` 运行 `wrangler types` |
| `pnpm cf:check` | 两个应用分别执行 `wrangler deploy --dry-run` |
| `pnpm format` | 用 Prettier 格式化仓库 |

绑定变更后运行 `pnpm cf:types`，并提交 `apps/saas/worker-configuration.d.ts`。CI 会再生成一次并对比差异。

本地 D1 迁移由 `dev:saas` 和 `preview` 在启动 Wrangler 前执行。需要单独跑时：

```bash
pnpm --filter @ship/saas exec wrangler d1 migrations apply DB --local
```

已应用的迁移文件只追加、不修改。Wrangler 只读取 `apps/saas/migrations`。

## 内容站

Astro 在构建时生成每个公开 URL。简单工具是独立页面上的浏览器脚本：计数器只改当前页的数字，不发请求。

| URL | 作用 |
| --- | --- |
| `/` | 首页 |
| `/guide` | 内容页和简单工具的边界 |
| `/tools/counter` | 不保存数据的计数器 |
| `/privacy`、`/terms` | 法律页。这个站不保存个人信息 |
| 未知路径 | 真实 404 |

站名和 canonical 写在 `apps/web/src/site.ts`。换成真实域名时改这里的 `url`，并替换 `wrangler.jsonc` 里 staging 与 production 的主机名。部署顺序、占位域名和验收步骤见 [apps/web/README.md](apps/web/README.md)。

## SaaS 骨架

一个包、一次构建、一个 Worker。构建顺序固定：先 Astro 写入 `dist/`，再 Vite 只写入 `dist/app/`。

| URL | 作用 |
| --- | --- |
| `/` | 可索引的首页 |
| `/pricing` | 静态方案名称和价格文案，没有结账 |
| `/privacy`、`/terms` | 法律页。数据库只有 `app_meta`，没有账户 |
| `/app` | 应用首页。认证插件启用前没有会话 |
| `/app/settings` | 空状态，用来验收深链 |
| `GET /api/health` | `{ "ok": true }`，不访问 D1 |
| `GET /api/meta` | 读取 `app_meta`，返回应用名和已启用插件 id |

`wrangler.jsonc` 里 staging 与 production 的 `database_id` 是占位，不能拿去部署。先用 `wrangler d1 create` 得到 UUID，再替换主机名。生产环境的远程迁移需要单独批准。密钥以后用 `wrangler secret put` 写入，不放进 `vars` 或 Git。完整步骤见 [apps/saas/README.md](apps/saas/README.md)。

代码回滚不会恢复 D1。发布和回滚按规范第 12 节和第 15 节执行，全文见 [技术选型与开发规范](docs/0.%20Cloudflare%20技术选型与开发规范.md)。

## 插件

插件不会通过扫描 `plugins/` 加载。Worker 的依赖必须在构建时静态可见。启用一个插件要同时做四件事：

1. 在 `apps/saas/worker/plugins.ts` 里静态导入并放进数组。
2. 把它的 Drizzle 表展开进 `apps/saas/db/schema.ts`，生成新的 SQL 并提交到 `apps/saas/migrations/`。
3. 在 `apps/saas/wrangler.jsonc` 的本地配置和每个环境里声明它需要的绑定，然后运行 `pnpm cf:types`。
4. 如果它有界面，在应用壳里静态导入 `clientRoutes`。

认证只存用户和会话，不建租户。属于用户的表从第一版迁移起就带非空 `user_id`。用户 id 来自已验证的会话，不来自调用方自选字段。插件包里的 SQL 只是草案，直到应用把它复制进 `apps/saas/migrations`。

模块、插件和页面的顺序见 [后续开发计划](docs/2.%20Ship%20Cloudflare%20后续开发计划.md)。每个插件开工前另写设计说明。类型和检查函数在 `@ship/plugin-sdk`，启用步骤见 [plugins/README.md](plugins/README.md)。

## 质量与 CI

ESLint 与 Prettier 放在仓库根，各包不复制配置。GitHub Actions 在 push 和 pull request 上执行：

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm cf:check
pnpm cf:types && git diff --exit-code -- apps/saas/worker-configuration.d.ts
```

流水线不设置 `CLOUDFLARE_API_TOKEN`。`cf:check` 只做 dry-run。远程迁移和 `wrangler deploy` 留在有审批的发布流程里。

测试覆盖错误体形状、API 响应头、未注册写方法被拒绝，以及 workerd 里的 `/api/health`、`/api/meta` 和未知 API。页面、深链和 404 在预览步骤里确认，Playwright 不是 CI 门禁。

## 当前范围

本期交付 monorepo、内容站模板和 SaaS 骨架。下面这些能力留到对应插件，不在默认依赖里：

- 注册、登录、会话、权限、支付、邮件、短信、国际化和文件上传
- R2、KV、Queues、Workflows、Durable Objects
- Next.js、Nuxt、TanStack Start，以及服务端渲染

选型理由和明确排除项写在 [技术方案第 3 节和第 7 节](docs/1.%20Ship%20Cloudflare%20技术方案.md)。

## 文档

| 文档 | 内容 |
| --- | --- |
| [技术选型与开发规范](docs/0.%20Cloudflare%20技术选型与开发规范.md) | 平台限额、数据、安全、发布和上线验收 |
| [技术方案](docs/1.%20Ship%20Cloudflare%20技术方案.md) | 本仓库的目录、构建、路由和插件契约 |
| [后续开发计划](docs/2.%20Ship%20Cloudflare%20后续开发计划.md) | 骨架之后的模块、插件和页面顺序 |
| [内容站说明](apps/web/README.md) | 本地预览和部署 |
| [SaaS 说明](apps/saas/README.md) | 三进程开发、D1 迁移和部署 |
| [内容站选型单](apps/web/SELECTION.md) | 该模板的选型记录 |
| [SaaS 选型单](apps/saas/SELECTION.md) | 该模板的选型记录 |
| [插件约定](plugins/README.md) | 以后如何把插件接进 SaaS |

本仓库以 [MIT 许可证](LICENSE) 发布。
