import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';

const SECTIONS = [
  {
    title: 'What we collect',
    body: 'We collect the minimum data needed to run the site: anonymous, aggregated analytics on page views and site performance (via Vercel Analytics and Speed Insights, which do not use tracking cookies or collect personally identifiable information), and the email address you provide if you voluntarily subscribe to our newsletter.',
  },
  {
    title: 'Third-party services we use',
    body: 'Newsletter signups are processed by ConvertKit. Episode audio and video are hosted and served by Simplecast and YouTube, whose own privacy policies apply when you interact with their embedded players. Site hosting, performance monitoring, and analytics are provided by Vercel.',
  },
  {
    title: 'Google API data use',
    body: "The Dime Podcast's internal publishing tools use the YouTube Data API (with the youtube.force-ssl scope) solely to retrieve caption and transcript data from videos on our own YouTube channel, for the sole purpose of publishing episode transcripts on this website. This access is limited to our own channel's content, is used only for that stated purpose, is never sold, shared with third parties, or used for advertising, and is not used to access any other user's data. Our use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
  },
  {
    title: 'Newsletter emails',
    body: 'If you subscribe to our newsletter, your email address is stored by ConvertKit and used only to send you newsletter updates from The Dime Podcast. You can unsubscribe at any time using the link in any newsletter email.',
  },
  {
    title: 'No sale of personal data',
    body: 'We do not sell, rent, or trade personal data to third parties.',
  },
  {
    title: 'Contact',
    body: 'Questions about this policy or your data can be sent to info@dimepodcast.com, or use our contact page.',
  },
];

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — The Dime Podcast</title>
        <meta name="description" content="Privacy policy for The Dime Podcast — what data we collect, the third-party services we use, and how we handle it." />
        <link rel="canonical" href="https://www.dimepodcast.com/privacy" />
      </Head>
      <Header />

      <section style={{ padding: '80px 48px', maxWidth: 800, margin: '0 auto' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
          Legal
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(36px,5vw,56px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 1, marginBottom: 40 }}>
          Privacy Policy
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
