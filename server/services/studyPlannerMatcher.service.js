import StudySession from "../models/StudySession.js";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
  "into", "is", "it", "of", "on", "or", "the", "this", "to", "with", "your",
  "study", "learn", "learning", "revise", "revision", "practice", "prepare",
  "preparation", "notes", "note", "quiz", "session", "topic", "concepts",
]);

const PHRASE_ALIASES = [
  [/\boperating\s+systems?\b/g, " operating_system "],
  [/\bobject[ -]?oriented(?:\s+programming)?\b/g, " oop "],
  [/\bdata\s+structures?(?:\s+and\s+algorithms?)?\b/g, " dsa "],
  [/\bmachine\s+learning\b/g, " machine_learning "],
  [/\bartificial\s+intelligence\b/g, " artificial_intelligence "],
  [/\bdatabase\s+management\s+systems?\b/g, " database "],
  [/\bcomputer\s+networks?\b/g, " computer_network "],
  [/\bweb\s+development\b/g, " web_development "],
];

const TOKEN_ALIASES = new Map([
  ["js", "javascript"],
  ["ecmascript", "javascript"],
  ["async", "asynchronous"],
  ["asynchrony", "asynchronous"],
  ["dbms", "database"],
  ["databases", "database"],
  ["os", "operating_system"],
  ["oops", "oop"],
  ["algorithms", "algorithm"],
  ["promises", "promise"],
  ["threads", "thread"],
  ["processes", "process"],
]);

const normalizePhraseText = (value) => {
  let text = String(value || "")
    .normalize("NFKD")
    .toLowerCase();

  for (const [pattern, replacement] of PHRASE_ALIASES) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/[^a-z0-9_+#.]+/g, " ").replace(/\s+/g, " ").trim();
};

const canonicalizeToken = (token) => {
  const alias = TOKEN_ALIASES.get(token);
  if (alias) return alias;
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
};

const tokensFor = (value) =>
  normalizePhraseText(value)
    .split(" ")
    .map(canonicalizeToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const addWeights = (map, values, weight) => {
  for (const token of tokensFor(values)) {
    map.set(token, Math.max(map.get(token) || 0, weight));
  }
};

const getSessionTitle = (session) =>
  session.output?.sessionTitle ||
  session.topic ||
  session.sourceFile?.fileName ||
  "Learning item";

const buildPlanTokenWeights = ({ topic, title, goal }) => {
  const weights = new Map();
  addWeights(weights, topic, 4);
  addWeights(weights, title, 2.5);
  addWeights(weights, goal, 1.25);
  return weights;
};

const buildCandidateTokenWeights = (session) => {
  const weights = new Map();
  addWeights(weights, session.topic, 4);
  addWeights(weights, getSessionTitle(session), 3.5);
  addWeights(weights, session.output?.shortDescription, 1.5);
  addWeights(weights, session.academicContext?.stream, 0.7);
  addWeights(weights, session.academicContext?.program, 0.5);
  return weights;
};

const scoreSession = (plan, session) => {
  const planWeights = buildPlanTokenWeights(plan);
  const candidateWeights = buildCandidateTokenWeights(session);
  const planWeightTotal = [...planWeights.values()].reduce((sum, value) => sum + value, 0) || 1;
  let matchedPlanWeight = 0;
  let weightedIntersection = 0;
  const matchedTokens = [];

  for (const [token, planWeight] of planWeights.entries()) {
    if (candidateWeights.has(token)) {
      matchedPlanWeight += planWeight;
      weightedIntersection += Math.min(planWeight, candidateWeights.get(token));
      matchedTokens.push(token);
    }
  }

  const unionTokens = new Set([...planWeights.keys(), ...candidateWeights.keys()]);
  const jaccard = unionTokens.size ? matchedTokens.length / unionTokens.size : 0;
  const coverage = matchedPlanWeight / planWeightTotal;
  const normalizedTopic = normalizePhraseText(plan.topic);
  const normalizedCandidate = normalizePhraseText(`${session.topic || ""} ${getSessionTitle(session)}`);
  const phraseBonus = normalizedTopic.length >= 3 && normalizedCandidate.includes(normalizedTopic)
    ? 0.25
    : 0;
  const titleTopicBonus = tokensFor(plan.topic).some((token) => tokensFor(getSessionTitle(session)).includes(token))
    ? 0.08
    : 0;
  const density = weightedIntersection / Math.max(planWeightTotal, 1);

  const score = Math.min(1, coverage * 0.58 + density * 0.16 + jaccard * 0.12 + phraseBonus + titleTopicBonus);

  return {
    score,
    matchedTokens: matchedTokens.slice(0, 5),
  };
};

const serializeSuggestion = (session, match) => ({
  id: session._id,
  generationType: session.generationType || "combined",
  origin: session.origin || "ai_generation",
  title: getSessionTitle(session),
  description: session.output?.shortDescription || "",
  topic: session.topic || "",
  hasNotes: Boolean(session.output?.notes),
  hasQuiz: Boolean(session.output?.quiz?.questions?.length),
  quizSize: Number(session.quizSize || 0),
  createdAt: session.createdAt,
  score: Number(match.score.toFixed(3)),
  matchedTerms: match.matchedTokens,
});

export const findRelatedStudyLibraryItems = async ({ userId, topic, title, goal, limit = 6 }) => {
  const sessions = await StudySession.find({
    user: userId,
    status: "completed",
  })
    .select(
      "generationType origin topic sourceFile academicContext quizSize output.sessionTitle output.shortDescription output.notes output.quiz createdAt",
    )
    .sort({ createdAt: -1 })
    .limit(120)
    .lean();

  return sessions
    .map((session) => ({ session, match: scoreSession({ topic, title, goal }, session) }))
    .filter(({ match }) => match.score >= 0.31)
    .sort((a, b) => b.match.score - a.match.score || new Date(b.session.createdAt) - new Date(a.session.createdAt))
    .slice(0, Math.min(Math.max(Number(limit) || 6, 1), 8))
    .map(({ session, match }) => serializeSuggestion(session, match));
};
