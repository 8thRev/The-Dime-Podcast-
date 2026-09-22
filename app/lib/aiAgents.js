// Classifies a request's User-Agent as an AI agent, for src/middleware.js.
//
// Three classes, because they mean different things for growth:
//   retrieval: a person asked an assistant something and it fetched this page
//              live to answer (ChatGPT-User, Claude-User, Perplexity-User) or
//              the assistant's search index crawled it (OAI-SearchBot,
//              Claude-SearchBot, PerplexityBot). These are the fetches that
//              turn into citations.
//   training:  corpus crawlers building datasets. Being known, not referred.
//   search:    classic search engine crawlers. Bing matters here because it
//              backs ChatGPT search and Copilot.
// The retrieval and training names mirror next-sitemap.config.js so robots.txt
// and this log agree on who is who. Keep the two lists in step.
const AGENTS = [
  ['OAI-SearchBot', 'retrieval'],
  ['ChatGPT-User', 'retrieval'],
  ['PerplexityBot', 'retrieval'],
  ['Perplexity-User', 'retrieval'],
  ['DuckAssistBot', 'retrieval'],
  ['ClaudeBot', 'retrieval'],
  ['Claude-User', 'retrieval'],
  ['Claude-SearchBot', 'retrieval'],
  ['MistralAI-User', 'retrieval'],
  ['Meta-ExternalFetcher', 'retrieval'],
  ['YouBot', 'retrieval'],
  ['GPTBot', 'training'],
  ['anthropic-ai', 'training'],
  ['Google-Extended', 'training'],
  ['Applebot-Extended', 'training'],
  ['Meta-ExternalAgent', 'training'],
  ['Amazonbot', 'training'],
  ['cohere-ai', 'training'],
  ['CCBot', 'training'],
  ['Bytespider', 'training'],
  ['Googlebot', 'search'],
  ['bingbot', 'search'],
  ['Applebot', 'search'],
  ['DuckDuckBot', 'search'],
];

const LOWER = AGENTS.map(([name, cls]) => [name.toLowerCase(), name, cls]);

/** Returns {name, class} for a known agent, or null for everything else. */
export function classifyAgent(userAgent) {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const [needle, name, cls] of LOWER) {
    if (ua.includes(needle)) return { name, class: cls };
  }
  return null;
}

export const AGENT_NAMES = AGENTS.map(([name]) => name);
