"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function Hero3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isLowPowerDevice =
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      window.innerWidth < 768;

    const getSize = () => ({
      w: container.clientWidth || window.innerWidth,
      h: container.clientHeight || window.innerHeight,
    });

    const { w, h } = getSize();
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isLowPowerDevice,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(w, h);
    // Cap pixel ratio to balance visual crispness & GPU load
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowPowerDevice ? 1 : 1.5));
    renderer.shadowMap.enabled = !isLowPowerDevice;
    if (!isLowPowerDevice) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    renderer.setClearColor(0x1e2d3d, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);

    scene.add(new THREE.AmbientLight(0x3a5068, 1.4));
    const sun = new THREE.DirectionalLight(0xc8e0f5, 0.9);
    sun.position.set(6, 12, 8);
    sun.castShadow = !isLowPowerDevice;
    scene.add(sun);

    const warm1 = new THREE.PointLight(0xffcc77, 3.5, 10);
    warm1.position.set(-1.4, 3.0, 0.8);
    scene.add(warm1);

    const warm2 = new THREE.PointLight(0xff9944, 2.2, 8);
    warm2.position.set(2.2, 2.6, -0.4);
    scene.add(warm2);

    const cool = new THREE.PointLight(0x9fc1e1, 1.0, 16);
    cool.position.set(-5, 7, -3);
    scene.add(cool);

    const lmat = (col: number) => new THREE.MeshLambertMaterial({ color: col });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.15, 22), lmat(0x243344));
    floor.position.y = -0.08;
    floor.receiveShadow = !isLowPowerDevice;
    scene.add(floor);

    const rug = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.04, 4.5), lmat(0x1e4d6b));
    rug.position.set(0, 0.01, 1);
    scene.add(rug);

    const bookColors = [
      0x8b1a1a, 0x1a5c8b, 0x2d7a2d, 0xb8860b, 0x6b2d8b, 0xc4622d, 0x2d6b8b, 0x8b6914,
      0xa0522d, 0x4682b4, 0x8b4513, 0x228b22, 0xcd853f, 0x6a5acd, 0x9fc1e1, 0x2f6f8f,
      0x7a3535, 0x3a7a5a,
    ];

    const makeShelf = (x: number, z: number, ry: number) => {
      const g = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 0.28), lmat(0x4a2e10));
      back.castShadow = !isLowPowerDevice;
      back.receiveShadow = !isLowPowerDevice;
      g.add(back);

      const sm = lmat(0x5a3818);
      for (let s = 0; s < 3; s++) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 0.32), sm);
        sh.position.set(0, -0.9 + s * 0.9, 0.05);
        g.add(sh);
      }

      for (let s = 0; s < 3; s++) {
        let bx = -1.8;
        for (let b = 0; b < 13; b++) {
          const bw = 0.17 + ((s * 7 + b * 13) % 10) * 0.011;
          const bh = 0.52 + ((s * 11 + b * 5) % 10) * 0.028;
          const bk = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bh, 0.23),
            lmat(bookColors[(s * 13 + b) % bookColors.length])
          );
          bk.position.set(bx + bw / 2, -0.9 + s * 0.9 + 0.05 + bh / 2, 0.05);
          bk.rotation.z = (((s + b) % 5) - 2) * 0.015;
          bk.castShadow = !isLowPowerDevice;
          g.add(bk);
          bx += bw + 0.01;
          if (bx > 1.85) break;
        }
      }

      g.position.set(x, 1.8, z);
      g.rotation.y = ry;
      scene.add(g);
    };

    makeShelf(-4.2, 0, Math.PI / 2);
    makeShelf(4.2, 0, -Math.PI / 2);
    makeShelf(0, -4.8, 0);

    const tbl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.6), lmat(0x6b3d18));
    tbl.position.set(0, 0.88, 1.9);
    tbl.castShadow = !isLowPowerDevice;
    tbl.receiveShadow = !isLowPowerDevice;
    scene.add(tbl);

    [-1.4, 1.4].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.88, 8), lmat(0x5a3010));
      leg.position.set(lx, 0.44, 1.9);
      scene.add(leg);
    });

    const deskLamp = (x: number, z: number) => {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.07, 10), lmat(0x8b6914));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6), lmat(0x7a5c10));
      pole.position.y = 0.39;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.32, 10, 1, true), lmat(0xc89830));
      shade.position.y = 0.8;
      const g = new THREE.Group();
      g.add(base, pole, shade);
      g.position.set(x, 0.95, z);
      scene.add(g);
    };
    deskLamp(-0.9, 1.7);
    deskLamp(0.9, 1.7);

    const bBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.65), lmat(0x4a3018));
    bBase.position.set(0, 0.9, 1.95);
    scene.add(bBase);

    [
      [-0.22, 0.07],
      [0.22, -0.07],
    ].forEach(([bx, rz]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.006, 0.6), lmat(0xfaf5e8));
      p.position.set(bx, 0.915, 1.95);
      p.rotation.z = rz;
      scene.add(p);
    });

    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 14), lmat(0x2255aa));
    globe.position.set(-2.6, 1.25, 1.3);
    scene.add(globe);

    const gStand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.13, 0.5, 8), lmat(0x6b4010));
    gStand.position.set(-2.6, 0.75, 1.3);
    scene.add(gStand);

    const plant = (x: number, z: number) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.3, 8), lmat(0xb05020));
      pot.position.set(x, 0.16, z);
      scene.add(pot);
      for (let i = 0; i < 6; i++) {
        const lf = new THREE.Mesh(new THREE.SphereGeometry(0.14 + (i % 3) * 0.03, 7, 7), lmat(0x2a7a2a));
        lf.position.set(x + Math.cos(i) * 0.12, 0.58 + (i % 3) * 0.11, z + Math.sin(i) * 0.12);
        scene.add(lf);
      }
    };
    plant(-3.4, 3.1);
    plant(3.4, 3.1);

    const floaters: THREE.Mesh[] = [];
    const fbCols = [0x9fc1e1, 0x48c78e, 0xb8860b, 0x8b1a1a, 0x6b2d8b];
    for (let i = 0; i < 5; i++) {
      const a = i * ((Math.PI * 2) / 5);
      const fb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.33, 0.07), lmat(fbCols[i]));
      fb.userData = { bx: Math.cos(a) * 2.3, bz: Math.sin(a) * 2.3, by: 2.55 + i * 0.28, a };
      fb.position.set(fb.userData.bx, fb.userData.by, fb.userData.bz);
      scene.add(fb);
      floaters.push(fb);
    }

    let isDrag = false;
    let px = 0;
    let py = 0;
    let theta = 0.18;
    let phi = 0.52;
    let radius = 13;
    let isInViewport = true;
    let isTabVisible = !document.hidden;
    const target = new THREE.Vector3(0, 1.3, 0);

    const onMouseDown = (e: MouseEvent) => {
      isDrag = true;
      px = e.clientX;
      py = e.clientY;
    };
    const onMouseUp = () => {
      isDrag = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDrag) return;
      theta -= (e.clientX - px) * 0.005;
      phi = Math.max(0.18, Math.min(1.25, phi + (e.clientY - py) * 0.005));
      px = e.clientX;
      py = e.clientY;
    };
    const onTouchStart = (e: TouchEvent) => {
      isDrag = true;
      px = e.touches[0].clientX;
      py = e.touches[0].clientY;
    };
    const onTouchEnd = () => {
      isDrag = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDrag) return;
      theta -= (e.touches[0].clientX - px) * 0.006;
      phi = Math.max(0.18, Math.min(1.25, phi + (e.touches[0].clientY - py) * 0.006));
      px = e.touches[0].clientX;
      py = e.touches[0].clientY;
    };
    const onWheel = (e: WheelEvent) => {
      radius = Math.max(7, Math.min(22, radius + e.deltaY * 0.02));
    };
    const onResize = () => {
      const s = getSize();
      renderer.setSize(s.w, s.h);
      camera.aspect = s.w / s.h;
      camera.updateProjectionMatrix();
    };

    // Pause WebGL rendering when scrolled offscreen or when tab is inactive
    let rafId = 0;
    let t = 0;
    let lastFrameTime = 0;
    const minFrameMs = isLowPowerDevice ? 33 : 16; // ~30fps on low-power, 60fps on desktop

    const renderFrame = (now: number) => {
      if (!isInViewport || !isTabVisible) {
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(renderFrame);
      if (now - lastFrameTime < minFrameMs) return;
      lastFrameTime = now;

      if (!prefersReducedMotion) {
        t += 0.01;
        if (!isDrag) theta += 0.0018;
      }

      camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = target.y + radius * Math.cos(phi);
      camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(target);

      floaters.forEach((fb) => {
        fb.position.y = fb.userData.by + Math.sin(t * 1.1 + fb.userData.a * 2) * 0.2;
        fb.rotation.y = t * 0.45 + fb.userData.a;
        fb.rotation.z = Math.sin(t * 0.7 + fb.userData.a) * 0.14;
      });
      globe.rotation.y = t * 0.28;
      warm1.intensity = 3.0 + Math.sin(t * 1.05) * 0.5;
      warm2.intensity = 1.8 + Math.sin(t * 0.85 + 1) * 0.35;
      renderer.render(scene, camera);
    };

    const startLoop = () => {
      if (!rafId && isInViewport && isTabVisible) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        isInViewport = entries[0]?.isIntersecting ?? true;
        if (isInViewport) startLoop();
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) startLoop();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    startLoop();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full [contain:strict]">
      <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
