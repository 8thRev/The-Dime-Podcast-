import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import NewsletterForm from '@/src/components/NewsletterForm';

export default function Newsletter() {
  return (
    <>
      <Head>
        <title>First Principles Newsletter — The Dime Podcast</title>
        <meta name="description" content="One structural insight per episode. 550-650 words, one idea, no fluff. Free weekly newsletter for cannabis operators." />
        <link rel="canonical" href="https://www.dimepodcast.com/newsletter" />
        <meta property="og:title" content="First Principles Newsletter — The Dime Podcast" />
        <meta property="og:description" content="Not a recap. The structural principle underneath each conversation. Written for operators who need to understand what's happening before the market makes it obvious." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.dimepodcast.com/newsletter" />
        <meta name="twitter:title" content="First Principles Newsletter — The Dime Podcast" />
        <meta name="twitter:description" content="One structural insight per episode. Free weekly newsletter for cannabis operators." />
      </Head>
      <Header />

      <section style={{ padding: '80px 48px', maxWidth: 680 }}>
        <div className="mono" style={{ fontSize: '9px', color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 16 }}>
          First Principles
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(52px,8vw,84px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.88, marginBottom: 32 }}>
          The insight<br />
          behind<br />
          the episode.
        </h1>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', marginBottom: 16, fontWeight: 300 }}>
          Every episode produces a newsletter. Not a recap. The structural principle underneath the conversation, written for operators who need to understand what's actually happening before the market makes it obvious.
        </p>
        <p className="syne" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 48, letterSpacing: '.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          550-650 WORDS · ONE IDEA · NO NOISE · FREE
        </p>

        <div style={{ maxWidth: 420 }}>
          <NewsletterForm />
        </div>

        <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 16 }}>
          Operator intelligence only. Unsubscribe anytime.
        </p>
      </section>

      <Footer />
    </>
  );
}
