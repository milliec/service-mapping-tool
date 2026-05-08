# Service Blueprint

A browser-based, editable digital service blueprint tool for service designers and cross-functional teams. Map service journeys, delivery layers, rules, systems, and data in one place.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

### Tech stack

- **Next.js 16** (App Router) — framework and rendering
- **TypeScript** — type safety throughout
- **React** — component model
- **Tailwind CSS v4** — utility-first styling
- **shadcn/ui** — accessible UI primitives (Dialog, Tooltip, etc.)
- **dnd-kit** — drag and drop for cards
- **Zustand** — lightweight state management
- **Papa Parse** — CSV parsing
- **SheetJS (xlsx)** — Excel file parsing

### Data model

| Entity | Purpose |
|---|---|
| `Blueprint` | Top-level container with service name and metadata |
| `Stage` | Horizontal band grouping related steps |
| `Step` | Column within a stage — the main analysis unit |
| `LaneDefinition` | Configurable swimlane row (Actor, User need, System, etc.) |
| `Card` | Content item placed at the intersection of a step and lane |

The data model is defined in `src/lib/types.ts`.

### Board layout

The board renders two structural dimensions:

- **Vertical**: Stage header → Stage outcome → Step header → Swimlane rows
- **Horizontal**: Stages contain steps as columns; the board scrolls horizontally

A **line of visibility** divider separates frontstage lanes (Actor, User action, User need, Pain point, Frontstage touchpoint) from backstage lanes (Backstage process, System, Policy intent, Business rule, Data input, Data output).

### State management

All blueprint state lives in a single Zustand store (`src/store/blueprint-store.ts`). The store:

- Hydrates from `localStorage` on mount (or seeds an example blueprint)
- Persists every mutation to `localStorage` automatically
- Provides granular actions for stages, steps, cards, and lane visibility

### Canonical swimlanes

| Key | Display label |
|---|---|
| `actor` | Actor |
| `user_action_event` | User action / event |
| `user_need` | User need |
| `pain_point` | Pain point |
| `frontstage_touchpoint` | Frontstage touchpoint |
| `backstage_process` | Backstage process |
| `system` | System |
| `policy_intent` | Policy intent |
| `business_rule` | Business rule |
| `data_input` | Data input |
| `data_output` | Data output |

## Spreadsheet import

### Supported formats

| Format | Detection | File types |
|---|---|---|
| **Row-based template** | Has `record_type` + `lane_key` columns | CSV, XLSX |
| **Swimlane matrix** | First column of data rows contains lane/structural labels | CSV, XLSX |
| **Mural export** | Has `Swim Lane Label` + `Stage Label` columns | XLSX |

Both row-based and swimlane matrix formats produce the same normalized internal board model.

### Import flow

1. User clicks **Import** in the toolbar
2. Drops or selects a CSV or XLSX file
3. For multi-sheet XLSX, selects which sheet to import
4. The parser auto-detects the format
5. Validation results are shown (errors and warnings)
6. On confirmation, the blueprint state is replaced with the imported data

### Import architecture

```
src/lib/import/
├── parse.ts        — File reading + format detection routing
├── normalize.ts    — Normalizers for all three formats
│                     detectFormat(), splitCellItems(), parseInlineId()
│                     normalizeImportRows(), normalizeSwimlaneMatrix()
│                     normalizeMuralExport(), normalizeAiRows()
├── validate.ts     — Header and lane key validation
└── __tests__/
    └── swimlane.test.ts — Unit tests (vitest)
```

---

### Format A — Row-based template

One row per card. Required columns: `record_type`, `service_name`, `stage`, `stage_order`, `step`, `step_order`.

Optional columns: `stage_outcome`, `lane_key`, `card_title`, `card_body`, `card_order`, `tags`, `source_ref`, `traceability_code`, `derived_from_ids`, `next_step`.

Use `record_type: structure` for stage/step definition rows and `record_type: card` for card rows.

**Multi-card delimiter:** separate multiple card titles with `||` in `card_title`:
```
card_title: "Validation unclear || Error messages confusing"
```

---

### Format B — Swimlane matrix

A workshop-friendly layout where **columns = steps** and **rows = swimlanes**. Designed for pasting from workshop templates or export tools.

#### Sheet layout

```
| Lane          | Step 1         | Step 2         |
|---------------|----------------|----------------|
| service_name  | My Service     |                |
| stage         | Prepare        | Submit         |
| stage_outcome | Ready          | Done           |
| step          | Gather docs    | Upload         |
| next_step     | Submit::Upload |                |
| actor         | User           | User           |
| pain_point    | Forms unclear  | - Timeout      |
|               |                | - Hard to find |
| backstage_process | Review     | Process        |
```

#### Structural rows (not cards)

| Row label | Meaning |
|---|---|
| `service_name` | Blueprint name — first non-empty cell wins |
| `stage` | Stage name per column — blank cells carry forward from the left |
| `stage_outcome` | Outcome text for the stage in that column |
| `step` | Step title per column — falls back to the column header |
| `next_step` | Step transition (see below) |

#### Content lane rows

