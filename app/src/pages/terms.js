import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';

const SECTIONS = [
  {
    title: 'Acceptance of terms',
    body: 'By accessing dimepodcast.com, you agree to these Terms of Service. If you do not agree, please do not use the site.',
  },
  {
    title: 'Content',
    body: 'Episodes, show notes, transcripts, and related content are provided for informational purposes only and do not constitute legal, financial, or investment advice. Some transcripts, summaries, and derived content on this site are generated using AI from the recorded audio and may contain errors or inaccuracies; they are clearly labeled where they appear.',
  },
  {
    title: 'Intellectual property',
    body: 'The Dime Podcast name, logo, episode audio/video, and original written content are the property of The Dime Podcast unless otherwise noted. You may share links to our content but may not republish full episodes, transcripts, or articles without permission.',
  },
  {
    title: 'Third-party links and services',
    body: 'This site links to and embeds third-party services, including Simplecast, YouTube, and ConvertKit, and references guests’ companies and websites. We are not responsible for the content, accuracy, or practices of any third-party site.',
  },
  {
    title: 'No warranty',
    body: 'This site and its content are provided "as is" without warranties of any kind, express or implied. We do not guarantee the accuracy or completeness of any episode, transcript, or article.',
  },
  {
    title: 'Limitation of liability',
    body: 'To the fullest extent permitted by law, The Dime Podcast is not liable for any damages arising from your use of this site or reliance on its content.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may update these Terms of Service from time to time. Continued use of the site after changes are posted constitutes acceptance of the updated terms.',
  },
  {
    title: 'Contact',
    body: 'Questions about these terms can be sent to Bryan.Fields@8threv.com.',
  },
];

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service — The Dime Podcast</title>
        <meta name="description" content="Terms of Service for The Dime Podcast website." />
        <link rel="canonical" href="https://www.dimepodcast.com/terms" />
      </Head>
      <Header />

      <section style={{ padding: '80px 48px', maxWidth: 800, margin: '0 auto' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
          Legal
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(36px,5vw,56px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 1, marginBottom: 40 }}>
          Terms of Service
        </h1>

        {SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 36 }}>
            <h2 className="syne" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: 10 }}>
              {section.title}
            </h2>
            <p className="crimson" style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--text-secondary)', fontWeight: 300 }}>
              {section.body}
            </p>
          </div>
        ))}
      </section>

      <Footer />
    </>
  );
}
