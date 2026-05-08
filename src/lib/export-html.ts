import { getLaneTitle } from './lane-definitions';
import { type BlueprintState, type Card, type LaneDefinition, type PolicyReformSpan, type Stage, type Step, type JourneySpan } from './types';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'blueprint';
}

function renderTags(tags: string[]) {
  if (tags.length === 0) return '';
  return `
    <div class="tag-row">
      ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
    </div>
  `;
}

function renderCard(card: Card, laneTitle: string) {
  return `
    <article class="card">
      <div class="card-meta">
        <span class="lane-pill">${escapeHtml(laneTitle)}</span>
        ${card.traceabilityCode ? `<span class="trace-pill">${escapeHtml(card.traceabilityCode)}</span>` : ''}
      </div>
      <h5>${escapeHtml(card.title)}</h5>
      ${card.body ? `<p>${escapeHtml(card.body)}</p>` : ''}
      ${renderTags(card.tags)}
    </article>
  `;
}

function renderSpanCard(span: JourneySpan | PolicyReformSpan, typeLabel: string, stepLookup: Map<string, Step>) {
  const start = stepLookup.get(span.startStepId)?.title ?? 'Unknown step';
  const end = stepLookup.get(span.endStepId)?.title ?? start;
  return `
    <article class="span-card">
      <div class="card-meta">
        <span class="lane-pill">${escapeHtml(typeLabel)}</span>
      </div>
      <h5>${escapeHtml(span.title)}</h5>
      ${span.description ? `<p>${escapeHtml(span.description)}</p>` : ''}
      <div class="span-range">${escapeHtml(start)} to ${escapeHtml(end)}</div>
    </article>
  `;
}

function sortByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function getRelevantLanes(state: BlueprintState) {
  const cardsByLane = new Set(state.cards.map((card) => card.laneKey));
  if (state.journeySpans.length > 0) cardsByLane.add('user_journey');
  if (state.policyReformSpans.length > 0) cardsByLane.add('policy_reform');

  return [...state.lanes]
    .filter((lane) => lane.visible || cardsByLane.has(lane.key))
    .sort((a, b) => a.order - b.order);
}

