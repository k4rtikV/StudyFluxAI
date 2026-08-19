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
  const [micError, setMicError] = useState("");
  const [processingError, setProcessingError] = useState("");
  const [retryPayload, setRetryPayload] = useState(null);
  const [lastTurnNotice, setLastTurnNotice] = useState("");

  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const audioUrlRef = useRef("");
  const mountedRef = useRef(true);

  const cleanupPlayer = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.src = "";
      playerRef.current = null;
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
        if (value?.status === "completed") setEngineState("complete");
      })
      .catch((error) => { if (active) toast.error(errorMessage(error, "Interview could not be loaded.")); })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      mountedRef.current = false;
      cleanupPlayer();
      cleanupRecorder();
    };
  }, [cleanupPlayer, cleanupRecorder, interviewId]);

  const turnConfig = interview?.turnConfig || {
    noSpeechTimeoutMs: 15000,
    endSilenceMs: 3000,
    maxAnswerSeconds: 120,
    warningSeconds: 5,
  };

  const currentQuestion = interview?.currentQuestion || null;
  const questionProgress = currentQuestion?.sequence || interview?.questionCount || 0;
  const recentTurns = useMemo(() => (interview?.transcript || []).slice(-4).reverse(), [interview]);

  const processFinishedRecording = useCallback(async (question, result, existingPayload = null) => {
    if (!question?.id || !mountedRef.current) return;
    setEngineState("processing");
    setLevel(0);
    setProcessingError("");
    setAudioError("");
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
        window.setTimeout(() => {
          if (mountedRef.current) playQuestionRef.current?.(nextQuestion);
        }, 650);
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
    await cleanupRecorder();
    setHasSpeech(false);
    setElapsedMs(0);
    setNoSpeechRemainingMs(turnConfig.noSpeechTimeoutMs);
    setLevel(0);
    setMicError("");
    setAudioError("");
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
  }, [cleanupRecorder, processFinishedRecording, turnConfig.endSilenceMs, turnConfig.maxAnswerSeconds, turnConfig.noSpeechTimeoutMs]);

  const playQuestion = useCallback(async (question) => {
    if (!question?.id) return;
    await cleanupRecorder();
    cleanupPlayer();
    setEngineState("speaking");
    setAudioError("");
    setMicError("");
    setProcessingError("");
    setLevel(0.2);

    try {
      const blob = await getInterviewQuestionAudio(interviewId, question.id);
      if (!mountedRef.current) return;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const player = new Audio(url);
      playerRef.current = player;
      player.onended = () => {
        cleanupPlayer();
        if (mountedRef.current) startListening(question);
      };
      player.onerror = () => {
        cleanupPlayer();
        if (!mountedRef.current) return;
        setLevel(0);
        setEngineState("paused");
        setAudioError("Question audio could not be played. You can retry Astra's voice or answer from the visible question text.");
      };
      await player.play();
    } catch (error) {
      cleanupPlayer();
      if (!mountedRef.current) return;
      setLevel(0);
      setEngineState("paused");
      setAudioError(errorMessage(error, "Astra's voice could not be generated. Retry the audio or continue from the question text."));
    }
  }, [cleanupPlayer, cleanupRecorder, interviewId, startListening]);

  const playQuestionRef = useRef(playQuestion);
  useEffect(() => { playQuestionRef.current = playQuestion; }, [playQuestion]);

  const beginInterview = async () => {
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

  const manualSubmit = () => {
    if (!hasSpeech || !recorderRef.current) return;
    recorderRef.current.stop("manual_submit");
  };

  const restartAnswer = async () => {
    if (!currentQuestion?.id) return;
    await cleanupRecorder();
    setLastTurnNotice("");
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
            <p className="mt-2 text-sm text-slate-600">Astra adapts each question to your role, learner profile, resume context and the answers you give during this interview.</p>
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

            <div className="flex min-h-[430px] flex-col">
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
                    {lastTurnNotice && <span className="hidden text-xs font-bold text-emerald-600 sm:block">{lastTurnNotice}</span>}
                  </div>

                  <h2 className="mt-5 text-2xl font-black leading-9 tracking-tight text-slate-950">{currentQuestion.text}</h2>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    {engineState === "speaking" && <div className="flex items-center gap-3 text-sm font-bold text-cyan-700"><AudioLines size={19} className="animate-pulse" /> Astra is asking the question in your headphones...</div>}
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
                    {engineState === "processing" && <div className="flex items-center gap-3 text-sm font-bold text-violet-700"><LoaderCircle size={19} className="animate-spin" /> Gemini is transcribing, evaluating and choosing the next question...</div>}
                    {engineState === "paused" && <div className="flex items-center gap-3 text-sm font-bold text-amber-700"><TimerReset size={19} /> Interview paused safely. Nothing will be double-charged.</div>}
                  </div>

                  {(audioError || micError || processingError) && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold leading-5 text-rose-700">
                      {audioError || micError || processingError}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {audioError && <><button type="button" onClick={() => playQuestion(currentQuestion)} className="rounded-xl bg-white px-3 py-2 font-extrabold text-violet-700 ring-1 ring-violet-200"><RefreshCcw size={13} className="mr-1 inline" /> Retry voice</button><button type="button" onClick={() => startListening(currentQuestion)} className="rounded-xl bg-slate-950 px-3 py-2 font-extrabold text-white">Answer from text</button></>}
                        {micError && <button type="button" onClick={() => startListening(currentQuestion)} className="rounded-xl bg-white px-3 py-2 font-extrabold text-violet-700 ring-1 ring-violet-200"><Mic size={13} className="mr-1 inline" /> Reconnect microphone</button>}
                        {processingError && retryPayload && <button type="button" onClick={retryProcessing} className="rounded-xl bg-white px-3 py-2 font-extrabold text-violet-700 ring-1 ring-violet-200"><RefreshCcw size={13} className="mr-1 inline" /> Retry processing</button>}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-3 pt-6">
                    {engineState === "listening" && <>
                      <button type="button" onClick={manualSubmit} disabled={!hasSpeech} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#059669,#0d9488)] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><Send size={16} /> Submit answer</button>
                      <button type="button" onClick={restartAnswer} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600 hover:border-violet-300 hover:text-violet-700"><RotateCcw size={15} /> Restart answer</button>
                    </>}
                    {engineState === "ready" && currentQuestion && <button type="button" onClick={() => playQuestion(currentQuestion)} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-extrabold text-white"><Volume2 size={16} /> Play question</button>}
                  </div>
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
            <p className="mt-2 text-[11px] leading-5 text-slate-400">Profile + role + resume context remain active across every question. Later turns also use your previous answers.</p>
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
