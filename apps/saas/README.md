# Ship SaaS

一个 Worker：可索引的公开页、`/app` 下的应用壳、只读 API，以及一个 D1。没有匿名写接口。

## 本地

三个进程一起开。第一次会先做完整构建，让 Wrangler 有资产可服务。

```bash
pnpm --filter @ship/saas dev
```

| 进程     | 地址                         | 用途                           |
| -------- | ---------------------------- | ------------------------------ |
| Astro    | <http://127.0.0.1:4321>      | 改公开页                       |
| Vite     | <http://127.0.0.1:5174/app/> | 改应用壳，`/api` 代理到 Worker |
| Wrangler | <http://127.0.0.1:8787>      | API、本地 D1、合并后的资产     |

验收用合并预览，而不是单独的 Vite 或 Astro：

```bash
pnpm --filter @ship/saas preview
```

在 8787 上确认：

- `/` 和 `/pricing` 是 200，源码里有正文。
- 未知公开路径是 404。
- 刷新 `/app/settings` 仍是应用壳。
- `GET /api/health` 与 `GET /api/meta` 带 `Cache-Control: private, no-store`。
- `POST /api/meta` 返回 401，错误体是 `{ "error": "auth_required" }`。

本地迁移由 `dev` 和 `preview` 在启动 Wrangler 前执行。需要单独跑时：

```bash
pnpm --filter @ship/saas exec wrangler d1 migrations apply DB --local
```

`dev` 和 `preview` 都会先对本地库执行这条命令。Wrangler 不会在启动时自动补迁移。

## 部署

1. 在目标账户创建两个库，把 `wrangler.jsonc` 里 staging 和 production 的 `database_id` 换成命令输出的 UUID。配置里的 UUID 是占位，不能拿去部署。

```bash
pnpm --filter @ship/saas exec wrangler d1 create ship-saas-staging-db
pnpm --filter @ship/saas exec wrangler d1 create ship-saas-production-db
```

2. 把 `staging.example.com` 和 `www.example.com` 换成同一账户里已经启用的主机名，并确认证书和 DNS。
3. 构建，然后对目标环境先看迁移，再 dry-run，再部署。

```bash
pnpm --filter @ship/saas build
pnpm --filter @ship/saas exec wrangler d1 migrations list DB --env staging --remote
pnpm --filter @ship/saas exec wrangler d1 migrations apply DB --env staging --remote
pnpm --filter @ship/saas exec wrangler deploy --dry-run --env staging
pnpm --filter @ship/saas exec wrangler deploy --env staging
```

生产环境的 `--remote` 需要单独批准。执行前核对账户、环境名、数据库 UUID 和主机名。

已应用的迁移文件只追加、不修改。绑定变更后运行 `pnpm cf:types`，并提交 `worker-configuration.d.ts`。

这个模板没有密钥。以后的密钥用 `wrangler secret put <NAME> --env <environment>` 写入，不放进 `vars` 或 Git。

发布、回滚和验收按仓库规范第 12 节和第 15 节。代码回滚不恢复 D1。
