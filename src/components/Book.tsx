"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const W = 2;
const H = 2.8;
const N = 6;

const HEADS = [
  "Library Offerings",
  "Services and Resources",
  "Our Heritage",
  "Reading Rooms",
  "Museum Collection",
  "Digital Archive",
  "Community Programs",
  "Visit Us",
  "Membership",
  "Events",
  "News",
  "Contact",
];

const K: ReadonlyArray<readonly [number, number]> = [
  [0, 8],
  [0.15, 7.2],
  [0.35, 5.4],
  [0.6, 4.6],
  [0.85, 2.3],
  [1, 6.5],
];

function sm(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function camZ(p: number): number {
  for (let i = 1; i < K.length; i++) {
    if (p <= K[i][0]) {
      const a = K[i - 1];
      const b = K[i];
      return a[1] + (b[1] - a[1]) * sm(a[0], b[0], p);
    }
  }
  return K[K.length - 1][1];
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useReducedMotionFlag(): MutableRefObject<boolean> {
  const reduced = useRef(prefersReducedMotion());
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onChange = () => {
      reduced.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export interface BookComponentProps {
  progress: MutableRefObject<number>;
}

export function BookRig({ progress }: BookComponentProps) {
  const reduced = useReducedMotionFlag();
  const cur = useRef(reduced.current ? 0.6 : 0);

  const lightsGroup = useMemo(() => {
    const group = new THREE.Group();
    const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x1a2238, 0.9);
    const key = new THREE.DirectionalLight(0xffd9a0, 1.4);
    key.position.set(3, 4, 5);
    const rim = new THREE.DirectionalLight(0x7aa8ff, 1);
    rim.position.set(-4, 2, -3);
    group.add(hemi, key, rim);
    return group;
  }, []);

  useFrame(({ camera, size }) => {
    const isReduced = reduced.current;
    if (isReduced) {
      cur.current = 0.6;
    } else {
      cur.current += (progress.current - cur.current) * 0.045;
    }

    const p = cur.current;
    const close = sm(0.88, 1, p);
    const open = sm(0.35, 0.6, p) * (1 - close);
    const aspect = (size.width || 1) / (size.height || 1);
    const z = camZ(p) * Math.max(1, 1.7 / aspect);

    camera.position.set(0, 0.5 * (1 - open), z);
    camera.lookAt(0, 0, 0);
  });

  return <primitive object={lightsGroup} />;
}

function buildCanvasTexture(
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1432;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.scale(2, 2);
    draw(ctx, 512, 716);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export default function Book({ progress }: BookComponentProps) {
  const reduced = useReducedMotionFlag();
  const cur = useRef(reduced.current ? 0.6 : 0);

  const bookAssets = useMemo(() => {
    const textures: THREE.Texture[] = [];
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    const trackTex = <T extends THREE.Texture>(t: T): T => {
      textures.push(t);
      return t;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };

    const coverTex = trackTex(
      buildCanvasTexture((g, w, h) => {
        g.fillStyle = "#4a2a18";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 3000; i++) {
          g.fillStyle = `rgba(0,0,0,${Math.random() * 0.09})`;
          g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        g.strokeStyle = "#d4a94f";
        g.lineWidth = 6;
        g.strokeRect(28, 28, w - 56, h - 56);
        g.lineWidth = 2;
        g.strokeRect(46, 46, w - 92, h - 92);
        g.beginPath();
        g.arc(w / 2, 150, 42, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(w / 2, 150, 28, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(w / 2, 150, 12, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "#e4be6c";
        g.shadowColor = "rgba(0,0,0,0.55)";
        g.shadowBlur = 8;
        g.textAlign = "center";
        g.font = "bold 58px Georgia,serif";
        ["Iloilo City", "Public", "Library"].forEach((s, i) =>
          g.fillText(s, w / 2, 260 + i * 72)
        );
        g.font = "italic 25px Georgia,serif";
        g.fillStyle = "#d4a94f";
        g.fillText("Heart of Knowledge", w / 2, 530);
        g.shadowBlur = 0;
      })
    );

    const pageTex = (i: number, s: number) =>
      trackTex(
        buildCanvasTexture((g, w, h) => {
          g.fillStyle = "#f4ead2";
          g.fillRect(0, 0, w, h);
          const gr = g.createLinearGradient(s ? w : 0, 0, s ? w - 90 : 90, 0);
          gr.addColorStop(0, "rgba(60,40,20,.38)");
          gr.addColorStop(1, "rgba(60,40,20,0)");
          g.fillStyle = gr;
          g.fillRect(0, 0, w, h);

          const mx = s ? 60 : 95;
          g.fillStyle = "#4a2a18";
          g.font = "bold 34px Georgia,serif";
          g.textAlign = "left";
          g.fillText(HEADS[(i * 2 + s) % HEADS.length], mx, 110);

          g.fillStyle = "rgba(74,42,24,.32)";
          for (let y = 155; y < 640; y += 22) {
            g.fillRect(mx, y, w - 155 - (Math.random() < 0.2 ? 110 : 0), 6);
          }

          g.fillStyle = "rgba(74,42,24,.6)";
          g.font = "15px Georgia,serif";
          g.textAlign = "center";
          g.fillText(String(i * 2 + s + 1), w / 2, h - 32);
        })
      );

    const leather = trackMat(new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.7 }));
    const paper = trackMat(new THREE.MeshStandardMaterial({ color: 0xf0e4c8, roughness: 0.9 }));
    const endp = trackMat(new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.9 }));
    const gold = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xd4a94f, roughness: 0.35, metalness: 0.4 })
    );
    const coverMat = trackMat(new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.6 }));

    const sceneRoot = new THREE.Group();
    const pivot = new THREE.Group();
    const book = new THREE.Group();
    pivot.add(book);
    sceneRoot.add(pivot);

    const glow = new THREE.PointLight(0xffc878, 0, 7);
    glow.position.set(0, 0.3, 1.4);
    sceneRoot.add(glow);

    const addBox = (
      w: number,
      h: number,
      d: number,
      m: THREE.Material | THREE.Material[],
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = book
    ) => {
      const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    addBox(W, H, 0.06, [leather, leather, leather, leather, endp, leather], W / 2, 0, -0.2);
    addBox(W - 0.1, H - 0.1, 0.22, paper, (W - 0.1) / 2 + 0.02, 0, -0.06);
    addBox(0.12, H, 0.46, leather, -0.04, 0, 0);
    [-0.9, 0, 0.9].forEach((y) => addBox(0.02, 0.07, 0.47, gold, -0.1, y, 0));

    const fc = new THREE.Group();
    fc.position.z = 0.2;
    book.add(fc);
    addBox(W, H, 0.06, [leather, leather, leather, leather, coverMat, endp], W / 2, 0, 0, fc);

    const pages: THREE.Group[] = [];
    const pg = trackGeo(new THREE.PlaneGeometry(W - 0.1, H - 0.12));

    for (let i = 0; i < N; i++) {
      const g = new THREE.Group();
      g.position.z = 0.17 - i * 0.02;
      book.add(g);

      const frontMat = trackMat(
        new THREE.MeshStandardMaterial({ map: pageTex(i, 0), roughness: 0.9 })
      );
      const backMat = trackMat(
        new THREE.MeshStandardMaterial({ map: pageTex(i, 1), roughness: 0.9 })
      );

      const f = new THREE.Mesh(pg, frontMat);
      f.position.x = (W - 0.1) / 2 + 0.02;
      g.add(f);

      const b = new THREE.Mesh(pg, backMat);
      b.position.copy(f.position);
      b.rotation.y = Math.PI;
      g.add(b);

      pages.push(g);
    }

    return {
      sceneRoot,
      pivot,
      book,
      fc,
      pages,
      glow,
      dispose: () => {
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
      },
    };
  }, []);

  useEffect(() => {
    return () => bookAssets.dispose();
  }, [bookAssets]);

  useFrame((state) => {
    const isReduced = reduced.current;
    if (isReduced) {
      cur.current = 0.6;
    } else {
      cur.current += (progress.current - cur.current) * 0.045;
    }

    const p = cur.current;
    const t = state.clock.elapsedTime;
    const close = sm(0.88, 1, p);
    const open = sm(0.35, 0.6, p) * (1 - close);
    const k = sm(0, 0.35, p) * (1 - close);

    const { pivot, book, fc, pages, glow } = bookAssets;

    fc.rotation.y = -Math.PI * open;
    pages.forEach((g, i) => {
      g.rotation.y = -Math.PI * sm(0.42 + i * 0.035, 0.58 + i * 0.035, p) * (1 - close);
    });
    book.position.x = -(W / 2) * (1 - open);

    const sway = isReduced ? 0 : Math.sin(t * 0.35) * 0.03;
    pivot.rotation.set(-0.9 * (1 - k) + sway, 0.6 * (1 - k) + sway, 0);
    pivot.position.y = 1.1 * close + (isReduced ? 0 : Math.sin(t * 0.45) * 0.035 * (1 - open));
    glow.intensity = open * 1.8;
  });

  return <primitive object={bookAssets.sceneRoot} />;
}
