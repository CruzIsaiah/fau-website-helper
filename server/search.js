const STOP_WORDS = new Set([
  "a", "an", "and", "are", "can", "do", "for", "from", "get", "how", "i", "in", "is", "it",
  "me", "my", "of", "on", "the", "to", "what", "where", "why", "with", "would"
]);

export const TERM_GROUPS = {
  "computer science": ["cs", "bscs", "computer sciences"],
  "computer engineering": ["ce", "bsce"],
  "electrical engineering": ["ee", "bsee"],
  "artificial intelligence": ["ai", "msai"],
  "financial aid": ["fafsa", "student aid", "aid status"],
  withdrawal: ["drop class", "drop course", "withdraw course", "leave class", "leave a class", "leave course", "leave a course", "remove class"],
  "degree requirements": [
    "program requirements", "curriculum", "required courses", "major classes", "degree classes",
    "graduation requirements", "requirements to graduate", "need to graduate", "degree audit"
  ],
  advising: ["advisor", "academic advisor", "academic advising", "course planning"],
  billing: ["bill", "tuition", "student account", "pay tuition", "payment"],
  transcript: ["academic transcript", "official transcript", "student records"],
  registration: ["register", "enroll", "sign up for classes", "course registration", "class registration"],
  "academic calendar": ["semester dates", "term dates", "important dates", "start of semester"]
};

const INTENTS = {
  program_requirements: ["degree requirements", "program requirements", "requirements", "curriculum", "required courses", "major classes", "graduate", "electives"],
  courses: ["course", "courses", "class", "classes", "electives", "prerequisite"],
  registration: ["registration", "register", "enroll", "add class", "add a class", "add course", "add a course", "schedule changes"],
  withdrawal: ["withdrawal", "withdraw", "drop", "drop class", "drop course", "leave class", "leave a class", "leave course", "leave a course"],
  graduation: ["graduation", "commencement", "diploma", "graduate"],
  deadlines: ["deadline", "last day", "academic calendar", "semester start", "term dates", "when"],
  financial_aid: ["financial aid", "fafsa", "grant", "loan", "aid status"],
  billing: ["billing", "tuition", "student account", "payment", "refund", "fees"],
  advising: ["advising", "advisor", "course planning", "change major", "switch major"],
  transcripts: ["transcript", "academic transcript", "send transcript"],
  admissions: ["admission", "admissions", "apply", "application", "transfer student"],
  student_records: ["student records", "enrollment verification", "records"],
  scholarships: ["scholarship", "scholarships"],
  holds: ["hold", "registration hold", "account hold"],
  degree_audit: ["degree audit", "remaining requirements", "still need"],
  campus_services: ["parking", "housing", "library", "canvas", "health", "counseling", "career"],
  contact: ["contact", "phone", "email", "office", "talk to"]
};

const AUTHORITY_WEIGHTS = {
  program_requirements: 2.8,
  catalog: 2.6,
  program: 2.3,
  department: 1.7,
  college: 1.25,
  centralized_academic: 1.2,
  service: 0.8,
  portal: 0.35
};

export function normalizeText(value = "") {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensFor(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map((token) => token.length > 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token);
}

function containsPhrase(text, phrase) {
  return ` ${text} `.includes(` ${normalizeText(phrase)} `);
}

function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= b.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost
      );
      if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) {
        rows[row][column] = Math.min(rows[row][column], rows[row - 2][column - 2] + cost);
      }
    }
  }
  return rows[a.length][b.length];
}

function fuzzySimilarity(a, b) {
  if (a === b) return 1;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 2) return 0;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

