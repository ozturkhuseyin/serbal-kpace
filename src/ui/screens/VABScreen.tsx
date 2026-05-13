import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '../stores/editorStore';
import { useGameStore } from '../stores/gameStore';
import { VehicleAssembly, PartInstance } from '../../editor/VehicleAssembly';
import { computeDeltaV } from '../../editor/DeltaVCalculator';
import { partsByCategory, PartConfig, getPart } from '../../editor/PartDatabase';
import { Vec3 } from '../../physics/Vector3';
import { STOCK_DESIGNS } from '../../editor/StockDesigns';

interface VABProps {
  initial?: VehicleAssembly;
  onLaunch: (assembly: VehicleAssembly) => void;
  onExit: () => void;
}

interface NodeRef {
  partInstanceId: string;
  partConfig: PartConfig;
  nodeId: string;
  worldPosition: THREE.Vector3;
  direction: THREE.Vector3;
  occupied: boolean;
}

/**
 * Vehicle Assembly Building. A live 3D editor:
 *  - LMB drag (or middle drag) rotates the camera around the build, scroll
 *    zooms, RMB also orbits.
 *  - LMB click on an existing part selects it (highlighted in orange). Press
 *    Delete / Backspace or click "DETACH" to remove it (with its descendants).
 *  - With a part type chosen from the catalogue, free attach nodes glow green.
 *    Click on a node (or on empty space) to place the part. Placement snaps to
 *    the nearest free node when possible.
 */
