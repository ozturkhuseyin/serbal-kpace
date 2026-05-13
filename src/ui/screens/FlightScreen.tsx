import React, { useEffect, useRef, useState } from 'react';
import { useFlightStore } from '../stores/flightStore';
import { HUD } from '../components/HUD';
import { FlightScene } from '../../game/FlightScene';
import { AudioManager } from '../../game/AudioManager';
import { VehicleAssembly } from '../../editor/VehicleAssembly';
import { createKerbalIBeginnerRocket } from '../../editor/StockDesigns';
import { useGameStore } from '../stores/gameStore';
import { Vec3 } from '../../physics/Vector3';

export interface FlightScreenProps {
  assembly?: VehicleAssembly;
  onExit: () => void;
}

export const FlightScreen: React.FC<FlightScreenProps> = ({ assembly, onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlightScene | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const setScreen = useGameStore((s) => s.setScreen);
  const tel = useFlightStore((s) => s.telemetry);
  const [, force] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const audio = new AudioManager();
    audioRef.current = audio;
    const fs = new FlightScene(containerRef.current, audio);
    sceneRef.current = fs;
    const home = fs.system.getBody('kerbin')!;
    fs.launchAssembly(assembly ?? createKerbalIBeginnerRocket(), home);
    fs.start();

    const initAudio = () => {
      if (!audio.initialized) audio.init();
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('pointerdown', initAudio);
    window.addEventListener('keydown', initAudio);

    const id = setInterval(() => force((n) => n + 1), 250);

    return () => {
      clearInterval(id);
      fs.stop();
      sceneRef.current = null;
    };
  }, [assembly]);

  const fwd = tel ? computeForward() : { x: 0, y: 1, z: 0 };
  const up = computeUp();
  const radial = computeRadial();
  const prograde = computePrograde();

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <HUD
        forward={fwd}
        up={up}
        radialUp={radial}
        prograde={prograde}
        onStage={() => sceneRef.current?.active && sceneRef.current.staging.triggerNextStage(sceneRef.current.active)}
        onWarpUp={() => sceneRef.current?.adjustWarp(1)}
        onWarpDown={() => sceneRef.current?.adjustWarp(-1)}
        onMap={() => sceneRef.current?.toggleMap()}
        onCamera={() => sceneRef.current?.scene.cycleCameraMode()}
        onRecover={() => onExit()}
        onPause={() => setScreen('space-center')}
      />
    </div>
  );

  function computeForward() {
    const v = sceneRef.current?.active;
    if (!v) return { x: 0, y: 1, z: 0 };
    const f = v.body.forwardWorld();
    return { x: f.x, y: f.y, z: f.z };
  }
  function computeUp() {
    const v = sceneRef.current?.active;
    if (!v) return { x: 0, y: 0, z: 1 };
    const u = v.body.upWorld();
    return { x: u.x, y: u.y, z: u.z };
  }
  function computeRadial() {
    const v = sceneRef.current?.active;
    if (!v) return { x: 0, y: 1, z: 0 };
    const r = v.body.position.sub(v.parentBody.position).normalize();
    return { x: r.x, y: r.y, z: r.z };
  }
  function computePrograde() {
    const v = sceneRef.current?.active;
    if (!v) return { x: 0, y: 1, z: 0 };
    const parent = v.parentBody;
    const relVel = v.body.velocity.sub(parent.velocity);
    const m = relVel.length() || 1;
    return { x: relVel.x / m, y: relVel.y / m, z: relVel.z / m };
  }
};

void Vec3;
