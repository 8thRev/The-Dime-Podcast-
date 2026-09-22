// Logs page fetches by AI agents, which GA4 cannot see (agents run no
// JavaScript). This is the only record of which pages ChatGPT, Claude,
// Perplexity and the crawlers behind them actually pull, and bot/weekly_data.py
// reads it into the Monday report as the agent_visits source.
//
// What is stored: one counter per day per (agent class, agent name, path),
// in the Upstash Redis store attached through the Vercel marketplace. No IPs,
// no query strings, no headers, nothing about human visitors. Without the
// store's env vars the middleware records nothing and costs nothing.
//
// Runs on the Edge before the page cache, so static and ISR pages are counted
// too. The write is fire and forget: a store outage never slows or fails a
// page.

import { NextResponse } from 'next/server';
import { classifyAgent } from '@/lib/aiAgents';

const KEY_TTL_SECONDS = 120 * 86400;
const MAX_PATH_LENGTH = 200;

export const config = {
  // Everything except Next internals, the API routes and static assets.
  // llms.txt, rss.xml and sitemap.xml stay in: those are exactly the files
  // agents come for.
  matcher: ['/((?!_next/|api/|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|ico|webp|css|js|map|woff2?)$).*)'],
};

export function middleware(request, event) {
  const agent = classifyAgent(request.headers.get('user-agent'));
  if (agent) {
    event.waitUntil(record(agent, request.nextUrl.pathname));
  }
  return NextResponse.next();
}

async function record(agent, pathname) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const day = new Date().toISOString().slice(0, 10);
  const key = `agents:${day}`;
  const field = `${agent.class}\t${agent.name}\t${pathname.slice(0, MAX_PATH_LENGTH)}`;
  try {
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['HINCRBY', key, field, 1],
        ['EXPIRE', key, KEY_TTL_SECONDS],
      ]),
    });
  } catch {
    // Deliberately silent: logging here would fire on every agent fetch
    // during an outage and the Monday report already marks the source
    // unavailable when the read side fails.
  }
}
