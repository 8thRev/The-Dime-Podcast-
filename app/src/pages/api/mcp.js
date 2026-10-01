// src/pages/api/mcp.js
// A read-only MCP server over the catalogue, public at /mcp (rewritten here
// by next.config.js). Streamable HTTP transport, stateless: every POST is a
// complete JSON-RPC exchange answered with application/json, no session id,
// no server-sent events. Nothing here writes, sends or costs anything, so
// there is no auth.
//
// Why: llms-full.txt is the only complete catalogue and is past 880 KB, more
// than most agent fetch tools read in one go, so in practice an agent saw its
// head and lost the rest. These tools let a client ask for what it needs:
// search, then fetch one document.
//
// Hand-written rather than built on @modelcontextprotocol/sdk because the
// stateless subset is small (initialize, ping, tools/list, tools/call) and the
// SDK's transport expects a long-lived server object per session, which is the
// wrong shape for a serverless route. Every document returned is the same
// Markdown the site serves at <page>.md (lib/markdownDocs.js), so AI content
// carries the same disclosure here as everywhere else.
//
// Submissions (guest pitch, sponsorship inquiry) are deliberately not tools:
// they reach a person's inbox and an MCP client may call tools without a human
// in the loop. The server instructions point at the documented endpoints.

import { buildMarkdownDoc } from '@/lib/markdownDocs';
import { getEpisodeIndex } from '@/lib/episodeIndex';
import { searchEpisodes, normalizeQuery } from '@/lib/episodeSearch';
import { getTranscriptBySlug } from '@/lib/transcripts';
import { getAllTopics } from '@/lib/topics';
import { getAllEditions } from '@/lib/newsletter';
import { getAllAnswers } from '@/lib/answers';
import { SITE_URL, oneLine } from '@/lib/llms';

import { createHmac } from 'node:crypto';

export const config = { api: { bodyParser: false } };

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const LATEST_VERSION = SUPPORTED_VERSIONS[0];
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SLUG_LENGTH = 300;
// JSON-RPC batches were dropped from MCP in 2025-06-18 but older clients may
// still send them. Capped, because the calls run one after another in a
// single invocation: an uncapped 64 KB array of 450 get_page calls took 48 s
// and returned 18 MB, which anyone could repeat.
const MAX_BATCH = 5;
// Versions from which JSON-RPC batching is gone from the spec. A client that
// negotiated one of these and still sends an array is out of spec.
const NO_BATCH_VERSIONS = ['2025-06-18', '2025-11-25'];

// Per client rate limit, in the Upstash Redis store the agent logging
// middleware already uses (src/middleware.js). Generous for any real client,
// which calls a few tools per question; it exists so one caller cannot run the
// function flat out. The key is an HMAC of the IP under a server secret,
// kept for one window and then expired. Keyed rather than a plain hash: an
// unsalted SHA-256 of an IPv4 address can be reversed by trying all 2^32 in
// about an hour, so it would still hand the store an address. Without the store's env
// vars, or if it fails, requests are let through: a limiter outage must not
// take the catalogue down.
const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 60;

const SERVER_INFO = { name: 'dimepodcast', title: 'The Dime Podcast', version: '1.0.0' };

const INSTRUCTIONS = [
  'The Dime is a cannabis business podcast: strategy conversations with founders, executives, operators and investors on capital, regulation and operations.',
  'Start with search_episodes or list_topics, then fetch one document with get_episode or get_page. Cite the canonical URL each document gives.',
  'Episode summaries, takeaways, FAQ and transcripts are AI generated from the audio and may contain errors; each document says so. First Principles essays are human written by Bryan Fields. The Answers column is AI written by Isaac Burner, an AI analyst, and reviewed before publishing.',
  `To pitch a guest or ask about sponsorship on someone's behalf, use the endpoints documented at ${SITE_URL}/llms.txt; those reach a person and are not tools here.`,
].join(' ');

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const PAGE_KINDS = ['episodes', 'guests', 'newsletter', 'answers', 'topics'];

