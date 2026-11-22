"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface FloatingSpec {
  id: string;
  basePos: readonly [number, number, number];
  baseRot: readonly [number, number, number];
  bobAmp: number;
  bobSpeed: number;
  driftAmp?: number;
  rotSpeedX: number;
  rotSpeedY: number;
  phase: number;
  scale?: number;
}

function makeGlobeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
    ocean.addColorStop(0, "#12304a");
    ocean.addColorStop(0.5, "#1c4a6b");
    ocean.addColorStop(1, "#12304a");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(224, 184, 97, 0.28)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= canvas.width; x += canvas.width / 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += canvas.height / 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(245, 200, 66, 0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    ctx.fillStyle = "#c9b382";
    ctx.strokeStyle = "#8a6d3b";
    ctx.lineWidth = 2;

    const continents: Array<[number, number, number, number, number]> = [
      [215, 145, 78, 52, -0.3],
      [260, 215, 42, 34, 0.2],
      [295, 325, 55, 82, 0.15],
      [535, 130, 68, 42, 0.1],
      [540, 265, 58, 76, 0.05],
      [710, 145, 135, 68, -0.05],
      [815, 240, 26, 20, 0.3],
      [845, 232, 10, 26, 0.1],
      [865, 345, 52, 34, -0.2],
    ];

    for (const [cx, cy, rx, ry, rot] of continents) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = "#f5c842";
    ctx.beginPath();
    ctx.arc(845, 234, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function makePaperTexture(docTitle: string, stampText: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#f9f3e3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(180, 60, 60, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(52, 0);
    ctx.lineTo(52, canvas.height);
    ctx.stroke();

    ctx.fillStyle = "#1e3a57";
    ctx.font = "bold 20px Georgia, serif";
    ctx.fillText(docTitle, 68, 56);

    ctx.fillStyle = "rgba(35, 50, 68, 0.58)";
    for (let row = 0; row < 12; row++) {
      const y = 94 + row * 30;
      const lineW = row % 4 === 3 ? 185 : 260 - ((row * 17) % 35);
      ctx.fillRect(68, y, lineW, 4);
      ctx.fillStyle = "rgba(100, 140, 180, 0.16)";
      ctx.fillRect(68, y + 12, canvas.width - 96, 1);
      ctx.fillStyle = "rgba(35, 50, 68, 0.58)";
    }

    ctx.save();
    ctx.translate(275, 420);
    ctx.rotate(-0.16);
    ctx.strokeStyle = "#b83c3c";
    ctx.lineWidth = 3;
    ctx.strokeRect(-72, -18, 144, 36);
    ctx.fillStyle = "#b83c3c";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stampText, 0, 0);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function LibraryGlobe({
  position,
  scale = 1,
  phase = 0,
  reducedRef,
}: {
  position: readonly [number, number, number];
  scale?: number;
  phase?: number;
  reducedRef: MutableRefObject<boolean>;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  const tex = useMemo(() => makeGlobeTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(({ clock }, delta) => {
    if (reducedRef.current) return;
    if (sphereRef.current) {
      sphereRef.current.rotation.y += Math.min(delta, 0.05) * 0.45;
    }
    if (rootRef.current) {
      const t = clock.elapsedTime + phase;
      rootRef.current.position.x = position[0] + Math.cos(t * 0.65) * 0.06;
      rootRef.current.position.y = position[1] + Math.sin(t * 1.1) * 0.08;
      rootRef.current.rotation.y = Math.sin(t * 0.5) * 0.12;
    }
  });

  return (
    <group ref={rootRef} position={[position[0], position[1], position[2]]} scale={scale}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.28, 0.1, 24]} />
        <meshStandardMaterial color="#422616" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.09, 0.16, 16]} />
        <meshStandardMaterial color="#d4a94f" metalness={0.65} roughness={0.3} />
      </mesh>

      <group position={[0, 0.62, 0]} rotation={[0, 0, -0.36]}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <torusGeometry args={[0.42, 0.022, 12, 48, Math.PI]} />
          <meshStandardMaterial color="#d4a94f" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.015, 0.015, 0.9, 10]} />
          <meshStandardMaterial color="#d4a94f" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh ref={sphereRef} castShadow receiveShadow>
          <sphereGeometry args={[0.37, 36, 28]} />
          <meshStandardMaterial map={tex} roughness={0.42} metalness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

