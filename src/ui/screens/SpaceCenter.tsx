import React from 'react';
import { useGameStore } from '../stores/gameStore';

export const SpaceCenter: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const funds = useGameStore((s) => s.funds);
  const science = useGameStore((s) => s.science);
  const reputation = useGameStore((s) => s.reputation);
  const mode = useGameStore((s) => s.mode);

  return (
    <div style={root}>
      <header style={header}>
        <button style={backBtn} onClick={() => setScreen('menu')}>← MAIN MENU</button>
        <h1 style={{ margin: 0, fontWeight: 300, fontSize: 22, letterSpacing: 6 }}>KERBAL SPACE CENTER</h1>
        <div style={{ display: 'flex', gap: 24 }}>
          {mode !== 'sandbox' && (
            <>
              <Stat label="FUNDS" value={`$${funds.toLocaleString()}`} color="#54c98a" />
              <Stat label="SCIENCE" value={science.toLocaleString()} color="#5aa9ff" />
              <Stat label="REPUTATION" value={reputation.toLocaleString()} color="#ffb347" />
            </>
          )}
        </div>
      </header>

      <div style={facilityGrid}>
        <FacilityCard
          name="VEHICLE ASSEMBLY"
          description="Design and assemble your rockets from the parts catalogue."
          accent
          onClick={() => setScreen('editor')}
        />
        <FacilityCard
          name="LAUNCH PAD"
          description="Fly your last design straight to the pad."
          onClick={() => setScreen('flight')}
        />
        <FacilityCard
          name="TRACKING STATION"
          description="View vessels in flight, plan maneuvers, switch crafts."
          onClick={() => setScreen('flight')}
          disabled={mode === 'career'}
        />
        <FacilityCard
          name="RESEARCH & DEVELOPMENT"
          description="Spend science to unlock new parts."
          onClick={() => setScreen('tech-tree')}
          disabled={mode === 'sandbox'}
        />
        <FacilityCard
          name="MISSION CONTROL"
          description="Browse contracts and accept missions."
          onClick={() => alert('Mission Control coming next milestone.')}
          disabled={mode !== 'career'}
        />
        <FacilityCard
          name="ASTRONAUT COMPLEX"
          description="Manage your crew of kerbals."
          onClick={() => alert('Astronaut roster coming next milestone.')}
        />
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ color: '#6e7d99', fontSize: 9, letterSpacing: 2 }}>{label}</div>
    <div style={{ color, fontSize: 16, fontFamily: 'monospace' }}>{value}</div>
  </div>
);

const FacilityCard: React.FC<{
  name: string;
  description: string;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ name, description, accent, disabled, onClick }) => (
  <button
    onClick={() => !disabled && onClick()}
    disabled={disabled}
    style={{
      textAlign: 'left',
      padding: '24px 26px',
      background: accent ? 'linear-gradient(135deg, rgba(255, 179, 71, 0.18), rgba(255, 138, 58, 0.06))' : 'rgba(20, 26, 38, 0.8)',
      border: '1px solid ' + (accent ? '#ffb347aa' : '#2a313d'),
      borderRadius: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      color: '#e8edf6',
      transition: 'transform 120ms ease, border-color 120ms ease',
      minHeight: 140,
    }}
  >
    <div style={{ fontSize: 18, letterSpacing: 3, fontWeight: 500, color: accent ? '#ffb347' : '#e8edf6' }}>{name}</div>
    <div style={{ marginTop: 10, color: '#9aa9c0', fontSize: 13 }}>{description}</div>
  </button>
);

const root: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(ellipse at 70% 30%, #1a2848 0%, #060914 60%, #000 100%)',
  padding: '32px 60px',
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid #1a2030',
  paddingBottom: 18,
};

const backBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  border: '1px solid #2a313d',
  borderRadius: 3,
  color: '#9aa9c0',
  cursor: 'pointer',
  fontSize: 11,
  letterSpacing: 2,
  fontFamily: 'inherit',
};

const facilityGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 18,
  flex: 1,
};
