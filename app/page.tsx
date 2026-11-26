"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DrawingUtils, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Camera, CameraOff, Eye, EyeOff, FlipHorizontal2, RotateCcw, Volume2, VolumeX } from "lucide-react";
import params from "@/lib/waras_params.json";
import { evaluateRep, jointAngles, RepTracker, type Frame, type Verdict } from "@/lib/squat";
import { WarasCatMascot, WarasLogo, type MascotStatus } from "@/components/WarasMascot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PixelNumber } from "@/components/PixelNumber";

// WASM version must match the installed @mediapipe/tasks-vision version.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Thigh parallel to the floor ≈ 90° at the knee; the matching hip angle comes from the fitted hip–knee line.
const KNEE_TARGET = 90;
const HIP_TARGET = Math.round(params.k * KNEE_TARGET + params.b);

// Live phase from the knee angle. 160° matches RepTracker's default `up`; "Dasar" is within 10° of parallel.
type Phase = "Berdiri" | "Gerak" | "Dasar";
const PHASES: Phase[] = ["Berdiri", "Gerak", "Dasar"];
const phaseOf = (knee: number): Phase => (knee >= 160 ? "Berdiri" : knee <= KNEE_TARGET + 10 ? "Dasar" : "Gerak");

async function createPose() {
  const vision = await FilesetResolver.forVisionTasks(WASM);
  const make = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  try {
    return await make("GPU");
  } catch {
    return make("CPU"); // some phones/browsers have no usable WebGL
  }
}