Rows whose first-column label matches a canonical lane key become card rows. Supported labels: `actor`, `user_action` (alias for `user_action_event`), `user_need`, `pain_point`, `frontstage_touchpoint`, `backstage_process`, `system`, `policy_intent`, `business_rule`, `data_input`, `data_output`.

Unknown labels produce a warning and the row is skipped.

#### Multi-item cells

Each cell may contain one or more items, split by:
- **Line breaks** (`\n`, `\r\n`)
- **Bullet prefixes**: `-`, `*`, `•` at the start of a line

Each item becomes a separate card. Empty lines are discarded.

```
- Validation unclear
- Errors confusing
  Timeout on upload
```
→ three cards: `Validation unclear`, `Errors confusing`, `Timeout on upload`

#### Inline IDs

Card items may include an optional traceability code at the start:
```
PP-001 Validation unclear
PP-002 Errors confusing
```
The code (`PP-001`) is stored as the card's `traceabilityCode`. The remaining text is the card title. If no inline code is present, one is generated automatically from the lane prefix.

**Duplicate ID rules:**
- Same code + same text → warning, card imported once (deduplicated)
- Same code + different text → error flagged in import preview

#### next_step handling

`next_step` creates step-to-step `StepLink` records (not cards). The target value resolves in order:

1. Traceability code: `SS-007`
2. Stage::step composite: `Submit::Upload`
3. Bare step title within the same stage: `Upload` (warns if ambiguous)

Unresolved values produce a warning and are skipped.

---

### Traceability codes

Both formats assign stable traceability codes to every entity on import:

| Prefix | Entity |
|---|---|
| `ST-NNN` | Stage |
| `SS-NNN` | Step |
| `AC-NNN` | Actor card |
| `UA-NNN` | User action card |
| `UN-NNN` | User need card |
| `PP-NNN` | Pain point card |
| `FT-NNN` | Frontstage touchpoint card |
| `BP-NNN` | Backstage process card |
| `SY-NNN` | System card |
| `PI-NNN` | Policy intent card |
| `BR-NNN` | Business rule card |
| `DI-NNN` | Data input card |
| `DO-NNN` | Data output card |
| `NS-NNN` | Step link (next_step) |

Codes are stable — once assigned they are never regenerated. They survive undo/redo via persisted counters in `BlueprintState.traceabilityCounters`.

## Keyboard accessibility

- All controls are keyboard reachable
- Focus states are clearly visible
- Cards have a context menu with **Move up**, **Move down**, **Move left**, **Move right** as keyboard alternatives to drag and drop
- Steps have **Move left** and **Move right** arrow buttons
- Reduced motion preferences are respected

## Extension points

### Adding a new swimlane

1. Add the key to `LANE_KEYS` in `src/lib/types.ts`
2. Add the lane definition to `DEFAULT_LANES` in `src/lib/lane-definitions.ts`
3. Add an icon mapping in `src/components/board/LaneLabel.tsx`
4. Add color classes for the new lane key

### Adding tags or filters

The `Card` type already includes a `tags` array. To add tag filtering:

1. Add a filter state to the store
2. Filter cards in the board's `cardsMap` computation
3. Add filter UI in the toolbar

### JSON export

Already included — click **Export** in the toolbar to download the full blueprint as JSON.

### Adding comments

1. Add a `Comment` type to the data model
2. Link comments to cards by `cardId`
3. Add a comment panel or popover to the card component

### Collaboration

The Zustand store can be extended with middleware for:

- WebSocket sync (e.g., Liveblocks, PartyKit)
- CRDT-based conflict resolution
- Operational transforms

## Project structure

```
src/
├── app/
│   ├── globals.css          — Global styles and theme
│   ├── layout.tsx           — Root layout with font and tooltip provider
│   └── page.tsx             — Main page with hydration and board rendering
├── components/
│   ├── board/
│   │   ├── Board.tsx        — Main board with DnD context and grid layout
│   │   ├── BoardToolbar.tsx — Top toolbar with actions
│   │   ├── BlueprintCard.tsx— Draggable card with edit and move actions
│   │   ├── CellArea.tsx     — Step × Lane cell with sortable cards
│   │   ├── EmptyState.tsx   — Empty blueprint state
│   │   ├── LaneLabel.tsx    — Swimlane label with icon and color
│   │   ├── StageHeader.tsx  — Stage band header with edit actions
│   │   ├── StageOutcome.tsx — Editable stage outcome row
│   │   └── StepHeader.tsx   — Editable step column header
│   ├── import/
│   │   └── ImportDialog.tsx — File upload and import flow
│   └── ui/                  — shadcn/ui components
├── lib/
│   ├── import/
│   │   ├── normalize.ts     — Import row normalization
│   │   ├── parse.ts         — CSV and XLSX parsing
│   │   └── validate.ts      — Import validation
│   ├── lane-definitions.ts  — Lane configuration
│   ├── seed-data.ts         — Example blueprint data
│   ├── types.ts             — TypeScript types and schemas
│   └── utils.ts             — Utility functions
└── store/
    └── blueprint-store.ts   — Zustand state store
```
