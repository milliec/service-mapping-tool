import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { extractFromXlsx } from '../extract';

function makeWorkbookFromRows(rows: string[][], sheetName = 'Blueprint'): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

describe('extractFromXlsx swimlane aliases', () => {
  it('maps alias swimlane rows to canonical lane keys', () => {
    const workbook = makeWorkbookFromRows([
      ['swimlane', 'STG-01', 'STG-02'],
      ['stage', 'Policy', 'Submit'],
      ['step', 'Define policy', 'Submit report'],
      ['primary_actor', 'Defra Policy', 'Producer'],
      ['secondary_actors', 'Regulator; Compliance scheme administrator', 'Regulator'],
      ['business_rule_refs', 'Rule A; Rule B', 'Rule C'],
      ['data_in', 'Legislation; stakeholder input', 'Submission ID; timestamp'],
      ['data_out', 'Published guidance', 'Submission receipt; validation result'],
    ]);

    const result = extractFromXlsx(workbook, 'Blueprint', 'test.xlsx');
    const extracted = result.rows.map((row) => row.extractedCells);

    expect(result.errors).toHaveLength(0);
    expect(extracted.filter((row) => row.lane_key === 'actor').map((row) => row.card_title)).toEqual([
      'Defra Policy',
      'Producer',
      'Regulator',
      'Compliance scheme administrator',
      'Regulator',
    ]);
    expect(extracted.filter((row) => row.card_title === 'Defra Policy').map((row) => row.tags)).toEqual(['primary']);
    expect(extracted.filter((row) => row.card_title === 'Producer').map((row) => row.tags)).toEqual(['primary']);
    expect(extracted.filter((row) => row.card_title === 'Regulator').map((row) => row.tags)).toEqual(['secondary', 'secondary']);
    expect(extracted.filter((row) => row.card_title === 'Compliance scheme administrator').map((row) => row.tags)).toEqual(['secondary']);
    expect(extracted.filter((row) => row.lane_key === 'business_rule').map((row) => row.card_title)).toEqual([
      'Rule A',
      'Rule B',
      'Rule C',
    ]);
    expect(extracted.filter((row) => row.lane_key === 'data_input').map((row) => row.card_title)).toEqual([
      'Legislation',
      'stakeholder input',
      'Submission ID',
      'timestamp',
    ]);
    expect(extracted.filter((row) => row.lane_key === 'data_output').map((row) => row.card_title)).toEqual([
      'Published guidance',
      'Submission receipt',
      'validation result',
    ]);
  });

  it('maps ideas rows into ideas lane cards', () => {
    const workbook = makeWorkbookFromRows([
      ['swimlane', 'STG-01'],
      ['stage', 'Waste'],
      ['ideas', 'Guidance: WOA-001 Clearer disposal guidance'],
    ]);

    const result = extractFromXlsx(workbook, 'Blueprint', 'test.xlsx');
    const extracted = result.rows.map((row) => row.extractedCells);

    expect(result.errors).toHaveLength(0);
    // The extractor now emits one structure_row per column before card rows
    // so commit.ts can seed stages in column order and pick up phase info.
    const cardRows = extracted.filter((r) => r.record_type === 'card_row' || r.lane_key);
    expect(cardRows).toEqual([
      expect.objectContaining({
        stage: 'Waste',
        step: 'STG-01',
        lane_key: 'ideas',
        card_title: 'Guidance: WOA-001 Clearer disposal guidance',
      }),
    ]);
  });

  it('maps human-readable desired behaviour change rows to behaviour_change', () => {
    const workbook = makeWorkbookFromRows([
      ['swimlane', 'STG-01'],
      ['stage', 'Design and sourcing'],
      ['step', 'Choose materials'],
      ['Desired behaviour change', 'Design out unrecyclable elements'],
    ]);

    const result = extractFromXlsx(workbook, 'Blueprint', 'test.xlsx');
    const extracted = result.rows.map((row) => row.extractedCells);

    expect(result.errors).toHaveLength(0);
    expect(extracted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'Design and sourcing',
          step: 'Choose materials',
          lane_key: 'behaviour_change',
          card_title: 'Design out unrecyclable elements',
        }),
      ]),
    );
  });

  it('maps L1 success measure rows to performance indicators', () => {
    const workbook = makeWorkbookFromRows([
      ['swimlane', 'STG-01'],
      ['phase', 'Production'],
      ['stage', 'Submit data'],
      ['policy_outcome', 'Packaging data is classified consistently'],
      ['success_measure', 'Effectiveness: SPI-001 % classified correctly'],
    ], 'Lifecycle');

    const result = extractFromXlsx(workbook, 'Lifecycle', 'test.xlsx');
    const extracted = result.rows.map((row) => row.extractedCells);

    expect(result.errors).toHaveLength(0);
    expect(extracted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'Submit data',
          step: 'STG-01',
          lane_key: 'performance_indicators',
          card_title: 'Effectiveness: SPI-001 % classified correctly',
        }),
      ]),
    );
  });

  it('maps L1 ideas rows into the visible L1 ideas lane', () => {
    const workbook = makeWorkbookFromRows([
      ['swimlane', 'STG-01'],
      ['phase', 'Production'],
      ['stage', 'Submit data'],
      ['policy_outcome', 'Packaging data is classified consistently'],
      ['ideas', 'Guidance: WOA-001 Clearer disposal guidance'],
    ], 'Sheet1');

    const result = extractFromXlsx(workbook, 'Sheet1', 'test.xlsx');
    const extracted = result.rows.map((row) => row.extractedCells);

    expect(result.errors).toHaveLength(0);
    expect(extracted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'Submit data',
          step: 'STG-01',
          lane_key: 'opportunities_lane',
          card_title: 'Guidance: WOA-001 Clearer disposal guidance',
        }),
      ]),
    );
  });

  it('maps plural actors rows to canonical actor lanes', () => {
    const workbook = makeWorkbookFromRows([
      ['swimlane', 'STG-01'],
      ['stage', 'Submit data'],
      ['Actors', 'Producer; Compliance scheme'],
      ['Backstage actors', 'Regulator'],
    ]);

    const result = extractFromXlsx(workbook, 'Blueprint', 'test.xlsx');
    const extracted = result.rows.map((row) => row.extractedCells);

    expect(result.errors).toHaveLength(0);
    expect(extracted.filter((row) => row.lane_key === 'actor').map((row) => row.card_title)).toEqual([
      'Producer',
      'Compliance scheme',
    ]);
    expect(extracted.find((row) => row.lane_key === 'backstage_actor')?.card_title).toBe('Regulator');
  });

  it('splits semicolon-separated product teams into separate span markers', () => {
    const workbook = makeWorkbookFromRows([
      ['swimlane', 'STG-01'],
      ['stage', 'Submit data'],
      ['step', 'Upload file'],
      ['product_teams', 'Core platform; Reporting team'],
    ]);

    const result = extractFromXlsx(workbook, 'Blueprint', 'test.xlsx');
    const spanRows = result.rows
      .map((row) => row.extractedCells)
      .filter((row) => row.span_type === 'product_team');

    expect(result.errors).toHaveLength(0);
    expect(spanRows.map((row) => row.span_title)).toEqual([
      'Core platform',
      'Reporting team',
    ]);
    expect(spanRows.map((row) => `${row.start_step}..${row.end_step}`)).toEqual([
      'Upload file..Upload file',
      'Upload file..Upload file',
    ]);
  });

  it('maps common activity aliases into the activity swimlane', () => {
    const workbook = makeWorkbookFromRows([
      ['swimlane', 'STG-01', 'STG-02'],
      ['stage', 'Submit data', 'Review data'],
      ['Activities', 'Upload file', ''],
      ['User tasks', '', 'Check validation status'],
    ]);

    const result = extractFromXlsx(workbook, 'Blueprint', 'test.xlsx');
    const extracted = result.rows.map((row) => row.extractedCells);

    expect(result.errors).toHaveLength(0);
    expect(extracted.filter((row) => row.lane_key === 'activity').map((row) => row.card_title)).toEqual([
      'Upload file',
      'Check validation status',
    ]);
  });
});
