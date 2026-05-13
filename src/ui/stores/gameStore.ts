import { create } from 'zustand';

export type Screen = 'menu' | 'space-center' | 'editor' | 'flight' | 'tracking' | 'tech-tree';
export type GameMode = 'sandbox' | 'science' | 'career';

export interface CrewMember {
  id: string;
  name: string;
  role: 'pilot' | 'engineer' | 'scientist';
  experience: number;
  status: 'available' | 'in-flight' | 'lost';
}

export interface MissionContract {
  id: string;
  title: string;
  description: string;
  reward: number;
  reputation: number;
  science: number;
  status: 'available' | 'active' | 'completed' | 'failed';
  requirements: string[];
}

export interface SaveSlot {
  name: string;
  vesselDesignIds: string[];
  funds: number;
  science: number;
  reputation: number;
  unlockedTech: string[];
  contracts: MissionContract[];
  universalTime: number;
}

export interface GameStore {
  screen: Screen;
  mode: GameMode;
  funds: number;
  science: number;
  reputation: number;
  unlockedTech: Set<string>;
  contracts: MissionContract[];
  crew: CrewMember[];
  setScreen: (s: Screen) => void;
  setMode: (m: GameMode) => void;
  addFunds: (n: number) => void;
  addScience: (n: number) => void;
  addReputation: (n: number) => void;
  unlock: (id: string) => void;
  acceptContract: (id: string) => void;
  completeContract: (id: string) => void;
  addContract: (c: MissionContract) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  screen: 'menu',
  mode: 'sandbox',
  funds: 25000,
  science: 0,
  reputation: 0,
  unlockedTech: new Set([
    'basicRocketry',
    'basicAerodynamics',
    'basicScience',
  ]),
  contracts: [],
  crew: [
    { id: 'jeb', name: 'Jebediah Kerman', role: 'pilot', experience: 5, status: 'available' },
    { id: 'bill', name: 'Bill Kerman', role: 'engineer', experience: 3, status: 'available' },
    { id: 'bob', name: 'Bob Kerman', role: 'scientist', experience: 4, status: 'available' },
    { id: 'val', name: 'Valentina Kerman', role: 'pilot', experience: 4, status: 'available' },
  ],
  setScreen: (s) => set({ screen: s }),
  setMode: (m) => set({ mode: m }),
  addFunds: (n) => set((s) => ({ funds: s.funds + n })),
  addScience: (n) => set((s) => ({ science: s.science + n })),
  addReputation: (n) => set((s) => ({ reputation: s.reputation + n })),
  unlock: (id) => set((s) => ({ unlockedTech: new Set([...s.unlockedTech, id]) })),
  acceptContract: (id) =>
    set((s) => ({
      contracts: s.contracts.map((c) => (c.id === id ? { ...c, status: 'active' } : c)),
    })),
  completeContract: (id) =>
    set((s) => ({
      contracts: s.contracts.map((c) => (c.id === id ? { ...c, status: 'completed' } : c)),
    })),
  addContract: (c) => set((s) => ({ contracts: [...s.contracts, c] })),
}));