// Square-wave blips you can hear from 3 m away: rising pair = valid rep, one low buzz = needs correction.
function playCue(ac: AudioContext, ok: boolean) {
  (ok ? [660, 990] : [220]).forEach((freq, i) => {
    const t = ac.currentTime + i * 0.12;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.1 : 0.3));
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

// Section and field labels: sentence case, no tracking. Small caps-style labels read as template chrome.
const LABEL = "text-sm font-semibold text-mute";
// Every frame corner is sharp. Change this one value to bring rounding back to the shared frames.
const RADIUS = "rounded-none";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(undefined);
  // Refs so the frame loop (created once in start) always sees the latest tracker and audio setting.
  const trackerRef = useRef(new RepTracker());
  const cueRef = useRef<AudioContext | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [error, setError] = useState("");
  const [live, setLive] = useState<Frame | null>(null);
  const [history, setHistory] = useState<boolean[]>([]); // one entry per rep: passed or not
  const [last, setLast] = useState<Verdict | null>(null);
  const [mirror, setMirror] = useState(true);
  const [audio, setAudio] = useState(false);
  const [panel, setPanel] = useState(true); // side text on or off; the pixel mascot stays either way

  useEffect(
    () => () => {
      stopRef.current?.();
      cueRef.current?.close();
    },
    [],
  );

  async function start() {
    setStatus("loading");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stopRef.current = () => stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const pose = await createPose();
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const draw = new DrawingUtils(ctx);
      let raf = 0;
      let lastTime = -1;

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (video.currentTime === lastTime || video.videoWidth === 0) return;
        lastTime = video.currentTime;
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const lm = pose.detectForVideo(video, performance.now()).landmarks[0];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!lm) return setLive(null);
        draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: "#F97316", lineWidth: 4 });
        draw.drawLandmarks(lm, { color: "#1C1917", fillColor: "#F3F0EB", lineWidth: 2, radius: 4 });
        const f = jointAngles(lm, video.videoWidth / video.videoHeight);
        setLive(f);
        const rep = f && trackerRef.current.push(f);
        if (rep) {
          const v = evaluateRep(rep, params);
          if (cueRef.current) playCue(cueRef.current, v.ok);
          setLast(v);
          setHistory((h) => [...h, v.ok]);
        }
      };
      loop();

      stopRef.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        pose.close();
      };
      setStatus("running");
    } catch (e) {
      stopRef.current?.();
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stop() {
    stopRef.current?.();
    stopRef.current = undefined;
    setStatus("idle");
    setLive(null);
  }

  function toggleAudio() {
    if (cueRef.current) {
      cueRef.current.close();
      cueRef.current = null;
      setAudio(false);
    } else {
      // Created inside the click so browsers allow it to play.
      cueRef.current = new AudioContext();
      playCue(cueRef.current, true);
      setAudio(true);
    }
  }

  function reset() {
    trackerRef.current = new RepTracker();
    setHistory([]);
    setLast(null);
  }

  const running = status === "running";
  const total = history.length;
  const good = history.filter(Boolean).length;
  const mood: MascotStatus = !last ? "idle" : last.ok ? "good" : "warning";
  const flip = mirror ? "-scale-x-100" : "";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col lg:border-x lg:border-line">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-4">
        <div className="flex min-w-0 items-center gap-3">
          <WarasLogo size={30} />
          <h1 className="font-display text-3xl font-bold leading-none">WARAS</h1>
          <p className="truncate text-[15px] text-mute">
            Wawasan Analisis Raga dan Sikap<span className="hidden md:inline">: korektor squat real-time</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setPanel((p) => !p)}
            aria-pressed={panel}
            aria-label="Tampilkan teks samping"
            title={panel ? "Sembunyikan teks samping" : "Tampilkan teks samping"}
            className="flex h-9 items-center gap-2 border border-line px-3 text-[15px] font-semibold text-ink hover:bg-line active:translate-y-px"
          >
            {panel ? <Eye size={16} strokeWidth={2} /> : <EyeOff size={16} strokeWidth={2} />}
            <span className="hidden sm:inline">Teks samping</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main
        className={`grid flex-1 content-start lg:grid-rows-[auto_1fr] lg:content-stretch ${
          panel ? "lg:grid-cols-[minmax(0,68fr)_minmax(0,32fr)]" : "lg:grid-cols-[minmax(0,1fr)_200px]"
        }`}
      >
        <section aria-label="Kamera" className="p-3 sm:p-5">
          <div className={`overflow-hidden border border-line ${RADIUS}`}>
            <div className="relative aspect-[4/3] w-full md:aspect-video">
              {/* The screen stays dark in both themes so the video and overlay read like a monitor. */}
              <div data-theme="dark" className="absolute inset-0 overflow-hidden bg-well text-ink">
                {/* Mirrored like a selfie by default; angles are unaffected by the flip. */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`absolute inset-0 h-full w-full object-contain ${flip}`}
                />
                <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full object-contain ${flip}`} />

                {running && (
                  <p className={`absolute left-3 top-3 flex items-center gap-2 bg-canvas/80 px-2.5 py-1 text-[13px] font-semibold ${RADIUS}`}>
                    {/* The dot marks a real state: a pose is being tracked or it is not. */}
                    <span className={`size-2 ${live ? "bg-accent" : "bg-line-strong"}`} aria-hidden />
                    <span className={live ? "text-ink" : "text-mute"}>{live ? "Pose terkunci" : "Mencari pose…"}</span>
                  </p>
                )}
                {running && live && <PhaseStrip phase={phaseOf(live.knee)} />}

                {!running && (
                  <SetupOverlay loading={status === "loading"} error={status === "error" ? error : ""} onStart={start} />
                )}
              </div>
            </div>

            {/* Control bar, flush under the viewport. Icons are the usual ones for camera, mirror, sound and reset. */}
            <div className="grid auto-rows-[48px] grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
              <ControlButton
                onClick={running ? stop : start}
                disabled={status === "loading"}
                icon={running ? <CameraOff size={16} strokeWidth={2} /> : <Camera size={16} strokeWidth={2} />}
              >
                {running ? "Hentikan kamera" : status === "loading" ? "Memuat…" : "Mulai kamera"}
              </ControlButton>
              <ControlButton
                onClick={() => setMirror((m) => !m)}
                pressed={mirror}
                icon={<FlipHorizontal2 size={16} strokeWidth={2} />}
              >
                Mirror
              </ControlButton>
              <ControlButton
                onClick={toggleAudio}
                pressed={audio}
                icon={audio ? <Volume2 size={16} strokeWidth={2} /> : <VolumeX size={16} strokeWidth={2} />}
              >
                Suara
              </ControlButton>
              <ControlButton
                onClick={reset}
                disabled={total === 0}
                icon={<RotateCcw size={16} strokeWidth={2} />}
              >
                Reset
              </ControlButton>
            </div>
          </div>
        </section>

        {/* Phones: camera, telemetry, then method. Desktop: method sits under the camera, telemetry spans both rows. */}
        <aside
          aria-label="Telemetri"
          className="flex flex-col bg-panel lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-line"
        >
          {panel ? (
            <>
          <div className="grid grid-cols-2">
            <Metric label="Repetisi" className="border-b border-r">
              <BigNumber>{total}</BigNumber>
            </Metric>
            <Metric label="Benar" className="border-b">
              <BigNumber className="text-accent-ink">{good}</BigNumber>
            </Metric>
            <Metric label="Sudut panggul" className="border-b border-r">
              <Angle value={live?.hip} target={HIP_TARGET} />
            </Metric>
            <Metric label="Sudut lutut" className="border-b">
              <Angle value={live?.knee} target={KNEE_TARGET} />
            </Metric>
          </div>

          <History history={history} />

          {/* The outline color is the state: orange after a valid rep, red after a rep to fix. */}
          <section
            aria-live="polite"
            aria-label="Repetisi terakhir"
            className={`m-4 border-2 bg-canvas p-4 ${RADIUS} ${
              mood === "good" ? "border-accent" : mood === "warning" ? "border-warn" : "border-line"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className={LABEL}>Repetisi terakhir</h2>
              {last && (
                <p className="text-sm tabular-nums">
                  <span className="text-mute">Rep {total}: </span>
                  <span className={`font-bold ${last.ok ? "text-accent-ink" : "text-warn-ink"}`}>{last.ok ? "Valid" : "Perbaiki"}</span>
                </p>
              )}
            </div>
            <div className="flex items-start gap-4">
              <WarasCatMascot status={mood} size={80} />
              <div className="min-w-0 text-base leading-relaxed">
                {!last && <p className="text-mute">Lakukan satu squat penuh (turun lalu berdiri).</p>}
                {last?.ok && <p className="font-semibold text-accent-ink">Bagus! Squat standar.</p>}
                {last && !last.ok && (
                  <ul className="list-disc space-y-1.5 pl-4 marker:text-warn-ink">
                    {last.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <footer className="mt-auto border-t border-line px-4 py-3 text-[13px] leading-relaxed text-mute">
            Video diproses di perangkatmu dan tidak dikirim ke server. Metode: Yao et al. (2026), Computers 15(5):293.
          </footer>
            </>
          ) : (
            /* Text hidden: only the animated mascot is left. It still reacts to every rep. */
            <div className="flex items-center justify-center p-4 lg:flex-1">
              <WarasCatMascot status={mood} size={128} />
              <p className="sr-only" aria-live="polite">
                {last ? (last.ok ? "Squat benar" : "Squat perlu diperbaiki") : ""}
              </p>
            </div>
          )}
        </aside>

        <MethodPanel />
      </main>
    </div>
  );
}

