"use client";
import { useEffect, useRef, type ReactNode } from "react";

type RGB = [number, number, number];
type Blob = { x: number; y: number; vx: number; vy: number; r: number; c: RGB; ph: number; life: number; drop: boolean };
type Ring = { x: number; y: number; r: number; a: number; c: RGB };

const CYAN: RGB = [0, 174, 239], MAGENTA: RGB = [236, 0, 140], YELLOW: RGB = [255, 214, 0], BLACK: RGB = [40, 40, 52];
const CMYK = [CYAN, MAGENTA, YELLOW, BLACK];
const INDIGO: RGB = [99, 102, 241]; // pengganti hitam di mode gelap (hitam tidak terlihat pada latar gelap)
const JARAK = 240; // radius pengaruh kursor (px)
const GRID = 30; // jarak titik halftone (px)

/**
 * Latar login bertema cetak: tetesan tinta CMYK yang melayang dan bercampur seperti tinta sungguhan
 * (mode terang: blend "multiply" = mencampur warna subtraktif; mode gelap: "screen" = cahaya).
 * Interaktif: tetesan menjauh dari kursor/jari, klik/tap menahan kursor menarik tetesan sekaligus memercikkan tinta baru,
 * dan titik halftone di bawah membesar di dekat kursor. Mengikuti mode gelap dan "kurangi gerakan" dari sistem.
 */
export function InkBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: -9999, y: -9999, down: false };
    let w = 0, h = 0, raf = 0, t = 0, last = 0;
    let blobs: Blob[] = [];
    let rings: Ring[] = [];

    const seed = () => {
      const n = Math.round(Math.min(26, Math.max(10, (w * h) / 65000)));
      blobs = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: 90 + Math.random() * 130, c: CMYK[i % 4], ph: Math.random() * Math.PI * 2, life: 1, drop: false,
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduce) draw();
    };

    const percik = (x: number, y: number) => {
      const dark = document.documentElement.classList.contains("dark");
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 2.4;
        blobs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 28 + Math.random() * 46, c: CMYK[(Math.random() * 4) | 0], ph: Math.random() * 6, life: 1, drop: true });
      }
      rings.push({ x, y, r: 6, a: 0.7, c: dark ? INDIGO : CMYK[(Math.random() * 3) | 0] });
      const drops = blobs.filter((b) => b.drop);
      if (drops.length > 48) blobs = blobs.filter((b) => !drops.slice(0, drops.length - 48).includes(b));
    };

    const step = (dt: number) => {
      for (const b of blobs) {
        // gerak melayang halus + pengaruh kursor
        b.vx += Math.sin(t * 0.6 + b.ph) * 0.004 * dt;
        b.vy += Math.cos(t * 0.5 + b.ph * 1.3) * 0.004 * dt;
        const dx = b.x - mouse.x, dy = b.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < JARAK + b.r * 0.4 && d > 1) {
          const f = (1 - d / (JARAK + b.r * 0.4)) * 0.09 * dt * (mouse.down ? -1.6 : 1); // klik tahan = menarik
          b.vx += (dx / d) * f; b.vy += (dy / d) * f;
        }
        const maks = b.drop ? 4 : 1.6, v = Math.hypot(b.vx, b.vy);
        if (v > maks) { b.vx *= maks / v; b.vy *= maks / v; }
        b.vx *= b.drop ? 0.975 : 0.992; b.vy *= b.drop ? 0.975 : 0.992;
        b.x += b.vx * dt; b.y += b.vy * dt;
        const m = b.r * 0.3; // pantul lembut di tepi layar
        if (b.x < -m) b.vx = Math.abs(b.vx); else if (b.x > w + m) b.vx = -Math.abs(b.vx);
        if (b.y < -m) b.vy = Math.abs(b.vy); else if (b.y > h + m) b.vy = -Math.abs(b.vy);
        if (b.drop) b.life -= 0.0035 * dt;
      }
      blobs = blobs.filter((b) => !b.drop || b.life > 0);
      for (const r of rings) { r.r += 3.2 * dt; r.a -= 0.014 * dt; }
      rings = rings.filter((r) => r.a > 0);
    };

    const draw = () => {
      const dark = document.documentElement.classList.contains("dark");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = dark ? "#0b1220" : "#f8fafc";
      ctx.fillRect(0, 0, w, h);

      // tetesan tinta
      ctx.globalCompositeOperation = dark ? "screen" : "multiply";
      for (const b of blobs) {
        const c = dark && b.c === BLACK ? INDIGO : b.c;
        const rr = b.r * (1 + 0.06 * Math.sin(t * 0.9 + b.ph));
        const a = (b.drop ? Math.max(0, b.life) : 1) * (dark ? 0.5 : 0.55);
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
        g.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.45})`);
        g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.fill();
      }

      // titik halftone: membesar di dekat kursor
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = dark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.11)";
      ctx.beginPath();
      for (let x = GRID / 2; x < w; x += GRID) {
        for (let y = GRID / 2; y < h; y += GRID) {
          const d = Math.hypot(x - mouse.x, y - mouse.y);
          const r = 1 + (d < 200 ? (1 - d / 200) * 2.6 : 0);
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      for (const r of rings) {
        ctx.strokeStyle = `rgba(${r.c[0]},${r.c[1]},${r.c[2]},${r.a})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(2.5, (now - (last || now)) / 16.67); // 1 = 60fps; dibatasi agar tidak melompat setelah tab tidak aktif
      last = now; t += dt / 60;
      step(dt); draw();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onDown = (e: PointerEvent) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.down = true;
      if (!(e.target as HTMLElement | null)?.closest("form,button,input,a,select,textarea")) percik(e.clientX, e.clientY); // jangan memercik saat mengisi form
    };
    const onUp = () => { mouse.down = false; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; mouse.down = false; };

    resize();
    window.addEventListener("resize", resize);
    if (reduce) {
      // gerakan dikurangi: satu gambar statis tanpa animasi; digambar ulang hanya saat tema berganti
      const mo = new MutationObserver(() => draw());
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => { window.removeEventListener("resize", resize); mo.disconnect(); };
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
