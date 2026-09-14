# Frontend

React 19 + Vite + Tailwind CSS v4 + HeroUI Pro.

## Setup

```sh
pnpm install
```

HeroUI Pro artifacts are downloaded with the same `hpsetup` flow as the internal Matrix app. After `pnpm install`, if `@heroui-pro/react` CSS is missing:

```sh
npx hpsetup@latest <HEROUI_SETUP_KEY> react
```

## Develop

```sh
pnpm dev
```

Set `VITE_API_BASE` in `.env.local` (see `.env.example`). Runtime override lives in `index.html` as `#app-config`.

## Build / deploy

```sh
pnpm build
pnpm deploy
```
