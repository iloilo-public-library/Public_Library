"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { FloatingLibraryProps } from "@/components/landing/FloatingLibraryProps";

export interface ShelfItem {
  id: string;
  title: string;
  blurb?: string;
}

export interface BookShelfProps {
  items: ShelfItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface BookSpec {
  item: ShelfItem;
  index: number;
  width: number;
  height: number;
  depth: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  color: string;
  accent: string;
}

const BINDING_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#5a2a1d", "#e0b861"],
  ["#1d3b5a", "#9fc1e1"],
  ["#1f4d3b", "#7fd4ae"],
  ["#4b2e59", "#d8b4fe"],
  ["#6b3f19", "#f5c842"],
  ["#1e4650", "#7dd3fc"],
  ["#68242c", "#f3c19d"],
  ["#2c3e50", "#9fc1e1"],
];

function usePrefersReducedMotion(): React.MutableRefObject<boolean> {
  const reducedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reducedRef;
}

function makeSpineTexture(
  title: string,
  index: number,
  bgColor: string,
  accentColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle leather grain
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }

    // Gold spine bands
    ctx.fillStyle = accentColor;
    ctx.fillRect(16, 44, canvas.width - 32, 6);
    ctx.fillRect(16, 62, canvas.width - 32, 2);
    ctx.fillRect(16, canvas.height - 64, canvas.width - 32, 2);
    ctx.fillRect(16, canvas.height - 48, canvas.width - 32, 6);

    // Volume index at bottom
    ctx.font = "bold 24px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1).padStart(2, "0"), canvas.width / 2, canvas.height - 102);

    // Vertical spine title
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 - 16);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#f7eed8";
    ctx.font = "bold 28px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const displayTitle = title.length > 22 ? `${title.slice(0, 21)}…` : title;
    ctx.fillText(displayTitle, 0, 0);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeCoverTexture(
  title: string,
  index: number,
  bgColor: string,
  accentColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 716;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
    ctx.lineWidth = 2;
    ctx.strokeRect(46, 46, canvas.width - 92, canvas.height - 92);

    ctx.fillStyle = accentColor;
    ctx.textAlign = "center";
    ctx.font = "bold 22px Georgia, serif";
    ctx.fillText(`VOLUME ${String(index + 1).padStart(2, "0")}`, canvas.width / 2, 130);

    // Wrap title nicely across lines
    ctx.fillStyle = "#f8f1df";
    ctx.font = "bold 44px Georgia, serif";
    const words = title.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width > canvas.width - 140) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) lines.push(currentLine);

    const startY = 300 - ((lines.length - 1) * 54) / 2;
    lines.forEach((line, idx) => {
      ctx.fillText(line, canvas.width / 2, startY + idx * 54);
    });

    ctx.fillStyle = accentColor;
    ctx.font = "italic 22px Georgia, serif";
    ctx.fillText("Iloilo City Public Library", canvas.width / 2, canvas.height - 108);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeWoodFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#3a2214";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rows = 4;
    const cols = 2;
    const tileH = canvas.height / rows;
    const tileW = canvas.width / cols;
    const shades = ["#4b2d1b", "#573621", "#422717", "#613d26"];

    for (let r = 0; r < rows; r++) {
      const stagger = (r % 2) * (tileW / 2);
      for (let c = -1; c <= cols; c++) {
        const x = c * tileW + stagger;
        const y = r * tileH;
        const shade = shades[(r * 3 + Math.abs(c)) % shades.length];

        ctx.fillStyle = shade;
        ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);

        // Wood grain streaks
        for (let g = 0; g < 18; g++) {
          const gy = y + 6 + ((g * 7) % (tileH - 12));
          ctx.fillStyle = g % 2 === 0 ? "rgba(0,0,0,0.12)" : "rgba(255,215,170,0.06)";
          ctx.fillRect(x + 4, gy, tileW - 8, 2);
        }

        // Subtle plank joint bevel
        ctx.strokeStyle = "rgba(15, 8, 4, 0.72)";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, tileW - 3, tileH - 3);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 5);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

