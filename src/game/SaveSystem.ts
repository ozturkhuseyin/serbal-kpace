import { VesselDesign } from '../editor/VehicleAssembly';

const DB_NAME = 'orbital-saves';
const DB_VERSION = 1;
const STORE_DESIGNS = 'designs';
const STORE_GAMES = 'games';

interface GameSave {
  id: string;
  name: string;
  timestamp: number;
  funds: number;
  science: number;
  reputation: number;
  unlockedTech: string[];
  contracts: unknown[];
  universalTime: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DESIGNS)) {
        db.createObjectStore(STORE_DESIGNS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStore(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  const tx = db.transaction(name, mode);
  return tx.objectStore(name);
}

function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDesign(design: VesselDesign): Promise<void> {
  const store = await getStore(STORE_DESIGNS, 'readwrite');
  await awaitRequest(store.put({ ...design, _savedAt: Date.now() }));
}

export async function loadDesign(id: string): Promise<VesselDesign | null> {
  const store = await getStore(STORE_DESIGNS, 'readonly');
  const result = await awaitRequest(store.get(id));
  return (result as VesselDesign) ?? null;
}

export async function listDesigns(): Promise<VesselDesign[]> {
  const store = await getStore(STORE_DESIGNS, 'readonly');
  const result = await awaitRequest(store.getAll());
  return (result as VesselDesign[]) ?? [];
}

export async function deleteDesign(id: string): Promise<void> {
  const store = await getStore(STORE_DESIGNS, 'readwrite');
  await awaitRequest(store.delete(id));
}

export async function saveGame(save: GameSave): Promise<void> {
  const store = await getStore(STORE_GAMES, 'readwrite');
  await awaitRequest(store.put(save));
}

export async function loadGame(id: string): Promise<GameSave | null> {
  const store = await getStore(STORE_GAMES, 'readonly');
  const result = await awaitRequest(store.get(id));
  return (result as GameSave) ?? null;
}

export async function listGames(): Promise<GameSave[]> {
  const store = await getStore(STORE_GAMES, 'readonly');
  const result = await awaitRequest(store.getAll());
  return (result as GameSave[]) ?? [];
}
