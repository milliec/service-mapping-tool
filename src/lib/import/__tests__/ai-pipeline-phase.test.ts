import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { extractFromXlsx } from '../extract';
import { MockImportMappingService } from '../mock-mapping-service';
import { commitMappedRows } from '../commit';
import type { MappedRow } from '../mapping-types';

// Integration test for the AI import pipeline (AiImportDialog path):
// extract → mock mapping → commit. Ensures phase info + column order are
// preserved end-to-end for the swimlane matrix format.
describe('AI import pipeline — swimlane matrix with phases', () => {
  it('preserves stage column order and phase assignments for waste_lifecycle_1.xlsx', async () => {
    const workbookPath = path.resolve(process.cwd(), 'public/waste_lifecycle_1.xlsx');
    const workbook = XLSX.readFile(workbookPath);

    const extraction = extractFromXlsx(workbook, 'Lifecycle', 'waste_lifecycle_1.xlsx');
    const mapping = await new MockImportMappingService().mapRows(extraction.rows);
    const commit = commitMappedRows(mapping.rows, 'Waste Lifecycle', 'waste_lifecycle_1.xlsx');

    const titlePhases = commit.state.stages.map((s) => ({ title: s.title, phase: s.phase }));

    expect(titlePhases).toEqual([
      { title: 'Selection of materials (raw or recycled)', phase: 'Production' },
      { title: 'Product design and manufacture of product', phase: 'Production' },
      { title: 'Placement of product on the market', phase: 'Production' },
      { title: 'Purchase products from the market', phase: 'Consumption' },
      { title: 'Product use (households and businesses)', phase: 'Consumption' },
      { title: 'Discard waste', phase: 'Consumption' },
      { title: 'Collect waste to transfer stations, maintain duty-of-care documentation', phase: 'Waste management' },
      { title: 'Materials recovery facilities sort, separate material streams and pre-treatment', phase: 'Waste management' },
      { title: 'Materials turned into secondary raw materials that re-enter manufacturing', phase: 'Waste management' },
      { title: 'Residual waste processed in EfW plants, energy generated and ash handled safely', phase: 'Waste management' },
      { title: 'Landfill disposal or exporting', phase: 'Waste management' },
    ]);
  });

  it('commits L1 ideas rows to the visible L1 ideas lane', () => {
    const rows: MappedRow[] = [
      {
        id: 'row-1',
        sourceRow: {
          sourceType: 'xlsx',
          sourceFileName: 'l1.xlsx',
          sourceSheetOrPage: 'Sheet1',
          sourceRowNumber: 2,
          extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title', 'phase'],
          extractedCells: {
            record_type: 'card_row',
            stage: 'Review',
            step: 'Review data',
            lane_key: 'ideas',
            card_title: 'Guidance: WOA-001 Clearer disposal guidance',
            phase: 'Production',
          },
          rawText: 'Review\tReview data\tideas\tGuidance: WOA-001 Clearer disposal guidance',
        },
        proposedRecordType: 'card_row',
        proposedStage: 'Review',
        proposedStep: 'Review data',
        proposedLaneKey: 'ideas',
        proposedCardTitle: 'Guidance: WOA-001 Clearer disposal guidance',
        proposedCardBody: '',
        proposedTags: ['guidance'],
        confidence: 0.9,
        flags: [],
        reviewStatus: 'accepted',
      },
    ];

    const commit = commitMappedRows(rows, 'Waste Lifecycle', 'l1.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards[0]?.laneKey).toBe('opportunities_lane');
    expect(commit.state.lanes.some((lane) => lane.key === 'opportunities_lane')).toBe(true);
    expect(commit.state.lanes.some((lane) => lane.key === 'ideas')).toBe(false);
  });

  it('keeps non-L1 ideas rows on the standard ideas lane', () => {
    const rows: MappedRow[] = [
      {
        id: 'row-1',
        sourceRow: {
          sourceType: 'xlsx',
          sourceFileName: 'l2.xlsx',
          sourceSheetOrPage: 'Blueprint',
          sourceRowNumber: 2,
          extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title'],
          extractedCells: {
            record_type: 'card_row',
            stage: 'Review',
            step: 'Review data',
            lane_key: 'ideas',
            card_title: 'Offer clearer disposal guidance',
          },
          rawText: 'Review\tReview data\tideas\tOffer clearer disposal guidance',
        },
        proposedRecordType: 'card_row',
        proposedStage: 'Review',
        proposedStep: 'Review data',
        proposedLaneKey: 'ideas',
        proposedCardTitle: 'Offer clearer disposal guidance',
        proposedCardBody: '',
        proposedTags: [],
        confidence: 0.9,
        flags: [],
        reviewStatus: 'accepted',
      },
    ];

    const commit = commitMappedRows(rows, 'Service Blueprint', 'l2.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards[0]?.laneKey).toBe('ideas');
    expect(commit.state.lanes.some((lane) => lane.key === 'ideas')).toBe(true);
    expect(commit.state.lanes.some((lane) => lane.key === 'opportunities_lane')).toBe(false);
  });

  it('skips area-reference placeholders in desired behaviour change imports', () => {
    const makeRow = (id: string, title: string, rowNumber: number): MappedRow => ({
      id,
      sourceRow: {
        sourceType: 'xlsx',
        sourceFileName: 'l2.xlsx',
        sourceSheetOrPage: 'Blueprint',
        sourceRowNumber: rowNumber,
        extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title'],
        extractedCells: {
          record_type: 'card_row',
          stage: 'Review',
          step: 'Review data',
          lane_key: 'behaviour_change',
          card_title: title,
        },
        rawText: `Review\tReview data\tbehaviour_change\t${title}`,
      },
      proposedRecordType: 'card_row',
      proposedStage: 'Review',
      proposedStep: 'Review data',
      proposedLaneKey: 'behaviour_change',
      proposedCardTitle: title,
      proposedCardBody: '',
      proposedTags: [],
      confidence: 0.9,
      flags: [],
      reviewStatus: 'accepted',
    });

    const commit = commitMappedRows([
      makeRow('row-1', 'Areas B, C, D, H', 2),
      makeRow('row-2', 'Areas C: reference only', 3),
      makeRow('row-3', 'Design out hard-to-recycle packaging', 4),
    ], 'Service Blueprint', 'l2.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards.map((card) => card.title)).toEqual([
      'Design out hard-to-recycle packaging',
    ]);
  });

  it('moves desired behaviour change evidence-basis codes into derived-from metadata', () => {
    const title = 'Supply-chain actors understand RAM and legislation clarity. Evidence basis is adjacent and limited: UN-063 and PP-063 show supply-chain actors need RAM/legislation clarity to support customers.';
    const rows: MappedRow[] = [
      {
        id: 'row-1',
        sourceRow: {
          sourceType: 'xlsx',
          sourceFileName: 'l2.xlsx',
          sourceSheetOrPage: 'Blueprint',
          sourceRowNumber: 2,
          extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title'],
          extractedCells: {
            record_type: 'card_row',
            stage: 'Review',
            step: 'Review data',
            lane_key: 'behaviour_change',
            card_title: title,
          },
          rawText: `Review\tReview data\tbehaviour_change\t${title}`,
        },
        proposedRecordType: 'card_row',
        proposedStage: 'Review',
        proposedStep: 'Review data',
        proposedLaneKey: 'behaviour_change',
        proposedCardTitle: title,
        proposedCardBody: '',
        proposedTags: [],
        confidence: 0.9,
        flags: [],
        reviewStatus: 'accepted',
      },
    ];

    const commit = commitMappedRows(rows, 'Service Blueprint', 'l2.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards[0]?.title).toBe('Supply-chain actors understand RAM and legislation clarity.');
    expect(commit.state.cards[0]?.derivedFromIds).toEqual(['UN-063', 'PP-063']);
  });

  it('moves success measure reference codes into derived-from metadata', () => {
    const title = 'Track whether guidance reduces repeated clarification requests. PP-043, PP-044, PP-045, PP-047, PP-057, PP-066.';
    const rows: MappedRow[] = [
      {
        id: 'row-1',
        sourceRow: {
          sourceType: 'xlsx',
          sourceFileName: 'l2.xlsx',
          sourceSheetOrPage: 'Blueprint',
          sourceRowNumber: 2,
          extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title'],
          extractedCells: {
            record_type: 'card_row',
            stage: 'Review',
            step: 'Review data',
            lane_key: 'success_measure',
            card_title: title,
          },
          rawText: `Review\tReview data\tsuccess_measure\t${title}`,
        },
        proposedRecordType: 'card_row',
        proposedStage: 'Review',
        proposedStep: 'Review data',
        proposedLaneKey: 'success_measure',
        proposedCardTitle: title,
        proposedCardBody: '',
        proposedTags: [],
        confidence: 0.9,
        flags: [],
        reviewStatus: 'accepted',
      },
    ];

    const commit = commitMappedRows(rows, 'Service Blueprint', 'l2.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards[0]?.title).toBe('Track whether guidance reduces repeated clarification requests.');
    expect(commit.state.cards[0]?.derivedFromIds).toEqual([
      'PP-043',
      'PP-044',
      'PP-045',
      'PP-047',
      'PP-057',
      'PP-066',
    ]);
  });

  it('strips imported opportunity trace footers from cards', () => {
    const rows: MappedRow[] = [
      {
        id: 'row-1',
        sourceRow: {
          sourceType: 'xlsx',
          sourceFileName: 'l2.xlsx',
          sourceSheetOrPage: 'Blueprint',
          sourceRowNumber: 2,
          extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title', 'card_body'],
          extractedCells: {
            record_type: 'card_row',
            stage: 'Review',
            step: 'Review data',
            lane_key: 'opportunities',
            card_title: 'Make reuse guidance easier to act on. Trace: OPP-003/004/008/014/029.',
            card_body: 'Evidence summary.\nTrace: OPP-003/004/008/014/029.',
          },
          rawText: 'Review\tReview data\topportunities\tMake reuse guidance easier to act on. Trace: OPP-003/004/008/014/029.',
        },
        proposedRecordType: 'card_row',
        proposedStage: 'Review',
        proposedStep: 'Review data',
        proposedLaneKey: 'opportunities',
        proposedCardTitle: 'Make reuse guidance easier to act on. Trace: OPP-003/004/008/014/029.',
        proposedCardBody: 'Evidence summary.\nTrace: OPP-003/004/008/014/029.',
        proposedTags: [],
        confidence: 0.9,
        flags: [],
        reviewStatus: 'accepted',
      },
    ];

    const commit = commitMappedRows(rows, 'Service Blueprint', 'l2.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards[0]?.title).toBe('Make reuse guidance easier to act on.');
    expect(commit.state.cards[0]?.body).toBe('Evidence summary.');
  });

  it('moves imported user-need roll-up suffixes into derived-from metadata', () => {
    const rows: MappedRow[] = [
      {
        id: 'row-1',
        sourceRow: {
          sourceType: 'xlsx',
          sourceFileName: 'l2.xlsx',
          sourceSheetOrPage: 'Blueprint',
          sourceRowNumber: 2,
          extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title'],
          extractedCells: {
            record_type: 'card_row',
            stage: 'Review',
            step: 'Review data',
            lane_key: 'user_need',
            card_title: 'As a producer, I need clearer reuse guidance [Rolls up UN-056, UN-057, UN-058, UN-062, UN-064',
          },
          rawText: 'Review\tReview data\tuser_need\tAs a producer, I need clearer reuse guidance [Rolls up UN-056, UN-057, UN-058, UN-062, UN-064',
        },
        proposedRecordType: 'card_row',
        proposedStage: 'Review',
        proposedStep: 'Review data',
        proposedLaneKey: 'user_need',
        proposedCardTitle: 'As a producer, I need clearer reuse guidance [Rolls up UN-056, UN-057, UN-058, UN-062, UN-064',
        proposedCardBody: '',
        proposedTags: [],
        confidence: 0.9,
        flags: [],
        reviewStatus: 'accepted',
      },
    ];

    const commit = commitMappedRows(rows, 'Service Blueprint', 'l2.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards[0]?.title).toBe('As a producer, I need clearer reuse guidance');
    expect(commit.state.cards[0]?.derivedFromIds).toEqual(['UN-056', 'UN-057', 'UN-058', 'UN-062', 'UN-064']);
  });

  it('moves imported pain-point roll-up suffixes into derived-from metadata', () => {
    const rows: MappedRow[] = [
      {
        id: 'row-1',
        sourceRow: {
          sourceType: 'xlsx',
          sourceFileName: 'l2.xlsx',
          sourceSheetOrPage: 'Blueprint',
          sourceRowNumber: 2,
          extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title'],
          extractedCells: {
            record_type: 'card_row',
            stage: 'Review',
            step: 'Review data',
            lane_key: 'pain_point',
            card_title: 'Reuse requirements are hard to interpret [Rolls up PP-040, PP-042, PP-048, PP-053',
          },
          rawText: 'Review\tReview data\tpain_point\tReuse requirements are hard to interpret [Rolls up PP-040, PP-042, PP-048, PP-053',
        },
        proposedRecordType: 'card_row',
        proposedStage: 'Review',
        proposedStep: 'Review data',
        proposedLaneKey: 'pain_point',
        proposedCardTitle: 'Reuse requirements are hard to interpret [Rolls up PP-040, PP-042, PP-048, PP-053',
        proposedCardBody: '',
        proposedTags: [],
        confidence: 0.9,
        flags: [],
        reviewStatus: 'accepted',
      },
    ];

    const commit = commitMappedRows(rows, 'Service Blueprint', 'l2.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards[0]?.title).toBe('Reuse requirements are hard to interpret');
    expect(commit.state.cards[0]?.derivedFromIds).toEqual(['PP-040', 'PP-042', 'PP-048', 'PP-053']);
  });

  it('skips evidence-reference-only pain point cards', () => {
    const makeRow = (id: string, title: string, rowNumber: number): MappedRow => ({
      id,
      sourceRow: {
        sourceType: 'xlsx',
        sourceFileName: 'l2.xlsx',
        sourceSheetOrPage: 'Blueprint',
        sourceRowNumber: rowNumber,
        extractedHeaders: ['record_type', 'stage', 'step', 'lane_key', 'card_title'],
        extractedCells: {
          record_type: 'card_row',
          stage: 'Review',
          step: 'Review data',
          lane_key: 'pain_point',
          card_title: title,
        },
        rawText: `Review\tReview data\tpain_point\t${title}`,
      },
      proposedRecordType: 'card_row',
      proposedStage: 'Review',
      proposedStep: 'Review data',
      proposedLaneKey: 'pain_point',
      proposedCardTitle: title,
      proposedCardBody: '',
      proposedTags: [],
      confidence: 0.9,
      flags: [],
      reviewStatus: 'accepted',
    });

    const commit = commitMappedRows([
      makeRow('row-1', 'E-108, E-109, E-113, E-115, E-117]', 2),
      makeRow('row-2', 'Reuse requirements are hard to interpret (E-108)', 3),
    ], 'Service Blueprint', 'l2.xlsx');

    expect(commit.warnings).toHaveLength(0);
    expect(commit.state.cards.map((card) => card.title)).toEqual([
      'Reuse requirements are hard to interpret (E-108)',
    ]);
  });
});
