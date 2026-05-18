# Service Blueprint

A browser-based tool for mapping service journeys, delivery layers, rules, systems, and data in one place.

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
