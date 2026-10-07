import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { createOrganizationSchema, createPersonSchema } from '@/lib/schema';
import { PODCAST_RATING } from '@/lib/ratings';

const HOSTS = [
  {
    name: 'Bryan Fields',
    role: 'Host',
    handle: '@Bryanfields24',
    bio: 'Operator-first. Strategy-driven. Bryan built The Dime as the show he wished existed when he entered the industry. He asks the questions operators need answered, to the people who have the real answers.',
  },
  {
    name: 'Kellan Finney',
    role: 'Co-Host',
    handle: '@Kellan_Finney',
    bio: 'Deep technical and scientific background across cannabis operations. Kellan brings the precision layer: cultivation science, extraction economics, and the operational systems that separate operators.',
  },
];

export default function About() {
  const schema = createOrganizationSchema('https://www.dimepodcast.com');
  const hostSchemas = HOSTS.map((host) => createPersonSchema({ name: host.name }));
  return (
    <>
      <SeoHead
        title="About"
        description="The Dime is a strategy podcast for cannabis operators. Hosted by Bryan Fields and Kellan Finney. Long-form conversations with founders, executives, investors, and policy architects."
        path="/about"
      />
      <Schema schema={schema} />
      {hostSchemas.map((s, i) => (
        <Schema key={HOSTS[i].name} schema={s} />
      ))}
      <Header />

      <section className="band">
        <div className="wrap page-head">
          <span className="eyebrow">About the Show</span>
          <h1 className="page-title" style={{ maxWidth: 820, marginBottom: 'clamp(32px, 5vw, 56px)' }}>
            Built for<br />
            operators.<br />
            <span className="accent">Not observers.</span>
          </h1>
          <div className="grid-2">
            <p className="lede" style={{ marginTop: 0 }}>
              The Dime is not a cannabis lifestyle show. It is not a culture podcast. It is a strategy room, open to the public. More than 300 episodes in, Bryan Fields and Kellan Finney have built the most operator-focused conversation in cannabis. CEOs, investors, founders, and policy architects. The conversations that don&apos;t happen in earnings calls.
            </p>
            <p className="lede" style={{ marginTop: 0 }}>
              The listener is making decisions under margin compression, regulatory uncertainty, and capital scarcity. They tune in because The Dime gives them intelligence they cannot get anywhere else, before the market makes it obvious. Rated {PODCAST_RATING.value} stars by {PODCAST_RATING.count} reviewers. Top 5% most shared globally.
            </p>
          </div>
        </div>
      </section>

      <section className="host-grid band">
        {HOSTS.map((host) => (
          <div key={host.name} className="host-card">
            <span className="eyebrow">{host.role}</span>
            <h2 className="page-title page-title--article" style={{ marginTop: 10, marginBottom: 8 }}>
              {host.name}
            </h2>
            <div className="meta" style={{ marginBottom: 24 }}>
              <span style={{ color: 'var(--text-accent)' }}>{host.role} · The Dime</span>
              {' · '}
              {host.handle}
            </div>
            <p className="lede" style={{ marginTop: 0, fontSize: '16px' }}>
              {host.bio}
            </p>
          </div>
        ))}
      </section>

      <Footer />
    </>
  );
}
