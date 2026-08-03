# MixStil Sleep Audio

用自然语言快速生成可调整、可复现、可分享的个性化睡眠与冥想声景。

项目以[个性化音频项目主线宪章](docs/project-mainline-charter.md)作为最高执行约束，以[个性化音频生成方案 V2.0](docs/personalized-audio-generation-plan-v2.md)作为当前产品和技术基线。

当前唯一主线：完成 Recipe V2，使用户描述、Live Mix、版本冻结和最终导出共享一套可复现的配方语义。

## Product Docs

- [Project Mainline Charter](docs/project-mainline-charter.md)
- [Personalized Audio Generation Plan V2](docs/personalized-audio-generation-plan-v2.md)
- [Personalized Audio Execution Plan](docs/personalized-audio-execution-plan.md)
- [Product PRD](docs/product-prd.md)
- [Business Architecture](docs/business-architecture.md)
- [Information Architecture](docs/information-architecture.md)
- [Backend Contract](docs/backend-contract.md)
- [MVP Backlog](docs/mvp-backlog.md)
- [Compliance Notes](docs/compliance-notes.md)

## Implementation Notes

- Frontend: React + TypeScript + Vite.
- Backend: Express + PostgreSQL.
- Domain/schema types: `src/lib/domain.ts`.

## Local Development

```bash
cp .env.example .env
docker compose up -d postgres
pnpm dev:api
pnpm dev
```

If the Docker Compose plugin is unavailable, use:

```bash
pnpm db:docker
pnpm dev:api
pnpm dev
```

The frontend proxies `/api` to the sleep-audio API on `http://localhost:8788`.
