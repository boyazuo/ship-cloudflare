# Ship Web

内容站模板。Astro 在构建时生成每个公开页面。产物是静态资源，没有 Worker 脚本，没有 D1、R2 或密钥。

简单工具是一张独立页面上的浏览器脚本。需要账号、支付或服务端数据时，改用 SaaS 模板。

## 本地

```bash
pnpm --filter @ship/web dev
```

打开 <http://127.0.0.1:4322>。这是 Astro 开发服务器。

按资产规则预览（先构建，再用 Wrangler）：

```bash
pnpm --filter @ship/web preview
```

在 <http://127.0.0.1:4173> 确认：

- `/`、`/guide`、`/tools/counter` 返回 200，源码里有正文。
- 刷新 `/tools/counter` 仍是这一页。Increment 改变页面上的数字，Reset 回到 0。
- 未知路径返回 404 页面，状态码是 404。

站名和 canonical 写在 `src/site.ts`。换成真实域名时只改这里的 `url`。

## 部署

1. 把 `wrangler.jsonc` 里 `staging` 和 `production` 的主机名换成目标账户中已经启用的 zone。
2. 把 `src/site.ts` 的 `url` 换成同一个主机名。
3. `pnpm --filter @ship/web build`
4. `pnpm --filter @ship/web exec wrangler deploy --dry-run`
5. 确认账户和环境后，再 `pnpm --filter @ship/web exec wrangler deploy`

顶层配置没有路由，给本地和 CI 的 dry-run 使用。`staging` 与 `production` 重复写了资产配置，避免把本地占位当成远程资源。

发布和回滚按仓库规范第 12 节、第 15 节执行。这个模板没有数据库迁移。
