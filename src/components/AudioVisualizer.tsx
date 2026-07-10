import { useState, useRef, useEffect, useCallback } from "react";
import { Music, Mic, Monitor, Play, Square, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";

const BAR_COUNT = 48;
type SourceType = "system" | "mic";

// Parse "H S% L%" CSS variable into [h, s, l] numbers
function parseCssHsl(val: string): [number, number, number] {
  const parts = val.trim().split(/\s+/);
  return [
    parseFloat(parts[0]) || 0,
    parseFloat(parts[1]) || 0,
    parseFloat(parts[2]) || 0,
  ];
}


const AudioVisualizer = () => {
  const [isActive, setIsActive] = useState(false);
  const [source, setSource] = useState<SourceType>("system");
  const [trackName, setTrackName] = useState<string>("");
  const [colored, setColored] = useState(false);
  const coloredRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const smoothedRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barW = w / BAR_COUNT;

    const style = getComputedStyle(document.documentElement);
    const [pH, pS, pL] = parseCssHsl(style.getPropertyValue("--primary"));

    const colorStops: [number, number, number][] = coloredRef.current
      ? [
          parseCssHsl(style.getPropertyValue("--contribution-low")),
          parseCssHsl(style.getPropertyValue("--contribution-medium")),
          parseCssHsl(style.getPropertyValue("--contribution-high")),
          parseCssHsl(style.getPropertyValue("--contribution-max")),
        ]
      : [];

    const smoothed = smoothedRef.current;

    const step = Math.floor(data.length / BAR_COUNT);

    for (let i = 0; i < BAR_COUNT; i++) {
      const raw = data[i * step] / 255;

      // Fast attack, slow decay
      smoothed[i] = raw > smoothed[i]
        ? smoothed[i] + (raw - smoothed[i]) * 0.75
        : smoothed[i] + (raw - smoothed[i]) * 0.12;

      // Power curve — makes quiet parts more visible, loud parts more dramatic
      const val = Math.pow(smoothed[i], 0.65);
      const barH = val * h * 0.92;
      const x = i * barW;

      if (coloredRef.current) {
        const [ch, cs, cl] = colorStops[i % colorStops.length];
        ctx.fillStyle = `hsl(${ch}, ${cs}%, ${cl}%)`;
      } else {
        ctx.fillStyle = `hsl(${pH}, ${pS}%, ${pL}%)`;
      }
      ctx.fillRect(x + 1, h - barH, barW - 2, barH);
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    analyserRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    smoothedRef.current.fill(0);
    setIsActive(false);
    setTrackName("");
  }, []);

  const connectStream = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    streamRef.current = stream;
    setIsActive(true);

    const audioTrack = stream.getAudioTracks()[0];
    setTrackName(audioTrack?.label || "Unknown source");
    audioTrack.onended = () => stop();
    animFrameRef.current = requestAnimationFrame(draw);
  }, [draw, stop]);

  const startSystem = async () => {
    try {
      let stream: MediaStream;

      const electronApi = (window as any).electron;
      if (electronApi?.isElectron) {
        // Electron: use desktopCapturer + getUserMedia with chromeMediaSource
        const sources: { id: string; name: string }[] =
          await electronApi.getDesktopSources();
        if (!sources || sources.length === 0) return;

        const sourceId = sources[0].id;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId,
            },
          } as any,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId,
            },
          } as any,
        });
        stream.getVideoTracks().forEach((t) => t.stop());
      } else {
        // Browser fallback
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        stream.getVideoTracks().forEach((t) => t.stop());
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      connectStream(new MediaStream(audioTracks));
    } catch {
      // User cancelled or permission denied
    }
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      connectStream(stream);
    } catch {
      // Permission denied or no mic
    }
  };

  const toggleColored = () => {
    coloredRef.current = !coloredRef.current;
    setColored((v) => !v);
  };

  const start = () => {
    if (source === "mic") startMic();
    else startSystem();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas);
    return () => {
      obs.disconnect();
      stop();
    };
  }, [stop]);

  return (
    <div className="border border-border rounded-md p-4 bg-card h-[185px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Music className="h-4 w-4 text-primary shrink-0" />
          <span className="font-body text-xs uppercase tracking-widest text-muted-foreground truncate">
            Audio Visualizer
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleColored}
            className={`p-1 border border-border rounded transition-colors mr-1 ${colored ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title={colored ? "Color mode on" : "Color mode off"}
          >
            <Palette className="h-3 w-3" />
          </button>
          {!isActive && (
            <div className="flex items-center border border-border rounded overflow-hidden mr-1">
              <button
                onClick={() => setSource("system")}
                className={`p-1 transition-colors ${source === "system" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="System audio"
              >
                <Monitor className="h-3 w-3" />
              </button>
              <button
                onClick={() => setSource("mic")}
                className={`p-1 transition-colors ${source === "mic" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Microphone"
              >
                <Mic className="h-3 w-3" />
              </button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={isActive ? stop : start}
            title={isActive ? "Stop" : "Start"}
          >
            {isActive ? (
              <Square className="h-3 w-3 text-destructive" />
            ) : (
              <Play className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {isActive && trackName && (
        <div className="flex items-center gap-1.5 mb-1.5 shrink-0 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
          <p className="font-body text-[10px] text-muted-foreground truncate">
            {trackName}
          </p>
        </div>
      )}

      <div className="flex-1 relative min-h-0">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-body text-xs text-muted-foreground">
              {source === "mic" ? "Click play to use microphone" : "Click play to capture system audio"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioVisualizer;
