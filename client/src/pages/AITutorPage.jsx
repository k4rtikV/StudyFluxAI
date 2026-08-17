import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  GraduationCap,
  History,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import TutorMessageContent from "../components/tutor/TutorMessageContent";
import useAuth from "../hooks/useAuth";
import DashboardLayout from "../layouts/DashboardLayout";
import { getLearningProfile } from "../services/learningProfileService";
import { listStudySessions } from "../services/studySessionService";
import {
  archiveTutorConversation,
  createTutorConversation,
  getTutorConversation,
  getTutorUsage,
  listTutorConversations,
  sendTutorMessage,
} from "../services/tutorService";

const LEVEL_LABELS = {
  class_7: "Class 7",
  class_8: "Class 8",
  class_9: "Class 9",
  class_10: "Class 10",
  class_11: "Class 11",
  class_12: "Class 12",
  diploma: "Diploma",
  bachelors: "Bachelor's / Undergraduate",
  masters: "Master's / Postgraduate",
  mba: "MBA",
  phd: "PhD / Doctorate",
  other: "Other",
};

const SUGGESTIONS = [
  "Explain this concept in simpler terms with an example.",
  "Quiz me with one short practice question, then explain my answer.",
  "Compare the two most important ideas in this topic.",
  "Walk me through this step by step instead of giving only the answer.",
];

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  "AI Tutor could not complete that request.";

const formatConversationTime = (value) => {
  if (!value) {
    return "New";
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return sameDay
    ? new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
      }).format(date);
};