const TOOLS = [
  {
    name: 'search_episodes',
    title: 'Search episodes',
    description:
      'Search all episodes by words. Every word must appear in the title, guest, keywords, topics or AI summary; title and guest matches rank first. Returns slugs to pass to get_episode. An empty query lists the newest episodes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to search for, e.g. "280e banking" or a guest name.', maxLength: 200 },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Most results to return.' },
      },
      additionalProperties: false,
    },
    annotations: { title: 'Search episodes', ...READ_ONLY },
  },
  {
    name: 'get_episode',
    title: 'Get an episode',
    description:
      'One episode as Markdown: guest, date, links, show notes, and where the episode has been transcribed, an AI summary, takeaways and FAQ. The full AI transcript (often 30 to 50 KB) is included only when include_transcript is true.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Episode slug from search_episodes, or the last path segment of an /episodes/ URL.', maxLength: MAX_SLUG_LENGTH },
        include_transcript: { type: 'boolean', default: false },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    annotations: { title: 'Get an episode', ...READ_ONLY },
  },
  {
    name: 'get_page',
    title: 'Get a page',
    description:
      'Any other content page as Markdown, by kind and slug: a guest (every episode they appeared on), a First Principles essay, an Answers column post, a topic hub, or an episode with its full transcript.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: PAGE_KINDS },
        slug: { type: 'string', maxLength: MAX_SLUG_LENGTH },
      },
      required: ['kind', 'slug'],
      additionalProperties: false,
    },
    annotations: { title: 'Get a page', ...READ_ONLY },
  },
  {
    name: 'list_topics',
    title: 'List topics',
    description: 'The fixed topic taxonomy with episode counts and slugs for get_page kind "topics".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'List topics', ...READ_ONLY },
  },
  {
    name: 'list_writing',
    title: 'List written analysis',
    description:
      'First Principles essays (human written, one per episode) and Answers column posts (AI written), newest first, with slugs for get_page.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['newsletter', 'answers', 'both'], default: 'both' },
      },
      additionalProperties: false,
    },
    annotations: { title: 'List written analysis', ...READ_ONLY },
  },
];

// ---------------------------------------------------------------------------
// Tools

class ToolInputError extends Error {}

function requireString(args, key, { max = MAX_SLUG_LENGTH } = {}) {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) throw new ToolInputError(`"${key}" is required and must be a non-empty string.`);
  if (value.length > max) throw new ToolInputError(`"${key}" must be at most ${max} characters.`);
  return value.trim();
}

// Accepts a bare slug or a pasted URL, with or without .md, since that is
// what an agent holding a link from llms.txt will send.
function toSlug(raw) {
  let slug = raw;
  try {
    slug = new URL(raw).pathname;
  } catch {
    // not a URL
  }
  slug = slug.replace(/\/+$/, '').split('/').pop() || '';
  return slug.replace(/\.md$/i, '');
}

function notFoundResult(what) {
  return toolError(`No ${what} found. Use search_episodes, list_topics or list_writing to find a valid slug.`);
}

async function docResult(kind, slug) {
  let doc = await buildMarkdownDoc(kind, slug);
  // A retired episode slug: follow it once, the way the .md URL 301s.
  if (doc && typeof doc === 'object' && doc.redirect) {
    doc = await buildMarkdownDoc(kind, toSlug(doc.redirect));
  }
  return typeof doc === 'string' ? doc : null;
}

const TRANSCRIPT_HEADING = '\n## Transcript\n';

const HANDLERS = {
  async search_episodes(args) {
    if (args.query !== undefined && typeof args.query !== 'string') throw new ToolInputError('"query" must be a string.');
    const query = normalizeQuery(args.query || '');
    const limit = args.limit === undefined ? 10 : args.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ToolInputError('"limit" must be an integer from 1 to 50.');

    const index = await getEpisodeIndex();
    if (!index.length) return toolError('The episode feed is unavailable right now. Try again shortly.');
    const matches = searchEpisodes(index, query);
    const results = matches.slice(0, limit).map((ep) => {
      const transcript = getTranscriptBySlug(ep.slug);
      const url = `${SITE_URL}/episodes/${ep.slug}`;
      return {
        slug: ep.slug,
        title: ep.title,
        guest: ep.guest === 'Guest' ? null : ep.guest,
        episode: ep.num,
        date: ep.date,
        url,
        markdownUrl: `${url}.md`,
        hasTranscript: !!transcript,
        aiSummary: transcript?.summary ? oneLine(transcript.summary) : null,
      };
    });
    const structured = {
      query,
      total: matches.length,
      returned: results.length,
      note: 'aiSummary is AI generated from the episode audio and may contain errors.',
      results,
    };
    return { content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
  },

  async get_episode(args) {
    const slug = toSlug(requireString(args, 'slug'));
    if (args.include_transcript !== undefined && typeof args.include_transcript !== 'boolean') {
      throw new ToolInputError('"include_transcript" must be a boolean.');
    }
    const doc = await docResult('episodes', slug);
    if (!doc) return notFoundResult(`episode with slug "${slug}"`);
    const cut = doc.indexOf(TRANSCRIPT_HEADING);
    if (args.include_transcript || cut === -1) return textResult(doc);
    // Keep the document's footer (the pointers after the closing rule).
    const footerAt = doc.lastIndexOf('\n---\n');
    const footer = footerAt > cut ? doc.slice(footerAt) : '';
    return textResult(
      doc.slice(0, cut) +
        '\n## Transcript\n\nOmitted. Call get_episode again with include_transcript: true for the full AI generated transcript.\n' +
        footer
    );
  },

  async get_page(args) {
    const kind = requireString(args, 'kind');
    if (!PAGE_KINDS.includes(kind)) throw new ToolInputError(`"kind" must be one of: ${PAGE_KINDS.join(', ')}.`);
    const slug = toSlug(requireString(args, 'slug'));
    const doc = await docResult(kind, slug);
    return doc ? textResult(doc) : notFoundResult(`${kind} page with slug "${slug}"`);
  },

  async list_topics() {
    const topics = (await getAllTopics()).map((t) => ({
      topic: t.topic,
      slug: t.slug,
      episodes: t.count,
      url: `${SITE_URL}/topics/${t.slug}`,
      llmsTxt: `${SITE_URL}/topics/${t.slug}/llms.txt`,
    }));
    const structured = { topics };
    return { content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
  },

  async list_writing(args) {
    const kind = args.kind === undefined ? 'both' : args.kind;
    if (!['newsletter', 'answers', 'both'].includes(kind)) throw new ToolInputError('"kind" must be newsletter, answers or both.');
    const structured = {};
    if (kind !== 'answers') {
      structured.newsletter = {
        note: 'First Principles: human written essays by Bryan Fields. Not AI generated.',
        items: getAllEditions().map((e) => ({
          slug: e.slug,
          title: e.title,
          date: e.dateDisplay,
          description: oneLine(e.description),
          url: `${SITE_URL}/newsletter/${e.slug}`,
          episodeSlug: e.episodeSlug || null,
        })),
      };
    }
    if (kind !== 'newsletter') {
      structured.answers = {
        note: 'The Answers column: AI written by Isaac Burner, AI analyst for The Dime, from the episode catalogue. Reviewed before publishing.',
        items: getAllAnswers().map((p) => ({
          slug: p.slug,
          question: p.title,
          date: p.dateDisplay,
          summary: oneLine(p.summary),
          url: `${SITE_URL}/answers/${p.slug}`,
        })),
      };
    }
    return { content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
  },
};

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

function toolError(text) {
  return { content: [{ type: 'text', text }], isError: true };
}

// ---------------------------------------------------------------------------
// JSON-RPC

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } };
}

