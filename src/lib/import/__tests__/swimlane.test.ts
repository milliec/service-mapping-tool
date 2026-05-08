/**
 * Tests for the swimlane matrix import pipeline.
 *
 * Covers:
 *  - splitCellItems  — cell splitting by newlines and bullets
 *  - parseInlineId   — inline traceability code extraction
 *  - detectFormat    — format detection from headers + data rows
 *  - normalizeSwimlaneMatrix — full normalizer: stages, steps, cards,
 *      step links, inline IDs, generated IDs, duplicate detection
 *
 * All tested functions are pure (no store, no filesystem access).
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { splitCellItems, splitEmbeddedTypedLaneItems, parseInlineId, parseLeadingCodeLabel, detectFormat, normalizeSwimlaneMatrix } from '../normalize';
import { processXlsxSheet } from '../parse';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal swimlane matrix row set for testing. */
function makeRows(overrides: Record<string, Record<string, string>> = {}): Record<string, string>[] {
  const base: Record<string, Record<string, string>> = {
    service_name:          { lane: 'service_name', col1: 'My Service', col2: '' },
    stage:                 { lane: 'stage',         col1: 'Prepare',   col2: 'Submit' },
    stage_outcome:         { lane: 'stage_outcome', col1: 'Ready',     col2: 'Submitted' },
    step:                  { lane: 'step',          col1: 'Gather docs', col2: 'Upload' },
    pain_point:            { lane: 'pain_point',    col1: 'Forms unclear\nErrors confusing', col2: 'Timeout errors' },
    frontstage_touchpoint: { lane: 'frontstage_touchpoint', col1: 'Portal', col2: '' },
    next_step:             { lane: 'next_step',     col1: 'Submit::Upload', col2: '' },
    ...overrides,
  };
  return Object.values(base);
}

const HEADERS = ['lane', 'col1', 'col2'];

// ---------------------------------------------------------------------------
// splitCellItems
// ---------------------------------------------------------------------------

