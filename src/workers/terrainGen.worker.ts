/**
 * Terrain heightmap generator. Runs inside a Web Worker so generation never
 * blocks the main render loop.
 *
 * The worker accepts requests for a (lat, lon, radius, lod) patch and returns
 * a heightmap + biome mask buffer for that patch.
 */

interface TerrainRequest {
  id: number;
  bodyId: string;
  centreLat: number;
  centreLon: number;
  arcRadius: number;
  resolution: number;
  amplitude: number;
  seed: number;
}

interface TerrainResponse {
  id: number;
  bodyId: string;
  resolution: number;
  heights: Float32Array;
  biome: Uint8Array;
}

function hash(n: number): number {
  let x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
}

function noise(x: number, y: number, z: number, seed: number): number {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = x - i, fy = y - j, fz = z - k;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const v000 = hash((i * 73 + j * 19 + k * 41) * 0.0173 + seed);
  const v100 = hash(((i + 1) * 73 + j * 19 + k * 41) * 0.0173 + seed);
  const v010 = hash((i * 73 + (j + 1) * 19 + k * 41) * 0.0173 + seed);
  const v110 = hash(((i + 1) * 73 + (j + 1) * 19 + k * 41) * 0.0173 + seed);
  const v001 = hash((i * 73 + j * 19 + (k + 1) * 41) * 0.0173 + seed);
  const v101 = hash(((i + 1) * 73 + j * 19 + (k + 1) * 41) * 0.0173 + seed);
  const v011 = hash((i * 73 + (j + 1) * 19 + (k + 1) * 41) * 0.0173 + seed);
  const v111 = hash(((i + 1) * 73 + (j + 1) * 19 + (k + 1) * 41) * 0.0173 + seed);
  const x00 = v000 * (1 - u) + v100 * u;
  const x10 = v010 * (1 - u) + v110 * u;
  const x01 = v001 * (1 - u) + v101 * u;
  const x11 = v011 * (1 - u) + v111 * u;
  const y0 = x00 * (1 - v) + x10 * v;
  const y1 = x01 * (1 - v) + x11 * v;
  return y0 * (1 - w) + y1 * w;
}

function fbm(x: number, y: number, z: number, seed: number, octaves = 4): number {
  let sum = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq, z * freq, seed + i * 17.13) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum / max;
}

self.addEventListener('message', (ev: MessageEvent<TerrainRequest>) => {
  const req = ev.data;
  const N = req.resolution;
  const heights = new Float32Array(N * N);
  const biome = new Uint8Array(N * N);
  const cosLat = Math.cos(req.centreLat);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const u = i / (N - 1);
      const v = j / (N - 1);
      const lat = req.centreLat + (v - 0.5) * req.arcRadius;
      const lon = req.centreLon + (u - 0.5) * req.arcRadius / Math.max(cosLat, 0.1);
      const x = Math.cos(lat) * Math.cos(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.sin(lon);
      const h = fbm(x * 8, y * 8, z * 8, req.seed) * 0.6 + fbm(x * 32, y * 32, z * 32, req.seed) * 0.25;
      heights[i * N + j] = (h - 0.5) * req.amplitude * 2;
      let b = 0;
      const absLat = Math.abs(lat);
      if (absLat > 1.2) b = 4;
      else if (h < 0.45) b = 1;
      else if (h < 0.65) b = 2;
      else b = 3;
      biome[i * N + j] = b;
    }
  }
  const resp: TerrainResponse = { id: req.id, bodyId: req.bodyId, resolution: N, heights, biome };
  (self as DedicatedWorkerGlobalScope).postMessage(resp, [heights.buffer, biome.buffer]);
});

export {};
