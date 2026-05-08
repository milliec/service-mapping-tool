import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { processXlsxSheet } from '../parse';

describe('waste lifecycle workbook import', () => {
  it.each([
    'public/waste_lifecycle.xlsx',
    'public/waste_lifecycle_1.xlsx',
  ])('preserves lifecycle stage order and phase assignments for %s', (relativePath) => {
    const workbookPath = path.resolve(process.cwd(), relativePath);
    const workbook = XLSX.readFile(workbookPath);
    const fileName = path.basename(workbookPath);
    const result = processXlsxSheet(workbook, 'Lifecycle', fileName);

    expect(result.warnings.some((warning) => warning.message.includes('user_journeys'))).toBe(false);
    expect(result.state.stages.map((stage) => ({ title: stage.title, phase: stage.phase }))).toEqual([
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

  it('imports producer whole journey user needs and pain points into canonical lanes', () => {
    const workbookPath = path.resolve(process.cwd(), 'public/producer_whole_journey.xlsx');
    const workbook = XLSX.readFile(workbookPath);
    const result = processXlsxSheet(workbook, 'Whole_journey', 'producer_whole_journey.xlsx');

    expect(result.errors).toHaveLength(0);
    expect(result.state.cards.some((card) => card.laneKey === 'user_need')).toBe(true);
    expect(result.state.cards.some((card) => card.laneKey === 'pain_point')).toBe(true);
  });
});
