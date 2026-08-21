import {
  ArrowLeft,
  AudioLines,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  Headphones,
  LoaderCircle,
  Mic,
  RefreshCcw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Volume2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router";

import InterviewAvatar from "../components/interview/InterviewAvatar";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  getInterview,
  getInterviewQuestionAudio,
  initializeInterview,
  submitInterviewAnswer,
} from "../services/interviewService";
import { startInterviewAudioRecorder } from "../utils/interviewAudioRecorder";
import { emitProgressionChanged } from "../utils/progressionEvents";

const createId = () => globalThis.crypto?.randomUUID?.() || `answer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const formatDuration = (ms) => `${Math.max(0, Math.floor(Number(ms || 0) / 1000))}s`;
const errorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const errorCode = (error) => error?.response?.data?.code || error?.code || "";
const MAX_RESTARTS_PER_QUESTION = 2;
const restartStorageKey = (interviewId, questionId) => `smart-interview:${interviewId}:${questionId}:restarts`;

function SmartInterviewSessionPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [engineState, setEngineState] = useState("ready");
  const [level, setLevel] = useState(0);
  const [hasSpeech, setHasSpeech] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [noSpeechRemainingMs, setNoSpeechRemainingMs] = useState(null);
  const [audioError, setAudioError] = useState("");
  const [audioErrorCode, setAudioErrorCode] = useState("");
  const [micError, setMicError] = useState("");
  const [processingError, setProcessingError] = useState("");
  const [retryPayload, setRetryPayload] = useState(null);
  const [lastTurnNotice, setLastTurnNotice] = useState("");
  const [slowVoice, setSlowVoice] = useState(false);
  const [voiceLatencyMs, setVoiceLatencyMs] = useState(null);
  const [restartCount, setRestartCount] = useState(0);

  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const audioUrlRef = useRef("");
  const voiceSlowTimerRef = useRef(null);
  const audioRequestTokenRef = useRef(0);
  const audioContextRef = useRef(null);
  const mountedRef = useRef(true);

  const unlockBrowserAudio = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContextClass();
      }
      const context = audioContextRef.current;
      context.resume?.().catch(() => {});
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.01);
    } catch {
      // Browser audio policies vary; the normal HTMLAudio path remains the fallback.
    }
  }, []);

  const cleanupPlayer = useCallback(() => {
    if (voiceSlowTimerRef.current) {
      window.clearTimeout(voiceSlowTimerRef.current);
      voiceSlowTimerRef.current = null;
    }

    const player = playerRef.current;
    playerRef.current = null;

    if (player) {
      // Detach handlers before clearing src. Some browsers emit an error event
      // when a completed media element is torn down, which previously surfaced
      // a false "Question audio could not be played" state after Astra spoke.
      player.onplaying = null;
      player.onended = null;
      player.onerror = null;
      try { player.pause(); } catch {}
      try {
        player.removeAttribute("src");
        player.load();
      } catch {}
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }
  }, []);

  const cleanupRecorder = useCallback(async () => {
    if (recorderRef.current) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      try { await recorder.dispose(); } catch {}
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    getInterview(interviewId)
      .then((response) => {
        if (!active) return;
        const value = response?.data?.interview || null;
        setInterview(value);
        if (value?.status === "completed") {
          setEngineState("complete");
        } else if (value?.currentQuestion?.id) {
          setEngineState("paused");
          setLastTurnNotice("Saved interview recovered. Resume Astra or answer the visible question when you are ready.");
        }
      })
      .catch((error) => { if (active) toast.error(errorMessage(error, "Interview could not be loaded.")); })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      mountedRef.current = false;
      cleanupPlayer();
      cleanupRecorder();
      try { audioContextRef.current?.close?.(); } catch {}
      audioContextRef.current = null;
    };
  }, [cleanupPlayer, cleanupRecorder, interviewId]);

  const turnConfig = interview?.turnConfig || {
    noSpeechTimeoutMs: 15000,
    endSilenceMs: 7000,
    maxAnswerSeconds: 120,
    warningSeconds: 5,
  };

  const currentQuestion = interview?.currentQuestion || null;
  const voiceQuotaExhausted = audioErrorCode === "GEMINI_TTS_QUOTA_EXHAUSTED";

  useEffect(() => {
    if (!currentQuestion?.id) {
      setRestartCount(0);
      return;
    }
    try {
      const stored = Number(sessionStorage.getItem(restartStorageKey(interviewId, currentQuestion.id)) || 0);
      setRestartCount(Math.max(0, Math.min(MAX_RESTARTS_PER_QUESTION, stored)));
    } catch {
      setRestartCount(0);
    }
  }, [currentQuestion?.id, interviewId]);

  const questionProgress = currentQuestion?.sequence || interview?.questionCount || 0;
  const recentTurns = useMemo(() => (interview?.transcript || []).slice(-4).reverse(), [interview]);

  const processFinishedRecording = useCallback(async (question, result, existingPayload = null) => {
    if (!question?.id || !mountedRef.current) return;
    setEngineState("processing");
    setLevel(0);
    setProcessingError("");
    setAudioError("");
    setAudioErrorCode("");
    setMicError("");

    const payload = existingPayload || {
      interviewId,
      questionId: question.id,
      submissionId: createId(),
      completionReason: result.reason,
      durationMs: result.durationMs,
      audioBlob: result.blob,
    };
    setRetryPayload(payload);

    try {
      const response = await submitInterviewAnswer(payload);
      if (!mountedRef.current) return;
      const nextInterview = response?.data?.interview || null;
      setInterview(nextInterview);
      setRetryPayload(null);
      try {
        sessionStorage.removeItem(restartStorageKey(interviewId, question.id));
      } catch {
        // Ignore storage cleanup failures.
      }
      setLastTurnNotice(
        result.reason === "no_speech"
          ? "No speech was detected, so Astra moved on."
          : result.reason === "manual_submit"
            ? "Answer submitted early."
            : result.reason === "silence_auto_submit"
              ? "Answer submitted after your pause."
              : "Maximum answer time reached.",
      );

      if (response?.data?.completed || nextInterview?.status === "completed") {
        setEngineState("complete");
        emitProgressionChanged();
        const progression = response?.data?.progression || nextInterview?.progressionReward || null;
        if (Number(progression?.xpEarned || 0) > 0) {
          toast.success(`Interview complete · +${Number(progression.xpEarned)} XP earned.`);
        } else if (progression?.antiFarmingApplied) {
          toast.success("Interview complete. Today's interview-completion XP was already earned.");
        } else {
          toast.success("Interview complete. Astra is preparing your report.");
        }
        return;
      }

      const nextQuestion = nextInterview?.currentQuestion;
      if (nextQuestion?.id) {
        playQuestionRef.current?.(nextQuestion);
      } else {
        setEngineState("paused");
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setProcessingError(errorMessage(error, "Astra could not process that answer. Your local recording is still available to retry."));
      setEngineState("paused");
    }
  }, [interviewId]);

  const startListening = useCallback(async (question) => {
    audioRequestTokenRef.current += 1;
    cleanupPlayer();
    await cleanupRecorder();
    setHasSpeech(false);
    setElapsedMs(0);
    setNoSpeechRemainingMs(turnConfig.noSpeechTimeoutMs);
    setLevel(0);
    setMicError("");
    setAudioError("");
    setSlowVoice(false);
    setEngineState("listening");

    try {
      const recorder = await startInterviewAudioRecorder({
        noSpeechTimeoutMs: turnConfig.noSpeechTimeoutMs,
        endSilenceMs: turnConfig.endSilenceMs,
        maxAnswerSeconds: turnConfig.maxAnswerSeconds,
        onLevel: (metrics) => {
          if (!mountedRef.current) return;
          setLevel(metrics.level);
          setElapsedMs(metrics.elapsedMs);
          setNoSpeechRemainingMs(metrics.noSpeechRemainingMs);
          if (metrics.hasSpeech) setHasSpeech(true);
        },
        onState: (state) => { if (mountedRef.current && state.hasSpeech) setHasSpeech(true); },
        onFinish: (result) => {
          recorderRef.current = null;
          processFinishedRecording(question, result);
        },
      });
      recorderRef.current = recorder;
    } catch (error) {
      setEngineState("paused");
      setMicError(errorMessage(error, "Microphone access was lost. Reconnect the microphone to continue."));
    }
  }, [cleanupPlayer, cleanupRecorder, processFinishedRecording, turnConfig.endSilenceMs, turnConfig.maxAnswerSeconds, turnConfig.noSpeechTimeoutMs]);

  const playQuestion = useCallback(async (question) => {
    if (!question?.id) return;
    await cleanupRecorder();
    cleanupPlayer();
    setEngineState("voice_preparing");
    setSlowVoice(false);
    setVoiceLatencyMs(null);
    setAudioError("");
    setAudioErrorCode("");
    setMicError("");
    setProcessingError("");
    setLevel(0.12);

    const requestToken = audioRequestTokenRef.current + 1;
    audioRequestTokenRef.current = requestToken;
    const requestStartedAt = performance.now();
    voiceSlowTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current && audioRequestTokenRef.current === requestToken) {
        setSlowVoice(true);
      }
    }, 4000);

    try {
      const audio = await getInterviewQuestionAudio(interviewId, question.id);
      if (!mountedRef.current || audioRequestTokenRef.current !== requestToken) return;
      if (voiceSlowTimerRef.current) {
        window.clearTimeout(voiceSlowTimerRef.current);
        voiceSlowTimerRef.current = null;
      }
      const requestMs = Math.round(performance.now() - requestStartedAt);
      setVoiceLatencyMs(requestMs);
      setSlowVoice(false);
      console.info("[smart-interview] question_audio_received", {
        questionId: question.id,
        sequence: question.sequence,
        requestMs,
        serverTtsMs: audio.serverTtsMs,
        cacheStatus: audio.cacheStatus,
        voice: audio.voice,
      });

      const url = URL.createObjectURL(audio.blob);
      audioUrlRef.current = url;
      const player = new Audio(url);
      playerRef.current = player;
      player.onplaying = () => {
        if (!mountedRef.current || audioRequestTokenRef.current !== requestToken) return;
        setSlowVoice(false);
        setAudioError("");
        setAudioErrorCode("");
        setEngineState("speaking");
        setLevel(0.22);
        console.info("[smart-interview] question_audio_playing", {
          questionId: question.id,
          sequence: question.sequence,
          totalMs: Math.round(performance.now() - requestStartedAt),
        });
      };
      player.onended = () => {
        if (!mountedRef.current || audioRequestTokenRef.current !== requestToken) return;
        cleanupPlayer();
        startListening(question);
      };
      player.onerror = () => {
        if (!mountedRef.current || audioRequestTokenRef.current !== requestToken) return;
        cleanupPlayer();
        if (!mountedRef.current) return;
        setLevel(0);
        setEngineState("paused");
        setAudioErrorCode("AUDIO_PLAYBACK_FAILED");
        setAudioError("Question audio could not be played. Retry Astra's voice or start answering from the visible question.");
      };
      await player.play();
    } catch (error) {
      if (!mountedRef.current || audioRequestTokenRef.current !== requestToken) return;
      cleanupPlayer();
      setLevel(0);
      setSlowVoice(false);
      setEngineState("paused");
      setAudioErrorCode(errorCode(error));
      setAudioError(errorMessage(error, "Astra's voice could not be generated. Retry the voice or start answering from the visible question."));
    }
  }, [cleanupPlayer, cleanupRecorder, interviewId, startListening]);

  const playQuestionRef = useRef(playQuestion);
  useEffect(() => { playQuestionRef.current = playQuestion; }, [playQuestion]);

  const beginInterview = async () => {
    unlockBrowserAudio();
    setEngineState("processing");
    setProcessingError("");
    try {
      let nextInterview = interview;
      if (!interview?.currentQuestion?.id && interview?.status !== "completed") {
        const response = await initializeInterview(interviewId);
        nextInterview = response?.data?.interview || interview;
        setInterview(nextInterview);
      }
      if (nextInterview?.status === "completed") {
        setEngineState("complete");
        return;
      }
      if (nextInterview?.currentQuestion?.id) await playQuestion(nextInterview.currentQuestion);
    } catch (error) {
      setEngineState("paused");
      setProcessingError(errorMessage(error, "Astra could not prepare the interview question."));
    }
  };

  const resumeWithVoice = () => {
    unlockBrowserAudio();
    setLastTurnNotice("");
    playQuestion(currentQuestion);
  };

  const answerVisibleQuestion = () => {
    unlockBrowserAudio();
    setLastTurnNotice("");
    startListening(currentQuestion);
  };

  const manualSubmit = () => {
    if (!hasSpeech || !recorderRef.current) return;
    recorderRef.current.stop("manual_submit");
  };

  const restartAnswer = async () => {
    if (!currentQuestion?.id) return;
    if (restartCount >= MAX_RESTARTS_PER_QUESTION) {
      toast.error(`Restart limit reached for this question (${MAX_RESTARTS_PER_QUESTION}). Continue this attempt or let Astra move on.`);
      return;
    }

    const nextCount = restartCount + 1;
    setRestartCount(nextCount);
    try {
      sessionStorage.setItem(restartStorageKey(interviewId, currentQuestion.id), String(nextCount));
    } catch {
      // Session storage is a UX guard only; recording can still continue without it.
    }

    await cleanupRecorder();
    setLastTurnNotice("");
    setSlowVoice(false);
    startListening(currentQuestion);
  };

  const retryProcessing = () => {
    if (!retryPayload || !currentQuestion?.id) return;
    processFinishedRecording(currentQuestion, {
      reason: retryPayload.completionReason,
      durationMs: retryPayload.durationMs,
      blob: retryPayload.audioBlob,
    }, retryPayload);
  };

  useEffect(() => {
    if (!["listening", "processing"].includes(engineState)) return undefined;
    const warnOnExit = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnOnExit);
    return () => window.removeEventListener("beforeunload", warnOnExit);
  }, [engineState]);

  if (loading) {
    return <DashboardLayout><div className="flex min-h-[55vh] items-center justify-center text-sm font-bold text-slate-500"><LoaderCircle size={20} className="mr-2 animate-spin" /> Loading interview...</div></DashboardLayout>;
  }

  if (!interview) {
    return <DashboardLayout><div className="rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-2xl font-black text-slate-900">Interview unavailable</h1><button type="button" onClick={() => navigate("/interview")} className="mt-5 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white">Back to Smart Interview</button></div></DashboardLayout>;
  }

  const noSpeechSeconds = noSpeechRemainingMs == null ? null : Math.ceil(noSpeechRemainingMs / 1000);
  const warning = engineState === "listening" && !hasSpeech && noSpeechSeconds != null && noSpeechSeconds <= Number(turnConfig.warningSeconds || 5);

  return (
    <DashboardLayout>
      <button type="button" onClick={() => navigate("/interview")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600 shadow-sm hover:text-violet-700"><ArrowLeft size={15} /> Interview home</button>

      <section className="mt-4 overflow-hidden rounded-[32px] border border-violet-200/75 bg-[linear-gradient(125deg,#ffffff_0%,#f5f3ff_56%,#ecfeff_100%)] p-6 shadow-[0_22px_70px_rgba(79,70,229,0.10)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600"><Sparkles size={15} /> Voice Smart Interview</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{interview.targetRole}</h1>
            <p className="mt-2 text-sm text-slate-600">Astra adapts each question to your role, {interview.useLearnerProfile !== false ? "learner profile, " : ""}resume context and the answers you give during this interview.</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            <span className="rounded-full border border-white/90 bg-white/80 px-3 py-2 text-xs font-extrabold text-slate-700">Q {Math.min(questionProgress || 1, interview.maxQuestions)} / {interview.maxQuestions}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700"><ShieldCheck size={14} /> Already charged</span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <section className="overflow-hidden rounded-[30px] border border-cyan-200/70 bg-white/92 shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:p-8">
            <div className="rounded-[28px] border border-violet-100 bg-[linear-gradient(145deg,rgba(245,243,255,0.72),rgba(236,254,255,0.62))] p-5">
              <InterviewAvatar state={engineState === "ready" ? "ready" : engineState} level={level} name={interview.interviewer?.name || "Astra"} />
            </div>

            <div className="flex min-h-[340px] flex-col sm:min-h-[390px] xl:min-h-[430px]">
              {interview.status === "completed" ? (
                <div className="my-auto rounded-[26px] border border-emerald-200 bg-emerald-50/65 p-7 text-center">
                  <CheckCircle2 size={34} className="mx-auto text-emerald-600" />
                  <h2 className="mt-4 text-2xl font-black text-slate-900">Interview questions complete.</h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">All {interview.maxQuestions} adaptive voice questions and evaluations are saved. Astra is preparing the final report in the background.</p>
                  {interview.progressionReward ? (
                    <div className="mx-auto mt-5 flex max-w-md flex-wrap items-center justify-center gap-2 rounded-2xl border border-white bg-white/75 p-3 text-xs font-bold text-slate-600">
                      <span className="inline-flex items-center gap-1.5 text-amber-700"><Zap size={14} /> +{Number(interview.progressionReward.xpEarned || 0)} XP</span>
                      <span className="text-slate-300">·</span>
                      <span>{interview.progressionReward.antiFarmingApplied ? "Daily completion XP already earned today" : "First eligible completion XP applied"}</span>
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={() => navigate(`/interview/${interview.id}/report`)} className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#0891b2)] px-4 py-2.5 text-sm font-extrabold text-white shadow-md"><BarChart3 size={16} /> View final report</button>
                    <button type="button" onClick={() => navigate("/interview")} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700">Interview history</button>
                  </div>
                </div>
              ) : !currentQuestion ? (
                <div className="my-auto text-center">
                  <Headphones size={34} className="mx-auto text-violet-600" />
                  <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.15em] text-cyan-700">Ready when you are</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-900">Begin your voice interview.</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">This first click unlocks audio playback in the browser. Astra will generate a personalized opening question, speak it, then your microphone will start listening automatically.</p>
                  <button type="button" onClick={beginInterview} disabled={engineState === "processing"} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#2563eb)] px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60">
                    {engineState === "processing" ? <><LoaderCircle size={17} className="animate-spin" /> Astra is preparing...</> : <><Volume2 size={17} /> Begin interview</>}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Question {currentQuestion.sequence} · {currentQuestion.category}</p>
                      <span className="mt-1 inline-block rounded-full bg-violet-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-violet-700">{currentQuestion.difficulty}</span>
                    </div>
                    <div className="text-right">
                      {lastTurnNotice && <span className="hidden text-xs font-bold text-emerald-600 sm:block">{lastTurnNotice}</span>}
                      {voiceLatencyMs != null && <span className="mt-1 hidden text-[10px] font-bold text-slate-400 sm:block">Last voice ready in {(voiceLatencyMs / 1000).toFixed(1)}s</span>}
                    </div>
                  </div>

                  <h2 className="mt-5 text-2xl font-black leading-9 tracking-tight text-slate-950">{currentQuestion.text}</h2>

                  <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 text-center text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
                    <div className={`rounded-xl px-2 py-2 ${["voice_preparing", "speaking"].includes(engineState) ? "bg-cyan-50 text-cyan-700" : ""}`}>1 · Astra asks</div>
                    <div className={`rounded-xl px-2 py-2 ${engineState === "listening" ? "bg-emerald-50 text-emerald-700" : ""}`}>2 · You answer</div>
                    <div className={`rounded-xl px-2 py-2 ${engineState === "processing" ? "bg-violet-50 text-violet-700" : ""}`}>3 · Astra evaluates</div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    {engineState === "voice_preparing" && (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 text-sm font-bold text-cyan-700">
                          <LoaderCircle size={19} className="shrink-0 animate-spin" />
                          <span>{slowVoice ? "Voice is taking longer than usual. You can keep waiting or answer from the visible question." : "Preparing Astra's voice… the question is ready on screen."}</span>
                        </div>
                        {slowVoice && (
                          <button
                            type="button"
                            onClick={() => startListening(currentQuestion)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800 shadow-sm hover:border-violet-300 hover:text-violet-700"
                          >
                            <Mic size={13} /> Answer without voice
                          </button>
                        )}
                      </div>
                    )}
                    {engineState === "speaking" && <div className="flex items-center gap-3 text-sm font-bold text-cyan-700"><AudioLines size={19} className="animate-pulse" /> Astra is asking the question. Your microphone starts automatically when she finishes.</div>}
                    {engineState === "listening" && (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-700"><Mic size={18} /> {hasSpeech ? "Listening to your answer" : "Waiting for you to start speaking"}</div>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Clock3 size={14} /> {formatDuration(elapsedMs)}</div>
                        </div>
                        <div className="mt-4 flex h-12 items-center gap-1 rounded-xl border border-white bg-white px-3 shadow-inner">
                          {Array.from({ length: 28 }).map((_, index) => {
                            const distance = Math.abs(index - 13.5) / 13.5;
                            const weight = 1 - distance * 0.55;
                            return <span key={index} className="flex-1 rounded-full bg-[linear-gradient(180deg,#22d3ee,#7c3aed)] transition-all duration-100" style={{ height: `${Math.max(4, 5 + level * 31 * weight)}px`, opacity: 0.45 + level * 0.55 }} />;
                          })}
                        </div>
                        {!hasSpeech && <p className={`mt-3 text-xs font-bold ${warning ? "text-rose-600" : "text-slate-500"}`}>{warning ? `No speech detected — moving on in ${noSpeechSeconds}s` : `Start speaking within ${noSpeechSeconds ?? Math.ceil(turnConfig.noSpeechTimeoutMs / 1000)}s. Astra will move on if there is no response.`}</p>}
                        {hasSpeech && <p className="mt-3 text-xs text-slate-500">When you finish, a {Math.round(turnConfig.endSilenceMs / 100) / 10}s pause submits automatically — or submit immediately below.</p>}
                      </div>
                    )}
                    {engineState === "processing" && <div className="flex items-center gap-3 text-sm font-bold text-violet-700"><LoaderCircle size={19} className="animate-spin" /> Astra is transcribing and evaluating your answer, then choosing the next question…</div>}
                    {engineState === "paused" && <div className="flex items-center gap-3 text-sm font-bold text-amber-700"><TimerReset size={19} /> Interview paused safely. Nothing will be double-charged.</div>}
                  </div>

                  {(audioError || micError || processingError) && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold leading-5 text-rose-700">
                      {audioError || micError || processingError}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {audioError && engineState === "paused" && <>
                          {!voiceQuotaExhausted ? (
                            <button type="button" onClick={resumeWithVoice} className="rounded-xl bg-white px-3 py-2 font-extrabold text-violet-700 ring-1 ring-violet-200"><RefreshCcw size={13} className="mr-1 inline" /> Retry voice</button>
                          ) : null}
                          <button type="button" onClick={answerVisibleQuestion} className="rounded-xl bg-slate-950 px-3 py-2 font-extrabold text-white"><Mic size={13} className="mr-1 inline" /> Answer from visible question</button>
                        </>}
                        {micError && <button type="button" onClick={() => startListening(currentQuestion)} className="rounded-xl bg-white px-3 py-2 font-extrabold text-violet-700 ring-1 ring-violet-200"><Mic size={13} className="mr-1 inline" /> Reconnect microphone</button>}
                        {processingError && retryPayload && <button type="button" onClick={retryProcessing} className="rounded-xl bg-white px-3 py-2 font-extrabold text-violet-700 ring-1 ring-violet-200"><RefreshCcw size={13} className="mr-1 inline" /> Retry processing</button>}
                        {processingError && !retryPayload && !currentQuestion?.id && <button type="button" onClick={beginInterview} className="rounded-xl bg-white px-3 py-2 font-extrabold text-violet-700 ring-1 ring-violet-200"><RefreshCcw size={13} className="mr-1 inline" /> Retry Astra</button>}
                      </div>
                    </div>
                  )}

                  {engineState === "listening" && (
                    <div className="mt-4">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/55 p-3">
                        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">Your answer controls</p>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <button type="button" onClick={manualSubmit} disabled={!hasSpeech} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#059669,#0d9488)] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><Send size={16} /> {hasSpeech ? "Submit answer now" : "Start speaking to enable submit"}</button>
                          <button type="button" onClick={restartAnswer} disabled={restartCount >= MAX_RESTARTS_PER_QUESTION} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600 hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw size={15} /> {restartCount >= MAX_RESTARTS_PER_QUESTION ? "Restart limit reached" : "Restart"}</button>
                        </div>
                        <p className="mt-2 text-[10px] font-semibold text-slate-500">Restarts are limited to {MAX_RESTARTS_PER_QUESTION} per question so restarting cannot keep a turn open indefinitely. Used: {restartCount}/{MAX_RESTARTS_PER_QUESTION}.</p>
                      </div>
                    </div>
                  )}
                  {["ready", "paused"].includes(engineState) && currentQuestion && !(audioError || micError || processingError) && (
                    <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/55 p-4">
                      <p className="text-xs font-extrabold text-violet-800">{engineState === "paused" ? "Saved turn ready to resume" : "Question ready"}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Your current question is saved. Resume with Astra's voice or answer directly from the visible prompt.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={resumeWithVoice} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-extrabold text-white"><Volume2 size={14} /> Resume with Astra</button>
                        <button type="button" onClick={answerVisibleQuestion} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700"><Mic size={14} /> Answer visible question</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[26px] border border-slate-200 bg-white/90 p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Voice rules</p>
            <div className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
              <div className="flex gap-2"><Mic size={15} className="mt-0.5 shrink-0 text-emerald-600" /><span>No speech for {Math.round(turnConfig.noSpeechTimeoutMs / 1000)}s → Astra moves on.</span></div>
              <div className="flex gap-2"><TimerReset size={15} className="mt-0.5 shrink-0 text-violet-600" /><span>After you speak, {Math.round(turnConfig.endSilenceMs / 100) / 10}s of silence → automatic submit.</span></div>
              <div className="flex gap-2"><Send size={15} className="mt-0.5 shrink-0 text-cyan-600" /><span>Submit early whenever you've said enough.</span></div>
              <div className="flex gap-2"><Clock3 size={15} className="mt-0.5 shrink-0 text-amber-600" /><span>Maximum answer length: {turnConfig.maxAnswerSeconds}s.</span></div>
            </div>
          </section>

          <section className="rounded-[26px] border border-slate-200 bg-white/90 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><FileText size={16} /> Candidate context</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{interview.resume?.fileName || "No resume attached"}</p>
            <p className={`mt-2 text-[11px] font-bold ${interview.useLearnerProfile !== false ? "text-emerald-600" : "text-slate-500"}`}>Learner profile: {interview.useLearnerProfile !== false ? "Included" : "Excluded from interview scope"}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">Role + resume context remain active across every question. Later turns also use your previous answers.</p>
          </section>

          <section className="rounded-[26px] border border-slate-200 bg-white/90 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><BrainCircuit size={16} /> Recent answers</div>
            {recentTurns.length ? <div className="mt-3 space-y-3">{recentTurns.map((turn) => <div key={turn.submissionId} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Q{turn.questionNumber}</p><p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-700">{turn.answerTranscript || "No verbal response"}</p></div>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">Your captured transcripts will appear here as the interview progresses.</p>}
          </section>

          <section className="rounded-[26px] border border-cyan-200 bg-cyan-50/60 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-cyan-900"><AudioLines size={16} /> Audio privacy</div>
            <p className="mt-2 text-xs leading-5 text-cyan-900/75">Answer audio is sent to Gemini only for the current turn. StudyFluxAI stores the resulting transcript/evaluation, not the raw recording.</p>
          </section>
        </aside>
      </div>
    </DashboardLayout>
  );
}

export default SmartInterviewSessionPage;
