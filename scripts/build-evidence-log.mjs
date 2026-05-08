/**
 * Regenerates src/data/evidence-log.json from public/evidence_log.xlsx.
 * Run: npm run build:evidence-log
 */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const xlsxPath = path.join(root, 'public', 'evidence_log.xlsx');
const outPath = path.join(root, 'src', 'data', 'evidence-log.json');

const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets['Evidence Log'];
if (!ws) {
  console.error('Sheet "Evidence Log" not found');
  process.exit(1);
}
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
const byId = {};
for (const r of rows) {
  const id = String(r.evidence_id || '').trim();
  if (!id) continue;
  byId[id] = {
    evidence_id: id,
    evidenceType: r['evidence type'] || '',
    source: r.source || '',
    sourceReference: r.source_reference || '',
    rawExcerpt: r.raw_excerpt || '',
    insightSummary: r.insight_summary || '',
    theme: r.theme || '',
    serviceStage: r.service_stage || '',
    confidenceLevel: r.confidence_level || '',
    evidenceStrength: r.evidence_strength || '',
  };
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(byId)}\n`);
console.log('Wrote', outPath, Object.keys(byId).length, 'entries');
