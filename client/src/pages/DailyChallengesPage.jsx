import {
  BarChart3,
  Check,
  Clock3,
  Gem,
  LoaderCircle,
  MessageSquare,
  Sparkles,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import useAuth from "../hooks/useAuth";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  answerDailyChallenge,
  getCommunityPolls,
  getDailyChallenge,
  voteCommunityPoll,
} from "../services/communityService";
import { getCommunitySocket } from "../utils/communitySocket";

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "";

const extractError = (error, fallback) =>
  error?.response?.data?.message || fallback;

function ResultBadge({ correct }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${
        correct
          ? "bg-emerald-100 text-emerald-700"
          : "bg-rose-100 text-rose-700"
      }`}
    >
      {correct ? <Check size={14} /> : <X size={14} />}
      {correct ? "Correct" : "Not quite"}
    </div>
  );
}

function PollCard({ poll, onVote, voting }) {
  const hasVoted = Boolean(poll.userVoteOptionId);
  const totalVotes = Number(poll.results?.totalVotes || 0);

  return (
    <article className="rounded-3xl border border-violet-200/80 bg-white/80 p-5 shadow-[0_16px_40px_rgba(76,29,149,0.07)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">
            <MessageSquare size={15} />
            Community poll
          </p>
          <h3 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">
            {poll.question}
          </h3>
        </div>

        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {poll.options.map((option) => {
          const result = poll.results?.options?.find(
            (item) => item.optionId === option.id,
          );
          const percentage = Number(result?.percentage || 0);
          const selected = poll.userVoteOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              disabled={hasVoted || voting}
              onClick={() => onVote(poll.id, option.id)}
              className={`relative w-full overflow-hidden rounded-2xl border p-4 text-left transition ${
                selected
                  ? "border-violet-400 bg-violet-50"
                  : hasVoted
                    ? "border-slate-200 bg-slate-50/80"
                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm"
              }`}
            >
              {hasVoted && (
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 bg-violet-100/70 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              )}

              <span className="relative flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-slate-800">
                  {option.text}
                </span>

                {hasVoted && (
                  <span className="shrink-0 text-sm font-extrabold text-violet-700">
                    {percentage}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        {hasVoted
          ? "Results update live as the StudyFluxAI community votes."
          : `Vote once before ${formatDateTime(poll.expiresAt)} to reveal the live community result.`}
      </p>
    </article>
  );
}

function DailyChallengesPage() {
  const { setUser } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [votingPollId, setVotingPollId] = useState(null);

  const load = async () => {
    try {
      const [challengeResponse, pollsResponse] = await Promise.all([
        getDailyChallenge(),
        getCommunityPolls(),
      ]);

      const nextChallenge = challengeResponse.data?.challenge || null;
      setChallenge(nextChallenge);
      setSelectedOption(nextChallenge?.attempt?.selectedOptionIndex ?? null);
      setPolls(pollsResponse.data?.polls || []);
    } catch (error) {
      toast.error(extractError(error, "We couldn't load community activities."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pollRoomKey = useMemo(
    () => polls.map((poll) => poll.id).join("|"),
    [polls],
  );

  useEffect(() => {
    if (!pollRoomKey) return undefined;

    const socket = getCommunitySocket();
    const pollIds = pollRoomKey.split("|");

    pollIds.forEach((pollId) => socket.emit("community:join-poll", pollId));

    const handleResults = ({ pollId, results }) => {
      setPolls((current) =>
        current.map((poll) =>
          poll.id === pollId ? { ...poll, results } : poll,
        ),
      );
    };

    socket.on("community:poll-results", handleResults);

    return () => {
      socket.off("community:poll-results", handleResults);
      pollIds.forEach((pollId) => socket.emit("community:leave-poll", pollId));
    };
  }, [pollRoomKey]);

  const answered = Boolean(challenge?.attempt);
  const isCorrect = Boolean(challenge?.attempt?.isCorrect);

  const rewardSummary = useMemo(() => {
    if (!challenge?.attempt) return null;
    return {
      xp: Number(challenge.attempt.xpEarned || 0),
      gems: Number(challenge.attempt.fluxGemsEarned || 0),
    };
  }, [challenge]);

  const submitAnswer = async () => {
    if (!challenge || selectedOption === null) {
      toast.error("Choose an answer first.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await answerDailyChallenge(challenge.id, selectedOption);
      const nextChallenge = response.data?.challenge;
      const balance = Number(response.data?.balance);

      setChallenge(nextChallenge);
      if (Number.isFinite(balance)) {
        setUser((current) =>
          current ? { ...current, fluxGems: balance } : current,
        );
      }

      if (nextChallenge?.attempt?.isCorrect) {
        toast.success(
          `Correct — +${nextChallenge.attempt.xpEarned} XP and +${nextChallenge.attempt.fluxGemsEarned} FluxGems.`,
        );
      } else {
        toast("Answer saved. Check the explanation below.");
      }
    } catch (error) {
      toast.error(extractError(error, "We couldn't submit your answer."));
      if (error?.response?.status === 409) await load();
    } finally {
      setSubmitting(false);
    }
  };

  const vote = async (pollId, optionId) => {
    setVotingPollId(pollId);
    try {
      const response = await voteCommunityPoll(pollId, optionId);
      const data = response.data;
      setPolls((current) =>
        current.map((poll) =>
          poll.id === pollId
            ? {
                ...poll,
                userVoteOptionId: data.userVoteOptionId,
                results: data.results,
              }
            : poll,
        ),
      );
      toast.success("Vote recorded.");
    } catch (error) {
      toast.error(extractError(error, "We couldn't record your vote."));
    } finally {
      setVotingPollId(null);
    }
  };

  return (
    <DashboardLayout>
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-emerald-600">Community learning</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Daily Challenges
          </h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-500">
            Test yourself on one universal challenge, earn progression rewards for correct answers, and join live community polls.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="mt-8 grid min-h-[320px] place-items-center rounded-3xl border border-slate-200 bg-white/70">
          <div className="text-center">
            <LoaderCircle className="mx-auto animate-spin text-emerald-600" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Loading today's activities...</p>
          </div>
        </div>
      ) : (
        <>
          <section className="mt-6 overflow-hidden rounded-[28px] border border-emerald-300/90 bg-gradient-to-br from-emerald-100/95 via-white/90 to-cyan-50/90 shadow-[0_24px_60px_rgba(16,185,129,0.12)]">
            {challenge ? (
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                      <Trophy size={23} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                        Today's challenge
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {challenge.category} · {challenge.difficulty}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-700">
                      <Zap size={14} /> +{challenge.xpReward} XP
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                      <Gem size={14} /> +{challenge.fluxGemReward} FluxGems
                    </span>
                  </div>
                </div>

                <h2 className="mt-7 max-w-4xl text-2xl font-extrabold leading-snug tracking-tight text-slate-950 sm:text-3xl">
                  {challenge.question}
                </h2>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {challenge.options.map((option) => {
                    const selected = selectedOption === option.index;
                    const correct = answered && challenge.correctOptionIndex === option.index;
                    const wrongSelected = answered && selected && !correct;

                    return (
                      <button
                        key={option.index}
                        type="button"
                        disabled={answered || submitting}
                        onClick={() => setSelectedOption(option.index)}
                        className={`flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-left transition ${
                          correct
                            ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100"
                            : wrongSelected
                              ? "border-rose-300 bg-rose-50"
                              : selected
                                ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100"
                                : "border-slate-200 bg-white/85 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
                        }`}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-600">
                          {String.fromCharCode(65 + option.index)}
                        </span>
                        <span className="font-bold text-slate-800">{option.text}</span>
                      </button>
                    );
                  })}
                </div>

                {!answered ? (
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <Clock3 size={16} /> Available until {formatDateTime(challenge.expiresAt)}
                    </p>
                    <button
                      type="button"
                      disabled={selectedOption === null || submitting}
                      onClick={submitAnswer}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}
                      Submit answer
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <ResultBadge correct={isCorrect} />
                      <div className="flex items-center gap-3 text-sm font-extrabold">
                        <span className="text-amber-700">+{rewardSummary?.xp || 0} XP</span>
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <FluxGemMark size={20} /> +{rewardSummary?.gems || 0}
                        </span>
                      </div>
                    </div>
                    <p className="mt-4 text-sm font-bold text-slate-700">Explanation</p>
                    <p className="mt-1 leading-7 text-slate-600">
                      {challenge.explanation || "The correct answer has been highlighted above."}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid min-h-[330px] place-items-center p-8 text-center">
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Trophy size={25} />
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold text-slate-900">No challenge is live right now</h2>
                  <p className="mx-auto mt-2 max-w-lg leading-7 text-slate-500">
                    The next admin-scheduled Daily Challenge will appear here automatically when its publish window begins.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-violet-600">Live community</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Community polls</h2>
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                <BarChart3 size={15} /> Real-time results
              </span>
            </div>

            {polls.length > 0 ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {polls.map((poll) => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    voting={votingPollId === poll.id}
                    onVote={vote}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm font-semibold text-slate-500">
                No community poll is live at the moment.
              </div>
            )}
          </section>
        </>
      )}
    </DashboardLayout>
  );
}

export default DailyChallengesPage;