export const VABScreen: React.FC<VABProps> = ({ initial, onLaunch, onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const assemblyRef = useRef<VehicleAssembly>(initial ?? new VehicleAssembly({ name: 'New Craft' }));
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const nodeMarkerGroupRef = useRef<THREE.Group | null>(null);
  const partMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const nodeRefsRef = useRef<NodeRef[]>([]);
  const setDesign = useEditorStore((s) => s.setDesign);
  const setDeltaV = useEditorStore((s) => s.setDeltaV);
  const symmetry = useEditorStore((s) => s.symmetryMode);
  const setSymmetry = useEditorStore((s) => s.setSymmetry);
  const unlockedTech = useGameStore((s) => s.unlockedTech);
  const mode = useGameStore((s) => s.mode);
  const [selectedPartType, setSelectedPartType] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const selectedInstanceRef = useRef<string | null>(null);
  const selectedPartTypeRef = useRef<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('command');
  const [hint, setHint] = useState<string>('');

  selectedInstanceRef.current = selectedInstance;
  selectedPartTypeRef.current = selectedPartType;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a1226);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const dl = new THREE.DirectionalLight(0xffffff, 1.1);
    dl.position.set(5, 8, 6);
    scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x88aaff, 0.5);
    dl2.position.set(-5, 3, -4);
    scene.add(dl2);
    const fill = new THREE.HemisphereLight(0xa0b8ff, 0x202028, 0.35);
    scene.add(fill);

    // VAB floor: dark concrete + subtle grid
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c2231, metalness: 0.2, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.0;
    scene.add(floor);
    const grid = new THREE.GridHelper(40, 40, 0x37445e, 0x1f2738);
    grid.position.y = -2.99;
    scene.add(grid);

    // Center spine guideline (dashed line up from launch point)
    const spineMat = new THREE.LineDashedMaterial({ color: 0x3d6e8a, dashSize: 0.3, gapSize: 0.2, opacity: 0.6, transparent: true });
    const spineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 14, 0)]);
    const spine = new THREE.Line(spineGeom, spineMat);
    spine.computeLineDistances();
    scene.add(spine);

    const cam = new THREE.PerspectiveCamera(45, w / h, 0.05, 200);
    cam.position.set(8, 4, 10);
    cam.lookAt(0, 1, 0);

    const group = new THREE.Group();
    scene.add(group);
    const nodeMarkers = new THREE.Group();
    scene.add(nodeMarkers);
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = cam;
    meshGroupRef.current = group;
    nodeMarkerGroupRef.current = nodeMarkers;

    // ---------- camera orbit ----------
    let theta = 0.6;
    let phi = 1.05;
    let radius = 12;
    let target = new THREE.Vector3(0, 1, 0);
    let dragging = false;
    let dragMoved = false;
    let lastX = 0, lastY = 0;
    let dragButton = 0;
    const updateCam = () => {
      const sinP = Math.sin(phi);
      cam.position.set(
        target.x + radius * sinP * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * sinP * Math.sin(theta),
      );
      cam.lookAt(target);
    };
    updateCam();

    const onDown = (e: MouseEvent) => {
      dragging = true;
      dragMoved = false;
      lastX = e.clientX; lastY = e.clientY;
      dragButton = e.button;
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
      }
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
      lastX = e.clientX; lastY = e.clientY;
      // Pan with shift+left or middle button
      const pan = (dragButton === 1) || (dragButton === 0 && e.shiftKey);
      const orbit = (dragButton === 2) || (dragButton === 0 && !e.shiftKey);
      if (pan) {
        const panSpeed = radius * 0.0018;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        cam.getWorldDirection(right);
        right.cross(cam.up).normalize();
        up.copy(cam.up);
        target.addScaledVector(right, -dx * panSpeed);
        target.addScaledVector(up, dy * panSpeed);
      } else if (orbit) {
        theta -= dx * 0.008;
        phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi - dy * 0.008));
      }
      updateCam();
    };
    const onUp = (e: MouseEvent) => {
      const wasDragging = dragging;
      const moved = dragMoved;
      dragging = false;
      // Treat as click only if no significant movement and the LMB
      if (wasDragging && !moved && e.button === 0) {
        handleClick(e);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(2, Math.min(60, radius * (e.deltaY > 0 ? 1.1 : 0.9)));
      updateCam();
    };

    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---------- click handling: pick part or attach node ----------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, cam);

      // If a part TYPE is selected, look for a free attach node first.
      if (selectedPartTypeRef.current) {
        const nodeMeshes: THREE.Object3D[] = nodeMarkers.children.filter((c) => (c.userData as any).nodeRef && !(c.userData as any).nodeRef.occupied);
        const nodeHits = raycaster.intersectObjects(nodeMeshes, false);
        if (nodeHits.length) {
          const nodeRef = (nodeHits[0].object.userData as any).nodeRef as NodeRef;
          attachToNode(nodeRef);
          return;
        }
        // No node hit: place along the spine under the lowest part.
        placeOnSpine();
        return;
      }

      // No part selected for placement → try to pick an existing part to select.
      const partMeshes: THREE.Object3D[] = [];
      for (const o of group.children) collectMeshes(o, partMeshes);
      const hits = raycaster.intersectObjects(partMeshes, false);
      if (hits.length) {
        const inst = (hits[0].object.userData as any).instanceId as string | undefined;
        if (inst) {
          setSelectedInstance(inst);
          return;
        }
      }
      setSelectedInstance(null);
    };

    let rafId = 0;
    const animate = () => {
      renderer.render(scene, cam);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      const W = container.clientWidth, H = container.clientHeight;
      renderer.setSize(W, H);
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    rebuild();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.domElement.removeEventListener('mousedown', onDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedInstance) {
          assemblyRef.current.removePart(selectedInstance);
          setSelectedInstance(null);
          rebuild();
          flashHint('Part removed');
        }
      } else if (e.key === 'Escape') {
        setSelectedPartType(null);
        setSelectedInstance(null);
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) { assemblyRef.current.redo(); rebuild(); flashHint('Redo'); }
        else { assemblyRef.current.undo(); rebuild(); flashHint('Undo'); }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstance]);

  // Refresh node-marker visibility whenever placement type changes
  useEffect(() => {
    refreshNodeMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartType]);

  // Refresh selection highlight whenever it changes
  useEffect(() => {
    refreshSelectionHighlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstance]);

  const flashHint = (msg: string): void => {
    setHint(msg);
    window.setTimeout(() => setHint((h) => (h === msg ? '' : h)), 1600);
  };

  const rebuild = (): void => {
    const group = meshGroupRef.current;
    if (!group) return;
    while (group.children.length) {
      const c = group.children.pop()!;
      group.remove(c);
      disposeObject(c);
    }
    partMeshesRef.current.clear();

    const a = assemblyRef.current;
    for (const inst of a.design.parts) {
      const config = getPart(inst.partId);
      if (!config) continue;
      const mesh = createPartMesh(config);
      mesh.position.set(inst.position.x, inst.position.y, inst.position.z);
      mesh.rotation.set(inst.rotation.x, inst.rotation.y, inst.rotation.z);
      tagWithInstance(mesh, inst.id);
      group.add(mesh);
      partMeshesRef.current.set(inst.id, mesh);
    }

    setDesign({ ...a.design });
    setDeltaV(computeDeltaV(a, 9.81));
    refreshNodeMarkers();
    refreshSelectionHighlight();
  };

  // Compute world-space attach node positions and refresh markers in scene
  const refreshNodeMarkers = (): void => {
    const group = meshGroupRef.current;
    const markers = nodeMarkerGroupRef.current;
    if (!group || !markers) return;
    while (markers.children.length) {
      const c = markers.children.pop()!;
      markers.remove(c);
      disposeObject(c);
    }
    nodeRefsRef.current = [];

    const a = assemblyRef.current;
    const occupied = new Set<string>();
    for (const inst of a.design.parts) {
      if (inst.attachedTo) {
        occupied.add(`${inst.attachedTo.partInstanceId}:${inst.attachedTo.nodeId}`);
        occupied.add(`${inst.id}:${inst.attachedTo.selfNodeId}`);
      }
    }

    for (const inst of a.design.parts) {
      const config = getPart(inst.partId);
      if (!config) continue;
      for (const node of config.attachNodes ?? []) {
        const local = new THREE.Vector3(node.position[0], node.position[1], node.position[2]);
        const world = local.clone().add(new THREE.Vector3(inst.position.x, inst.position.y, inst.position.z));
        const dir = node.direction
          ? new THREE.Vector3(node.direction[0], node.direction[1], node.direction[2]).normalize()
          : new THREE.Vector3(0, 1, 0);
        const isOcc = occupied.has(`${inst.id}:${node.id}`);
        const ref: NodeRef = {
          partInstanceId: inst.id,
          partConfig: config,
          nodeId: node.id,
          worldPosition: world,
          direction: dir,
          occupied: isOcc,
        };
        nodeRefsRef.current.push(ref);

        // Only render markers if the user has a part selected for placement
        if (selectedPartTypeRef.current && !isOcc) {
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0x6dff8a, transparent: true, opacity: 0.9 }),
          );
          m.position.copy(world);
          (m.userData as any).nodeRef = ref;
          markers.add(m);
          // Direction arrow
          const arrow = new THREE.Mesh(
            new THREE.ConeGeometry(0.09, 0.3, 12),
            new THREE.MeshBasicMaterial({ color: 0x6dff8a, transparent: true, opacity: 0.7 }),
          );
          arrow.position.copy(world).addScaledVector(dir, 0.32);
          arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          (arrow.userData as any).nodeRef = ref;
          markers.add(arrow);
        }
      }
    }
  };

  const refreshSelectionHighlight = (): void => {
    const group = meshGroupRef.current;
    if (!group) return;
    for (const inst of assemblyRef.current.design.parts) {
      const mesh = partMeshesRef.current.get(inst.id);
      if (!mesh) continue;
      mesh.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && (m as any).isMeshStandardMaterial) {
          const baseEm = (mesh.userData as any).baseEmissive ?? 0x000000;
          if (selectedInstanceRef.current === inst.id) {
            (m as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xffb347);
            (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
          } else {
            (m as THREE.MeshStandardMaterial).emissive = new THREE.Color(baseEm);
            (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.0;
          }
        }
      });
    }
  };

  // Attach the selected part type to the given node
  const attachToNode = (nodeRef: NodeRef): void => {
    if (!selectedPartTypeRef.current) return;
    const newConfig = getPart(selectedPartTypeRef.current);
    if (!newConfig) return;
    // Find the matching node on the new part: opposite direction preferred.
    const wantDir = nodeRef.direction.clone().multiplyScalar(-1);
    let bestNode = newConfig.attachNodes?.[0];
    let bestDot = -2;
    for (const n of newConfig.attachNodes ?? []) {
      if (!n.direction) continue;
      const d = new THREE.Vector3(n.direction[0], n.direction[1], n.direction[2]).normalize();
      const dot = d.dot(wantDir);
      if (dot > bestDot) { bestDot = dot; bestNode = n; }
    }
    if (!bestNode) {
      flashHint('Part has no attach node');
      return;
    }
    // Compute new part position so its bestNode aligns with nodeRef.worldPosition
    const newNodeOffset = new THREE.Vector3(bestNode.position[0], bestNode.position[1], bestNode.position[2]);
    const newPos = nodeRef.worldPosition.clone().sub(newNodeOffset);

    const inst = assemblyRef.current.addPart(newConfig.id, new Vec3(newPos.x, newPos.y, newPos.z), {
      parent: { partInstanceId: nodeRef.partInstanceId, nodeId: nodeRef.nodeId },
      selfNode: bestNode.id,
    });
    setSelectedInstance(inst.id);
    rebuild();
    flashHint(`Attached ${newConfig.name}`);
  };

  // Place the part along the central spine, below the lowest existing part.
  const placeOnSpine = (): void => {
    if (!selectedPartTypeRef.current) return;
    const cfg = getPart(selectedPartTypeRef.current);
    if (!cfg) return;
    const a = assemblyRef.current;
    const lowest = a.design.parts.length === 0
      ? 0
      : Math.min(...a.design.parts.map((p) => p.position.y));
    const newY = a.design.parts.length === 0 ? 0 : lowest - (cfg.height ?? 1.0);
    const inst = a.addPart(cfg.id, new Vec3(0, newY, 0));
    setSelectedInstance(inst.id);
    rebuild();
    flashHint(`Placed ${cfg.name} on spine`);
  };

  const detachSelected = (): void => {
    if (!selectedInstance) return;
    assemblyRef.current.removePart(selectedInstance);
    setSelectedInstance(null);
    rebuild();
    flashHint('Part removed');
  };

  const undo = () => { assemblyRef.current.undo(); setSelectedInstance(null); rebuild(); flashHint('Undo'); };
  const redo = () => { assemblyRef.current.redo(); setSelectedInstance(null); rebuild(); flashHint('Redo'); };
  const clear = () => {
    assemblyRef.current = new VehicleAssembly({ name: assemblyRef.current.design.name });
    setSelectedInstance(null);
    rebuild();
    flashHint('Cleared');
  };
  const loadStock = (id: string) => {
    const entry = STOCK_DESIGNS.find((d) => d.id === id);
    if (!entry) return;
    assemblyRef.current = entry.build();
    setSelectedInstance(null);
    setSelectedPartType(null);
    rebuild();
    flashHint(`Loaded ${entry.name}`);
  };

  const grouped = useMemo(() => {
    const cats = partsByCategory();
    return Object.entries(cats).map(([cat, parts]) => ({
      cat,
      parts: parts.filter((p) => mode === 'sandbox' || !p.techRequired || unlockedTech.has(p.techRequired)),
    }));
  }, [unlockedTech, mode]);

  const dv = useEditorStore((s) => s.deltaV);
  const design = useEditorStore((s) => s.design);
  const selectedInstanceData: PartInstance | undefined = design?.parts.find((p) => p.id === selectedInstance);
  const selectedConfig = selectedInstanceData ? getPart(selectedInstanceData.partId) : undefined;

  return (
    <div style={root}>
      <div style={partsPanel}>
        <h3 style={panelTitle}>PARTS CATALOGUE</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {grouped.map(({ cat }) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                ...catBtn,
                background: activeCategory === cat ? '#ffb347' : 'rgba(20, 26, 38, 0.85)',
                color: activeCategory === cat ? '#000' : '#cdd6e6',
              }}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {grouped.find((g) => g.cat === activeCategory)?.parts.map((p) => (
            <PartButton
              key={p.id}
              part={p}
              selected={selectedPartType === p.id}
              onClick={() => {
                setSelectedPartType((cur) => (cur === p.id ? null : p.id));
                setSelectedInstance(null);
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ color: '#6e7d99', fontSize: 9, letterSpacing: 2, marginBottom: 2 }}>
            STOCK DESIGNS
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STOCK_DESIGNS.map((d) => (
              <button
                key={d.id}
                style={{ ...vabBtn, textAlign: 'left', padding: '6px 10px' }}
                onClick={() => loadStock(d.id)}
                title={d.description}
              >
                <div style={{ color: '#ffb347', fontSize: 11 }}>{d.name}</div>
                <div style={{ color: '#6e7d99', fontSize: 9, marginTop: 2, lineHeight: 1.3 }}>
                  {d.description}
                </div>
              </button>
            ))}
          </div>
          <button style={vabBtn} onClick={clear}>CLEAR DESIGN</button>
        </div>
      </div>

      <div style={viewport}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: selectedPartType ? 'crosshair' : 'grab' }} />
        <div style={topToolbar}>
          <button style={vabBtn} onClick={onExit}>← BACK</button>
          <span style={{ color: '#9aa9c0', fontFamily: 'monospace', fontSize: 13 }}>{design?.name ?? 'Untitled'}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={vabBtn} onClick={undo} title="Undo (Ctrl+Z)">UNDO</button>
            <button style={vabBtn} onClick={redo} title="Redo (Ctrl+Shift+Z)">REDO</button>
            <SymmetrySelect value={symmetry} onChange={setSymmetry} />
            <button
              style={{ ...vabBtn, opacity: selectedInstance ? 1 : 0.4 }}
              onClick={detachSelected}
              disabled={!selectedInstance}
              title="Delete / Backspace"
            >
              DETACH
            </button>
            <button
              style={{ ...vabBtn, background: '#ffb347', color: '#000', border: '1px solid #ffb347' }}
              onClick={() => onLaunch(assemblyRef.current)}
              disabled={!design || design.parts.length === 0}
            >
              LAUNCH →
            </button>
          </span>
        </div>
        <div style={bottomBar}>
          <span style={{ color: '#6e7d99' }}>
            <kbd style={kbdStyle}>LMB</kbd> rotate · <kbd style={kbdStyle}>Shift+LMB</kbd> / <kbd style={kbdStyle}>MMB</kbd> pan ·
            <kbd style={kbdStyle}>Wheel</kbd> zoom · <kbd style={kbdStyle}>Click</kbd> select · <kbd style={kbdStyle}>Del</kbd> remove
          </span>
          {selectedPartType && (
            <span style={{ color: '#6dff8a', marginLeft: 'auto' }}>
              Placing: {getPart(selectedPartType)?.name ?? selectedPartType} — click a green node or empty space
            </span>
          )}
          {hint && (
            <span style={{ color: '#ffb347', marginLeft: 'auto' }}>{hint}</span>
          )}
        </div>
      </div>

      <div style={infoPanel}>
        <h3 style={panelTitle}>VEHICLE STATS</h3>
        <Stat label="MASS" value={`${design?.totalMass.toFixed(2) ?? '0'} t`} />
        <Stat label="COST" value={`$${design?.totalCost.toLocaleString() ?? '0'}`} />
        <Stat label="PARTS" value={`${design?.parts.length ?? 0}`} />
        <hr style={hr} />
        <Stat label="LIFTOFF TWR (ASL)" value={dv?.liftoffTwrAtm.toFixed(2) ?? '—'} accent={!!dv && dv.liftoffTwrAtm < 1.2} />
        <Stat label="LIFTOFF TWR (VAC)" value={dv?.liftoffTwrVac.toFixed(2) ?? '—'} />
        <Stat label="ΔV TOTAL (ATM)" value={`${dv?.totalAtm.toFixed(0) ?? '0'} m/s`} />
        <Stat label="ΔV TOTAL (VAC)" value={`${dv?.totalVac.toFixed(0) ?? '0'} m/s`} accent />
        <hr style={hr} />
        <h4 style={panelTitle}>STAGES</h4>
        {dv?.stages.map((s, i) => (
          <div key={i} style={stageRow}>
            <span style={{ color: '#ffb347', fontFamily: 'monospace', minWidth: 28 }}>S{s.stage}</span>
            <span style={{ color: '#cdd6e6', fontFamily: 'monospace', flex: 1 }}>
              Δv {s.dvVac.toFixed(0)} | TWR {s.twrAsl.toFixed(2)}
            </span>
            <span style={{ color: '#9aa9c0', fontFamily: 'monospace' }}>{s.burnTime > 0 ? s.burnTime.toFixed(0) + 's' : '-'}</span>
          </div>
        ))}
        {selectedConfig && (
          <>
            <hr style={hr} />
            <h4 style={panelTitle}>SELECTED PART</h4>
            <Stat label="NAME" value={selectedConfig.name} />
            <Stat label="MASS" value={`${selectedConfig.mass.toFixed(3)} t`} />
            <Stat label="COST" value={`$${selectedConfig.cost}`} />
            <Stat label="STAGE" value={`${selectedInstanceData?.stage ?? -1}`} />
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button style={vabBtn} onClick={() => {
                if (!selectedInstance) return;
                const cur = selectedInstanceData?.stage ?? -1;
                assemblyRef.current.setStage(selectedInstance, cur - 1);
                rebuild();
              }}>STAGE −</button>
              <button style={vabBtn} onClick={() => {
                if (!selectedInstance) return;
                const cur = selectedInstanceData?.stage ?? -1;
                assemblyRef.current.setStage(selectedInstance, cur + 1);
                rebuild();
              }}>STAGE +</button>
              <button style={{ ...vabBtn, color: '#ff7755' }} onClick={detachSelected}>DETACH</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function tagWithInstance(obj: THREE.Object3D, instanceId: string): void {
  obj.traverse((o) => {
    (o.userData as any).instanceId = instanceId;
  });
}

function collectMeshes(o: THREE.Object3D, out: THREE.Object3D[]): void {
  if ((o as THREE.Mesh).isMesh) out.push(o);
  for (const c of o.children) collectMeshes(c, out);
}

function disposeObject(c: THREE.Object3D): void {
  c.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}

const PartButton: React.FC<{ part: PartConfig; selected: boolean; onClick: () => void }> = ({ part, selected, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      textAlign: 'left',
      padding: '8px 10px',
      marginBottom: 4,
      background: selected ? 'rgba(255, 179, 71, 0.18)' : 'rgba(255, 255, 255, 0.03)',
      border: '1px solid ' + (selected ? '#ffb347' : '#2a313d'),
      borderRadius: 3,
      color: '#cdd6e6',
      cursor: 'pointer',
      fontSize: 11,
      lineHeight: 1.4,
      fontFamily: 'inherit',
    }}
  >
    <div style={{ fontWeight: 500, color: selected ? '#ffb347' : '#e8edf6' }}>{part.name}</div>
    <div style={{ color: '#6e7d99', marginTop: 2, fontSize: 10 }}>{part.mass.toFixed(2)}t · ${part.cost}</div>
    <div style={{ color: '#5d6a82', marginTop: 2, fontSize: 10 }}>{part.description}</div>
  </button>
);

const SymmetrySelect: React.FC<{ value: number; onChange: (n: 1 | 2 | 3 | 4 | 6 | 8) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[1, 2, 3, 4, 6, 8].map((n) => (
      <button
        key={n}
        onClick={() => onChange(n as 1 | 2 | 3 | 4 | 6 | 8)}
        style={{
          ...vabBtn,
          padding: '6px 8px',
          minWidth: 26,
          background: value === n ? '#ffb347' : 'rgba(20, 26, 38, 0.85)',
          color: value === n ? '#000' : '#cdd6e6',
        }}
      >
        {n}×
      </button>
    ))}
  </div>
);

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div style={{ marginBottom: 6 }}>
    <div style={{ color: '#6e7d99', fontSize: 9, letterSpacing: 1.5 }}>{label}</div>
    <div style={{ color: accent ? '#ffb347' : '#e8edf6', fontFamily: 'monospace', fontSize: 13 }}>{value}</div>
  </div>
);

