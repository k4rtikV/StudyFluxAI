import {
  CheckCircle2,
  CircleAlert,
  Gauge,
  LoaderCircle,
  Mic,
  Radio,
  RotateCcw,
  Square,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { runInterviewNetworkPreflight } from "../../services/interviewService";

const formatMetric = (value, suffix = "ms") =>
  Number.isFinite(value) ? `${Math.round(value)} ${suffix}` : "—";

const pickRecorderMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((value) => MediaRecorder.isTypeSupported?.(value)) || "";
};

function InterviewAudioPreflight({ onChange }) {
  const [micState, setMicState] = useState("idle");
  const [recording, setRecording] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState("");
  const [audioConfirmed, setAudioConfirmed] = useState(false);
  const [networkState, setNetworkState] = useState("idle");
  const [networkMetrics, setNetworkMetrics] = useState(null);
  const [error, setError] = useState("");

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
    cleanupStream();
  }, [cleanupStream]);

  useEffect(() => () => {
    if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
  }, [testAudioUrl]);

  const audioReady = micState === "ready" && audioConfirmed;
  const networkReady = networkState === "ready";

  useEffect(() => {
    onChange?.({
      audioReady,
      networkReady,
      ready: audioReady && networkReady,
      metrics: networkMetrics,
    });
  }, [audioReady, networkMetrics, networkReady, onChange]);

  const requestMicrophone = async () => {
    setError("");
    setMicState("requesting");
    setAudioConfirmed(false);
    if (testAudioUrl) {
      URL.revokeObjectURL(testAudioUrl);
      setTestAudioUrl("");
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support microphone recording.");
      }
      cleanupStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const liveTrack = stream.getAudioTracks().find((track) => track.readyState === "live");
      if (!liveTrack) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("A live microphone track was not detected.");
      }
      streamRef.current = stream;
      setMicState("ready");
    } catch (requestError) {
      setMicState(requestError?.name === "NotAllowedError" ? "denied" : "error");
      setError(
        requestError?.name === "NotAllowedError"
          ? "Microphone permission was blocked. Allow microphone access in the browser and try again."
          : requestError?.message || "Microphone check failed.",
      );
    }
  };

  const stopRecording = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startTestRecording = async () => {
    setError("");
    setAudioConfirmed(false);
    if (testAudioUrl) {
      URL.revokeObjectURL(testAudioUrl);
      setTestAudioUrl("");
    }

    if (!streamRef.current?.getAudioTracks?.().some((track) => track.readyState === "live")) {
      await requestMicrophone();
    }

    const stream = streamRef.current;
    if (!stream?.getAudioTracks?.().some((track) => track.readyState === "live")) return;

    try {
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm",
        });
        chunksRef.current = [];
        setRecording(false);
        if (!blob.size) {
          setError("The microphone test did not capture audio. Try again.");
          return;
        }
        const nextUrl = URL.createObjectURL(blob);
        setTestAudioUrl(nextUrl);
      };
      recorder.onerror = () => {
        setRecording(false);
        setError("The microphone test recording failed. Try again.");
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      stopTimerRef.current = setTimeout(stopRecording, 4500);
    } catch (recordError) {
      setRecording(false);
      setError(recordError?.message || "The microphone test recording failed.");
    }
  };

  const runNetworkCheck = async () => {
    setNetworkState("checking");
    setNetworkMetrics(null);
    setError("");
    try {
      const metrics = await runInterviewNetworkPreflight();
      setNetworkMetrics(metrics);
      setNetworkState("ready");
    } catch (networkError) {
      setNetworkState("error");
      setError(networkError?.response?.data?.message || "Connection preflight failed. Check the backend connection and try again.");
    }
  };

  const networkQuality = useMemo(() => {
    if (!networkMetrics) return null;
    const latency = Number(networkMetrics.averageLatencyMs || 0);
    const jitter = Number(networkMetrics.jitterMs || 0);
    if (latency <= 180 && jitter <= 80) return { label: "Strong", className: "text-emerald-700" };
    if (latency <= 450 && jitter <= 180) return { label: "Usable", className: "text-amber-700" };
    return { label: "Slow", className: "text-rose-700" };
  }, [networkMetrics]);

  return (
    <div className="mt-6 rounded-[24px] border border-cyan-200/80 bg-[linear-gradient(135deg,rgba(236,254,255,0.75),rgba(245,243,255,0.72),rgba(255,255,255,0.9))] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-cyan-700">Audio & connection preflight</p>
          <h3 className="mt-1 text-lg font-black text-slate-900">Check your microphone before anything is charged.</h3>
        </div>
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${audioReady && networkReady ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
          {audioReady && networkReady ? <CheckCircle2 size={13} /> : <Radio size={13} />}
          {audioReady && networkReady ? "Ready" : "Preflight required"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/90 bg-white/86 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${audioReady ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}><Mic size={18} /></span>
              <div>
                <p className="text-sm font-extrabold text-slate-900">Microphone</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">Allow access, record a short sample, listen back, then confirm it sounds clear.</p>
              </div>
            </div>
            {audioReady && <CheckCircle2 size={19} className="shrink-0 text-emerald-600" />}
          </div>

          {micState !== "ready" ? (
            <button type="button" disabled={micState === "requesting"} onClick={requestMicrophone} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-extrabold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60">
              {micState === "requesting" ? <><LoaderCircle size={15} className="animate-spin" /> Checking microphone...</> : <><Mic size={15} /> Enable microphone</>}
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><CheckCircle2 size={14} /> {audioConfirmed ? "Microphone test confirmed" : "Live microphone detected"}</div>
              <button type="button" onClick={recording ? stopRecording : startTestRecording} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold transition ${recording ? "bg-rose-600 text-white hover:bg-rose-700" : "border border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-700"}`}>
                {recording ? <><Square size={14} fill="currentColor" /> Stop test recording</> : <><Volume2 size={15} /> Record 4-second test</>}
              </button>
              {testAudioUrl && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <audio controls src={testAudioUrl} className="h-9 w-full" />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => { setAudioConfirmed(true); cleanupStream(); }} className={`flex-1 rounded-xl px-3 py-2 text-xs font-extrabold ${audioConfirmed ? "bg-emerald-600 text-white" : "bg-violet-600 text-white hover:bg-violet-700"}`}>
                      {audioConfirmed ? "Audio confirmed" : "My audio sounds clear"}
                    </button>
                    <button type="button" onClick={startTestRecording} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600 hover:text-violet-700"><RotateCcw size={13} /> Retest</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/90 bg-white/86 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${networkReady ? "bg-emerald-50 text-emerald-700" : "bg-cyan-50 text-cyan-700"}`}><Gauge size={18} /></span>
              <div>
                <p className="text-sm font-extrabold text-slate-900">Connection</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">Checks API round-trip latency, jitter and a small upload to the StudyFluxAI server.</p>
              </div>
            </div>
            {networkReady && <CheckCircle2 size={19} className="shrink-0 text-emerald-600" />}
          </div>

          {networkMetrics && (
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
              <div><p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Latency</p><p className="mt-1 text-xs font-black text-slate-800">{formatMetric(networkMetrics.averageLatencyMs)}</p></div>
              <div><p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Jitter</p><p className="mt-1 text-xs font-black text-slate-800">{formatMetric(networkMetrics.jitterMs)}</p></div>
              <div><p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Upload</p><p className="mt-1 text-xs font-black text-slate-800">{formatMetric(networkMetrics.uploadMs)}</p></div>
            </div>
          )}
          {networkQuality && <p className={`mt-3 text-xs font-extrabold ${networkQuality.className}`}>Connection quality: {networkQuality.label}</p>}
          <button type="button" disabled={networkState === "checking"} onClick={runNetworkCheck} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-xs font-extrabold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-60">
            {networkState === "checking" ? <><LoaderCircle size={15} className="animate-spin" /> Running connection check...</> : networkReady ? <><RotateCcw size={14} /> Run again</> : <><Gauge size={15} /> Run connection check</>}
          </button>
        </div>
      </div>

      {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700"><CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}</div>}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">The test recording stays in this browser and is discarded when you leave the page. It is not uploaded or saved.</p>
    </div>
  );
}

export default InterviewAudioPreflight;
