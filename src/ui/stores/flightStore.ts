import { create } from 'zustand';
import { VesselTelemetry } from '../../physics/PhysicsEngine';

export interface FlightStore {
  telemetry: VesselTelemetry | null;
  events: { id: number; type: string; message: string; ts: number }[];
  cameraMode: string;
  mapMode: boolean;
  setTelemetry: (t: VesselTelemetry) => void;
  pushEvent: (type: string, message: string) => void;
  setCameraMode: (m: string) => void;
  setMapMode: (m: boolean) => void;
}

let eid = 0;

export const useFlightStore = create<FlightStore>((set) => ({
  telemetry: null,
  events: [],
  cameraMode: 'chase',
  mapMode: false,
  setTelemetry: (t) => set({ telemetry: t }),
  pushEvent: (type, message) =>
    set((state) => ({
      events: [
        ...state.events.slice(-30),
        { id: eid++, type, message, ts: Date.now() },
      ],
    })),
  setCameraMode: (m) => set({ cameraMode: m }),
  setMapMode: (m) => set({ mapMode: m }),
}));
