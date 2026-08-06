import { useEffect, useRef } from "react";

interface FireGridProps {
  /** Live analyser node — when present the fire reacts to the audio. */
  analyser?: AnalyserNode | null;
  /** Dot spacing in CSS px. Small, ASCII-ish. */
  cell?: number;
  className?: string;
}

// Parse "H S% L%" CSS variable into [h, s, l] numbers
function parseCssHsl(val: string): [number, number, number] {
  const parts = val.trim().split(/\s+/);
  return [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0];
}

/**
 * ASCII-style fire: a grid of small square dots driven by a classic heat
 * propagation simulation. Animates continuously on its own, and when an
 * AnalyserNode is provided the per-column heat is fed by audio frequencies.
 */
const FireGrid = ({ analyser, cell = 7, className }: FireGridProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    analyserRef.current = analyser ?? null;
  }, [analyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cols = 0;
    let rows = 0;
    let heat = new Float32Array(0);
    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      cols = Math.max(4, Math.floor(w / cell));
      rows = Math.max(4, Math.floor(h / cell));
      heat = new Float32Array(cols * rows);
    };
    resize();

    const obs = new ResizeObserver(resize);
    obs.observe(canvas);

    const FIRE: [number, number, number][] = [
      [6, 80, 38],
      [18, 92, 48],
      [30, 96, 55],
      [44, 100, 66],
    ];

    const palette = () => FIRE;

    let stops = palette();
    let paletteTick = 0;
    let t = 0;
    let freq = new Uint8Array(0);

    const tick = () => {
      if (cols === 0 || rows === 0 || heat.length !== cols * rows) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      if (paletteTick++ % 90 === 0) stops = palette();
      t += 0.06;

      const node = analyserRef.current;
      let level = 0;
      if (node) {
        if (freq.length !== node.frequencyBinCount) freq = new Uint8Array(node.frequencyBinCount);
        node.getByteFrequencyData(freq);
        for (let i = 0; i < freq.length; i++) level += freq[i];
        level = level / (freq.length * 255);
      }

      // Seed the bottom row
      const bottom = (rows - 1) * cols;
      const step = freq.length > 0 ? Math.max(1, Math.floor(freq.length / cols)) : 0;
      for (let x = 0; x < cols; x++) {
        const wave = 0.55 + 0.45 * Math.sin(t + x * 0.35) * Math.sin(t * 0.6 + x * 0.11);
        let seed = wave * (0.55 + Math.random() * 0.45);
        if (step > 0) {
          const bin = freq[Math.min(freq.length - 1, x * step)] / 255;
          seed = Math.min(1, seed * 0.35 + Math.pow(bin, 0.7) * 1.1 + level * 0.35);
        }
        heat[bottom + x] = Math.min(1, seed);
      }

      // Propagate upwards with cooling
      const cooling = 0.055 + (node ? 0.05 * (1 - level) : 0.03);
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols; x++) {
          const below = (y + 1) * cols + x;
          const l = heat[below + (x > 0 ? -1 : 0)];
          const r = heat[below + (x < cols - 1 ? 1 : 0)];
          const b2 = heat[Math.min(heat.length - 1, (y + 2) * cols + x)];
          const avg = (heat[below] * 2 + l + r + b2) / 5;
          const drift = Math.random() * 0.03;
          heat[y * cols + x] = Math.max(0, avg - cooling - drift);
        }
      }

      // Draw
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      const dot = Math.max(2, cell - 3);
      const offset = (cell - dot) / 2;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = heat[y * cols + x];
          if (v < 0.06) {
            ctx.fillStyle = "hsl(0 0% 50% / 0.10)";
            ctx.fillRect(x * cell + offset, y * cell + offset, dot, dot);
            continue;
          }
          const idx = Math.min(stops.length - 1, Math.floor(v * stops.length));
          const [h, s, l] = stops[idx];
          ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%, ${Math.min(1, 0.35 + v)})`;
          ctx.fillRect(x * cell + offset, y * cell + offset, dot, dot);
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      obs.disconnect();
    };
  }, [cell]);

  return <canvas ref={canvasRef} className={className ?? "w-full h-full block"} />;
};

export default FireGrid;
