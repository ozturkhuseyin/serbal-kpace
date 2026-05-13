import React from 'react';
import { useFlightStore } from '../stores/flightStore';
import { Navball } from './Navball';

const fmt = (n: number, d = 1) => {
  if (!isFinite(n)) return '∞';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + 'G';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(d) + 'k';
  return n.toFixed(d);
};

const fmtTime = (s: number): string => {
  if (!isFinite(s) || s <= 0) return '—';
  const days = Math.floor(s / 86400);
  const hr = Math.floor((s % 86400) / 3600);
  const mn = Math.floor((s % 3600) / 60);
  const sc = Math.floor(s % 60);
  return `${days > 0 ? days + 'd ' : ''}${pad(hr)}:${pad(mn)}:${pad(sc)}`;
};
const pad = (n: number) => n.toString().padStart(2, '0');

export interface HUDProps {
  forward: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  radialUp: { x: number; y: number; z: number };
  prograde: { x: number; y: number; z: number };
  onStage: () => void;
  onWarpUp: () => void;
  onWarpDown: () => void;
  onMap: () => void;
  onCamera: () => void;
  onRecover: () => void;
  onPause: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  forward, up, radialUp, prograde,
  onStage, onWarpUp, onWarpDown, onMap, onCamera, onRecover, onPause,
}) => {
  const tel = useFlightStore((s) => s.telemetry);
  const events = useFlightStore((s) => s.events);

  if (!tel) return null;

  return (
    <div style={hudRoot}>
      <div style={leftPanel}>
        <Telem label="ALTITUDE ASL" value={fmt(tel.altitudeASL, 0) + ' m'} accent />
        <Telem label="ALTITUDE AGL" value={fmt(tel.altitudeAGL, 0) + ' m'} />
        <Telem label="VELOCITY" value={fmt(tel.speed, 1) + ' m/s'} accent />
        <Telem label="VERTICAL" value={fmt(tel.verticalSpeed, 1) + ' m/s'} />
        <Telem label="HORIZONTAL" value={fmt(tel.horizontalSpeed, 1) + ' m/s'} />
        <Telem label="DYNAMIC P" value={fmt(tel.q, 0) + ' Pa'} />
        <Telem label="MACH" value={tel.mach.toFixed(2)} />
        <Telem label="G-FORCE" value={tel.gForce.toFixed(2) + ' g'} />
        <Telem label="MET" value={fmtTime(tel.metSeconds)} />
      </div>

      <div style={navballWrap}>
        <Navball
          forward={forward}
          up={up}
          radialUp={radialUp}
          prograde={prograde}
          throttle={tel.throttle}
          sasMode={tel.sasMode}
        />
        <div style={buttonRow}>
          <Btn onClick={onStage} accent>STAGE</Btn>
          <Btn onClick={onMap}>MAP (M)</Btn>
          <Btn onClick={onCamera}>CAM (Tab)</Btn>
        </div>
        <div style={buttonRow}>
          <Btn onClick={onWarpDown}>«</Btn>
          <span style={{ fontFamily: 'monospace', color: '#ffb347', minWidth: 60, textAlign: 'center' }}>
            {tel.warpFactor.toLocaleString()}×
          </span>
          <Btn onClick={onWarpUp}>»</Btn>
          <Btn onClick={onPause}>II</Btn>
          <Btn onClick={onRecover}>RECOV</Btn>
        </div>
      </div>

      <div style={rightPanel}>
        <Telem label="THROTTLE" value={(tel.throttle * 100).toFixed(0) + '%'} accent />
        <ProgressBar value={tel.throttle} color="#ffb347" />
        <Telem label="THRUST" value={fmt(tel.thrust, 0) + ' N'} />
        <Telem label="ISP" value={tel.isp.toFixed(0) + ' s'} />
        <Telem label="TWR" value={tel.twr.toFixed(2)} />
        <Telem label="MASS" value={fmt(tel.totalMass, 1) + ' kg'} />
        <Telem label="LIQUID FUEL" value={tel.fuelLF.toFixed(0)} />
        <ProgressBar value={tel.fuelLFMax > 0 ? tel.fuelLF / tel.fuelLFMax : 0} color="#54c98a" />
        <Telem label="OXIDIZER" value={tel.fuelOx.toFixed(0)} />
        <ProgressBar value={tel.fuelOxMax > 0 ? tel.fuelOx / tel.fuelOxMax : 0} color="#5aa9ff" />
        <Telem label="STAGE" value={`${tel.stage} / ${tel.totalStages}`} />
      </div>

      <div style={topPanel}>
        <Telem label="BODY" value={tel.parentBody} accent />
        <Telem label="APO" value={fmt(tel.apoapsis, 0) + ' m'} />
        <Telem label="PERI" value={fmt(tel.periapsis, 0) + ' m'} />
        <Telem label="ECC" value={tel.orbitalEccentricity.toFixed(3)} />
        <Telem label="INC" value={(tel.inclination * 57.296).toFixed(1) + '°'} />
        <Telem label="PERIOD" value={fmtTime(tel.orbitalPeriod)} />
        <Telem label="SITUATION" value={tel.situation.toUpperCase()} accent />
      </div>

      <div style={eventsPanel}>
        {events.slice(-6).reverse().map((e) => (
          <div key={e.id} style={{ fontFamily: 'monospace', fontSize: 11, color: '#cdd6e6', opacity: 0.8 }}>
            <span style={{ color: '#ffb347' }}>{e.type.toUpperCase()}</span>  {e.message}
          </div>
        ))}
      </div>

      {tel.situation === 'pre-launch' && (
        <div style={launchPrompt}>
          <div style={{ fontSize: 13, color: '#6e7d99', letterSpacing: 4, marginBottom: 12 }}>READY TO LAUNCH</div>
          <div style={{ fontSize: 22, color: '#ffb347', letterSpacing: 3 }}>
            PRESS <kbd style={kbd}>SPACE</kbd> TO IGNITE — THEN <kbd style={kbd}>Z</kbd> FOR FULL THROTTLE
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: '#9aa9c0', letterSpacing: 1 }}>
            DRAG MOUSE TO ROTATE CAMERA · SCROLL TO ZOOM · M FOR MAP
          </div>
        </div>
      )}
    </div>
  );
};