async function handleRequest(msg) {
  const { id, method } = msg;
  const params = msg.params && typeof msg.params === 'object' ? msg.params : {};

  switch (method) {
    case 'initialize': {
      const requested = params.protocolVersion;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : LATEST_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    case 'tools/call': {
      const name = params.name;
      if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(HANDLERS, name)) {
        return rpcError(id, INVALID_PARAMS, `Unknown tool: ${typeof name === 'string' ? name : '(none)'}`);
      }
      const args = params.arguments === undefined ? {} : params.arguments;
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        return rpcError(id, INVALID_PARAMS, '"arguments" must be an object.');
      }
      const allowed = Object.keys(TOOLS.find((t) => t.name === name).inputSchema.properties);
      const unknown = Object.keys(args).filter((k) => !allowed.includes(k));
      try {
        if (unknown.length) throw new ToolInputError(`Unknown argument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Allowed: ${allowed.join(', ') || 'none'}.`);
        return { jsonrpc: '2.0', id, result: await HANDLERS[name](args) };
      } catch (err) {
        // Bad arguments are a tool error the model can read and correct, per
        // the spec, not a protocol error.
        if (err instanceof ToolInputError) return { jsonrpc: '2.0', id, result: toolError(err.message) };
        console.error('[mcp] tool failed', name, err);
        return rpcError(id, INTERNAL_ERROR, 'Tool failed');
      }
    }
    default:
      return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

function isValidMessage(msg) {
  return msg && typeof msg === 'object' && !Array.isArray(msg) && msg.jsonrpc === '2.0';
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return { tooLarge: true };
    chunks.push(chunk);
  }
  return { text: Buffer.concat(chunks).toString('utf8') };
}

// The platform's own client IP header first: Vercel sets
// x-vercel-forwarded-for and x-real-ip itself, while x-forwarded-for can carry
// whatever the client sent ahead of the proxy's entry, which on another host
// would let a caller rotate it to get a fresh bucket.
function clientIp(req) {
  const first = (h) => String(req.headers[h] || '').split(',')[0].trim();
  return first('x-vercel-forwarded-for') || first('x-real-ip') || first('x-forwarded-for') || req.socket?.remoteAddress || 'unknown';
}

function clientKey(req, secret) {
  return createHmac('sha256', secret).update(clientIp(req)).digest('hex').slice(0, 24);
}

