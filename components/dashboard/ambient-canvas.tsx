"use client";

import { useEffect, useRef } from "react";
import type * as THREE from "three";

/**
 * Decorative WebGL backdrop behind the dashboard header — a slow drift of
 * translucent tile-like planes. Purely ambient: pointer-events-none, low
 * opacity, and skipped entirely under prefers-reduced-motion.
 */
export function AmbientCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let cleanup = () => {};

    // Three.js is a real dependency cost — load it only on the client, only
    // once, and skip entirely for reduced-motion users.
    if (!prefersReducedMotion) {
      import("three").then((THREE) => {
        if (!mountRef.current) return;

        const width = mount.clientWidth;
        const height = mount.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.z = 18;

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mount.appendChild(renderer.domElement);

        const isDark = document.documentElement.classList.contains("dark");
        const planeColor = isDark ? 0x60a5fa : 0x3b82f6;

        const geometry = new THREE.PlaneGeometry(1.6, 1.6);
        const planes: {
          mesh: THREE.Mesh;
          speed: number;
          driftX: number;
          driftY: number;
          phase: number;
        }[] = [];

        const COUNT = 14;
        for (let i = 0; i < COUNT; i++) {
          const material = new THREE.MeshBasicMaterial({
            color: planeColor,
            transparent: true,
            opacity: isDark ? 0.06 + Math.random() * 0.05 : 0.04 + Math.random() * 0.04,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
          );
          mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          );
          scene.add(mesh);
          planes.push({
            mesh,
            speed: 0.05 + Math.random() * 0.1,
            driftX: (Math.random() - 0.5) * 0.15,
            driftY: (Math.random() - 0.5) * 0.1,
            phase: Math.random() * Math.PI * 2,
          });
        }

        let frameId: number;
        let t = 0;
        const animate = () => {
          t += 0.005;
          for (const p of planes) {
            p.mesh.rotation.x += p.speed * 0.01;
            p.mesh.rotation.y += p.speed * 0.008;
            p.mesh.position.x += Math.sin(t + p.phase) * 0.001;
            p.mesh.position.y += p.driftY * 0.01;
          }
          renderer.render(scene, camera);
          frameId = requestAnimationFrame(animate);
        };
        animate();

        const handleResize = () => {
          if (!mountRef.current) return;
          const w = mountRef.current.clientWidth;
          const h = mountRef.current.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", handleResize);

        cleanup = () => {
          cancelAnimationFrame(frameId);
          window.removeEventListener("resize", handleResize);
          geometry.dispose();
          planes.forEach((p) => (p.mesh.material as THREE.Material).dispose());
          renderer.dispose();
          if (mount.contains(renderer.domElement)) {
            mount.removeChild(renderer.domElement);
          }
        };
      });
    }

    return () => cleanup();
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
    />
  );
}