export function analyzeQuery(query) {
  const normalizedQuery = normalizeText(query);
  const matchedConcepts = [];
  const queryTokens = tokensFor(normalizedQuery);
  const expanded = new Set(queryTokens);

  for (const [canonical, aliases] of Object.entries(TERM_GROUPS)) {
    const matchesExactly = [canonical, ...aliases].some((term) => containsPhrase(normalizedQuery, term));
    const matchesApproximately = [canonical, ...aliases].some((term) => {
      const termTokens = tokensFor(term);
      if (termTokens.length < 2) return false;
      return termTokens.every((termToken) => queryTokens.some((queryToken) => fuzzySimilarity(termToken, queryToken) >= 0.76));
    });
    if (matchesExactly || matchesApproximately) {
      matchedConcepts.push(canonical);
      tokensFor(canonical).forEach((token) => expanded.add(token));
      aliases.flatMap(tokensFor).forEach((token) => expanded.add(token));
    }
  }

  const understandingText = `${normalizedQuery} ${matchedConcepts.join(" ")}`;
  const intents = Object.entries(INTENTS)
    .filter(([, phrases]) => phrases.some((phrase) => containsPhrase(understandingText, phrase)))
    .map(([intent]) => intent);

  return {
    normalizedQuery,
    queryTokens,
    expandedTerms: [...expanded],
    matchedConcepts,
    intents
  };
}

function resourceText(resource) {
  return normalizeText([
    resource.title, resource.description, resource.category, resource.department, resource.college,
    resource.program, resource.degree, resource.searchableText, ...(resource.keywords || []), ...(resource.aliases || [])
  ].filter(Boolean).join(" "));
}

function scoreResource(resource, analysis, semanticScores, detectedPrograms) {
  const title = normalizeText(resource.title);
  const aliases = (resource.aliases || []).map(normalizeText);
  const keywords = (resource.keywords || []).map(normalizeText);
  const haystack = resourceText(resource);
  const haystackTokens = [...new Set(tokensFor(haystack))];
  const program = normalizeText(resource.program);
  const breakdown = { title: 0, alias: 0, lexical: 0, fuzzy: 0, intent: 0, program: 0, authority: 0, semantic: 0 };

  for (const concept of analysis.matchedConcepts) {
    if (containsPhrase(title, concept)) breakdown.title += 4;
    if (aliases.some((alias) => alias === concept || containsPhrase(alias, concept))) breakdown.alias += 3.2;
    if (program && containsPhrase(program, concept)) breakdown.program += 5.5;
    if (keywords.some((keyword) => keyword === concept || containsPhrase(keyword, concept))) breakdown.lexical += 2.2;
  }

  if (program && [program, ...aliases].some((term) => containsPhrase(analysis.normalizedQuery, term))) {
    breakdown.program += 5.5;
  }
  if (detectedPrograms.size > 0 && program && !detectedPrograms.has(program)) breakdown.program -= 100;

  for (const token of analysis.expandedTerms) {
    if (tokensFor(title).includes(token)) breakdown.title += 1.15;
    else if (aliases.some((alias) => tokensFor(alias).includes(token))) breakdown.alias += 0.95;
    else if (haystackTokens.includes(token)) breakdown.lexical += 0.48;
    else {
      const similarity = haystackTokens.reduce((best, candidate) => Math.max(best, fuzzySimilarity(token, candidate)), 0);
      if (similarity >= 0.76) breakdown.fuzzy += similarity * 0.42;
    }
  }

  const resourceIntents = new Set(resource.intents || []);
  breakdown.intent = analysis.intents.reduce((score, intent) => {
    if (!resourceIntents.has(intent)) return score;
    if (intent === "courses" && analysis.intents.some((item) => ["registration", "withdrawal", "deadlines"].includes(item))) return score;
    if (intent === "courses" && resource.program && breakdown.program <= 0) return score;
    return score + 2.6;
  }, 0);
  const operationalIntents = analysis.intents.filter((intent) => ["registration", "withdrawal", "financial_aid", "billing", "transcripts", "deadlines"].includes(intent));
  if (operationalIntents.length > 0 && !operationalIntents.some((intent) => resourceIntents.has(intent))) breakdown.intent -= 3;
  if (detectedPrograms.size > 0 && analysis.intents.includes("program_requirements") && !program) breakdown.program -= 5;
  const hasRelevance = breakdown.title + breakdown.alias + breakdown.lexical + breakdown.fuzzy + breakdown.intent + breakdown.program > 0.55;
  if (hasRelevance) breakdown.authority = AUTHORITY_WEIGHTS[resource.sourceType] || 0.5;
  breakdown.semantic = Math.max(0, Math.min(1, semanticScores.get(resource.id) || 0)) * 2.2;

  return { score: Object.values(breakdown).reduce((sum, value) => sum + value, 0), breakdown };
}

