import * as THREE from 'three';
import { CelestialBody } from '../physics/CelestialBody';

/**
 * Procedural launch pad and gantry tower placed on a celestial body's surface.
 *
 * Returns a THREE.Group that is intended to be parented to the planet's
 * rotating render group so it stays anchored to the launch site.
 *
 * The pad's local +Y axis points radially outward from the planet centre and
 * its origin sits *on* the surface. All geometry is offset along +Y so it
 * appears to sit on top of the planet, not partially buried inside it.
 */
export function buildLaunchPad(body: CelestialBody): THREE.Group {
  const root = new THREE.Group();
  root.name = `launchpad:${body.config.id}`;

  // Place the pad at the body's +X surface point and orient so that the pad's
  // local +Y axis (its "up") aligns with the radial direction (+X in body
  // frame). Rotation: -π/2 around Z rotates +Y → +X. Push the root slightly
  // outward (10 cm) to avoid z-fighting with the planet sphere.
  root.position.set(body.config.radius + 0.1, 0, 0);
  root.rotation.set(0, 0, -Math.PI / 2);

  const padRadius = 30;
  const padHeight = 1.4;

  // Wide darker apron underneath the main pad
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x53575c, metalness: 0.1, roughness: 0.92 });
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(padRadius + 22, padRadius + 22, 0.5, 48), apronMat);
  apron.position.y = 0.25;
  root.add(apron);

  // Main concrete pad
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x747981, metalness: 0.1, roughness: 0.85 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(padRadius, padRadius, padHeight, 48), concreteMat);
  pad.position.y = 0.5 + padHeight / 2;
  root.add(pad);

  const padTopY = 0.5 + padHeight;

  // Yellow safety ring on top of the pad
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffb347, metalness: 0.4, roughness: 0.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(padRadius - 1.5, 0.22, 8, 64), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = padTopY + 0.05;
  root.add(ring);

  // Yellow stripes radiating from center on the top face
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffd87a, metalness: 0.05, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, padRadius * 0.7), stripeMat);
    stripe.rotation.y = (i / 6) * Math.PI;
    stripe.position.y = padTopY + 0.06;
    root.add(stripe);
  }

  // Center hold-down clamp ring (rocket sits above this)
  const clampMat = new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.7, roughness: 0.3 });
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 16), clampMat);
  clamp.position.y = padTopY + 0.35;
  root.add(clamp);

  // Flame deflector cone in the very middle
  const flameMat = new THREE.MeshStandardMaterial({ color: 0x16191e, metalness: 0.3, roughness: 0.85 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.2, 24), flameMat);
  flame.position.y = padTopY + 1.2;
  flame.rotation.x = Math.PI; // tip-down
  root.add(flame);

  // --- Gantry tower ---
  const trussMat = new THREE.MeshStandardMaterial({ color: 0xc05030, metalness: 0.5, roughness: 0.55 });
  const towerHeight = 24;
  const towerOffset = 9;
  const towerGroup = new THREE.Group();
  towerGroup.position.set(towerOffset, padTopY + towerHeight / 2, 0);
  for (const dx of [-1.0, 1.0]) {
    for (const dz of [-1.0, 1.0]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.22, towerHeight, 0.22), trussMat);
      strut.position.set(dx, 0, dz);
      towerGroup.add(strut);
    }
  }
  for (let i = 1; i <= 9; i++) {
    const y = -towerHeight / 2 + (i / 10) * towerHeight;
    const beamFB = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), trussMat);
    beamFB.position.set(0, y, 1.0);
    towerGroup.add(beamFB);
    const beamFB2 = beamFB.clone(); beamFB2.position.z = -1.0; towerGroup.add(beamFB2);
    const beamSide = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), trussMat);
    beamSide.position.set(1.0, y, 0); towerGroup.add(beamSide);
    const beamS2 = beamSide.clone(); beamS2.position.x = -1.0; towerGroup.add(beamS2);
  }
  // Service bridge reaching toward the rocket at mid-height
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(towerOffset - 2, 0.18, 1.8), trussMat);
  bridge.position.set(-(towerOffset - 2) / 2, towerHeight * 0.6 - towerHeight / 2, 0);
  towerGroup.add(bridge);
  // Lightning rod on top
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: 0.8, roughness: 0.3 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 8), rodMat);
  rod.position.set(0, towerHeight / 2 + 2, 0);
  towerGroup.add(rod);
  root.add(towerGroup);

  // Lighting masts at corners of the apron
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xfff4c2, emissiveIntensity: 0.7 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x444448, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r = padRadius - 4;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9, 8), mastMat);
    mast.position.set(Math.cos(a) * r, padTopY + 4.5, Math.sin(a) * r);
    root.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.6), mastMat);
    head.position.set(Math.cos(a) * r, padTopY + 9.2, Math.sin(a) * r);
    head.lookAt(0, padTopY + 9.2, 0);
    root.add(head);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), lampMat);
    lamp.position.set(Math.cos(a) * r * 0.92, padTopY + 9.0, Math.sin(a) * r * 0.92);
    root.add(lamp);
  }

  // Use the body to vary tint slightly so different worlds get different pads.
  if (body.config.id !== 'kerbin') {
    concreteMat.color.offsetHSL(0, 0, -0.05);
  }

  return root;
}