const STEPS = [
  "Taruh kamera setinggi pinggang",
  "Berdiri menyamping 2–3 m dari kamera",
  "Seluruh badan dari bahu sampai pergelangan kaki terlihat",
];

function SetupOverlay({ loading, error, onStart }: { loading: boolean; error: string; onStart: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-10 p-5">
      <AlignmentGuide />
      <div className="flex max-w-xs flex-col gap-5">
        <div>
          <h2 className={`${LABEL} mb-3`}>Persiapan</h2>
          {/* A real sequence, so the steps are numbered. */}
          <ol className="space-y-2.5">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-3 text-[15px] leading-snug sm:text-base">
                <span className="w-4 shrink-0 font-semibold tabular-nums text-accent-ink">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <button
          onClick={onStart}
          disabled={loading}
          className={`self-start bg-accent px-5 py-2.5 text-[15px] font-bold text-on-accent hover:bg-ink hover:text-canvas active:translate-y-px disabled:cursor-wait disabled:opacity-60 ${RADIUS}`}
        >
          {loading ? "Memuat model…" : "Mulai kamera"}
        </button>
        {error && (
          <p role="alert" className={`border border-warn px-3 py-2 text-sm leading-snug text-warn-ink ${RADIUS}`}>
            Kamera tidak bisa dibuka: {error}. Cek izin kamera di browser, lalu coba lagi.
          </p>
        )}
      </div>
    </div>
  );
}

