import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { normalizeMultiTabBlueprint } from '../normalize';

function makeWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['service_name', 'description'],
      ['Example Service', 'Example description'],
    ]),
    'Service',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['stage_id', 'stage_number', 'stage_name', 'stage_outcome'],
      ['STG-01', '1', 'Review', 'Submission assessed'],
    ]),
    'Stages',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['swimlane', 'STG-01'],
      ['performance_indicators', 'Effectiveness: SPI-001 % of submissions classified correctly at first attempt'],
    ]),
    'Blueprint',
  );

  return workbook;
}

describe('normalizeMultiTabBlueprint performance indicators', () => {
  it('uses the statement as the title while preserving type and SPI code', () => {
    const result = normalizeMultiTabBlueprint(makeWorkbook(), 'test.xlsx');
    const card = result.state.cards.find((item) => item.laneKey === 'performance_indicators');

    expect(card).toBeDefined();
    expect(card?.title).toBe('% of submissions classified correctly at first attempt');
    expect(card?.traceabilityCode).toBe('SPI-001');
    expect(card?.tags).toContain('effectiveness');
  });

  it('uses the statement as the title while preserving type and WOA code for opportunities', () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['service_name', 'description'],
        ['Example Service', 'Example description'],
      ]),
      'Service',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['stage_id', 'stage_number', 'stage_name', 'stage_outcome'],
        ['STG-01', '1', 'Review', 'Submission assessed'],
      ]),
      'Stages',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['swimlane', 'STG-01'],
        ['opportunities', 'Guidance: WOA-001 Provide clearer step-by-step submission guidance'],
      ]),
      'Blueprint',
    );

    const result = normalizeMultiTabBlueprint(workbook, 'test.xlsx');
    const card = result.state.cards.find((item) => item.laneKey === 'opportunities_lane');

    expect(card).toBeDefined();
    expect(card?.title).toBe('Provide clearer step-by-step submission guidance');
    expect(card?.traceabilityCode).toBe('WOA-001');
    expect(card?.tags).toContain('guidance');
  });

  it('strips leading WOA code labels from opportunities titles', () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['service_name', 'description'],
        ['Example Service', 'Example description'],
      ]),
      'Service',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['stage_id', 'stage_number', 'stage_name', 'stage_outcome'],
        ['STG-01', '1', 'Review', 'Submission assessed'],
      ]),
      'Stages',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['swimlane', 'STG-01'],
        ['opportunities', 'WOA-001: Guided classification tool with real-time validation and correction prompts'],
      ]),
      'Blueprint',
    );

    const result = normalizeMultiTabBlueprint(workbook, 'test.xlsx');
    const card = result.state.cards.find((item) => item.laneKey === 'opportunities_lane');

    expect(card).toBeDefined();
    expect(card?.title).toBe('Guided classification tool with real-time validation and correction prompts');
    expect(card?.traceabilityCode).toBe('WOA-001');
  });

  it('splits merged performance indicators into separate cards', () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['service_name', 'description'],
        ['Example Service', 'Example description'],
      ]),
      'Service',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['stage_id', 'stage_number', 'stage_name', 'stage_outcome'],
        ['STG-01', '1', 'Review', 'Submission assessed'],
      ]),
      'Stages',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['swimlane', 'STG-01'],
        ['performance_indicators', '% processed consistently regardless of caseworker. Efficiency: SPI-007 Time per organisation to determine status and begin registration'],
      ]),
      'Blueprint',
    );

    const result = normalizeMultiTabBlueprint(workbook, 'test.xlsx');
    const cards = result.state.cards.filter((item) => item.laneKey === 'performance_indicators');

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.title)).toEqual([
      '% processed consistently regardless of caseworker.',
      'Time per organisation to determine status and begin registration',
    ]);
    expect(cards[1]?.traceabilityCode).toBe('SPI-007');
    expect(cards[1]?.tags).toContain('efficiency');
  });

  it('maps success measure rows into L1 success measure cards', () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['service_name', 'description'],
        ['Example Service', 'Example description'],
      ]),
      'Service',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['stage_id', 'stage_number', 'stage_name', 'stage_outcome'],
        ['STG-01', '1', 'Review', 'Submission assessed'],
      ]),
      'Stages',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['swimlane', 'STG-01'],
        ['success_measure', 'Effectiveness: SPI-001 % classified correctly'],
      ]),
      'Blueprint',
    );

    const result = normalizeMultiTabBlueprint(workbook, 'test.xlsx');
    const card = result.state.cards.find((item) => item.laneKey === 'performance_indicators');

    expect(card?.title).toBe('% Classified correctly');
    expect(card?.traceabilityCode).toBe('SPI-001');
    expect(card?.tags).toContain('effectiveness');
  });
});