function UsagePill({ usage, compact = false }) {
  const freeRemaining = Number(usage?.freeRemaining || 0);
  const paidCost = Number(usage?.paidQuestionCost || 0);

  if (freeRemaining > 0) {
    return (
      <div
        className={`inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/85 px-3 py-1.5 font-extrabold text-emerald-700 ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        <Sparkles size={compact ? 13 : 14} className="shrink-0" />
        <span className="whitespace-nowrap">
          {freeRemaining} free question{freeRemaining === 1 ? "" : "s"} left today
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200 bg-violet-50/88 px-3 py-1.5 font-extrabold text-violet-700 ${
        compact ? "text-[11px]" : "text-xs"
      }`}
    >
      <FluxGemMark size={compact ? 18 : 20} className="rounded-[9px]" />
      <span className="whitespace-nowrap">{paidCost} FluxGems per question</span>
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  loading,
  onSelect,
  onNew,
  onArchive,
  onClose,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-100 p-4">
        <button
          type="button"
          onClick={() => {
            onNew();
            onClose?.();
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet-200/50 transition hover:-translate-y-0.5"
        >
          <MessageSquarePlus size={17} />
          New Tutor chat
        </button>
      </div>

      <div className="sf-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        <p className="px-2 pb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
          Conversation history
        </p>

        {loading ? (
          <div className="flex items-center gap-2 px-2 py-4 text-sm font-semibold text-slate-500">
            <LoaderCircle size={16} className="animate-spin" />
            Loading chats...
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
            <History size={20} className="mx-auto text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-700">
              No Tutor history yet
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Your completed Tutor conversations will stay here.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;

              return (
                <div
                  key={conversation.id}
                  className={`group flex items-center rounded-2xl border transition ${
                    active
                      ? "border-cyan-200 bg-cyan-50/80 shadow-sm"
                      : "border-transparent hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(conversation.id);
                      onClose?.();
                    }}
                    className="min-w-0 flex-1 px-3 py-3 text-left"
                  >
                    <p
                      className={`truncate text-sm font-extrabold ${
                        active ? "text-cyan-900" : "text-slate-700"
                      }`}
                    >
                      {conversation.title}
                    </p>

                    <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                      <span>
                        {conversation.successfulQuestionCount} question
                        {conversation.successfulQuestionCount === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <span>
                        {formatConversationTime(
                          conversation.lastMessageAt ||
                            conversation.createdAt,
                        )}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onArchive(conversation.id)}
                    title="Remove conversation"
                    aria-label="Remove conversation"
                    className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AITutorPage() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { user, setUser } = useAuth();

  const [usage, setUsage] = useState(null);
  const [profile, setProfile] = useState(null);
  const [studySessions, setStudySessions] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  const [selectedStudySessionId, setSelectedStudySessionId] = useState("");

  const [input, setInput] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const bottomRef = useRef(null);

  const activeConversationId = activeConversation?.id || "";

  const selectedStudySession = useMemo(
    () =>
      studySessions.find(
        (session) => session.id === selectedStudySessionId,
      ) || null,
    [selectedStudySessionId, studySessions],
  );

  const loadConversation = async (conversationId) => {
    if (!conversationId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    try {
      setLoadingConversation(true);

      const response = await getTutorConversation(conversationId);
      const data = response?.data || {};

      setActiveConversation(data.conversation || null);
      setMessages(data.messages || []);
      setSelectedStudySessionId(
        data.conversation?.contextStudySession?.id || "",
      );

      setSearchParams(
        {
          conversation: conversationId,
        },
        {
          replace: true,
        },
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingConversation(false);
    }
  };

  const refreshConversations = async () => {
    const response = await listTutorConversations();
    const items = response?.data?.conversations || [];
    setConversations(items);
    return items;
  };

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      try {
        const [
          usageResponse,
          profileResponse,
          sessionsResponse,
          conversationsResponse,
        ] = await Promise.all([
          getTutorUsage(),
          getLearningProfile(),
          listStudySessions(30),
          listTutorConversations(),
        ]);

        if (!active) {
          return;
        }

        setUsage(usageResponse?.data?.usage || null);
        setProfile(profileResponse?.data?.profile || null);
        setStudySessions(sessionsResponse?.data?.studySessions || []);

        const items = conversationsResponse?.data?.conversations || [];

        setConversations(items);

        const requestedConversationId = new URLSearchParams(
          window.location.search,
        ).get("conversation");

        const initialConversation =
          items.find(
            (conversation) =>
              conversation.id === requestedConversationId,
          ) || items[0];

        if (initialConversation?.id) {
          await loadConversation(initialConversation.id);
        }
      } catch (error) {
        if (active) {
          toast.error(getErrorMessage(error));
        }
      } finally {
        if (active) {
          setLoadingInitial(false);
        }
      }
    };

    loadInitial();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: messages.length > 2 ? "smooth" : "auto",
      block: "end",
    });
  }, [messages, sending]);

  const startNewChat = () => {
    setSearchParams({}, { replace: true });
    setActiveConversation(null);
    setMessages([]);
    setSelectedStudySessionId("");
    setInput("");
  };

  const handleArchive = async (conversationId) => {
    try {
      await archiveTutorConversation(conversationId);
      const remaining = conversations.filter(
        (conversation) => conversation.id !== conversationId,
      );

      setConversations(remaining);

      if (activeConversationId === conversationId) {
        if (remaining[0]?.id) {
          await loadConversation(remaining[0].id);
        } else {
          startNewChat();
        }
      }

      toast.success("Tutor conversation removed from history.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const updateBalance = (balance) => {
    if (!Number.isFinite(Number(balance))) {
      return;
    }

    setUser((current) =>
      current
        ? {
            ...current,
            fluxGems: Number(balance),
          }
        : current,
    );
  };

  const handleSend = async (overrideText = "") => {
    const question = String(overrideText || input).trim();

    if (!question || sending) {
      return;
    }

    let conversationId = activeConversationId;
    let conversationForRequest = activeConversation;

    try {
      setSending(true);

      if (!conversationId) {
        const created = await createTutorConversation({
          studySessionId: selectedStudySessionId,
        });

        conversationForRequest = created?.data?.conversation || null;
        conversationId = conversationForRequest?.id || "";

        if (!conversationId) {
          throw new Error(
            "Tutor conversation could not be created.",
          );
        }

        setActiveConversation(conversationForRequest);
        setSearchParams(
          {
            conversation: conversationId,
          },
          {
            replace: true,
          },
        );
      }

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        role: "user",
        content: question,
        status: "processing",
        billing: null,
      };

      setMessages((current) => [...current, optimisticMessage]);
      setInput("");

      try {
        const response = await sendTutorMessage(conversationId, question);

        const data = response?.data || {};

        setMessages((current) => [
          ...current.filter((message) => message.id !== tempId),
          data.userMessage,
          data.assistantMessage,
        ]);

        setUsage(data.usage || usage);

        if (data.billing?.charged > 0) {
          updateBalance(data.billing.balance);
        }

        const refreshed = await refreshConversations();
        const updatedConversation = refreshed.find(
          (conversation) => conversation.id === conversationId,
        );

        if (updatedConversation) {
          setActiveConversation((current) => ({
            ...(current || conversationForRequest),
            ...updatedConversation,
          }));
        }
      } catch (error) {
        setMessages((current) =>
          current.filter((message) => message.id !== tempId),
        );

        const balance = error?.response?.data?.data?.balance;
        updateBalance(balance);

        if (
          error?.response?.data?.code ===
          "TUTOR_INSUFFICIENT_FLUXGEMS"
        ) {
          toast.error(getErrorMessage(error), {
            duration: 4500,
          });
        } else {
          toast.error(getErrorMessage(error));
        }

        try {
          const usageResponse = await getTutorUsage();
          setUsage(usageResponse?.data?.usage || usage);
        } catch {
          // Keep the chat usable if usage refresh fails.
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const profileSummary = useMemo(() => {
    if (!profile) {
      return "";
    }

    return [
      LEVEL_LABELS[profile.educationLevel] || profile.educationLevel,
      profile.program,
      profile.stream,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [profile]);

  const freeRemaining = Number(usage?.freeRemaining || 0);
  const paidCost = Number(usage?.paidQuestionCost || 0);
  const insufficientForPaid =
    freeRemaining <= 0 && Number(user?.fluxGems || 0) < paidCost;

  return (
    <DashboardLayout>
      <section className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-600 text-white shadow-lg shadow-cyan-200/60">
              <BrainCircuit size={20} />
            </div>

            <div>
              <p className="text-sm font-bold text-cyan-700">
                Conversational learning
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                AI Tutor
              </h1>
            </div>
          </div>

          <p className="mt-2 max-w-3xl leading-7 text-slate-600">
            Ask follow-up questions, work through difficult ideas, or attach a
            saved Study Library session for grounded help.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {usage && <UsagePill usage={usage} />}

          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm xl:hidden"
          >
            <History size={16} />
            History
          </button>
        </div>
      </section>

      <section className="grid gap-5 lg:h-[calc(100vh-198px)] xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/72 shadow-[0_14px_36px_rgba(15,23,42,0.06)] backdrop-blur-xl xl:flex xl:flex-col">
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            loading={loadingInitial}
            onSelect={loadConversation}
            onNew={startNewChat}
            onArchive={handleArchive}
          />
        </aside>

        <div className="flex min-h-[650px] min-w-0 flex-col overflow-hidden rounded-3xl border border-cyan-200/80 bg-white/70 shadow-[0_18px_48px_rgba(14,165,233,0.08)] backdrop-blur-xl lg:min-h-0 lg:h-full">
          <div className="border-b border-slate-100 bg-gradient-to-r from-cyan-50/80 via-white/80 to-violet-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-slate-900">
                  {activeConversation?.title ||
                    "Start a new Tutor conversation"}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap size={13} />
                    {profileSummary || "Learning profile"}
                  </span>

                  {activeConversation?.contextStudySession && (
                    <>
                      <span>·</span>
                      <span className="inline-flex min-w-0 items-center gap-1 text-cyan-700">
                        <BookOpenCheck size={13} />
                        <span className="max-w-[320px] truncate">
                          {activeConversation.contextStudySession.title}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/profile/edit")}
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-indigo-200 bg-white/80 px-3 py-2 text-xs font-extrabold text-indigo-700 transition hover:bg-white"
              >
                <UserRound size={14} />
                Edit learner profile
              </button>
            </div>

            {!activeConversationId && (
              <div className="mt-4 rounded-2xl border border-white/90 bg-white/70 p-3.5 backdrop-blur">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
                      Optional Study Library context
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Attach one saved learning item before your first message.
                      This conversation will stay grounded to it.
                    </p>
                  </div>

                  <select
                    value={selectedStudySessionId}
                    onChange={(event) =>
                      setSelectedStudySessionId(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/70 lg:max-w-md"
                  >
                    <option value="">No saved session — general Tutor</option>

                    {studySessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedStudySession && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-cyan-50/70 px-3 py-2 text-xs leading-5 text-cyan-800">
                    <BookOpenCheck size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Tutor will receive the persisted content from
                      <strong> {selectedStudySession.title}</strong> as
                      conversation context.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sf-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {loadingInitial || loadingConversation ? (
              <div className="flex h-full min-h-[420px] items-center justify-center">
                <div className="text-center">
                  <LoaderCircle
                    size={28}
                    className="mx-auto animate-spin text-cyan-600"
                  />
                  <p className="mt-3 text-sm font-semibold text-slate-500">
                    Loading your Tutor workspace...
                  </p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex min-h-[430px] max-w-3xl flex-col items-center justify-center text-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl bg-cyan-300/30 blur-2xl" />
                  <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-600 text-white shadow-xl">
                    <BrainCircuit size={29} />
                  </div>
                </div>

                <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-950">
                  What are we learning today?
                </h2>

                <p className="mt-2 max-w-xl leading-7 text-slate-500">
                  Ask for an explanation, work through a problem, or use Tutor
                  as a guided revision partner. Follow-ups stay in this
                  conversation.
                </p>

                <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                      }}
                      className="group rounded-2xl border border-slate-200 bg-white/75 p-4 text-left text-sm font-semibold leading-6 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50/55 hover:text-cyan-900"
                    >
                      <span>{suggestion}</span>
                      <ArrowRight
                        size={14}
                        className="mt-3 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-500"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-6 pb-2">
                {messages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isUser && (
                        <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-sm">
                          <BrainCircuit size={17} />
                        </div>
                      )}

                      <div
                        className={`max-w-[90%] rounded-[28px] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] sm:max-w-[82%] sm:px-5 ${
                          isUser
                            ? "rounded-br-xl border border-violet-400/20 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-[0_18px_36px_rgba(109,40,217,0.24)]"
                            : "rounded-bl-xl border border-cyan-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,252,255,0.98)_100%)] text-slate-700 shadow-[0_12px_30px_rgba(14,165,233,0.06)]"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap text-sm leading-7 sm:text-[15px]">
                            {message.content}
                          </p>
                        ) : (
                          <TutorMessageContent content={message.content} />
                        )}

                        {isUser && message.billing && (
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">
                            {message.billing.isFree
                              ? "Free Tutor question"
                              : `${message.billing.cost} FluxGems`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex gap-3">
                    <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-sm">
                      <BrainCircuit size={17} />
                    </div>

                    <div className="rounded-[28px] rounded-bl-xl border border-cyan-100/85 bg-[linear-gradient(180deg,rgba(240,249,255,0.92)_0%,rgba(237,246,255,0.92)_100%)] px-5 py-4 shadow-[0_12px_28px_rgba(14,165,233,0.10)]">
                      <div className="flex items-center gap-2 text-sm font-bold text-cyan-800">
                        <LoaderCircle size={16} className="animate-spin" />
                        Tutor is thinking...
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white/88 p-3 backdrop-blur sm:p-4">
            {insufficientForPaid && (
              <div className="mx-auto mb-3 flex max-w-4xl flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <WalletCards size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Your free questions are used up and the next question costs
                    {" "}
                    {paidCost} FluxGems.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/wallet")}
                  className="shrink-0 font-extrabold text-amber-800 underline-offset-2 hover:underline"
                >
                  Open wallet
                </button>
              </div>
            )}

            <div className="mx-auto max-w-4xl">
              <div className="rounded-3xl border border-slate-200 bg-white/96 p-2 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-100/60">
                <textarea
                  value={input}
                  maxLength={2000}
                  rows={3}
                  disabled={sending}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    activeConversation?.contextStudySession
                      ? "Ask about this saved learning session..."
                      : "Ask AI Tutor anything you're learning..."
                  }
                  className="max-h-40 min-h-[72px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 sm:text-[15px]"
                />

                <div className="flex flex-col gap-2 px-2 pb-1 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-left">
                    {usage && <UsagePill usage={usage} compact />}
                    <span className="text-[10px] font-semibold text-slate-400">
                      Enter to send · Shift+Enter for new line
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || sending}
                    className="grid h-10 w-10 shrink-0 self-end place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:self-auto"
                    aria-label="Send Tutor question"
                  >
                    {sending ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Send size={17} />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 px-2 text-[10px] font-semibold text-slate-400">
                <span>Tutor answers use your saved learner profile by default.</span>
                <span>{input.length}/2000</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {historyOpen && (
        <>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            aria-label="Close Tutor history"
            className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] xl:hidden"
          />

          <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(92vw,360px)] flex-col border-l border-slate-200 bg-white shadow-2xl xl:hidden">
            <div className="flex h-[68px] items-center justify-between border-b border-slate-100 px-4">
              <div className="flex items-center gap-2">
                <History size={18} className="text-cyan-600" />
                <p className="font-extrabold text-slate-900">Tutor history</p>
              </div>

              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              <ConversationList
                conversations={conversations}
                activeId={activeConversationId}
                loading={loadingInitial}
                onSelect={loadConversation}
                onNew={startNewChat}
                onArchive={handleArchive}
                onClose={() => setHistoryOpen(false)}
              />
            </div>
          </aside>
        </>
      )}
    </DashboardLayout>
  );
}

export default AITutorPage;
