import React from 'react';
import { TECH_TREE } from '../../data/techTree';
import { useGameStore } from '../stores/gameStore';

export const TechTreeScreen: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const science = useGameStore((s) => s.science);
  const unlocked = useGameStore((s) => s.unlockedTech);
  const unlock = useGameStore((s) => s.unlock);
  const addScience = useGameStore((s) => s.addScience);

  const tiers = [1, 2, 3, 4, 5];

  const canUnlock = (id: string): boolean => {
    const node = TECH_TREE.find((n) => n.id === id);
    if (!node) return false;
    if (unlocked.has(id)) return false;
    if (science < node.cost) return false;
    return node.prerequisites.every((p) => unlocked.has(p));
  };

  const handleUnlock = (id: string) => {
    const node = TECH_TREE.find((n) => n.id === id);
    if (!node) return;
    if (!canUnlock(id)) return;
    addScience(-node.cost);
    unlock(id);
  };

  return (
    <div style={root}>
      <header style={header}>
        <button style={backBtn} onClick={() => setScreen('space-center')}>← SPACE CENTER</button>
        <h1 style={{ margin: 0, fontWeight: 300, fontSize: 22, letterSpacing: 6 }}>RESEARCH & DEVELOPMENT</h1>
        <div style={{ color: '#5aa9ff', fontFamily: 'monospace', fontSize: 16 }}>SCIENCE: {science}</div>
      </header>
      <div style={tree}>
        {tiers.map((tier) => (
          <div key={tier} style={tierColumn}>
            <h3 style={tierHeader}>TIER {tier}</h3>
            {TECH_TREE.filter((n) => n.tier === tier).map((node) => {
              const isUnlocked = unlocked.has(node.id);
              const possible = canUnlock(node.id);
              return (
                <div
                  key={node.id}
                  style={{
                    ...nodeStyle,
                    borderColor: isUnlocked ? '#54c98a' : possible ? '#ffb347' : '#2a313d',
                    opacity: isUnlocked ? 1 : possible ? 1 : 0.5,
                  }}
                >
                  <div style={{ color: isUnlocked ? '#54c98a' : possible ? '#ffb347' : '#cdd6e6', fontWeight: 500, fontSize: 14, letterSpacing: 1 }}>
                    {node.name}
                  </div>
                  <div style={{ color: '#9aa9c0', fontSize: 11, marginTop: 6 }}>{node.description}</div>
                  <div style={{ marginTop: 10, fontSize: 11, color: '#6e7d99' }}>
                    Cost: <span style={{ color: '#5aa9ff', fontFamily: 'monospace' }}>{node.cost}</span>  ·  Unlocks: {node.unlocks.length} parts
                  </div>
                  {!isUnlocked && (
                    <button
                      style={{
                        marginTop: 10,
                        padding: '6px 12px',
                        background: possible ? '#ffb347' : '#2a313d',
                        color: possible ? '#000' : '#6e7d99',
                        border: 'none',
                        borderRadius: 3,
                        cursor: possible ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit',
                        fontSize: 11,
                        letterSpacing: 1,
                      }}
                      onClick={() => handleUnlock(node.id)}
                      disabled={!possible}
                    >
                      {possible ? 'UNLOCK' : 'LOCKED'}
                    </button>
                  )}
                  {isUnlocked && (
                    <div style={{ marginTop: 8, color: '#54c98a', fontSize: 11, letterSpacing: 1 }}>UNLOCKED ✓</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const root: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(ellipse at 30% 30%, #161e34 0%, #06080f 80%)',
  padding: '32px 60px',
  display: 'flex',
  flexDirection: 'column',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
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

const tree: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 18,
  marginTop: 24,
  flex: 1,
  overflow: 'auto',
};

const tierColumn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const tierHeader: React.CSSProperties = {
  margin: 0,
  color: '#ffb347',
  fontSize: 11,
  letterSpacing: 4,
  fontWeight: 500,
  borderBottom: '1px solid #2a313d',
  paddingBottom: 8,
};

const nodeStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'rgba(20, 26, 38, 0.8)',
  border: '1px solid #2a313d',
  borderRadius: 4,
  transition: 'border-color 0.2s ease',
};
