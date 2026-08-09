import { useEffect, useRef } from "react";

interface FireGridProps {
  /** Live analyser node — when present the fire reacts to the audio. */
  analyser?: AnalyserNode | null;
  /** Dot spacing in CSS px. Small, ASCII-ish. */
  cell?: number;
  /** Maximum flame height as a fraction of the grid height (0.2 - 1). */
  maxHeight?: number;
  /** Full-volume mode: flattens the spectrum so both sides react equally. */
  balanced?: boolean;
  /** Frame cap so the animation stays smooth on lower-end devices. */
  fps?: number;
  className?: string;
}

/**
 * ASCII-style fire: a grid of small square dots driven by a classic heat
 * propagation simulation. Animates continuously on its own, and when an
 * AnalyserNode is provided the per-column heat is fed by audio frequencies.
 */
const FireGrid = ({
  analyser,
  cell = 7,
  maxHeight = 1,
  balanced = false,
  fps = 45,
  className,
}: FireGridProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const maxHeightRef = useRef(maxHeight);
  const balancedRef = useRef(balanced);
  const fpsRef = useRef(fps);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    analyserRef.current = analyser ?? null;
  }, [analyser]);
  useEffect(() => {
    maxHeightRef.current = Math.min(1, Math.max(0.2, maxHeight));
  }, [maxHeight]);
  useEffect(() => {
    balancedRef.current = balanced;
  }, [balanced]);
  useEffect(() => {
    fpsRef.current = Math.max(15, Math.min(60, fps));
  }, [fps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
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
      const nextW = Math.floor(w * dpr);
      const nextH = Math.floor(h * dpr);
      if (canvas.width !== nextW) canvas.width = nextW;
      if (canvas.height !== nextH) canvas.height = nextH;
      const nextCols = Math.max(4, Math.floor(w / cell));
      const nextRows = Math.max(4, Math.floor(h / cell));
      if (nextCols !== cols || nextRows !== rows) {
        cols = nextCols;
        rows = nextRows;
        // Re-seed so flame scaling recomputes cleanly for the new height.
        heat = new Float32Array(cols * rows);
        smooth = new Float32Array(cols);
      }
    };

    const FIRE: [number, number, number][] = [
      [6, 80, 38],
      [18, 92, 48],
      [30, 96, 55],
      [44, 100, 66],
    ];
    const stops = FIRE;

    let t = 0;
    let freq = new Uint8Array(0);
    let smooth = new Float32Array(0);
    let levelSmooth = 0;
    let last = 0;

    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas);
    window.addEventListener("resize", resize);

    // smooth easing curve (smoothstep) — avoids the flame flat-topping early
    const ease = (v: number) => v * v * (3 - 2 * v);

    const tick = (now: number) => {
      frameRef.current = requestAnimationFrame(tick);

      const interval = 1000 / fpsRef.current;
      if (now - last < interval) return;
      const dt = Math.min(3, (now - last) / interval || 1);
      last = now;

      if (cols === 0 || rows === 0 || heat.length !== cols * rows) return;

      t += 0.06 * dt;
      const maxH = maxHeightRef.current;
      const bal = balancedRef.current;

      const node = analyserRef.current;
      let level = 0;
      if (node) {
        if (freq.length !== node.frequencyBinCount) freq = new Uint8Array(node.frequencyBinCount);
        node.getByteFrequencyData(freq);
        for (let i = 0; i < freq.length; i++) level += freq[i];
        level = level / (freq.length * 255);
      }
      levelSmooth = levelSmooth * 0.8 + level * 0.2;

      if (smooth.length !== cols) smooth = new Float32Array(cols);

      // Seed the bottom row. Audio is mirrored around the centre so both sides
      // receive exactly the same frequency energy.
      const bottom = (rows - 1) * cols;
      const usable = freq.length > 0 ? Math.max(8, Math.floor(freq.length * 0.62)) : 0;
      const half = Math.max(1, (cols - 1) / 2);
      const reaches = new Float32Array(cols);

      for (let x = 0; x < cols; x++) {
        // Several incommensurate waves produce narrow, continuously splitting
        // tongues instead of a single smooth dome or concentric heat blobs.
        const tongue =
          0.52 +
          0.2 * Math.sin(x * 0.57 + t * 1.7) +
          0.16 * Math.sin(x * 0.19 - t * 1.13) +
          0.12 * Math.sin(x * 1.31 + t * 0.73);
        let signal = 0.72;

        if (usable > 0) {
          const u = Math.abs(x - (cols - 1) / 2) / half; // 0 center -> 1 edges
          const lo = Math.floor(Math.pow(usable, u * 0.999));
          const hi = Math.min(
            usable - 1,
            Math.max(lo, Math.floor(Math.pow(usable, Math.min(1, u + 1 / cols) * 0.999)))
          );
          let band = 0;
          for (let i = lo; i <= hi; i++) band = Math.max(band, freq[i]);
          band /= 255;
          // Tilt gain upward toward the edges (highs) to offset spectral rolloff.
          // Full-volume mode flattens it fully so both sides match the centre.
          const gain = bal ? 1 + 5 * u * u : 1 + 2.2 * u * u;
          let target = Math.min(1, Math.pow(band * gain, bal ? 0.45 : 0.62));
          if (bal) target = Math.max(target, levelSmooth * 0.95);
          smooth[x] = target > smooth[x]
            ? smooth[x] + (target - smooth[x]) * 0.68
            : smooth[x] * 0.86;
          signal = Math.min(1, smooth[x] + levelSmooth * 0.22);
        }

        const sourceFlicker = 0.84 + Math.random() * 0.16;
        const seed = Math.min(1, 0.5 + signal * 0.5) * sourceFlicker;
        heat[bottom + x] = ease(seed);

        // Every column gets a different, smoothly moving energy budget. The
        // slider scales the whole field rather than clipping it at a row, so a
        // reduced maximum height still has a pointed, lively silhouette.
        const shape = Math.max(0.28, Math.min(1, tongue));
        const audioLift = node ? 0.5 + signal * 0.5 : 0.82;
        reaches[x] = Math.max(2, rows * maxH * shape * audioLift);
      }

      // Advect heat upward with changing lateral drift. Per-column cooling
      // creates long tips, short gaps and splitting tongues like a real flame.
      for (let y = rows - 2; y >= 0; y--) {
        for (let x = 0; x < cols; x++) {
          const rise = rows - 1 - y;
          const sway = Math.sin(t * 1.4 + y * 0.22) + Math.sin(t * 0.61 + y * 0.09);
          const drift = sway > 0.55 ? 1 : sway < -0.55 ? -1 : 0;
          const sourceX = Math.max(0, Math.min(cols - 1, x - drift));
          const below = (y + 1) * cols + sourceX;
          const left = (y + 1) * cols + Math.max(0, sourceX - 1);
          const right = (y + 1) * cols + Math.min(cols - 1, sourceX + 1);
          const below2 = Math.min(rows - 1, y + 2) * cols + sourceX;
          const carried = heat[below] * 0.52 + heat[left] * 0.16 + heat[right] * 0.16 + heat[below2] * 0.16;
          const localReach = Math.max(2, (reaches[x] + reaches[sourceX]) * 0.5);
          const altitude = rise / localReach;
          const turbulentCooling = (0.66 + Math.random() * 0.42 + altitude * 0.16) / localReach;
          heat[y * cols + x] = Math.max(0, carried - turbulentCooling);
        }
      }

      // Draw — batch by palette index to minimise fillStyle changes.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      const dot = Math.max(2, cell - 3);
      const offset = (cell - dot) / 2;

      ctx.fillStyle = "hsl(0 0% 50% / 0.10)";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (heat[y * cols + x] < 0.06) {
            ctx.fillRect(x * cell + offset, y * cell + offset, dot, dot);
          }
        }
      }

      for (let s = 0; s < stops.length; s++) {
        const [h, sat, li] = stops[s];
        ctx.fillStyle = `hsl(${h}, ${sat}%, ${li}%)`;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const v = heat[y * cols + x];
            if (v < 0.06) continue;
            const idx = Math.min(stops.length - 1, Math.floor(v * stops.length));
            if (idx !== s) continue;
            ctx.globalAlpha = Math.min(1, 0.35 + v);
            ctx.fillRect(x * cell + offset, y * cell + offset, dot, dot);
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      obs.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [cell]);

  return <canvas ref={canvasRef} className={className ?? "w-full h-full block"} />;
};

export default FireGrid;