// Side view: camera at waist height on the left, athlete in profile 2-3 m away, tracked joints marked.
function AlignmentGuide() {
  const joints: [number, number][] = [
    [150, 44],
    [150, 82],
    [150, 106],
    [150, 128],
  ];
  return (
    <svg
      viewBox="0 0 200 150"
      className="hidden w-56 shrink-0 md:block lg:w-64"
      fill="none"
      stroke="#A8A29B"
      strokeWidth={1.5}
      shapeRendering="crispEdges"
      aria-label="Panduan posisi: kamera setinggi pinggang, badan menyamping"
      role="img"
    >
      <line x1="6" y1="130" x2="194" y2="130" stroke="#57524C" />
      {/* camera + tripod */}
      <rect x="14" y="76" width="16" height="10" stroke="#F3F0EB" />
      <line x1="30" y1="81" x2="34" y2="81" stroke="#F3F0EB" />
      <line x1="22" y1="86" x2="22" y2="130" />
      {/* line of sight at waist height */}
      <line x1="36" y1="81" x2="140" y2="81" strokeDasharray="3 3" />
      {/* distance */}
      <line x1="22" y1="140" x2="150" y2="140" />
      <line x1="22" y1="136" x2="22" y2="144" />
      <line x1="150" y1="136" x2="150" y2="144" />
      <text x="86" y="137" textAnchor="middle" fill="#A8A29B" stroke="none" fontSize="9" fontWeight="600">
        2–3 m
      </text>
      {/* athlete in profile */}
      <circle cx="150" cy="34" r="7" stroke="#F3F0EB" shapeRendering="auto" />
      <polyline points="150,44 150,82 150,106 150,128 140,128" stroke="#F3F0EB" />
      <polyline points="150,46 150,66 146,72" stroke="#F3F0EB" />
      {joints.map(([x, y]) => (
        <rect key={y} x={x - 2.5} y={y - 2.5} width="5" height="5" fill="#F97316" stroke="none" />
      ))}
      {/* visible span: shoulder to ankle */}
      <line x1="172" y1="44" x2="172" y2="128" stroke="#F97316" />
      <line x1="168" y1="44" x2="176" y2="44" stroke="#F97316" />
      <line x1="168" y1="128" x2="176" y2="128" stroke="#F97316" />
    </svg>
  );
}

function ControlButton({
  onClick,
  disabled,
  pressed,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="flex min-w-0 items-center justify-center gap-2 bg-panel px-2 text-[15px] font-semibold text-ink hover:bg-line active:translate-y-px disabled:cursor-not-allowed disabled:text-mute disabled:hover:bg-panel disabled:active:translate-y-0"
    >
      {icon}
      <span className="truncate">{children}</span>
      {/* On/off state of the toggle, so it reads without relying on color alone. */}
      {pressed !== undefined && (
        <span className={`text-[13px] font-bold ${pressed ? "text-accent-ink" : "text-mute"}`}>{pressed ? "Aktif" : "Mati"}</span>
      )}
    </button>
  );
}

function Metric({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-3 border-line p-4 ${className}`}>
      <h2 className={LABEL}>{label}</h2>
      {children}
    </div>
  );
}

// Pixel numerals (components/PixelNumber.tsx): big enough to read from the 2-3 m the person stands away from the screen.
function BigNumber({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <p className={`leading-none ${className}`}>
      <PixelNumber value={String(children)} unit={String(children).length > 3 ? 9 : 10} />
    </p>
  );
}

// Gauge runs from 180° (standing, empty) to 40° (very deep, full); orange once the target depth is reached.
const pct = (deg: number) => Math.min(100, Math.max(0, ((180 - deg) / 140) * 100));

function Angle({ value, target }: { value?: number; target: number }) {
  const has = value !== undefined;
  const reached = has && value <= target;
  return (
    <>
      <BigNumber className={reached ? "text-accent-ink" : ""}>{has ? `${value.toFixed(0)}°` : "-"}</BigNumber>
      <div>
        <div className="relative h-1.5 bg-line">
          {has && (
            <div
              className={`absolute inset-y-0 left-0 ${reached ? "bg-accent" : "bg-ink"}`}
              style={{ width: `${pct(value)}%` }}
            />
          )}
          <div className="absolute -inset-y-1 w-0.5 bg-mute" style={{ left: `${pct(target)}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[13px] tabular-nums text-mute">
          <span>180°</span>
          <span>Target {target}°</span>
        </div>
      </div>
    </>
  );
}

