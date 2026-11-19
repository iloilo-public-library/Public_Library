"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { FloatingLibraryProps } from "@/components/landing/FloatingLibraryProps";

export interface TableItem {
  id: string;
  title: string;
  blurb: string;
}

export interface EnchantTableProps {
  items: TableItem[];
  spread: number;
  onSpreadChange: (n: number) => void;
}

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

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  options?: { repeatX?: number; repeatY?: number }
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  if (options?.repeatX && options?.repeatY) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(options.repeatX, options.repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function drawBookPageBase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  isLeftSide: boolean
) {
  ctx.fillStyle = "#f4ebd6";
  ctx.fillRect(0, 0, w, h);

  // Inner spine crease shadow
  const grad = ctx.createLinearGradient(
    isLeftSide ? w : 0,
    0,
    isLeftSide ? w - 95 : 95,
    0
  );
  grad.addColorStop(0, "rgba(75, 48, 28, 0.34)");
  grad.addColorStop(1, "rgba(75, 48, 28, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Classic printed margin rules
  const leftEdge = isLeftSide ? 36 : 58;
  const frameW = w - 94;
  ctx.strokeStyle = "rgba(120, 88, 52, 0.38)";
  ctx.lineWidth = 2;
  ctx.strokeRect(leftEdge, 36, frameW, h - 72);
  ctx.lineWidth = 1;
  ctx.strokeRect(leftEdge + 6, 42, frameW - 12, h - 84);

  // Running library header
  const cx = w / 2 + (isLeftSide ? -11 : 11);
  ctx.fillStyle = "rgba(92, 66, 38, 0.65)";
  ctx.font = "600 13px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("ILOILO CITY PUBLIC LIBRARY", cx, 68);

  ctx.strokeStyle = "rgba(120, 88, 52, 0.25)";
  ctx.beginPath();
  ctx.moveTo(cx - 120, 80);
  ctx.lineTo(cx + 120, 80);
  ctx.stroke();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
) {
  let line = "";
  let y = startY;
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
  }
}

function makeTitlePageTexture(
  title: string,
  spreadIndex: number,
  isLeftSide: boolean
): THREE.CanvasTexture {
  return makeCanvasTexture(512, 716, (ctx, w, h) => {
    drawBookPageBase(ctx, w, h, isLeftSide);
    const cx = w / 2 + (isLeftSide ? -11 : 11);

    ctx.textAlign = "center";
    ctx.fillStyle = "#6e4b27";
    ctx.font = "bold 16px Georgia, serif";
    ctx.fillText(`SECTION ${String(spreadIndex + 1).padStart(2, "0")}`, cx, 195);

    // Simple engraved diamond separator
    ctx.fillStyle = "#8a6234";
    ctx.beginPath();
    ctx.moveTo(cx, 224);
    ctx.lineTo(cx + 10, 236);
    ctx.lineTo(cx, 248);
    ctx.lineTo(cx - 10, 236);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1d2c3b";
    ctx.font = "bold 46px Georgia, serif";
    wrapCanvasText(ctx, title, cx, 326, 330, 56);

    // Ruled separator
    ctx.strokeStyle = "rgba(120, 88, 52, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 80, 520);
    ctx.lineTo(cx + 80, 520);
    ctx.stroke();

    ctx.fillStyle = "rgba(45, 58, 72, 0.72)";
    ctx.font = "italic 16px Georgia, serif";
    ctx.fillText("Library Visitor Guide", cx, 550);

    ctx.fillStyle = "rgba(58, 42, 24, 0.65)";
    ctx.font = "15px Georgia, serif";
    ctx.fillText(String(spreadIndex * 2 + 1), cx, h - 54);
  });
}

function makeBlurbPageTexture(
  blurb: string,
  spreadIndex: number,
  isLeftSide: boolean
): THREE.CanvasTexture {
  return makeCanvasTexture(512, 716, (ctx, w, h) => {
    drawBookPageBase(ctx, w, h, isLeftSide);
    const cx = w / 2 + (isLeftSide ? -11 : 11);

    ctx.textAlign = "center";
    ctx.fillStyle = "#1f2e3d";
    ctx.font = "28px Georgia, serif";
    wrapCanvasText(ctx, blurb, cx, 235, 330, 44);

    // Subtle printed typesetting lines below blurb
    ctx.fillStyle = "rgba(62, 52, 38, 0.16)";
    for (let r = 0; r < 3; r++) {
      const y = 470 + r * 30;
      const lineW = r === 2 ? 190 : 250;
      ctx.fillRect(cx - lineW / 2, y, lineW, 3);
    }

    ctx.fillStyle = "rgba(58, 42, 24, 0.65)";
    ctx.font = "15px Georgia, serif";
    ctx.fillText(String(spreadIndex * 2 + 2), cx, h - 54);
  });
}

function makeWoodFloorTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = "#311c10";
      ctx.fillRect(0, 0, w, h);

      const rows = 4;
      const cols = 2;
      const tileH = h / rows;
      const tileW = w / cols;
      const shades = ["#422616", "#4d2d1b", "#392012", "#553420"];

      for (let r = 0; r < rows; r++) {
        const stagger = (r % 2) * (tileW / 2);
        for (let c = -1; c <= cols; c++) {
          const x = c * tileW + stagger;
          const y = r * tileH;
          ctx.fillStyle = shades[(r * 3 + Math.abs(c)) % shades.length];
          ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);

          for (let g = 0; g < 16; g++) {
            const gy = y + 6 + ((g * 7) % (tileH - 12));
            ctx.fillStyle = g % 2 === 0 ? "rgba(0,0,0,0.14)" : "rgba(255,215,170,0.05)";
            ctx.fillRect(x + 4, gy, tileW - 8, 2);
          }

          ctx.strokeStyle = "rgba(10, 6, 3, 0.78)";
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 1.5, y + 1.5, tileW - 3, tileH - 3);
        }
      }
    },
    { repeatX: 7, repeatY: 5 }
  );
}

function makeTableWoodTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#522f1c";
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 64; i++) {
      const y = (i / 64) * h;
      ctx.fillStyle =
        i % 3 === 0
          ? "rgba(28, 12, 4, 0.25)"
          : i % 2 === 0
            ? "rgba(180, 118, 72, 0.14)"
            : "rgba(90, 50, 26, 0.2)";
      ctx.fillRect(0, y, w, 4 + (i % 5));
    }

    ctx.strokeStyle = "rgba(212, 169, 79, 0.65)";
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, w - 36, h - 36);
  });
}

function makeDeskRunnerTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(512, 320, (ctx, w, h) => {
    ctx.fillStyle = "#7a1929";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#d4a94f";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    for (let i = 0; i < 900; i += 3) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.08)" : "rgba(255,215,150,0.04)";
      ctx.fillRect((i * 19) % w, (i * 29) % h, 3, 2);
    }
  });
}

export function TableCameraRig() {
  const reducedRef = usePrefersReducedMotion();
  const { size, pointer } = useThree();

  useFrame(({ camera }, delta) => {
    const aspect = size.width / Math.max(size.height, 1);
    const reduced = reducedRef.current;
    const targetX = reduced ? 0 : pointer.x * 0.35;
    const targetY = reduced ? 2.9 : 2.9 + pointer.y * 0.18;
    const targetZ = Math.max(7.4, 9 / aspect);

    if (reduced) {
      camera.position.set(0, 2.9, targetZ);
    } else {
      const factor = 1 - Math.exp(-5.5 * Math.min(delta, 0.05));
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, factor);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, factor);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, factor);
    }
    camera.lookAt(0, 1.55, 0);
  });

  return null;
}

