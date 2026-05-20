# Service Blueprint Tool

Gives cross-functional teams a shared canvas to map what users do, what the service does, and what's happening behind the scenes — across stages, steps, and swimlanes (L1 macro → L2 journey → L3 product detail). Pain points, needs, and system constraints are visible in the same view, so nothing gets siloed in a slide deck or across multiple mural boards.


## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech stack

Next.js · TypeScript · Tailwind CSS v4 · Zustand · shadcn/ui · dnd-kit

## Project structure

```
src/
├── app/                  — Next.js routes and global styles
├── components/board/     — Board, cards, toolbar, panels
├── components/import/    — Import dialog and file handling
├── lib/                  — Types, import pipeline, data loaders
└── store/                — Zustand blueprint store
```

## Deploying to Heroku

**1. Create the app**
```bash
heroku create your-app-name
```

**2. Set the password**

This activates the password gate — anyone visiting the URL will get a browser login prompt. They can enter any username but must use this exact password.
```bash
heroku config:set PREVIEW_PASSWORD=yourchosenpassword
```

**3. Push to deploy**
```bash
git push heroku main
```

> `middleware.ts` handles the password gate. When `PREVIEW_PASSWORD` is set, every page requires authentication. If the env var is not set (e.g. locally), all traffic passes through freely. No code changes needed.

---

Created and designed by Millie Chan.