interface ShelfBookProps {
  spec: BookSpec;
  isSelected: boolean;
  isHovered: boolean;
  reducedRef: React.MutableRefObject<boolean>;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

function ShelfBook({
  spec,
  isSelected,
  isHovered,
  reducedRef,
  onHover,
  onSelect,
}: ShelfBookProps) {
  const groupRef = useRef<THREE.Group>(null);

  const assets = useMemo(() => {
    const geometry = new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
    const spineTex = makeSpineTexture(spec.item.title, spec.index, spec.color, spec.accent);
    const coverTex = makeCoverTexture(spec.item.title, spec.index, spec.color, spec.accent);

    const leatherMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.7 });
    const pageMat = new THREE.MeshStandardMaterial({ color: "#efe4ca", roughness: 0.9 });
    const spineMat = new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.55 });
    const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.55 });

    // BoxGeometry faces: [+X cover, -X pages, +Y top pages, -Y bottom pages, +Z spine, -Z back]
    const materials = [coverMat, pageMat, pageMat, pageMat, spineMat, leatherMat];

    return {
      geometry,
      materials,
      dispose: () => {
        geometry.dispose();
        materials.forEach((m) => m.dispose());
        spineTex.dispose();
        coverTex.dispose();
      },
    };
  }, [spec]);

  useEffect(() => {
    return () => assets.dispose();
  }, [assets]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const factor = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    const nudge = isHovered && !reducedRef.current;

    const targetX = isSelected ? -0.15 : spec.baseX;
    const targetY = isSelected ? 2.18 : spec.baseY + (nudge ? 0.04 : 0);
    const targetZ = isSelected ? 2.05 : spec.baseZ + (nudge ? 0.3 : 0);
    const targetRotY = isSelected ? -0.62 : 0;
    const targetRotX = isSelected ? -0.06 : 0;
    const targetScale = isSelected ? 1.18 : 1;

    g.position.x = THREE.MathUtils.lerp(g.position.x, targetX, factor);
    g.position.y = THREE.MathUtils.lerp(g.position.y, targetY, factor);
    g.position.z = THREE.MathUtils.lerp(g.position.z, targetZ, factor);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRotY, factor);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetRotX, factor);
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetScale, factor));
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(isSelected ? null : spec.item.id);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(spec.item.id);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(null);
  };

  return (
    <group
      ref={groupRef}
      position={[spec.baseX, spec.baseY, spec.baseZ]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh
        geometry={assets.geometry}
        material={assets.materials}
        castShadow
        receiveShadow
      />
    </group>
  );
}