function createPartMesh(config: PartConfig): THREE.Object3D {
  const group = new THREE.Group();
  const r = config.radius ?? 0.6;
  const h = config.height ?? 1;
  let geom: THREE.BufferGeometry;
  let color = 0xc0c4cc;
  let metalness = 0.5, roughness = 0.45;
  switch (config.category) {
    case 'command':
      geom = new THREE.ConeGeometry(r, h, 24);
      color = 0xc8c8d0; metalness = 0.55; roughness = 0.4;
      break;
    case 'tank':
      geom = new THREE.CylinderGeometry(r, r, h, 32);
      color = 0xe6e6ea; metalness = 0.55; roughness = 0.35;
      break;
    case 'engine': {
      // Bell + nozzle
      const bellGeom = new THREE.ConeGeometry(r * 1.1, h * 0.65, 24, 1, true);
      const nozzleGeom = new THREE.CylinderGeometry(r * 0.6, r * 0.85, h * 0.35, 24);
      const bellMat = new THREE.MeshStandardMaterial({ color: 0xb87a3a, metalness: 0.7, roughness: 0.4 });
      const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.65, roughness: 0.55 });
      const bell = new THREE.Mesh(bellGeom, bellMat);
      bell.position.y = -h * 0.05;
      bell.rotation.x = Math.PI;
      const nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
      nozzle.position.y = h * 0.3;
      group.add(bell);
      group.add(nozzle);
      return group;
    }
    case 'srb':
      geom = new THREE.CylinderGeometry(r, r, h, 24);
      color = 0xd9d9dd; roughness = 0.6;
      break;
    case 'decoupler':
      geom = new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.18, 24);
      color = 0xff7733; metalness = 0.4; roughness = 0.55;
      break;
    case 'parachute':
      geom = new THREE.CylinderGeometry(r, r, 0.35, 16);
      color = 0xb13c3c; metalness = 0.3; roughness = 0.7;
      break;
    case 'fairing':
      geom = new THREE.ConeGeometry(r, h, 24);
      color = 0xf5f1e2; metalness = 0.4; roughness = 0.5;
      break;
    case 'fin':
      geom = new THREE.BoxGeometry(0.6, 0.05, 0.6);
      color = 0x90a0b0; metalness = 0.5; roughness = 0.45;
      break;
    case 'leg':
      geom = new THREE.CylinderGeometry(0.06, 0.1, 0.7, 8);
      color = 0x8090a8; metalness = 0.6; roughness = 0.4;
      break;
    case 'science':
    case 'antenna':
      geom = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      color = 0x4d6a8c;
      break;
    default:
      geom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      color = 0x90a0b0;
  }
  const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  group.add(new THREE.Mesh(geom, mat));
  return group;
}