describe('splitCellItems', () => {
  it('returns empty array for empty string', () => {
    expect(splitCellItems('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(splitCellItems('   \n  ')).toEqual([]);
  });

  it('splits on newlines', () => {
    expect(splitCellItems('Alpha\nBeta\nGamma')).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('splits on Windows CRLF', () => {
    expect(splitCellItems('Alpha\r\nBeta')).toEqual(['Alpha', 'Beta']);
  });

  it('splits on semicolons', () => {
    expect(splitCellItems('Alpha; Beta;Gamma')).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('strips leading dash bullets', () => {
    expect(splitCellItems('- Alpha\n- Beta')).toEqual(['Alpha', 'Beta']);
  });

  it('strips leading asterisk bullets', () => {
    expect(splitCellItems('* Alpha\n* Beta')).toEqual(['Alpha', 'Beta']);
  });

  it('strips leading bullet character •', () => {
    expect(splitCellItems('• Alpha\n• Beta')).toEqual(['Alpha', 'Beta']);
  });

  it('ignores blank lines between items', () => {
    expect(splitCellItems('Alpha\n\nBeta')).toEqual(['Alpha', 'Beta']);
  });

  it('returns single-item array for plain text with no delimiters', () => {
    expect(splitCellItems('Single item')).toEqual(['Single item']);
  });

  it('trims leading and trailing whitespace from each item', () => {
    expect(splitCellItems('  Alpha  \n  Beta  ')).toEqual(['Alpha', 'Beta']);
  });
});

// ---------------------------------------------------------------------------
// parseInlineId
// ---------------------------------------------------------------------------

describe('parseInlineId', () => {
  it('extracts a three-digit traceability code', () => {
    expect(parseInlineId('PP-001 Validation unclear')).toEqual({
      traceabilityCode: 'PP-001',
      text: 'Validation unclear',
    });
  });

  it('extracts a longer traceability code', () => {
    expect(parseInlineId('OPP-042 Some opportunity')).toEqual({
      traceabilityCode: 'OPP-042',
      text: 'Some opportunity',
    });
  });

  it('returns no code when text has no inline ID', () => {
    expect(parseInlineId('Just a plain card')).toEqual({ text: 'Just a plain card' });
  });

  it('does not match two-digit sequences', () => {
    expect(parseInlineId('PP-01 Too short')).toEqual({ text: 'PP-01 Too short' });
  });

  it('does not match lowercase prefix', () => {
    expect(parseInlineId('pp-001 lowercase')).toEqual({ text: 'pp-001 lowercase' });
  });

  it('trims extra whitespace from extracted text', () => {
    const result = parseInlineId('UN-007  Extra spaces');
    expect(result.traceabilityCode).toBe('UN-007');
    expect(result.text).toBe('Extra spaces');
  });

  it('handles multi-word lane prefixes like SS and ST', () => {
    expect(parseInlineId('SS-003 Step title')).toEqual({
      traceabilityCode: 'SS-003',
      text: 'Step title',
    });
  });
});

describe('parseLeadingCodeLabel', () => {
  it('extracts a traceability code followed by a colon label', () => {
    expect(parseLeadingCodeLabel('WOA-001: Guided classification tool')).toEqual({
      traceabilityCode: 'WOA-001',
      text: 'Guided classification tool',
    });
  });

  it('returns original text when no leading code label exists', () => {
    expect(parseLeadingCodeLabel('Guidance: WOA-001 Guided classification tool')).toEqual({
      text: 'Guidance: WOA-001 Guided classification tool',
    });
  });
});

describe('splitEmbeddedTypedLaneItems', () => {
  it('splits when a typed indicator starts mid-string', () => {
    expect(
      splitEmbeddedTypedLaneItems('% processed consistently regardless of caseworker. Efficiency: SPI-007 Time per organisation to determine status and begin registration'),
    ).toEqual([
      '% processed consistently regardless of caseworker.',
      'Efficiency: SPI-007 Time per organisation to determine status and begin registration',
    ]);
  });

  it('leaves a single typed item intact', () => {
    expect(
      splitEmbeddedTypedLaneItems('Efficiency: SPI-007 Time per organisation to determine status and begin registration'),
    ).toEqual([
      'Efficiency: SPI-007 Time per organisation to determine status and begin registration',
    ]);
  });
});

// ---------------------------------------------------------------------------
// detectFormat
// ---------------------------------------------------------------------------

describe('detectFormat', () => {
  it('detects template format by record_type and lane_key headers', () => {
    expect(detectFormat(['record_type', 'stage', 'lane_key', 'card_title'], [])).toBe('template');
  });

  it('detects mural format by swim_lane_label and stage_label headers', () => {
    expect(detectFormat(['swim_lane_label', 'stage_label', 'content'], [])).toBe('mural');
  });

  it('detects swimlane format when first column data has lane keys', () => {
    const rows = [
      { lane: 'stage', col1: 'Prepare' },
      { lane: 'step', col1: 'Gather docs' },
      { lane: 'pain_point', col1: 'Forms unclear' },
    ];
    expect(detectFormat(['lane', 'col1'], rows)).toBe('swimlane');
  });

  it('detects swimlane when first column contains structural keys', () => {
    const rows = [{ lane: 'service_name', col1: 'My Service' }];
    expect(detectFormat(['lane', 'col1'], rows)).toBe('swimlane');
  });

  it('detects legacy swimlane via header[0] === swimlane even with no matching data rows', () => {
    expect(detectFormat(['swimlane', 'col1'], [])).toBe('swimlane');
  });

  it('returns unknown when no format matches', () => {
    const rows = [{ a: 'foo', b: 'bar' }];
    expect(detectFormat(['a', 'b'], rows)).toBe('unknown');
  });

  it('returns unknown when no step headers exist after first column', () => {
    // Only one column — no step headers to go alongside lane labels
    const rows = [{ lane: 'pain_point' }];
    expect(detectFormat(['lane'], rows)).toBe('unknown');
  });

  it('template takes priority over swimlane even if rows look like swimlane', () => {
    // If record_type and lane_key are present, it must be template
    const rows = [{ record_type: 'stage', lane_key: 'pain_point', step1: '' }];
    expect(detectFormat(['record_type', 'lane_key', 'step1'], rows)).toBe('template');
  });
});

// ---------------------------------------------------------------------------
// normalizeSwimlaneMatrix — full integration
// ---------------------------------------------------------------------------

describe('normalizeSwimlaneMatrix', () => {
  it('produces stages and steps from stage/step rows', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    expect(state.stages).toHaveLength(2);
    expect(state.stages[0].title).toBe('Prepare');
    expect(state.stages[1].title).toBe('Submit');
    expect(state.steps).toHaveLength(2);
    expect(state.steps.map((s) => s.title)).toContain('Gather docs');
    expect(state.steps.map((s) => s.title)).toContain('Upload');
  });

  it('assigns ST traceability codes to stages', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    for (const stage of state.stages) {
      expect(stage.traceabilityCode).toMatch(/^ST-\d{3,}$/);
    }
  });

  it('assigns SS traceability codes to steps', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    for (const step of state.steps) {
      expect(step.traceabilityCode).toMatch(/^SS-\d{3,}$/);
    }
  });

  it('splits multi-line cells into separate cards', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    const ppCards = state.cards.filter((c) => c.laneKey === 'pain_point');
    // col1: "Forms unclear\nErrors confusing" + col2: "Timeout errors" = 3 cards
    expect(ppCards).toHaveLength(3);
    expect(ppCards.map((c) => c.title)).toContain('Forms unclear');
    expect(ppCards.map((c) => c.title)).toContain('Errors confusing');
    expect(ppCards.map((c) => c.title)).toContain('Timeout errors');
  });

  it('assigns PP lane traceability codes to pain_point cards', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    const ppCards = state.cards.filter((c) => c.laneKey === 'pain_point');
    for (const card of ppCards) {
      expect(card.traceabilityCode).toMatch(/^PP-\d{3,}$/);
    }
  });

  it('groups cards under the correct stage and step', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    const gatherStep = state.steps.find((s) => s.title === 'Gather docs')!;
    const ppInGather = state.cards.filter(
      (c) => c.laneKey === 'pain_point' && c.stepId === gatherStep.id,
    );
    expect(ppInGather).toHaveLength(2); // "Forms unclear" + "Errors confusing"
  });

  it('carries stage forward for columns with no explicit stage cell', () => {
    const rows = makeRows({
      // Override stage row: col1 has a stage, col2 is blank (carry-forward)
      stage: { lane: 'stage', col1: 'Prepare', col2: '' },
    });
    const { state } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    // Both steps should belong to 'Prepare'
    const prepareStage = state.stages.find((s) => s.title === 'Prepare')!;
    expect(prepareStage).toBeDefined();
    const stepsInPrepare = state.steps.filter((s) => s.stageId === prepareStage.id);
    expect(stepsInPrepare.length).toBeGreaterThanOrEqual(1);
  });

  it('sets stage outcome from stage_outcome row', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    const prepare = state.stages.find((s) => s.title === 'Prepare')!;
    expect(prepare.outcome).toBe('Ready');
  });

  it('reads service name from service_name row', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    expect(state.blueprint.serviceName).toBe('My Service');
  });

  it('resolves next_step to a StepLink', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    expect(state.stepLinks).toHaveLength(1);
    const link = state.stepLinks[0];
    const sourceStep = state.steps.find((s) => s.id === link.sourceStepId)!;
    const targetStep = state.steps.find((s) => s.id === link.targetStepId)!;
    expect(sourceStep.title).toBe('Gather docs');
    expect(targetStep.title).toBe('Upload');
    expect(link.traceabilityCode).toMatch(/^NS-\d{3,}$/);
  });

  it('warns on unresolvable next_step value', () => {
    const rows = makeRows({ next_step: { lane: 'next_step', col1: 'NonExistentStep', col2: '' } });
    const { warnings } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    expect(warnings.some((w) => w.field === 'next_step')).toBe(true);
  });

  it('preserves inline traceability codes', () => {
    const rows = makeRows({
      pain_point: { lane: 'pain_point', col1: 'PP-042 Validation unclear', col2: '' },
    });
    const { state } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    const card = state.cards.find((c) => c.title === 'Validation unclear');
    expect(card).toBeDefined();
    expect(card!.traceabilityCode).toBe('PP-042');
  });

  it('strips inline ID from card title', () => {
    const rows = makeRows({
      pain_point: { lane: 'pain_point', col1: 'PP-001 Forms unclear', col2: '' },
    });
    const { state } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    const card = state.cards.find((c) => c.laneKey === 'pain_point');
    expect(card!.title).toBe('Forms unclear');
    expect(card!.title).not.toContain('PP-001');
  });

  it('generates IDs for items without inline codes', () => {
    const rows = makeRows({
      pain_point: { lane: 'pain_point', col1: 'No ID here', col2: '' },
    });
    const { state } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    const card = state.cards.find((c) => c.title === 'No ID here');
    expect(card).toBeDefined();
    expect(card!.traceabilityCode).toMatch(/^PP-\d{3,}$/);
  });

  it('errors on duplicate inline ID with conflicting text', () => {
    const rows = makeRows({
      pain_point: {
        lane: 'pain_point',
        col1: 'PP-001 First version\nPP-001 Different text',
        col2: '',
      },
    });
    const { errors } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    expect(errors.some((e) => e.field === 'traceability_code' && e.message.includes('conflicting'))).toBe(true);
  });

  it('warns and deduplicates exact duplicate inline IDs', () => {
    const rows = makeRows({
      pain_point: {
        lane: 'pain_point',
        col1: 'PP-001 Same text\nPP-001 Same text',
        col2: '',
      },
    });
    const { state, warnings } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    const ppCards = state.cards.filter((c) => c.laneKey === 'pain_point');
    // Should only appear once
    expect(ppCards.filter((c) => c.traceabilityCode === 'PP-001')).toHaveLength(1);
    expect(warnings.some((w) => w.field === 'traceability_code')).toBe(true);
  });

  it('preserves explicit stage columns even when they have no card content', () => {
    const rows = makeRows({
      pain_point:            { lane: 'pain_point', col1: 'Something', col2: '' },
      frontstage_touchpoint: { lane: 'frontstage_touchpoint', col1: '', col2: '' },
      next_step:             { lane: 'next_step', col1: '', col2: '' },
    });
    const { state } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    const uploadStep = state.steps.find((s) => s.title === 'Upload');
    expect(uploadStep).toBeDefined();
  });

  it('prunes structurally blank step columns', () => {
    const rows = [
      { lane: 'service_name', col1: 'My Service', col2: '', col3: '' },
      { lane: 'stage', col1: 'Prepare', col2: '', col3: '' },
      { lane: 'step', col1: 'Gather docs', col2: '', col3: '' },
      { lane: 'pain_point', col1: 'Forms unclear', col2: '', col3: '' },
    ];

    const { state } = normalizeSwimlaneMatrix(['lane', 'col1', 'col2', 'col3'], rows, 'test.xlsx', 'Sheet1');

    expect(state.steps.map((step) => step.title)).toEqual(['Gather docs']);
  });

  it('warns on unknown lane labels', () => {
    const rows = makeRows({
      bogus_lane: { lane: 'bogus_lane', col1: 'Some content', col2: '' },
    });
    const { warnings } = normalizeSwimlaneMatrix(HEADERS, rows, 'test.xlsx', 'Sheet1');
    expect(warnings.some((w) => w.message.includes('bogus_lane'))).toBe(true);
  });

  it('produces the same normalized BlueprintState shape as row-based import', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    // All required BlueprintState arrays must be present
    expect(Array.isArray(state.stages)).toBe(true);
    expect(Array.isArray(state.steps)).toBe(true);
    expect(Array.isArray(state.cards)).toBe(true);
    expect(Array.isArray(state.cardLinks)).toBe(true);
    expect(Array.isArray(state.evidence)).toBe(true);
    expect(Array.isArray(state.opportunities)).toBe(true);
    expect(Array.isArray(state.stepLinks)).toBe(true);
    expect(Array.isArray(state.requirements)).toBe(true);
    expect(Array.isArray(state.apiContracts)).toBe(true);
    expect(Array.isArray(state.uiScaffolds)).toBe(true);
    expect(typeof state.traceabilityCounters).toBe('object');
    expect(state.blueprint).toHaveProperty('id');
    expect(state.blueprint).toHaveProperty('serviceName');
  });

  it('cards have all required Card fields', () => {
    const { state } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    for (const card of state.cards) {
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('blueprintId');
      expect(card).toHaveProperty('stageId');
      expect(card).toHaveProperty('stepId');
      expect(card).toHaveProperty('laneKey');
      expect(card).toHaveProperty('title');
      expect(card).toHaveProperty('sourceFile', 'test.xlsx');
      expect(card).toHaveProperty('sourceSheet', 'Sheet1');
      expect(card).toHaveProperty('traceabilityCode');
      expect(card).toHaveProperty('createdAt');
      expect(card).toHaveProperty('updatedAt');
    }
  });

  it('returns no errors for a valid swimlane matrix', () => {
    const { errors } = normalizeSwimlaneMatrix(HEADERS, makeRows(), 'test.xlsx', 'Sheet1');
    expect(errors).toHaveLength(0);
  });

  it('maps actor and data/business-rule alias rows into canonical swimlanes', () => {
    const headers = ['swimlane', 'stg-01', 'stg-02'];
    const rows = [
      { swimlane: 'stage', 'stg-01': 'Policy', 'stg-02': 'Submit' },
      { swimlane: 'step', 'stg-01': 'Define policy', 'stg-02': 'Submit report' },
      { swimlane: 'primary_actor', 'stg-01': 'Defra Policy', 'stg-02': 'Producer' },
      { swimlane: 'secondary_actors', 'stg-01': 'Regulator; Compliance scheme administrator', 'stg-02': 'Regulator' },
      { swimlane: 'business_rule_refs', 'stg-01': 'Rule A; Rule B', 'stg-02': 'Rule C' },
      { swimlane: 'data_in', 'stg-01': 'Legislation; stakeholder input', 'stg-02': 'Submission ID; timestamp' },
      { swimlane: 'data_out', 'stg-01': 'Published guidance', 'stg-02': 'Submission receipt; validation result' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Blueprint');

    expect(errors).toHaveLength(0);
    expect(state.cards.filter((c) => c.laneKey === 'actor').map((c) => c.title)).toEqual([
      'Defra Policy',
      'Producer',
      'Regulator',
      'Compliance scheme administrator',
      'Regulator',
    ]);
    expect(state.cards.find((c) => c.title === 'Defra Policy')?.tags).toEqual(['primary']);
    expect(state.cards.find((c) => c.title === 'Producer')?.tags).toEqual(['primary']);
    expect(state.cards.find((c) => c.title === 'Compliance scheme administrator')?.tags).toEqual(['secondary']);
    expect(state.cards.filter((c) => c.title === 'Regulator').map((c) => c.tags)).toEqual([
      ['secondary'],
      ['secondary'],
    ]);
    expect(state.cards.filter((c) => c.laneKey === 'business_rule').map((c) => c.title)).toEqual([
      'Rule A',
      'Rule B',
      'Rule C',
    ]);
    expect(state.cards.filter((c) => c.laneKey === 'data_input').map((c) => c.title)).toEqual([
      'Legislation',
      'Stakeholder input',
      'Submission ID',
      'Timestamp',
    ]);
    expect(state.cards.filter((c) => c.laneKey === 'data_output').map((c) => c.title)).toEqual([
      'Published guidance',
      'Submission receipt',
      'Validation result',
    ]);
  });

  it('maps ideas rows into ideas lane cards', () => {
    const headers = ['swimlane', 'stg-01'];
    const rows = [
      { swimlane: 'stage', 'stg-01': 'Waste' },
      { swimlane: 'ideas', 'stg-01': 'Guidance: WOA-001 Clearer disposal guidance' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Blueprint');

    expect(errors).toHaveLength(0);
    expect(state.cards.map((c) => ({ laneKey: c.laneKey, title: c.title }))).toEqual([
      {
        laneKey: 'ideas',
        title: 'Guidance: WOA-001 Clearer disposal guidance',
      },
    ]);
    expect(state.cards[0]?.traceabilityCode).toMatch(/^IDEA-\d{3,}$/);
  });

  it('maps L1 success measure rows into the success measure lane', () => {
    const headers = ['swimlane', 'stg-01'];
    const rows = [
      { swimlane: 'stage', 'stg-01': 'Review' },
      { swimlane: 'success_measure', 'stg-01': 'Effectiveness: SPI-001 % classified correctly' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Lifecycle');

    expect(errors).toHaveLength(0);
    const card = state.cards.find((c) => c.laneKey === 'performance_indicators');
    expect(card?.title).toBe('% Classified correctly');
    expect(card?.traceabilityCode).toBe('SPI-001');
    expect(card?.tags).toContain('effectiveness');
  });

  it('maps L1 success measure rows to performance indicators when sheet name is generic', () => {
    const headers = ['swimlane', 'stg-01'];
    const rows = [
      { swimlane: 'phase', 'stg-01': 'Production' },
      { swimlane: 'stage', 'stg-01': 'Review' },
      { swimlane: 'policy_outcome', 'stg-01': 'Packaging data is classified consistently' },
      { swimlane: 'success_measure', 'stg-01': 'Effectiveness: SPI-001 % classified correctly' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Sheet1');

    expect(errors).toHaveLength(0);
    const card = state.cards.find((c) => c.laneKey === 'performance_indicators');
    expect(card?.title).toBe('% Classified correctly');
    expect(state.lanes.some((lane) => lane.key === 'performance_indicators')).toBe(true);
    expect(state.lanes.some((lane) => lane.key === 'success_measure')).toBe(false);
  });

  it('maps L1 ideas rows into the visible L1 ideas lane when sheet name is generic', () => {
    const headers = ['swimlane', 'stg-01'];
    const rows = [
      { swimlane: 'phase', 'stg-01': 'Production' },
      { swimlane: 'stage', 'stg-01': 'Review' },
      { swimlane: 'policy_outcome', 'stg-01': 'Packaging data is classified consistently' },
      { swimlane: 'ideas', 'stg-01': 'Guidance: WOA-001 Clearer disposal guidance' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Sheet1');

    expect(errors).toHaveLength(0);
    const card = state.cards.find((c) => c.laneKey === 'opportunities_lane');
    expect(card?.title).toBe('Clearer disposal guidance');
    expect(card?.traceabilityCode).toBe('WOA-001');
    expect(card?.tags).toContain('guidance');
    expect(state.lanes.some((lane) => lane.key === 'opportunities_lane')).toBe(true);
    expect(state.lanes.some((lane) => lane.key === 'ideas')).toBe(false);
  });

  it('maps producer whole journey aliases and custom L2 lanes', () => {
    const headers = ['swimlane', 'stg-01'];
    const rows = [
      { swimlane: 'step', 'stg-01': 'Design and sourcing' },
      { swimlane: 'primary_actors', 'stg-01': 'Brand owner' },
      { swimlane: 'secondary_actors', 'stg-01': 'Defra' },
      { swimlane: 'frontstage_touchpoints', 'stg-01': 'Producer reads GOV.UK guidance' },
      { swimlane: 'user_needs', 'stg-01': 'Need one clear source of RAM guidance' },
      { swimlane: 'pain_points', 'stg-01': 'Guidance is fragmented' },
      { swimlane: 'backstage_process', 'stg-01': 'Regulators update RAM criteria' },
      { swimlane: 'description', 'stg-01': 'Choose materials and suppliers' },
      { swimlane: 'behaviour_change', 'stg-01': 'Design out unrecyclable elements' },
      { swimlane: 'success_measure', 'stg-01': 'Drop in PPT revenues' },
      { swimlane: 'motivation', 'stg-01': 'Avoid PPT charges' },
      { swimlane: 'ability', 'stg-01': 'Use recyclability assessment tools' },
      { swimlane: 'prompts', 'stg-01': 'Annual RAM guideline updates' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Whole_journey');

    expect(errors).toHaveLength(0);
    expect(state.cards.find((c) => c.laneKey === 'actor' && c.title === 'Brand owner')?.tags).toEqual(['primary']);
    expect(state.cards.find((c) => c.laneKey === 'actor' && c.title === 'Defra')?.tags).toEqual(['secondary']);
    expect(state.cards.find((c) => c.laneKey === 'user_action_event')?.title).toBe('Producer reads GOV.UK guidance');
    expect(state.cards.find((c) => c.laneKey === 'user_need')?.title).toBe('As a Brand owner, need one clear source of RAM guidance');
    expect(state.cards.find((c) => c.laneKey === 'pain_point')?.title).toBe('Guidance is fragmented');
    expect(state.cards.find((c) => c.laneKey === 'backstage_process')?.title).toBe('Regulators update RAM criteria');
    expect(state.cards.find((c) => c.laneKey === 'description')?.title).toBe('Choose materials and suppliers');
    expect(state.cards.find((c) => c.laneKey === 'behaviour_change')?.title).toBe('Design out unrecyclable elements');
    expect(state.cards.find((c) => c.laneKey === 'success_measure')?.title).toBe('Drop in PPT revenues');
    expect(state.cards.find((c) => c.laneKey === 'motivation')?.title).toBe('Avoid PPT charges');
    expect(state.cards.find((c) => c.laneKey === 'ability')?.title).toBe('Use recyclability assessment tools');
    expect(state.cards.find((c) => c.laneKey === 'prompts')?.title).toBe('Annual RAM guideline updates');
  });

  it('capitalizes newly imported card titles when the source sentence starts lowercase', () => {
    const headers = ['swimlane', 'stg-01'];
    const rows = [
      { swimlane: 'step', 'stg-01': 'Design and sourcing' },
      { swimlane: 'behaviour_change', 'stg-01': 'redesigning packaging to remove hard-to-recycle elements' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Whole_journey');

    expect(errors).toHaveLength(0);
    expect(state.cards.find((c) => c.laneKey === 'behaviour_change')?.title).toBe(
      'Redesigning packaging to remove hard-to-recycle elements',
    );
  });

  it('maps plural actors rows into the actor swimlane', () => {
    const headers = ['swimlane', 'stg-01'];
    const rows = [
      { swimlane: 'step', 'stg-01': 'Submit data' },
      { swimlane: 'Actors', 'stg-01': 'Producer; Compliance scheme' },
      { swimlane: 'Backstage actors', 'stg-01': 'Regulator' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Micro');

    expect(errors).toHaveLength(0);
    expect(state.cards.filter((c) => c.laneKey === 'actor').map((c) => c.title)).toEqual([
      'Producer',
      'Compliance scheme',
    ]);
    expect(state.cards.find((c) => c.laneKey === 'backstage_actor')?.title).toBe('Regulator');
  });

  it('maps common activity aliases into the activity swimlane', () => {
    const headers = ['swimlane', 'stg-01', 'stg-02'];
    const rows = [
      { swimlane: 'step', 'stg-01': 'Submit data', 'stg-02': 'Review data' },
      { swimlane: 'Activities', 'stg-01': 'Upload file', 'stg-02': '' },
      { swimlane: 'User tasks', 'stg-01': '', 'stg-02': 'Check validation status' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Micro');

    expect(errors).toHaveLength(0);
    expect(state.cards.filter((c) => c.laneKey === 'activity').map((c) => c.title)).toEqual([
      'Upload file',
      'Check validation status',
    ]);
  });

  it('carries phase values across blank cells in merged-looking phase rows', () => {
    const headers = ['swimlane', 'stg-01', 'stg-02', 'stg-03', 'stg-04'];
    const rows = [
      { swimlane: 'phase', 'stg-01': 'Production', 'stg-02': '', 'stg-03': 'Consumption', 'stg-04': '' },
      { swimlane: 'stage', 'stg-01': 'Select materials', 'stg-02': 'Design product', 'stg-03': 'Buy product', 'stg-04': 'Use product' },
      { swimlane: 'policy_reform', 'stg-01': 'Reform A', 'stg-02': 'Reform B', 'stg-03': 'Reform C', 'stg-04': 'Reform D' },
    ];

    const { state, errors } = normalizeSwimlaneMatrix(headers, rows, 'test.xlsx', 'Lifecycle');

    expect(errors).toHaveLength(0);
    expect(state.stages.map((stage) => ({ title: stage.title, phase: stage.phase }))).toEqual([
      { title: 'Select materials', phase: 'Production' },
      { title: 'Design product', phase: 'Production' },
      { title: 'Buy product', phase: 'Consumption' },
      { title: 'Use product', phase: 'Consumption' },
    ]);
  });

  it('errors when sheet has no step columns', () => {
    const { errors } = normalizeSwimlaneMatrix(
      ['lane'],           // only one column header, no steps
      [{ lane: 'stage' }],
      'test.xlsx',
      'Sheet1',
    );
    expect(errors.some((e) => e.field === 'headers')).toBe(true);
  });

  it('imports alias-based actor/business-rule/data rows from the structured workbook', () => {
    const workbookPath = path.resolve(process.cwd(), 'public/service_blueprint_structured_modified_7Apr.xlsx');
    const workbook = XLSX.readFile(workbookPath);

    const result = processXlsxSheet(workbook, 'Blueprint', 'service_blueprint_structured_modified_7Apr.xlsx');

    expect(result.errors).toHaveLength(0);
    expect(result.state.cards.some((c) => c.laneKey === 'actor')).toBe(true);
    expect(result.state.cards.some((c) => c.laneKey === 'business_rule')).toBe(true);
    expect(result.state.cards.some((c) => c.laneKey === 'data_input')).toBe(true);
    expect(result.state.cards.some((c) => c.laneKey === 'data_output')).toBe(true);
  });

  it('imports lifecycle success measure cards into the visible L1 lane from the fixture', () => {
    const workbookPath = path.resolve(process.cwd(), 'public/waste_lifecycle_1.xlsx');
    const workbook = XLSX.readFile(workbookPath);

    const result = processXlsxSheet(workbook, 'Lifecycle', 'waste_lifecycle_1.xlsx');

    expect(result.state.lanes.some((lane) => lane.key === 'performance_indicators')).toBe(true);
    expect(result.state.lanes.some((lane) => lane.key === 'success_measure')).toBe(false);
    expect(result.state.cards.some((card) => card.laneKey === 'performance_indicators')).toBe(true);
    expect(result.state.cards.some((card) => card.laneKey === 'success_measure')).toBe(false);
  });
});