export function FloatingBookItem({
  spec,
  coverColor,
  open,
  reducedRef,
}: {
  spec: FloatingSpec;
  coverColor: string;
  open?: boolean;
  reducedRef: MutableRefObject<boolean>;
}) {
  const ref = useRef<THREE.Group>(null);
  const pageTex = useMemo(() => makePaperTexture("OPEN CATALOG", "FOLIO"), []);
  useEffect(() => () => pageTex.dispose(), [pageTex]);

  useFrame(({ clock }) => {
    if (!ref.current || reducedRef.current) return;
    const t = clock.elapsedTime + spec.phase;
    const drift = spec.driftAmp ?? 0.06;
    ref.current.position.x = spec.basePos[0] + Math.cos(t * spec.bobSpeed * 0.65) * drift;
    ref.current.position.y = spec.basePos[1] + Math.sin(t * spec.bobSpeed) * spec.bobAmp;
    ref.current.rotation.x = spec.baseRot[0] + Math.sin(t * 0.7) * spec.rotSpeedX;
    ref.current.rotation.y = spec.baseRot[1] + Math.cos(t * 0.6) * spec.rotSpeedY;
  });

  if (open) {
    return (
      <group
        ref={ref}
        position={[spec.basePos[0], spec.basePos[1], spec.basePos[2]]}
        rotation={[spec.baseRot[0], spec.baseRot[1], spec.baseRot[2]]}
        scale={spec.scale ?? 1}
      >
        <group position={[-0.22, 0, 0]} rotation={[0, 0, 0.28]}>
          <mesh castShadow>
            <boxGeometry args={[0.44, 0.025, 0.58]} />
            <meshStandardMaterial color={coverColor} roughness={0.65} />
          </mesh>
          <mesh position={[0.01, 0.035, 0]} castShadow>
            <boxGeometry args={[0.4, 0.045, 0.54]} />
            <meshStandardMaterial map={pageTex} color="#f8efd9" roughness={0.85} />
          </mesh>
        </group>
        <group position={[0.22, 0, 0]} rotation={[0, 0, -0.28]}>
          <mesh castShadow>
            <boxGeometry args={[0.44, 0.025, 0.58]} />
            <meshStandardMaterial color={coverColor} roughness={0.65} />
          </mesh>
          <mesh position={[-0.01, 0.035, 0]} castShadow>
            <boxGeometry args={[0.4, 0.045, 0.54]} />
            <meshStandardMaterial map={pageTex} color="#f8efd9" roughness={0.85} />
          </mesh>
        </group>
        <mesh position={[0, -0.055, 0]}>
          <boxGeometry args={[0.06, 0.03, 0.58]} />
          <meshStandardMaterial color="#d4a94f" metalness={0.5} roughness={0.35} />
        </mesh>
      </group>
    );
  }

  return (
    <group
      ref={ref}
      position={[spec.basePos[0], spec.basePos[1], spec.basePos[2]]}
      rotation={[spec.baseRot[0], spec.baseRot[1], spec.baseRot[2]]}
      scale={spec.scale ?? 1}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.14, 0.62]} />
        <meshStandardMaterial color={coverColor} roughness={0.62} />
      </mesh>
      <mesh position={[0.02, 0, 0]}>
        <boxGeometry args={[0.43, 0.1, 0.58]} />
        <meshStandardMaterial color="#f2e6ca" roughness={0.88} />
      </mesh>
      <mesh position={[-0.22, 0, 0]}>
        <boxGeometry args={[0.03, 0.142, 0.5]} />
        <meshStandardMaterial color="#e0b861" metalness={0.55} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function FloatingPaperSheet({
  spec,
  docTitle,
  stampText,
  reducedRef,
}: {
  spec: FloatingSpec;
  docTitle: string;
  stampText: string;
  reducedRef: MutableRefObject<boolean>;
}) {
  const ref = useRef<THREE.Group>(null);
  const tex = useMemo(() => makePaperTexture(docTitle, stampText), [docTitle, stampText]);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(({ clock }) => {
    if (!ref.current || reducedRef.current) return;
    const t = clock.elapsedTime + spec.phase;
    const drift = spec.driftAmp ?? 0.06;
    ref.current.position.x = spec.basePos[0] + Math.cos(t * spec.bobSpeed * 0.75) * drift;
    ref.current.position.y = spec.basePos[1] + Math.sin(t * spec.bobSpeed) * spec.bobAmp;
    ref.current.rotation.x = spec.baseRot[0] + Math.sin(t * 0.8) * spec.rotSpeedX;
    ref.current.rotation.z = spec.baseRot[2] + Math.cos(t * 0.7) * 0.06;
  });

  return (
    <group
      ref={ref}
      position={[spec.basePos[0], spec.basePos[1], spec.basePos[2]]}
      rotation={[spec.baseRot[0], spec.baseRot[1], spec.baseRot[2]]}
      scale={spec.scale ?? 1}
    >
      <mesh castShadow>
        <planeGeometry args={[0.38, 0.5]} />
        <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
    </group>
  );
}
