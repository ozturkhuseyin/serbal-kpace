import React, { useState } from 'react';
import { useGameStore } from './ui/stores/gameStore';
import { MainMenu } from './ui/screens/MainMenu';
import { SpaceCenter } from './ui/screens/SpaceCenter';
import { VABScreen } from './ui/screens/VABScreen';
import { FlightScreen } from './ui/screens/FlightScreen';
import { TechTreeScreen } from './ui/screens/TechTreeScreen';
import { VehicleAssembly } from './editor/VehicleAssembly';

export const App: React.FC = () => {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const [currentAssembly, setCurrentAssembly] = useState<VehicleAssembly | undefined>(undefined);

  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'space-center' && <SpaceCenter />}
      {screen === 'tech-tree' && <TechTreeScreen />}
      {screen === 'editor' && (
        <VABScreen
          initial={currentAssembly}
          onLaunch={(a) => {
            setCurrentAssembly(a);
            setScreen('flight');
          }}
          onExit={() => setScreen('space-center')}
        />
      )}
      {screen === 'flight' && (
        <FlightScreen
          assembly={currentAssembly}
          onExit={() => setScreen('space-center')}
        />
      )}
    </>
  );
};
