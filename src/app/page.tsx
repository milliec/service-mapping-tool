'use client';

import { useEffect, useState } from 'react';
import { useBlueprintStore } from '@/store/blueprint-store';
import { BoardToolbar } from '@/components/board/BoardToolbar';
import { Board } from '@/components/board/Board';
import { EmptyState } from '@/components/board/EmptyState';
import { AiImportDialog } from '@/components/import/AiImportDialog';

const STAGE_MRF_TITLE_PREVIOUS = 'MRFs separate material streams and pre-treatment';
const STAGE_MRF_TITLE =
  'Materials Recovery Facilities separate material streams and pre-treatment';

const STAGE_PHASE_MAP: Record<string, string> = {
  'Selection of materials (raw or recycled)': 'Production',
  'Product design and manufacture of product': 'Production',
  'Placement of product on the market': 'Production',
  'Purchase products from the market': 'Consumption',
  'Product use (households and businesses)': 'Consumption',
  'Discard waste': 'Consumption',
  'Collect waste to transfer stations, maintain duty-of-care documentation': 'Waste management',
  [STAGE_MRF_TITLE]: 'Waste management',
  'Materials turned into secondary raw materials that re-enter manufacturing': 'Waste management',
  'Residual waste processed in EfW plants, energy generated and ash handled safely': 'Waste management',
  'Landfill disposal or exporting': 'Waste management',
};

export default function Home() {
  const hydrate = useBlueprintStore((s) => s.hydrate);
  const hydrated = useBlueprintStore((s) => s._hydrated);
  const stages = useBlueprintStore((s) => s.stages);
  const updateStage = useBlueprintStore((s) => s.updateStage);

  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Rename legacy stage title (template + localStorage) to spell out MRF
  useEffect(() => {
    if (!hydrated || stages.length === 0) return;
    for (const stage of stages) {
      if (stage.title === STAGE_MRF_TITLE_PREVIOUS) {
        updateStage(stage.id, { title: STAGE_MRF_TITLE });
      }
    }
  }, [hydrated, stages, updateStage]);

  // One-time migration: assign phases to stages that match the waste lifecycle template
  useEffect(() => {
    if (!hydrated || stages.length === 0) return;
    const needsMigration = stages.some((s) => {
      const expected = STAGE_PHASE_MAP[s.title];
      return expected && s.phase !== expected;
    });
    if (!needsMigration) return;
    for (const stage of stages) {
      const phase = STAGE_PHASE_MAP[stage.title];
      if (phase && stage.phase !== phase) {
        updateStage(stage.id, { phase });
      }
    }
  }, [hydrated, stages, updateStage]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#fafafa]">
      <BoardToolbar onImport={() => setShowImport(true)} />
      {stages.length === 0 ? (
        <EmptyState onImport={() => setShowImport(true)} />
      ) : (
        <Board />
      )}
      <AiImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
