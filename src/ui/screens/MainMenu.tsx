import React from 'react';
import { useGameStore } from '../stores/gameStore';

export const MainMenu: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const setMode = useGameStore((s) => s.setMode);

  return (
    <div style={root}>
      <div style={leftPanel}>
        <h1 style={title}>SERBAL KPACE</h1>
        <p style={subtitle}>SPACE PROGRAM SIMULATOR</p>
        <p style={tagline}>
          Build rockets. Fly through a procedural solar system. Land on alien worlds.
        </p>
      </div>
      <div style={rightPanel}>
        <Button label="NEW SANDBOX" sublabel="Free flight, unlimited parts" onClick={() => { setMode('sandbox'); setScreen('space-center'); }} accent />
        <Button label="CAREER" sublabel="Funds, contracts, tech tree" onClick={() => { setMode('career'); setScreen('space-center'); }} />
        <Button label="SCIENCE" sublabel="Earn science, unlock parts" onClick={() => { setMode('science'); setScreen('space-center'); }} />
        <Button label="LOAD GAME" sublabel="Continue an existing save" onClick={() => alert('Load game from main menu — coming soon. Use the Space Center save slots.')} disabled />
        <Button label="SETTINGS" sublabel="Audio, controls, quality" onClick={() => alert('Settings coming soon.')} disabled />
        <div style={{ marginTop: 24, fontSize: 11, color: '#5d6a82', textAlign: 'right', letterSpacing: 1 }}>
          v0.1 · BUILD &nbsp; SERBAL-{new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};

const Button: React.FC<{
  label: string;
  sublabel?: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}> = ({ label, sublabel, onClick, accent, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: 320,
      textAlign: 'left',
      background: accent ? 'linear-gradient(135deg, #ffb347, #ff8a3a)' : 'rgba(20, 26, 38, 0.85)',
      color: accent ? '#0a0c12' : '#e8edf6',
      border: '1px solid ' + (accent ? '#ffb347' : '#2a313d'),
      padding: '14px 20px',
      borderRadius: 4,
      fontFamily: 'Inter, sans-serif',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'transform 120ms ease',
    }}
    onMouseDown={(e) => (e.currentTarget.style.transform = 'translateX(2px)')}
    onMouseUp={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
  >
    <div style={{ fontSize: 16, letterSpacing: 3, fontWeight: 500 }}>{label}</div>
    {sublabel && <div style={{ fontSize: 11, color: accent ? '#0a0c12cc' : '#6e7d99', marginTop: 4, letterSpacing: 1 }}>{sublabel}</div>}
  </button>
);

const root: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(ellipse at 30% 60%, #102040 0%, #060914 60%, #000 100%)',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  alignItems: 'center',
  padding: '0 80px',
};

const leftPanel: React.CSSProperties = {
  paddingLeft: 60,
};

const rightPanel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  alignItems: 'flex-end',
  paddingRight: 60,
};

const title: React.CSSProperties = {
  fontSize: 84,
  letterSpacing: 8,
  margin: 0,
  fontWeight: 200,
  color: '#ffb347',
  textShadow: '0 0 32px rgba(255, 179, 71, 0.45)',
  whiteSpace: 'nowrap',
};

const subtitle: React.CSSProperties = {
  margin: 0,
  letterSpacing: 6,
  color: '#8a9bb5',
  fontSize: 13,
};

const tagline: React.CSSProperties = {
  marginTop: 32,
  color: '#a4b3c8',
  fontSize: 16,
  maxWidth: 460,
  lineHeight: 1.6,
};