export default function EnchantTable({
  items,
  spread,
  onSpreadChange,
}: EnchantTableProps) {
  const reducedRef = usePrefersReducedMotion();
  const { size } = useThree();
  const [hoveredBook, setHoveredBook] = useState(false);

  const stageGroupRef = useRef<THREE.Group>(null);
  const bookRef = useRef<THREE.Group>(null);
  const leafRefs = useRef<(THREE.Group | null)[]>([]);
  const curSpreadRef = useRef(spread);

  const count = Math.max(1, items.length);
  const maxSpread = count - 1;
  const clampedSpread = Math.max(0, Math.min(maxSpread, spread));

  useEffect(() => {
    document.body.style.cursor = hoveredBook ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hoveredBook]);

  const W = 1.36;
  const H = 1.82;
  const PX = (W - 0.08) / 2 + 0.02;

  const sceneAssets = useMemo(() => {
    const floorTex = makeWoodFloorTexture();
    const tableWoodTex = makeTableWoodTexture();
    const runnerTex = makeDeskRunnerTexture();

    const staticLeftTex = makeTitlePageTexture(
      items[0]?.title ?? "Library Offerings",
      0,
      true
    );
    const staticRightTex = makeBlurbPageTexture(
      items[maxSpread]?.blurb ?? "",
      maxSpread,
      false
    );

    const leaves = Array.from({ length: maxSpread }, (_, i) => ({
      frontTex: makeBlurbPageTexture(items[i]?.blurb ?? "", i, false),
      backTex: makeTitlePageTexture(
        items[i + 1]?.title ?? `Section ${i + 2}`,
        i + 1,
        true
      ),
    }));

    const pageGeo = new THREE.PlaneGeometry(W - 0.08, H - 0.1);

    const makePageMaterial = (tex: THREE.CanvasTexture) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.9,
      });

    const staticLeftMat = makePageMaterial(staticLeftTex);
    const staticRightMat = makePageMaterial(staticRightTex);
    const leafMaterials = leaves.map((leaf) => ({
      frontMat: makePageMaterial(leaf.frontTex),
      backMat: makePageMaterial(leaf.backTex),
    }));

    return {
      floorTex,
      tableWoodTex,
      runnerTex,
      pageGeo,
      staticLeftTex,
      staticRightTex,
      staticLeftMat,
      staticRightMat,
      leaves,
      leafMaterials,
      dispose: () => {
        floorTex.dispose();
        tableWoodTex.dispose();
        runnerTex.dispose();
        pageGeo.dispose();
        staticLeftTex.dispose();
        staticRightTex.dispose();
        staticLeftMat.dispose();
        staticRightMat.dispose();
        leaves.forEach((l) => {
          l.frontTex.dispose();
          l.backTex.dispose();
        });
        leafMaterials.forEach((m) => {
          m.frontMat.dispose();
          m.backMat.dispose();
        });
      },
    };
  }, [items, maxSpread]);

  useEffect(() => () => sceneAssets.dispose(), [sceneAssets]);

  const desktopOffsetX = size.width >= 768 ? 1.3 : 0;

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const reduced = reducedRef.current;

    if (stageGroupRef.current) {
      stageGroupRef.current.position.x = THREE.MathUtils.lerp(
        stageGroupRef.current.position.x,
        desktopOffsetX,
        0.12
      );
    }

    const rate = reduced ? 1000 : 4.5;
    curSpreadRef.current +=
      (clampedSpread - curSpreadRef.current) * (1 - Math.exp(-rate * dt));

    const cur = curSpreadRef.current;
    for (let i = 0; i < maxSpread; i++) {
      const leaf = leafRefs.current[i];
      if (!leaf) continue;
      const frac = smoothstep(0, 1, cur - i);
      leaf.rotation.y = -Math.PI * frac;
      leaf.position.z =
        0.02 + (maxSpread - 1 - i) * 0.01 * (1 - frac) + i * 0.01 * frac;
    }
  });

  const handleBookClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const book = bookRef.current;
    if (!book) return;
    const localPt = book.worldToLocal(e.point.clone());
    const delta = localPt.x > 0 ? 1 : -1;
    const next = Math.max(0, Math.min(maxSpread, clampedSpread + delta));
    onSpreadChange(next);
  };

  return (
    <>
      <fog attach="fog" args={["#14202e", 11.5, 24]} />

      {/* Warm Library Reading Room Lighting */}
      <hemisphereLight args={[0xdbe9f6, 0x1a2432, 0.85]} />
      <directionalLight
        color={0xffe3b8}
        intensity={1.25}
        position={[4, 8, 6]}
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
      <directionalLight color={0x8bb8e8} intensity={0.55} position={[-5, 4, -4]} />
      <pointLight
        color={0xffcf87}
        intensity={1.45}
        distance={9}
        position={[desktopOffsetX + 0.9, 2.25, 0.8]}
      />

      {/* Library Wooden Parquet Floor at y = 0 */}
      <mesh position={[0, 0, -1.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial map={sceneAssets.floorTex} roughness={0.65} metalness={0.05} />
      </mesh>

      {/* Background Library Bookshelves & Room Props */}
      <group position={[0, -0.215, 0]}>
        <FloatingLibraryProps reducedRef={reducedRef} />
      </group>

      {/* Real Wooden Library Reading Table & Physical Book on Lectern */}
      <group ref={stageGroupRef} position={[desktopOffsetX, 0, 0]}>
        {/* Polished Mahogany Reading Table */}
        <group>
          <mesh position={[0, 0.94, 0]} castShadow receiveShadow>
            <boxGeometry args={[3.25, 0.14, 2.0]} />
            <meshStandardMaterial
              map={sceneAssets.tableWoodTex}
              roughness={0.5}
              metalness={0.08}
            />
          </mesh>

          <mesh position={[0, 0.81, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.85, 0.14, 1.64]} />
            <meshStandardMaterial color="#3c2113" roughness={0.72} />
          </mesh>

          <mesh position={[0, 0.94, 1.005]}>
            <boxGeometry args={[3.26, 0.03, 0.02]} />
            <meshStandardMaterial color="#d4a94f" metalness={0.65} roughness={0.3} />
          </mesh>

          {/* 4 Turned Wooden Table Legs + Brass Ferrules */}
          {[
            [-1.32, -0.72],
            [1.32, -0.72],
            [-1.32, 0.72],
            [1.32, 0.72],
          ].map(([lx, lz], idx) => (
            <group key={idx} position={[lx, 0, lz]}>
              <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.075, 0.055, 0.88, 16]} />
                <meshStandardMaterial color="#442716" roughness={0.68} />
              </mesh>
              <mesh position={[0, 0.05, 0]}>
                <cylinderGeometry args={[0.06, 0.064, 0.1, 16]} />
                <meshStandardMaterial color="#d4a94f" metalness={0.7} roughness={0.28} />
              </mesh>
            </group>
          ))}

          {/* Crimson Desk Blotter Mat */}
          <mesh position={[0, 1.02, 0.06]} receiveShadow>
            <boxGeometry args={[2.65, 0.025, 1.48]} />
            <meshStandardMaterial map={sceneAssets.runnerTex} roughness={0.88} />
          </mesh>

          {/* Lectern Pedestal Connecting Blotter to Tilted Stand (strictly behind/below book) */}
          <mesh position={[0, 1.24, -0.18]} castShadow receiveShadow>
            <boxGeometry args={[1.24, 0.44, 0.24]} />
            <meshStandardMaterial color="#3c2113" roughness={0.75} />
          </mesh>
        </group>

        {/* Shared Tilted Lectern & Open Book Assembly (prevents any front/bottom intersection) */}
        <group position={[0, 1.86, -0.06]} rotation={[-0.64, 0, 0]}>
          {/* Lectern Backing Board behind the book covers */}
          <mesh position={[0, 0, -0.075]} castShadow receiveShadow>
            <boxGeometry args={[2.82, 1.9, 0.04]} />
            <meshStandardMaterial color="#4c2b18" roughness={0.65} />
          </mesh>

          {/* Lectern Bottom Rest Ledge strictly below the book's bottom edge */}
          <mesh position={[0, -0.94, 0.01]} castShadow receiveShadow>
            <boxGeometry args={[2.84, 0.06, 0.18]} />
            <meshStandardMaterial color="#5c3620" roughness={0.62} />
          </mesh>

          {/* Physical Open Page-Turning Library Book */}
          <group
            ref={bookRef}
            onClick={handleBookClick}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredBook(true);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoveredBook(false);
            }}
          >
            {/* Left & Right Hardcovers + Spine */}
            <mesh position={[-W / 2, 0, -0.04]} castShadow receiveShadow>
              <boxGeometry args={[W, H, 0.05]} />
              <meshStandardMaterial color="#6e2230" roughness={0.7} />
            </mesh>
            <mesh position={[W / 2, 0, -0.04]} castShadow receiveShadow>
              <boxGeometry args={[W, H, 0.05]} />
              <meshStandardMaterial color="#6e2230" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0, -0.04]} castShadow>
              <boxGeometry args={[0.08, H, 0.06]} />
              <meshStandardMaterial color="#481520" roughness={0.65} />
            </mesh>

            {/* Cream Paper Stack Thickness Under Open Pages */}
            <mesh position={[-PX, 0, -0.005]}>
              <boxGeometry args={[W - 0.1, H - 0.12, 0.028]} />
              <meshStandardMaterial color="#e7dcc2" roughness={0.9} />
            </mesh>
            <mesh position={[PX, 0, -0.005]}>
              <boxGeometry args={[W - 0.1, H - 0.12, 0.028]} />
              <meshStandardMaterial color="#e7dcc2" roughness={0.9} />
            </mesh>

            {/* Static Left & Right End Pages */}
            <mesh
              position={[-PX, 0, 0.012]}
              geometry={sceneAssets.pageGeo}
              material={sceneAssets.staticLeftMat}
            />
            <mesh
              position={[PX, 0, 0.012]}
              geometry={sceneAssets.pageGeo}
              material={sceneAssets.staticRightMat}
            />

            {/* Turning Printed Page Leaves */}
            {sceneAssets.leafMaterials.map((mats, idx) => (
              <group
                key={idx}
                ref={(el) => {
                  leafRefs.current[idx] = el;
                }}
                position={[0, 0, 0.02 + (maxSpread - 1 - idx) * 0.01]}
              >
                <mesh
                  position={[PX, 0, 0.002]}
                  geometry={sceneAssets.pageGeo}
                  material={mats.frontMat}
                />
                <mesh
                  position={[PX, 0, -0.002]}
                  rotation={[0, Math.PI, 0]}
                  geometry={sceneAssets.pageGeo}
                  material={mats.backMat}
                />
              </group>
            ))}
          </group>
        </group>
      </group>
    </>
  );
}
