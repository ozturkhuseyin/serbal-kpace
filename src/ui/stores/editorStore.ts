import { create } from 'zustand';
import { VesselDesign } from '../../editor/VehicleAssembly';
import { DeltaVReport } from '../../editor/DeltaVCalculator';

export interface EditorStore {
  design: VesselDesign | null;
  deltaV: DeltaVReport | null;
  selectedPartId: string | null;
  draggingPartType: string | null;
  symmetryMode: 1 | 2 | 3 | 4 | 6 | 8;
  setDesign: (d: VesselDesign) => void;
  setDeltaV: (r: DeltaVReport) => void;
  setSelected: (id: string | null) => void;
  setDragging: (id: string | null) => void;
  setSymmetry: (n: 1 | 2 | 3 | 4 | 6 | 8) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  design: null,
  deltaV: null,
  selectedPartId: null,
  draggingPartType: null,
  symmetryMode: 1,
  setDesign: (d) => set({ design: d }),
  setDeltaV: (r) => set({ deltaV: r }),
  setSelected: (id) => set({ selectedPartId: id }),
  setDragging: (id) => set({ draggingPartType: id }),
  setSymmetry: (n) => set({ symmetryMode: n }),
}));