function explainMatch(resource, analysis, breakdown) {
  if (breakdown.program >= 5 && analysis.intents.includes("program_requirements")) return `Official ${resource.program} ${resource.degree || "program"} requirements.`;
  if (breakdown.program >= 5) return `Official ${resource.program} program information.`;
  if (breakdown.intent >= 1.9) {
    const matchedIntent = analysis.intents.find((intent) => (resource.intents || []).includes(intent)) || analysis.intents[0];
    return `Official FAU information for ${matchedIntent.replaceAll("_", " ")}.`;
  }
  if (breakdown.fuzzy > breakdown.lexical) return "Closest official match after correcting likely spelling differences.";
  return "Relevant official FAU information for your search.";
}

function suggestionsFor(analysis) {
  if (analysis.matchedConcepts.includes("computer science")) return ["Computer Science B.S. requirements", "Computer Science B.A. requirements"];
  if (analysis.intents.includes("financial_aid")) return ["FAFSA status", "FAU financial aid contact"];
  if (analysis.intents.includes("withdrawal")) return ["Last day to drop", "Withdraw from a course"];
  return ["Computer Science B.S. requirements", "Financial aid status", "Academic calendar deadlines"];
}

export function rankFauResources(query, resources, { semanticMatches = [], debug = false } = {}) {
  const analysis = analyzeQuery(query);
  const semanticScores = new Map(semanticMatches.map((match) => [match.resourceId, match.score || match.similarity || 0]));
  const detectedPrograms = new Set(resources
    .filter((resource) => resource.program && (
      analysis.matchedConcepts.includes(normalizeText(resource.program)) ||
      [resource.program, ...(resource.aliases || [])].some((term) => containsPhrase(analysis.normalizedQuery, term))
    ))
    .map((resource) => normalizeText(resource.program)));
  const candidates = resources
    .map((resource) => ({ resource, ...scoreResource(resource, analysis, semanticScores, detectedPrograms) }))
    .filter((candidate) => candidate.score >= 2.25)
    .sort((a, b) => b.score - a.score || (b.resource.retrieval_priority || 0) - (a.resource.retrieval_priority || 0));

  const topScore = candidates[0]?.score || 0;
  const confidenceLevel = topScore >= 8 ? "high" : topScore >= 4 ? "medium" : "low";
  const matches = candidates.slice(0, confidenceLevel === "low" ? 3 : 5).map(({ resource, score, breakdown }) => ({
    resourceId: resource.id,
    reason: explainMatch(resource, analysis, breakdown),
    confidence: Number(Math.min(0.98, score / 8.5).toFixed(2)),
    score: Number(score.toFixed(3)),
    ...(debug ? { scoreBreakdown: Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, Number(value.toFixed(3))])) } : {})
  }));

  const programCandidates = candidates.filter(({ resource, breakdown }) => resource.program && resource.sourceType === "program_requirements" && breakdown.program >= 5);
  const distinctPrograms = new Map(programCandidates.map(({ resource }) => [`${resource.program}|${resource.degree || ""}`, resource]));
  const needsProgramClarification = analysis.intents.includes("program_requirements") && distinctPrograms.size > 1 &&
    !/\b(ba|bs|bachelor of arts|bachelor of science|ms|master|phd|certificate)\b/.test(analysis.normalizedQuery);
  const clarification = needsProgramClarification ? {
    prompt: "Which program are you looking for?",
    options: [...distinctPrograms.values()].slice(0, 4).map((resource) => ({ label: `${resource.program} ${resource.degree || ""}`.trim(), query: `${resource.program} ${resource.degree || ""} requirements`.trim() }))
  } : null;

  const result = {
    analysis,
    confidenceLevel,
    matches,
    clarification,
    suggestions: confidenceLevel === "low" || clarification ? suggestionsFor(analysis) : []
  };

  if (debug) console.debug("[search-debug]", JSON.stringify({ query, ...result }, null, 2));
  return result;
}