const Telem: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div style={{ marginBottom: 4 }}>
    <div style={{ color: '#6e7d99', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ color: accent ? '#ffb347' : '#e6ecf6', fontFamily: 'monospace', fontSize: 14, fontWeight: 500 }}>{value}</div>
  </div>
);

const ProgressBar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <div style={{ width: '100%', height: 4, background: '#1a1f2b', borderRadius: 2, marginBottom: 6 }}>
    <div style={{ width: `${Math.min(100, value * 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
  </div>
);

const Btn: React.FC<React.PropsWithChildren<{ onClick: () => void; accent?: boolean }>> = ({ onClick, accent, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '5px 10px',
      background: accent ? '#ffb347' : 'rgba(20, 25, 35, 0.85)',
      color: accent ? '#000' : '#cdd6e6',
      border: '1px solid ' + (accent ? '#ffb347' : '#2a313d'),
      borderRadius: 3,
      cursor: 'pointer',
      fontFamily: 'monospace',
      fontSize: 11,
      letterSpacing: 1,
    }}
  >
    {children}
  </button>
);

const hudRoot: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  fontFamily: 'Inter, sans-serif',
};

const leftPanel: React.CSSProperties = {
  position: 'absolute',
  top: 80,
  left: 18,
  width: 200,
  padding: 16,
  background: 'rgba(8, 11, 18, 0.78)',
  border: '1px solid rgba(60, 70, 88, 0.6)',
  borderRadius: 6,
  pointerEvents: 'auto',
  backdropFilter: 'blur(4px)',
};

const rightPanel: React.CSSProperties = {
  position: 'absolute',
  top: 80,
  right: 18,
  width: 220,
  padding: 16,
  background: 'rgba(8, 11, 18, 0.78)',
  border: '1px solid rgba(60, 70, 88, 0.6)',
  borderRadius: 6,
  pointerEvents: 'auto',
  backdropFilter: 'blur(4px)',
};

const navballWrap: React.CSSProperties = {
  position: 'absolute',
  bottom: 22,
  left: '50%',
  transform: 'translateX(-50%)',
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

const buttonRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'center',
};

const topPanel: React.CSSProperties = {
  position: 'absolute',
  top: 18,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 24,
  padding: '10px 22px',
  background: 'rgba(8, 11, 18, 0.78)',
  border: '1px solid rgba(60, 70, 88, 0.6)',
  borderRadius: 6,
  pointerEvents: 'auto',
};

const eventsPanel: React.CSSProperties = {
  position: 'absolute',
  bottom: 22,
  left: 18,
  width: 320,
  padding: 12,
  background: 'rgba(8, 11, 18, 0.6)',
  borderRadius: 6,
  pointerEvents: 'none',
};

const launchPrompt: React.CSSProperties = {
  position: 'absolute',
  top: '38%',
  left: '50%',
  transform: 'translateX(-50%)',
  textAlign: 'center',
  pointerEvents: 'none',
  textShadow: '0 0 18px rgba(0, 0, 0, 0.8)',
};

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  margin: '0 4px',
  background: 'rgba(255, 179, 71, 0.18)',
  border: '1px solid #ffb347',
  borderRadius: 3,
  fontFamily: 'monospace',
  fontSize: 16,
  color: '#fff',
};
