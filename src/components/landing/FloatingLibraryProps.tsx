"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  FloatingBookItem,
  FloatingPaperSheet,
  LibraryGlobe,
  type FloatingSpec,
} from "@/components/shared/FloatingBooks";

const BG_BOOK_COLORS = [
  "#5a2a1d",
  "#1d3b5a",
  "#1f4d3b",
  "#4b2e59",
  "#6b3f19",
  "#1e4650",
  "#68242c",
  "#2c3e50",
];

function makeSilenceSignTexture(heading: string, subheading: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 280;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#182838";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#e0b861";
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

    ctx.fillStyle = "#e0b861";
    const corners: [number, number][] = [
      [42, 42],
      [canvas.width - 42, 42],
      [42, canvas.height - 42],
      [canvas.width - 42, canvas.height - 42],
    ];
    for (const [x, y] of corners) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(canvas.width / 2, 74);
    ctx.strokeStyle = "#f5c842";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.lineTo(14, 14);
    ctx.stroke();
    ctx.fillStyle = "#f5c842";
    ctx.fillRect(-7, -6, 14, 10);
    ctx.restore();

    ctx.fillStyle = "#fbf4df";
    ctx.font = "bold 40px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(heading, canvas.width / 2, 148);

    ctx.fillStyle = "#9fc1e1";
    ctx.font = "bold 19px 'DM Sans', sans-serif";
    ctx.fillText(subheading, canvas.width / 2, 206);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeLibraryCardTexture(memberCode: string, holderName: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#f8f0dc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#1d354d";
    ctx.fillRect(0, 0, canvas.width, 74);
    ctx.fillStyle = "#e0b861";
    ctx.fillRect(0, 74, canvas.width, 5);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px Georgia, serif";
    ctx.textAlign = "left";
    ctx.fillText("ILOILO CITY PUBLIC LIBRARY", 26, 36);
    ctx.fillStyle = "#9fc1e1";
    ctx.font = "bold 13px monospace";
    ctx.fillText("OFFICIAL LIBRARY BORROWER CARD", 26, 58);

    ctx.fillStyle = "#dce6f0";
    ctx.strokeStyle = "#8a9db0";
    ctx.lineWidth = 2;
    ctx.fillRect(26, 98, 92, 106);
    ctx.strokeRect(26, 98, 92, 106);
    ctx.fillStyle = "#365573";
    ctx.beginPath();
    ctx.arc(72, 136, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(72, 196, 32, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#162534";
    ctx.font = "bold 22px Georgia, serif";
    ctx.fillText(holderName, 138, 122);
    ctx.fillStyle = "#486581";
    ctx.font = "bold 15px monospace";
    ctx.fillText(`CARD NO: ${memberCode}`, 138, 150);

    ctx.strokeStyle = "rgba(30, 58, 95, 0.25)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const y = 178 + i * 24;
      ctx.beginPath();
      ctx.moveTo(138, y);
      ctx.lineTo(canvas.width - 28, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(412, 148);
    ctx.rotate(-0.18);
    ctx.strokeStyle = "#169c65";
    ctx.lineWidth = 3;
    ctx.strokeRect(-58, -18, 116, 36);
    ctx.fillStyle = "#169c65";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ACTIVE MEMBER", 0, 0);
    ctx.restore();

    ctx.fillStyle = "#162534";
    let bx = 26;
    for (let i = 0; i < 48; i++) {
      const w = i % 3 === 0 ? 5 : i % 2 === 0 ? 3 : 2;
      ctx.fillRect(bx, 250, w, 46);
      bx += w + (i % 4 === 0 ? 6 : 4);
    }
    ctx.fillStyle = "#486581";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "right";
    ctx.fillText("DR. GRACIANO LOPEZ JAENA LRC", canvas.width - 24, 286);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function BgBookcaseUnit({
  position,
  rotY,
  seed,
}: {
  position: readonly [number, number, number];
  rotY: number;
  seed: number;
}) {
  const shelfBooks = useMemo(() => {
    const shelfYs = [0.78, 1.84, 2.9, 3.96];
    const items: Array<{
      key: string;
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      tiltZ: number;
    }> = [];

    shelfYs.forEach((sy, sIdx) => {
      let cursor = -1.28;
      let idx = 0;
      while (cursor < 1.18) {
        const hash = seed * 31 + sIdx * 13 + idx * 7;
        const w = 0.13 + (hash % 3) * 0.035;
        const h = 0.72 + ((hash * 5) % 4) * 0.05;
        const gap = idx % 5 === 4 ? 0.12 : 0.025;
        items.push({
          key: `${sIdx}-${idx}`,
          x: cursor + w / 2,
          y: sy + 0.05 + h / 2,
          w,
          h,
          color: BG_BOOK_COLORS[hash % BG_BOOK_COLORS.length],
          tiltZ: idx % 7 === 6 ? 0.08 : 0,
        });
        cursor += w + gap;
        idx += 1;
      }
    });
    return items;
  }, [seed]);

  return (
    <group position={[position[0], position[1], position[2]]} rotation={[0, rotY, 0]}>
      {/* Backboard */}
      <mesh position={[0, 2.55, -0.34]} receiveShadow>
        <boxGeometry args={[3.2, 4.7, 0.08]} />
        <meshStandardMaterial color="#25160d" roughness={0.88} />
      </mesh>
      {/* Side Pillars */}
      <mesh position={[-1.56, 2.55, 0]} receiveShadow>
        <boxGeometry args={[0.12, 4.7, 0.72]} />
        <meshStandardMaterial color="#341e12" roughness={0.78} />
      </mesh>
      <mesh position={[1.56, 2.55, 0]} receiveShadow>
        <boxGeometry args={[0.12, 4.7, 0.72]} />
        <meshStandardMaterial color="#341e12" roughness={0.78} />
      </mesh>
      {/* Crown & Plinth Base */}
      <mesh position={[0, 4.88, 0.02]}>
        <boxGeometry args={[3.36, 0.14, 0.78]} />
        <meshStandardMaterial color="#3d2416" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.42, 0.02]} receiveShadow>
        <boxGeometry args={[3.28, 0.42, 0.74]} />
        <meshStandardMaterial color="#2c1a0f" roughness={0.82} />
      </mesh>

      {/* Shelf Boards */}
      {[0.78, 1.84, 2.9, 3.96].map((sy) => (
        <mesh key={sy} position={[0, sy, 0]}>
          <boxGeometry args={[3.04, 0.09, 0.68]} />
          <meshStandardMaterial color="#3d2416" roughness={0.74} />
        </mesh>
      ))}

      {/* Populated Book Spines */}
      {shelfBooks.map((b) => (
        <mesh key={b.key} position={[b.x, b.y, 0.04]} rotation={[0, 0, b.tiltZ]}>
          <boxGeometry args={[b.w, b.h, 0.52]} />
          <meshStandardMaterial color={b.color} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function BackgroundBookshelves() {
  return (
    <group>
      <BgBookcaseUnit position={[-6.0, 0.215, -3.55]} rotY={0.14} seed={1} />
      <BgBookcaseUnit position={[-2.1, 0.215, -4.3]} rotY={0.04} seed={2} />
      <BgBookcaseUnit position={[2.0, 0.215, -4.3]} rotY={-0.04} seed={3} />
      <BgBookcaseUnit position={[5.9, 0.215, -3.55]} rotY={-0.14} seed={4} />
    </group>
  );
}

function SilenceSign({
  spec,
  heading,
  subheading,
  reducedRef,
}: {
  spec: FloatingSpec;
  heading: string;
  subheading: string;
  reducedRef: MutableRefObject<boolean>;
}) {
  const ref = useRef<THREE.Group>(null);
  const signTex = useMemo(() => makeSilenceSignTexture(heading, subheading), [heading, subheading]);
  useEffect(() => () => signTex.dispose(), [signTex]);

  useFrame(({ clock }) => {
    if (!ref.current || reducedRef.current) return;
    const t = clock.elapsedTime + spec.phase;
    const drift = spec.driftAmp ?? 0.05;
    ref.current.position.x = spec.basePos[0] + Math.cos(t * spec.bobSpeed * 0.7) * drift;
    ref.current.position.y = spec.basePos[1] + Math.sin(t * spec.bobSpeed) * spec.bobAmp;
    ref.current.rotation.z = spec.baseRot[2] + Math.sin(t * 0.7) * 0.035;
    ref.current.rotation.y = spec.baseRot[1] + Math.cos(t * 0.55) * 0.05;
  });

  const w = 1.05;
  const h = 0.58;

  return (
    <group
      ref={ref}
      position={[spec.basePos[0], spec.basePos[1], spec.basePos[2]]}
      rotation={[spec.baseRot[0], spec.baseRot[1], spec.baseRot[2]]}
      scale={spec.scale ?? 1}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w + 0.06, h + 0.06, 0.04]} />
        <meshStandardMaterial color="#3b2213" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={signTex} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0, -0.022]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={signTex} roughness={0.45} />
      </mesh>
    </group>
  );
}

function FloatingLibraryCard({
  spec,
  memberCode,
  holderName,
  reducedRef,
}: {
  spec: FloatingSpec;
  memberCode: string;
  holderName: string;
  reducedRef: MutableRefObject<boolean>;
}) {
  const ref = useRef<THREE.Group>(null);
  const tex = useMemo(
    () => makeLibraryCardTexture(memberCode, holderName),
    [memberCode, holderName]
  );
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(({ clock }) => {
    if (!ref.current || reducedRef.current) return;
    const t = clock.elapsedTime + spec.phase;
    const drift = spec.driftAmp ?? 0.05;
    ref.current.position.x = spec.basePos[0] + Math.cos(t * spec.bobSpeed * 0.72) * drift;
    ref.current.position.y = spec.basePos[1] + Math.sin(t * spec.bobSpeed) * spec.bobAmp;
    ref.current.rotation.y = spec.baseRot[1] + Math.sin(t * 0.65) * spec.rotSpeedY;
    ref.current.rotation.z = spec.baseRot[2] + Math.cos(t * 0.5) * 0.05;
  });

  return (
    <group
      ref={ref}
      position={[spec.basePos[0], spec.basePos[1], spec.basePos[2]]}
      rotation={[spec.baseRot[0], spec.baseRot[1], spec.baseRot[2]]}
      scale={spec.scale ?? 1}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.64, 0.4, 0.012]} />
        <meshStandardMaterial color="#e6dec8" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[0.62, 0.38]} />
        <meshStandardMaterial map={tex} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0, -0.008]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.62, 0.38]} />
        <meshStandardMaterial map={tex} roughness={0.45} />
      </mesh>
    </group>
  );
}

