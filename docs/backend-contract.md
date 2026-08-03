# Backend Contract

当前前端已切到 `src/lib/api.ts` HTTP client，后端由 `server/index.ts` 提供 Express API，数据库使用 PostgreSQL。核心资产 `mixes.recipe_data` 和 `ai_sessions.chat_history` 使用 JSONB。

## Current Local Implementation

- `src/lib/domain.ts`: shared entity and API types.
- `src/lib/api.ts`: frontend HTTP client.
- `server/index.ts`: Express API server.
- `server/schema.ts`: PostgreSQL schema creation.
- `server/seed.ts`: seed data for users, stems, and starter mixes.

## Core Tables

- `users`: user profile, role, subscription tier.
- `audio_stems`: licensed atomic audio tracks for the mixer.
- `mixes`: core soundscape asset with `recipe_data` JSON.
- `user_history`: recently played and future recommendation input.
- `ai_sessions`: prompt history and generated draft mix.

## API Shape

- `GET /api/me`
- `GET /api/audio-stems`
- `GET /api/listen/home`
- `GET /api/discover?query=`
- `GET /api/studio`
- `GET /api/mixes/:id`
- `POST /api/mixes`
- `POST /api/mixes/:id/play`
- `POST /api/mixes/:id/favorite`
- `POST /api/mixes/:id/share`
- `GET /api/mixes/:id/analytics`
- `POST /api/ai/sessions`

## Implemented Business Rules

- Home and Discover read from published mixes.
- Studio reads creator-owned mixes.
- AI prompt creates `ai_sessions` and a draft `mix`.
- Publishing saves `recipeData` instead of local-only work objects.
- Player records play history and play count.
- Favorite and share actions update mix counters.
- Analytics computes curation progress from plays, favorites, and completion rate.
- Save flow blocks risky medical claims such as `cure`, `treat`, `clinically proven`, and `guaranteed sleep`.

## Local Startup

```bash
cp .env.example .env
docker compose up -d postgres
pnpm dev:api
pnpm dev
```

If Docker Compose is unavailable, start any PostgreSQL instance and set `DATABASE_URL` to a database that the API can create tables in.
