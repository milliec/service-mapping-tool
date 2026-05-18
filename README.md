# Service Blueprint Tool

A single workspace that connects three layers of service design work — mapping, strategy, and prioritisation — that normally live in separate tools with no traceability between them.

## Service blueprint layer

Gives cross-functional teams a shared canvas to map what users do, what the service does, and what's happening behind the scenes — across stages, steps, and swimlanes (L1 macro → L2 journey → L3 product detail). Pain points, needs, and system constraints are visible in the same view, so nothing gets siloed in a slide deck.

## Opportunity layer

Surfaces why you're building what you're building — from environmental and strategic goals down to specific opportunity areas, with evidence codes linking claims to real research. Keeps the "what problem are we solving" question anchored to the map, not buried in a separate board.

## Prioritisation layer

Turns workshop gut-feel into a structured, repeatable scoring exercise (importance × readiness × public value × platform leverage). Creates a shared artefact the whole team can commit to, with a decision record (In / Park / Out) and a markdown export for stakeholders.

## Why it matters

Every opportunity is traceable back to the pain point it came from, the evidence that supports it, the journey step it affects, and the strategic goal it serves. That chain — from user pain → insight → opportunity → decision — is usually invisible. This makes it explicit and git-versioned.

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

---

© 2026 Millie Chan. All rights reserved.