export function FloatingLibraryProps({
  reducedRef,
}: {
  reducedRef: MutableRefObject<boolean>;
}) {
  return (
    <group>
      {/* BACKGROUND ARCHITECTURAL BOOKSHELVES */}
      <BackgroundBookshelves />

      {/* 1. GLOBES (Far-left upper & far-right lower, zero clutter) */}
      <LibraryGlobe
        position={[-5.35, 3.25, -0.6]}
        scale={0.7}
        phase={1.4}
        reducedRef={reducedRef}
      />
      <LibraryGlobe
        position={[4.55, 1.55, -0.4]}
        scale={0.68}
        phase={0.3}
        reducedRef={reducedRef}
      />

      {/* 2. SILENCE / QUIET ZONE SIGNS */}
      <SilenceSign
        spec={{
          id: "sign-mid-left",
          basePos: [-1.35, 3.15, -0.4],
          baseRot: [0.04, 0.2, -0.03],
          bobAmp: 0.06,
          bobSpeed: 0.9,
          rotSpeedX: 0.03,
          rotSpeedY: 0.05,
          phase: 0.2,
          scale: 0.7,
        }}
        heading="SILENCE PLEASE"
        subheading="READING & STUDY ZONE"
        reducedRef={reducedRef}
      />
      <SilenceSign
        spec={{
          id: "sign-right",
          basePos: [4.45, 3.25, -0.5],
          baseRot: [0.05, -0.34, -0.04],
          bobAmp: 0.06,
          bobSpeed: 1.0,
          rotSpeedX: 0.04,
          rotSpeedY: 0.05,
          phase: 1.1,
          scale: 0.7,
        }}
        heading="QUIET ZONE"
        subheading="RESPECT FELLOW READERS"
        reducedRef={reducedRef}
      />

      {/* 3. FLOATING OPEN & CLOSED BOOKS */}
      <FloatingBookItem
        spec={{
          id: "float-open-left",
          basePos: [-1.55, 0.95, 0.45],
          baseRot: [0.3, 0.36, -0.14],
          bobAmp: 0.07,
          bobSpeed: 1.05,
          rotSpeedX: 0.06,
          rotSpeedY: 0.1,
          phase: 3.4,
          scale: 0.68,
        }}
        coverColor="#5a2a1d"
        open
        reducedRef={reducedRef}
      />
      <FloatingBookItem
        spec={{
          id: "float-open-right",
          basePos: [3.55, 2.35, 0.25],
          baseRot: [0.32, -0.42, 0.12],
          bobAmp: 0.07,
          bobSpeed: 0.98,
          rotSpeedX: 0.06,
          rotSpeedY: 0.1,
          phase: 2.0,
          scale: 0.68,
        }}
        coverColor="#1d3b5a"
        open
        reducedRef={reducedRef}
      />
      <FloatingBookItem
        spec={{
          id: "float-closed-left",
          basePos: [-3.45, 3.45, -1.1],
          baseRot: [0.26, 0.4, 0.14],
          bobAmp: 0.08,
          bobSpeed: 1.15,
          rotSpeedX: 0.06,
          rotSpeedY: 0.12,
          phase: 1.2,
          scale: 0.72,
        }}
        coverColor="#1f4d3b"
        reducedRef={reducedRef}
      />

      {/* 4. FLOATING LIBRARY BORROWER CARDS */}
      <FloatingLibraryCard
        spec={{
          id: "card-left",
          basePos: [-2.55, 2.05, -0.2],
          baseRot: [0.16, 0.32, -0.12],
          bobAmp: 0.07,
          bobSpeed: 1.15,
          rotSpeedX: 0.04,
          rotSpeedY: 0.1,
          phase: 0.9,
          scale: 0.7,
        }}
        memberCode="ICPL-2026-0142"
        holderName="JUAN DELA CRUZ"
        reducedRef={reducedRef}
      />
      <FloatingLibraryCard
        spec={{
          id: "card-right",
          basePos: [3.55, 0.72, 0.65],
          baseRot: [-0.14, -0.36, 0.14],
          bobAmp: 0.06,
          bobSpeed: 1.08,
          rotSpeedX: 0.04,
          rotSpeedY: 0.1,
          phase: 2.6,
          scale: 0.68,
        }}
        memberCode="ICPL-2026-0891"
        holderName="MARIA CLARA"
        reducedRef={reducedRef}
      />

      {/* 5. FLOATING MANUSCRIPT & ARCHIVAL PAPERS */}
      <FloatingPaperSheet
        spec={{
          id: "paper-left",
          basePos: [-4.85, 1.85, -0.5],
          baseRot: [0.18, 0.38, -0.16],
          bobAmp: 0.07,
          bobSpeed: 1.06,
          rotSpeedX: 0.06,
          rotSpeedY: 0.08,
          phase: 3.1,
          scale: 0.7,
        }}
        docTitle="HERITAGE FOLIO"
        stampText="ILOILO"
        reducedRef={reducedRef}
      />
      <FloatingPaperSheet
        spec={{
          id: "paper-floor",
          basePos: [-3.65, 0.85, 0.35],
          baseRot: [0.32, 0.24, 0.18],
          bobAmp: 0.06,
          bobSpeed: 1.18,
          rotSpeedX: 0.06,
          rotSpeedY: 0.08,
          phase: 4.8,
          scale: 0.65,
        }}
        docTitle="STUDY PASS"
        stampText="QUIET ZONE"
        reducedRef={reducedRef}
      />
      <FloatingPaperSheet
        spec={{
          id: "paper-right",
          basePos: [5.15, 2.35, -0.8],
          baseRot: [-0.18, -0.4, 0.16],
          bobAmp: 0.07,
          bobSpeed: 0.96,
          rotSpeedX: 0.06,
          rotSpeedY: 0.08,
          phase: 1.9,
          scale: 0.72,
        }}
        docTitle="RA 7743 CHARTER"
        stampText="ARCHIVED"
        reducedRef={reducedRef}
      />
    </group>
  );
}
