import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import ConvertKitEmbed from '@/src/components/ConvertKitEmbed';

export default function Newsletter() {
  // Replace with your actual ConvertKit form ID
  const convertKitFormId = process.env.NEXT_PUBLIC_CONVERTKIT_FORM_ID;

  return (
    <>
      <Head>
        <title>First Principles Newsletter - The Dime Podcast</title>
      </Head>
      <Header />

      <section style={{ padding: '80px 48px', maxWidth: 680 }}>
        <div className="mono" style={{ fontSize: '9px', color: '#009E85', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 16 }}>
          First Principles
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(52px,8vw,84px)', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.02em', lineHeight: 0.88, marginBottom: 32 }}>
          The insight<br />
          behind<br />
          the episode.
        </h1>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: '#7A8FA8', marginBottom: 16, fontWeight: 300 }}>
          Every episode produces a newsletter. Not a recap. The structural principle underneath the conversation, written for operators who need to understand what's actually happening before the market makes it obvious.
        </p>
        <p className="syne" style={{ fontSize: '11px', color: '#3A4F66', marginBottom: 48, letterSpacing: '.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          550-650 WORDS · ONE IDEA · NO NOISE · FREE
        </p>

        {convertKitFormId ? (
          <ConvertKitEmbed formId={convertKitFormId} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
            <input placeholder="Your email address" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none' }} />
            <button className="btn-teal">Subscribe to First Principles</button>
          </div>
        )}

        <p className="mono" style={{ fontSize: '10px', color: '#1E3050', marginTop: 16 }}>
          Operator intelligence only. Unsubscribe anytime.
        </p>
      </section>

      <Footer />
    </>
  );
}