function renderStageSection(
  stage: Stage,
  steps: Step[],
  lanes: LaneDefinition[],
  cards: Card[],
  journeySpans: JourneySpan[],
  policyReformSpans: PolicyReformSpan[],
) {
  const stepLookup = new Map(steps.map((step) => [step.id, step]));
  const stageStepIds = new Set(steps.map((step) => step.id));
  const stageJourneySpans = sortByOrder(
    journeySpans.filter((span) => stageStepIds.has(span.startStepId) || stageStepIds.has(span.endStepId)),
  );
  const stagePolicySpans = sortByOrder(
    policyReformSpans.filter((span) => stageStepIds.has(span.startStepId) || stageStepIds.has(span.endStepId)),
  );

  return `
    <section class="stage">
      <header class="stage-header">
        <div>
          <p class="eyebrow">Stage</p>
          <h3>${escapeHtml(stage.title)}</h3>
        </div>
        ${stage.outcome ? `<p class="stage-outcome">${escapeHtml(stage.outcome)}</p>` : ''}
      </header>

      ${(stageJourneySpans.length > 0 || stagePolicySpans.length > 0) ? `
        <div class="span-section">
          ${stagePolicySpans.length > 0 ? `
            <div class="span-group">
              <h4>Policy reforms</h4>
              <div class="span-grid">
                ${stagePolicySpans.map((span) => renderSpanCard(span, 'Policy reform', stepLookup)).join('')}
              </div>
            </div>
          ` : ''}
          ${stageJourneySpans.length > 0 ? `
            <div class="span-group">
              <h4>User journeys</h4>
              <div class="span-grid">
                ${stageJourneySpans.map((span) => renderSpanCard(span, 'User journey', stepLookup)).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="steps-grid">
        ${steps.map((step) => `
          <section class="step">
            <header class="step-header">
              <p class="eyebrow">Step</p>
              <h4>${escapeHtml(step.title)}</h4>
            </header>
            <div class="lane-list">
              ${lanes.map((lane) => {
                const laneCards = sortByOrder(cards.filter((card) => card.stepId === step.id && card.laneKey === lane.key));
                if (lane.key === 'user_journey' || lane.key === 'policy_reform') return '';
                if (laneCards.length === 0) return '';
                return `
                  <section class="lane-block">
                    <h5 class="lane-title">${escapeHtml(getLaneTitle(lane.key))}</h5>
                    <div class="card-list">
                      ${laneCards.map((card) => renderCard(card, getLaneTitle(lane.key))).join('')}
                    </div>
                  </section>
                `;
              }).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    </section>
  `;
}

function renderDocument(state: BlueprintState, title?: string): string {
  const stages = sortByOrder(state.stages);
  const steps = sortByOrder(state.steps);
  const lanes = getRelevantLanes(state);
  const childDocuments = sortByOrder(
    (state.childBlueprints ?? []).map((child, index) => ({ ...child, order: index })),
  );

  return `
    <section class="document">
      <header class="document-header">
        <div>
          <p class="eyebrow">${escapeHtml(title ?? 'Blueprint')}</p>
          <h2>${escapeHtml(state.blueprint.serviceName)}</h2>
        </div>
        <div class="summary-grid">
          <div class="summary-card"><span>Stages</span><strong>${stages.length}</strong></div>
          <div class="summary-card"><span>Steps</span><strong>${steps.length}</strong></div>
          <div class="summary-card"><span>Cards</span><strong>${state.cards.length}</strong></div>
          <div class="summary-card"><span>Journeys</span><strong>${state.journeySpans.length}</strong></div>
          <div class="summary-card"><span>Reforms</span><strong>${state.policyReformSpans.length}</strong></div>
        </div>
      </header>

      ${state.blueprint.description ? `<p class="description">${escapeHtml(state.blueprint.description)}</p>` : ''}

      ${stages.map((stage) => {
        const stageSteps = steps.filter((step) => step.stageId === stage.id);
        return renderStageSection(stage, stageSteps, lanes, state.cards, state.journeySpans, state.policyReformSpans);
      }).join('')}

      ${childDocuments.length > 0 ? `
        <section class="children">
          <header class="subsection-header">
            <p class="eyebrow">Nested views</p>
            <h3>Included nested journeys</h3>
          </header>
          ${childDocuments.map((child) => renderDocument(child, 'Nested journey')).join('')}
        </section>
      ` : ''}
    </section>
  `;
}

export function exportHtml(state: BlueprintState): string {
  const fileTitle = `${state.blueprint.serviceName} blueprint`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(fileTitle)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7f6;
        --panel: #ffffff;
        --panel-soft: #eef6f1;
        --text: #183126;
        --muted: #62756b;
        --border: #d9e4de;
        --accent: #008938;
        --accent-soft: #e6f3eb;
        --shadow: 0 18px 40px rgba(16, 45, 30, 0.08);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, #ffffff 0, #f8fbf9 28%, transparent 55%),
          linear-gradient(180deg, #eef5f1 0%, var(--bg) 240px);
        color: var(--text);
      }

      .page {
        width: min(1200px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 32px 0 56px;
      }

      .hero {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 24px 28px;
        border: 1px solid var(--border);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: var(--shadow);
        margin-bottom: 28px;
      }

      .hero h1, .document-header h2, .stage-header h3, .subsection-header h3, .step-header h4, .card h5, .span-card h5 {
        margin: 0;
      }

      .hero h1 { font-size: clamp(2rem, 4vw, 3rem); line-height: 1; }
      .hero p { margin: 10px 0 0; color: var(--muted); max-width: 70ch; }

      .hero-meta {
        display: grid;
        gap: 10px;
        min-width: 240px;
      }

      .hero-meta-card, .summary-card {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: var(--panel-soft);
      }

      .hero-meta-card span, .summary-card span, .eyebrow, .lane-title {
        display: block;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .hero-meta-card strong, .summary-card strong {
        display: block;
        margin-top: 6px;
        font-size: 1rem;
      }

      .document {
        display: grid;
        gap: 24px;
      }

      .document + .document {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--border);
      }

      .document-header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: start;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(96px, 1fr));
        gap: 10px;
        min-width: min(560px, 100%);
      }

      .description {
        margin: 0;
        color: var(--muted);
        max-width: 80ch;
      }

      .stage {
        padding: 22px;
        border: 1px solid var(--border);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }

      .stage-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
        margin-bottom: 18px;
      }

      .stage-outcome {
        margin: 0;
        max-width: 38ch;
        color: var(--muted);
      }

      .span-section, .children {
        display: grid;
        gap: 18px;
      }

      .span-group {
        padding: 16px;
        border-radius: 20px;
        background: #f8fbf9;
        border: 1px solid var(--border);
      }

      .span-group h4, .subsection-header h3 {
        margin: 0 0 12px;
      }

      .span-grid, .card-list {
        display: grid;
        gap: 12px;
      }

      .steps-grid {
        display: grid;
        gap: 16px;
        margin-top: 18px;
      }

      .step {
        padding: 16px;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: #fcfdfc;
      }

      .step-header {
        margin-bottom: 12px;
      }

      .lane-list {
        display: grid;
        gap: 14px;
      }

      .lane-block {
        display: grid;
        gap: 10px;
      }

      .card, .span-card {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: white;
      }

      .card p, .span-card p {
        margin: 8px 0 0;
        color: var(--muted);
        line-height: 1.5;
      }

      .card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }

      .lane-pill, .trace-pill, .tag {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 600;
      }

      .lane-pill {
        background: var(--accent-soft);
        color: var(--accent);
      }

      .trace-pill, .tag {
        background: #f1f4f2;
        color: #496055;
      }

      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .span-range {
        margin-top: 12px;
        font-size: 12px;
        font-weight: 600;
        color: var(--accent);
      }

      @media (max-width: 920px) {
        .hero, .document-header, .stage-header {
          grid-template-columns: 1fr;
          display: grid;
        }

        .summary-grid {
          grid-template-columns: repeat(2, minmax(120px, 1fr));
          min-width: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div>
          <p class="eyebrow">Standalone blueprint viewer</p>
          <h1>${escapeHtml(state.blueprint.serviceName)}</h1>
          <p>This file is self-contained and can be opened in any browser or shared as an email attachment.</p>
        </div>
        <div class="hero-meta">
          <div class="hero-meta-card">
            <span>Exported</span>
            <strong>${escapeHtml(formatDate(new Date().toISOString()))}</strong>
          </div>
          <div class="hero-meta-card">
            <span>Blueprint updated</span>
            <strong>${escapeHtml(formatDate(state.blueprint.updatedAt))}</strong>
          </div>
        </div>
      </section>
      ${renderDocument(state)}
    </main>
  </body>
</html>`;
}

export function getBlueprintHtmlFilename(state: BlueprintState) {
  return `${slugify(state.blueprint.serviceName)}_blueprint_viewer.html`;
}
