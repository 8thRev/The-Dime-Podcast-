import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import SeoHead from '@/src/components/SeoHead';
import ConvertKitEmbed from '@/src/components/ConvertKitEmbed';

export default function Newsletter() {
  return (
    <>
      <SeoHead
        title="First Principles Newsletter"
        description="One structural insight per episode. 550-650 words, one idea, no fluff. Free weekly newsletter for cannabis operators."
        path="/newsletter"
      />
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
          Every episode produces a newsletter. Not a recap. The structural principle underneath the conversation, written for operators who need to understand what&apos;s actually happening before the market makes it obvious.
        </p>
        <p className="syne" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 48, letterSpacing: '.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          550-650 WORDS · ONE IDEA · NO NOISE · FREE
        </p>

        <ConvertKitEmbed />

        <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 16 }}>
          Operator intelligence only. Unsubscribe anytime.
        </p>
      </section>

      <Footer />
    </>
  );
}