const root: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  gridTemplateColumns: '260px 1fr 280px',
  gap: 0,
  background: '#04060c',
};

const partsPanel: React.CSSProperties = {
  background: 'rgba(8, 11, 18, 0.95)',
  borderRight: '1px solid #1a2030',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
};

const infoPanel: React.CSSProperties = {
  background: 'rgba(8, 11, 18, 0.95)',
  borderLeft: '1px solid #1a2030',
  padding: 16,
  overflowY: 'auto',
};

const viewport: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(180deg, #0a1226 0%, #04060c 100%)',
};

const topToolbar: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 10,
  background: 'rgba(8, 11, 18, 0.85)',
  borderBottom: '1px solid #1a2030',
};

const bottomBar: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  background: 'rgba(8, 11, 18, 0.85)',
  borderTop: '1px solid #1a2030',
  fontSize: 10,
  fontFamily: 'monospace',
  letterSpacing: 0.5,
};

const kbdStyle: React.CSSProperties = {
  background: '#1a2030',
  border: '1px solid #2a313d',
  borderRadius: 2,
  padding: '0px 4px',
  margin: '0 2px',
  color: '#cdd6e6',
  fontSize: 9,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  marginBottom: 12,
  color: '#ffb347',
  fontSize: 11,
  letterSpacing: 3,
  fontWeight: 500,
};

const vabBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'rgba(20, 26, 38, 0.85)',
  border: '1px solid #2a313d',
  borderRadius: 3,
  color: '#cdd6e6',
  cursor: 'pointer',
  fontSize: 11,
  letterSpacing: 1,
  fontFamily: 'inherit',
};

const catBtn: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 2,
  border: '1px solid #2a313d',
  cursor: 'pointer',
  fontSize: 10,
  letterSpacing: 0.5,
  fontFamily: 'monospace',
};

const hr: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #1a2030',
  margin: '12px 0',
};

const stageRow: React.CSSProperties = {
  display: 'flex',
  fontSize: 11,
  marginBottom: 4,
  alignItems: 'center',
};