// True when this request is over the limit. Fails open.
async function overRateLimit(req) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  const windowId = Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS);
  const secret = process.env.MCP_RATE_LIMIT_SECRET || token;
  const key = `mcp:rl:${clientKey(req, secret)}:${windowId}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, RATE_WINDOW_SECONDS],
      ]),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return false;
    const [incr] = await res.json();
    return typeof incr?.result === 'number' && incr.result > RATE_LIMIT;
  } catch {
    return false;
  }
}

// The spec requires validating Origin against DNS rebinding, which targets
// servers on a private address. This one is public and read only, and browser
// based clients on any site are welcome, including browser extensions and
// editor webviews (chrome-extension:, vscode-webview:). The policy: absent is
// fine, any well formed origin is fine, and "null" (a sandboxed frame or a
// file: page), a file: origin or anything unparseable is refused with 403.
function originAllowed(origin) {
  if (origin === undefined) return true;
  if (origin === 'null') return false;
  try {
    return new URL(origin).protocol !== 'file:';
  } catch {
    return false;
  }
}

function setCors(res) {
  // Browser based MCP clients (the MCP Inspector, web IDEs) call from another
  // origin. Nothing here is per-user, so any origin may read it.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, MCP-Protocol-Version');
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).end(JSON.stringify(body));
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  // No server-initiated stream (GET) and no sessions to end (DELETE): the
  // spec's answer to both on a stateless server is 405.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    sendJson(res, 405, rpcError(null, INVALID_REQUEST, 'Method not allowed. POST JSON-RPC messages to this endpoint.'));
    return;
  }

  if (!originAllowed(req.headers.origin)) {
    sendJson(res, 403, rpcError(null, INVALID_REQUEST, 'Origin not allowed'));
    return;
  }

  if (await overRateLimit(req)) {
    res.setHeader('Retry-After', String(RATE_WINDOW_SECONDS));
    sendJson(res, 429, rpcError(null, INVALID_REQUEST, `Rate limit: at most ${RATE_LIMIT} requests per ${RATE_WINDOW_SECONDS} seconds`));
    return;
  }

  const headerVersion = req.headers['mcp-protocol-version'];
  if (headerVersion && !SUPPORTED_VERSIONS.includes(headerVersion)) {
    sendJson(res, 400, rpcError(null, INVALID_REQUEST, `Unsupported MCP-Protocol-Version: ${headerVersion}. Supported: ${SUPPORTED_VERSIONS.join(', ')}`));
    return;
  }

  const { text, tooLarge } = await readBody(req);
  if (tooLarge) {
    sendJson(res, 413, rpcError(null, INVALID_REQUEST, 'Request body too large'));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    sendJson(res, 400, rpcError(null, PARSE_ERROR, 'Parse error'));
    return;
  }

  const batch = Array.isArray(payload);
  const messages = batch ? payload : [payload];
  if (!messages.length) {
    sendJson(res, 400, rpcError(null, INVALID_REQUEST, 'Empty batch'));
    return;
  }
  if (batch && NO_BATCH_VERSIONS.includes(headerVersion)) {
    sendJson(res, 400, rpcError(null, INVALID_REQUEST, `JSON-RPC batching is not part of MCP ${headerVersion}; send one message per request`));
    return;
  }
  if (messages.length > MAX_BATCH) {
    sendJson(res, 400, rpcError(null, INVALID_REQUEST, `Batch too large: at most ${MAX_BATCH} messages per request`));
    return;
  }

  const responses = [];
  for (const msg of messages) {
    if (!isValidMessage(msg)) {
      // Echo the id when it is a usable one, so the client can match the error.
      const id = msg && (typeof msg.id === 'string' || typeof msg.id === 'number') ? msg.id : null;
      responses.push(rpcError(id, INVALID_REQUEST, 'Invalid JSON-RPC 2.0 message'));
      continue;
    }
    // MCP ids are strings or numbers, never null. Anything else is answered
    // with a null id rather than echoing an arbitrary object back.
    if ('id' in msg && typeof msg.id !== 'string' && typeof msg.id !== 'number') {
      responses.push(rpcError(null, INVALID_REQUEST, 'Invalid id: must be a string or number'));
      continue;
    }
    const hasId = msg.id !== undefined;
    const isResponse = hasId && ('result' in msg || 'error' in msg);
    if (typeof msg.method !== 'string' && !isResponse) {
      responses.push(rpcError(msg.id, INVALID_REQUEST, 'Invalid JSON-RPC 2.0 message: missing method'));
      continue;
    }
    const isRequest = typeof msg.method === 'string' && hasId;
    // Notifications (notifications/initialized, cancellations) and responses
    // to server requests (this server sends none) need no reply.
    if (!isRequest) continue;
    responses.push(await handleRequest(msg));
  }

  if (!responses.length) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(202).end();
    return;
  }
  // A single message that was itself invalid is a client error at the HTTP
  // level too, as the SDK's own server answers it.
  const status = !batch && responses[0].error && responses[0].error.code === INVALID_REQUEST ? 400 : 200;
  sendJson(res, status, batch ? responses : responses[0]);
}