const HISTORY_SLOTS = 12;

// Last 12 reps as a strip of cells, oldest on the left.
function History({ history }: { history: boolean[] }) {
  const offset = Math.max(0, history.length - HISTORY_SLOTS);
  const recent = history.slice(offset);
  const rate = history.length ? Math.round((history.filter(Boolean).length / history.length) * 100) : null;
  return (
    <div className="border-b border-line p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className={LABEL}>Riwayat {HISTORY_SLOTS} rep</h2>
        <p className="text-sm tabular-nums text-mute">
          Akurasi <span className="font-semibold text-ink">{rate === null ? "-" : `${rate}%`}</span>
        </p>
      </div>
      <ol className="grid grid-cols-12 gap-1">
        {Array.from({ length: HISTORY_SLOTS }, (_, i) => {
          const ok = recent[i];
          return (
            <li
              key={i}
              className={`h-4 ${ok === undefined ? "border border-line" : ok ? "bg-accent" : "bg-warn"}`}
              aria-hidden={ok === undefined}
              aria-label={ok === undefined ? undefined : `Rep ${offset + i + 1}: ${ok ? "valid" : "perbaiki"}`}
            />
          );
        })}
      </ol>
    </div>
  );
}

function PhaseStrip({ phase }: { phase: Phase }) {
  return (
    <ol aria-label="Fase squat" className={`absolute right-3 top-3 flex overflow-hidden border border-line bg-canvas/80 ${RADIUS}`}>
      {PHASES.map((p) => {
        const on = p === phase;
        return (
          <li
            key={p}
            aria-current={on ? "step" : undefined}
            className={`border-line px-2.5 py-1 text-[13px] font-semibold not-first:border-l ${
              on ? (p === "Dasar" ? "bg-accent text-on-accent" : "bg-ink text-canvas") : "text-mute"
            }`}
          >
            {p}
          </li>
        );
      })}
    </ol>
  );
}

const fmt = (n: number, digits: number) => n.toFixed(digits).replace(".", ",");

// What the app actually checks, with the live fitted numbers, so the verdict is never a black box.
// Three parallel checks, not a sequence, so they are not numbered.
const RULES = [
  {
    title: "Koordinasi",
    body: "Sudut panggul harus mengikuti sudut lutut sepanjang gerakan.",
    formula: `|panggul − (${fmt(params.k, 2)}·lutut + ${fmt(params.b, 2)})| ≤ ${fmt(params.tol, 1)}°, lolos di ≥${Math.round(params.minPassRatio * 100)}% frame`,
  },
  {
    title: "Kedalaman",
    body: "Di titik terendah, panggul tidak boleh lebih tinggi dari lutut.",
    formula: `toleransi ${fmt(params.delta * 100, 1)}% panjang paha`,
  },
  {
    title: "Hitungan",
    body: "Satu repetisi dihitung saat lutut menekuk lalu lurus kembali.",
    formula: "mulai < 160°, wajib < 145°, selesai ≥ 160°",
  },
];

function MethodPanel() {
  return (
    <section aria-label="Cara penilaian" className="border-t border-line px-3 py-5 sm:px-5 lg:col-start-1 lg:border-t-0 lg:pt-0">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className={LABEL}>Cara penilaian</h2>
        {/* Leave-one-subject-out result on the paper's Zenodo data; see README "Akurasi". */}
        <p className="text-sm tabular-nums text-mute">
          Akurasi uji <span className="font-semibold text-ink">91,15%</span> (LOSO)
        </p>
      </div>
      <ul className={`grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3 ${RADIUS}`}>
        {RULES.map((r) => (
          <li key={r.title} className="flex flex-col gap-2 bg-panel p-4">
            <h3 className="text-lg font-bold">{r.title}</h3>
            <p className="text-[15px] leading-relaxed text-mute">{r.body}</p>
            <p className="mt-auto border-t border-line pt-2 text-sm font-medium tabular-nums">{r.formula}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