export default function BookShelf({ items, selectedId, onSelect }: BookShelfProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const reducedRef = usePrefersReducedMotion();
  const { size, pointer } = useThree();
  const rootGroupRef = useRef<THREE.Group>(null);
  const floorTex = useMemo(() => makeWoodFloorTexture(), []);

  useEffect(() => () => floorTex.dispose(), [floorTex]);

  useEffect(() => {
    document.body.style.cursor = hoveredId ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hoveredId]);

  const cappedItems = useMemo(() => items.slice(0, 12), [items]);

  const specs = useMemo<BookSpec[]>(() => {
    const count = cappedItems.length;
    const topCount = Math.ceil(count / 2);
    const bottomCount = Math.max(0, count - topCount);

    const buildRow = (rowItems: ShelfItem[], rowIndex: number, shelfBottomY: number, offsetIdx: number) => {
      const gap = 0.06;
      const widths = rowItems.map((_, idx) => 0.31 + (((offsetIdx + idx) * 7) % 4) * 0.025);
      const totalW = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, rowItems.length - 1) * gap;
      let cursorX = -totalW / 2;

      return rowItems.map((item, idx) => {
        const globalIdx = offsetIdx + idx;
        const w = widths[idx];
        const h = 1.06 + ((globalIdx * 5) % 4) * 0.045;
        const d = 0.84;
        const x = cursorX + w / 2;
        cursorX += w + gap;

        const [color, accent] = BINDING_PALETTE[globalIdx % BINDING_PALETTE.length];

        return {
          item,
          index: globalIdx,
          width: w,
          height: h,
          depth: d,
          baseX: x,
          baseY: shelfBottomY + h / 2,
          baseZ: 0.08,
          color,
          accent,
        };
      });
    };

    const topRow = buildRow(cappedItems.slice(0, topCount), 0, 2.52, 0);
    const bottomRow =
      bottomCount > 0 ? buildRow(cappedItems.slice(topCount), 1, 1.02, topCount) : [];

    return [...topRow, ...bottomRow];
  }, [cappedItems]);

  // Offset bookcase to the right on desktop so left hero headline stays clear
  const desktopOffsetX = size.width >= 768 ? 1.35 : 0;

  useFrame(({ camera }, delta) => {
    const isReduced = reducedRef.current;
    const targetCamX = isReduced ? 0 : pointer.x * 0.45;
    const targetCamY = isReduced ? 2.7 : 2.7 + pointer.y * 0.22;
    const targetCamZ = 8.2;

    if (isReduced) {
      camera.position.set(0, 2.7, 8.2);
    } else {
      const factor = 1 - Math.exp(-5 * Math.min(delta, 0.05));
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, factor);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, factor);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, factor);
    }
    camera.lookAt(0, 2.1, 0);

    if (rootGroupRef.current) {
      rootGroupRef.current.position.x = THREE.MathUtils.lerp(
        rootGroupRef.current.position.x,
        desktopOffsetX,
        0.12
      );
    }
  });

  return (
    <>
      <fog attach="fog" args={["#152332", 11.5, 22]} />
      <hemisphereLight args={[0xc8e0f5, 0x182434, 0.95]} />
      <directionalLight
        color={0xffe0b2}
        intensity={1.45}
        position={[5, 8, 6]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-4}
      />
      <directionalLight color={0x8bb8e8} intensity={0.75} position={[-5, 4, -4]} />
      <pointLight color={0xffcb80} intensity={1.6} distance={12} position={[1.2, 3.8, 2.8]} />

      {/* Wooden Library Parquet Floor Tile */}
      <mesh
        position={[0, 0.215, -1.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial
          map={floorTex}
          roughness={0.62}
          metalness={0.05}
        />
      </mesh>

      <group ref={rootGroupRef} position={[desktopOffsetX, 0, 0]}>
        {/* Wooden Bookcase Frame */}
        <group>
          {/* Backboard */}
          <mesh position={[0, 2.35, -0.45]} receiveShadow castShadow>
            <boxGeometry args={[3.8, 3.55, 0.12]} />
            <meshStandardMaterial color="#352014" roughness={0.8} />
          </mesh>

          {/* Left & Right Pillars */}
          <mesh position={[-1.84, 2.35, 0.05]} receiveShadow castShadow>
            <boxGeometry args={[0.14, 3.55, 1.05]} />
            <meshStandardMaterial color="#4a2c1a" roughness={0.7} />
          </mesh>
          <mesh position={[1.84, 2.35, 0.05]} receiveShadow castShadow>
            <boxGeometry args={[0.14, 3.55, 1.05]} />
            <meshStandardMaterial color="#4a2c1a" roughness={0.7} />
          </mesh>

          {/* Crown / Top Trim */}
          <mesh position={[0, 4.12, 0.08]} receiveShadow castShadow>
            <boxGeometry args={[4.02, 0.16, 1.15]} />
            <meshStandardMaterial color="#583420" roughness={0.65} />
          </mesh>

          {/* Top Shelf */}
          <mesh position={[0, 2.46, 0.05]} receiveShadow castShadow>
            <boxGeometry args={[3.6, 0.12, 1.02]} />
            <meshStandardMaterial color="#583420" roughness={0.65} />
          </mesh>

          {/* Bottom Shelf */}
          <mesh position={[0, 0.96, 0.05]} receiveShadow castShadow>
            <boxGeometry args={[3.6, 0.14, 1.04]} />
            <meshStandardMaterial color="#583420" roughness={0.65} />
          </mesh>

          {/* Base Plinth */}
          <mesh position={[0, 0.56, 0.04]} receiveShadow castShadow>
            <boxGeometry args={[3.88, 0.68, 1.06]} />
            <meshStandardMaterial color="#3c2315" roughness={0.75} />
          </mesh>

          {/* Gold Inlay Accent Bar */}
          <mesh position={[0, 4.02, 0.66]}>
            <boxGeometry args={[3.5, 0.025, 0.02]} />
            <meshStandardMaterial color="#d4a94f" roughness={0.35} metalness={0.5} />
          </mesh>
        </group>

        {/* Interactive Books */}
        {specs.map((spec) => (
          <ShelfBook
            key={spec.item.id}
            spec={spec}
            isSelected={selectedId === spec.item.id}
            isHovered={hoveredId === spec.item.id}
            reducedRef={reducedRef}
            onHover={setHoveredId}
            onSelect={onSelect}
          />
        ))}
      </group>

      {/* Spread Floating Library Background Props in World Space */}
      <FloatingLibraryProps reducedRef={reducedRef} />
    </>
  );
}
