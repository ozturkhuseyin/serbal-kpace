import React, { useMemo } from 'react';

/**
 * SVG navball that visualises pitch / yaw / roll plus prograde, retrograde,
 * normal/anti-normal, radial in/out and target markers.
 *
 * The "ball" is rendered as a clipped circle with a horizon line that pivots
 * with pitch & roll. Markers are projected from world-space directions onto
 * the disc.
 */
export interface NavballProps {
  /** Forward direction in world space (unit vector). */
  forward: { x: number; y: number; z: number };
  /** Up direction (head-of-vessel) in world space. */
  up: { x: number; y: number; z: number };
  /** Reference up — radial-out from parent body. */
  radialUp: { x: number; y: number; z: number };
  /** Velocity direction (world space). */
  prograde: { x: number; y: number; z: number };
  /** Throttle 0–1. */
  throttle: number;
  /** SAS mode label. */
  sasMode: string;
}

export const Navball: React.FC<NavballProps> = ({
  forward, up, radialUp, prograde, throttle, sasMode,
}) => {
  const r = 100;
  const cx = 110;
  const cy = 110;

  const orientation = useMemo(() => buildBodyFrame(forward, up, radialUp), [forward, up, radialUp]);

  const pitchDeg = Math.asin(clamp(forward.x * radialUp.x + forward.y * radialUp.y + forward.z * radialUp.z, -1, 1)) * (180 / Math.PI);
  const heading = Math.atan2(forward.x, forward.z) * (180 / Math.PI);

  const project = (worldDir: { x: number; y: number; z: number }) => {
    const local = orientation.toLocal(worldDir);
    return { sx: cx + local.x * r * 0.9, sy: cy - local.z * r * 0.9, visible: local.y > -0.05 };
  };

  const pg = project(prograde);
  const rg = project({ x: -prograde.x, y: -prograde.y, z: -prograde.z });
  const ru = project(radialUp);
  const ri = project({ x: -radialUp.x, y: -radialUp.y, z: -radialUp.z });

  const horizonY = cy + Math.sin((pitchDeg * Math.PI) / 180) * r * 0.95;
  const rollDeg = Math.atan2(orientation.right.x * radialUp.x + orientation.right.y * radialUp.y + orientation.right.z * radialUp.z,
    orientation.up.x * radialUp.x + orientation.up.y * radialUp.y + orientation.up.z * radialUp.z) * (180 / Math.PI);

  return (
    <svg width="220" height="220" viewBox="0 0 220 220" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="ballGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#9bc4ec" />
          <stop offset="60%" stopColor="#3b6ea5" />
          <stop offset="100%" stopColor="#0a1f3a" />
        </radialGradient>
        <linearGradient id="skyGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7eb6f0" />
          <stop offset="100%" stopColor="#1b3a6b" />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6b4424" />
          <stop offset="100%" stopColor="#3a2611" />
        </linearGradient>
        <clipPath id="ballClip"><circle cx={cx} cy={cy} r={r} /></clipPath>
      </defs>

      <circle cx={cx} cy={cy} r={r + 6} fill="#0c0f14" stroke="#2a313d" strokeWidth="2" />
      <g clipPath="url(#ballClip)" transform={`rotate(${rollDeg} ${cx} ${cy})`}>
        <rect x={cx - r} y={cy - r * 2} width={r * 2} height={r * 2} fill="url(#skyGrad)" />
        <rect x={cx - r} y={horizonY} width={r * 2} height={r * 2} fill="url(#groundGrad)" />
        <line x1={cx - r} y1={horizonY} x2={cx + r} y2={horizonY} stroke="#fff" strokeWidth="1.5" />
        {[-60, -30, 30, 60].map((a) => (
          <line
            key={a}
            x1={cx - r * 0.5}
            y1={horizonY - (a / 90) * r * 0.95}
            x2={cx + r * 0.5}
            y2={horizonY - (a / 90) * r * 0.95}
            stroke="#fff"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
        ))}
      </g>

      {pg.visible && (
        <g transform={`translate(${pg.sx} ${pg.sy})`}>
          <circle r="9" stroke="#ffe97a" fill="none" strokeWidth="2" />
          <circle r="2" fill="#ffe97a" />
          <line x1="-12" y1="0" x2="-9" y2="0" stroke="#ffe97a" strokeWidth="2" />
          <line x1="12" y1="0" x2="9" y2="0" stroke="#ffe97a" strokeWidth="2" />
          <line x1="0" y1="-12" x2="0" y2="-9" stroke="#ffe97a" strokeWidth="2" />
        </g>
      )}
      {rg.visible && (
        <g transform={`translate(${rg.sx} ${rg.sy})`}>
          <circle r="9" stroke="#ffe97a" fill="none" strokeWidth="2" />
          <line x1="-7" y1="-7" x2="7" y2="7" stroke="#ffe97a" strokeWidth="2" />
          <line x1="-7" y1="7" x2="7" y2="-7" stroke="#ffe97a" strokeWidth="2" />
        </g>
      )}
      {ru.visible && (
        <g transform={`translate(${ru.sx} ${ru.sy})`}>
          <circle r="6" stroke="#7be38f" fill="none" strokeWidth="2" />
        </g>
      )}
      {ri.visible && (
        <g transform={`translate(${ri.sx} ${ri.sy})`}>
          <circle r="6" stroke="#7be38f" fill="none" strokeWidth="2" />
          <circle r="2" fill="#7be38f" />
        </g>
      )}

      <line x1={cx} y1={cy - r - 2} x2={cx} y2={cy - r + 8} stroke="#ffb347" strokeWidth="2" />
      <line x1={cx - r - 2} y1={cy} x2={cx - r + 8} y2={cy} stroke="#ffb347" strokeWidth="2" />
      <line x1={cx + r + 2} y1={cy} x2={cx + r - 8} y2={cy} stroke="#ffb347" strokeWidth="2" />

      <rect x="200" y="20" width="14" height="170" rx="2" fill="#0c0f14" stroke="#2a313d" />
      <rect x="200" y={20 + (170 - throttle * 170)} width="14" height={throttle * 170} fill="#ffb347" />

      <text x="110" y="208" fill="#9aa3b3" fontSize="10" textAnchor="middle" fontFamily="monospace">
        HDG {Math.round(((heading + 360) % 360))}° · SAS {sasMode.toUpperCase()}
      </text>
    </svg>
  );
};

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

interface BodyFrame {
  forward: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  toLocal(v: { x: number; y: number; z: number }): { x: number; y: number; z: number };
}

function buildBodyFrame(
  forward: { x: number; y: number; z: number },
  up: { x: number; y: number; z: number },
  _ref: { x: number; y: number; z: number },
): BodyFrame {
  const f = normalize(forward);
  const upN = normalize(up);
  const r = normalize(cross(f, upN));
  const u = cross(r, f);
  return {
    forward: f,
    right: r,
    up: u,
    toLocal(v) {
      return { x: dot(v, r), y: dot(v, f), z: dot(v, u) };
    },
  };
}

function normalize(v: { x: number; y: number; z: number }) {
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}
function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
