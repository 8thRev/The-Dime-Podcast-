// src/pages/api/og.jsx
// Generates the social-preview (Open Graph / Twitter Card) image on demand,
// replacing the static /og-default.jpg that never existed in public/.
// Runs on the Edge Runtime because @vercel/og's ImageResponse returns a
// standard Response object rather than using the Node (req, res) handler
// shape the rest of this app's API routes use.
import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#111111',
          backgroundImage:
            'linear-gradient(90deg, #2A2A2A 1px, transparent 1px), linear-gradient(#2A2A2A 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '5px solid #3CB8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
              color: '#EEEEEE',
            }}
          >
            D
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 4,
              color: '#EEEEEE',
              textTransform: 'uppercase',
            }}
          >
            The Dime
          </div>
        </div>

        <div
          style={{
            fontSize: title ? 56 : 72,
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.15,
            maxWidth: 980,
          }}
        >
          {title || 'How the cannabis industry actually works.'}
        </div>

        <div
          style={{
            fontSize: 26,
            color: '#3CB8F0',
            marginTop: 32,
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          Cannabis Business Intelligence — Operator to Operator
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
