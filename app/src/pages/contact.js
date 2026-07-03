import { useState, useMemo, useEffect } from 'react';
import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';

const inputStyle = {
  background: 'var(--navy2)',
  border: '1px solid var(--border)',
  color: 'var(--white)',
  fontFamily: "'Syne', sans-serif",
  fontSize: '13px',
  padding: '14px 16px',
  width: '100%',
  outline: 'none',
};

export default function Contact() {
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', message: '', answer: '', company: '' });
  const loadedAt = useMemo(() => Date.now(), []);
  // Randomized client-side, after mount — computing this during render would
  // produce a different value on the server than on the client and trigger
  // a hydration mismatch.
  const [challenge, setChallenge] = useState({ a: 0, b: 0 });
  useEffect(() => {
    setChallenge({ a: Math.floor(Math.random() * 8) + 1, b: Math.floor(Math.random() * 8) + 1 });
  }, []);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          message: form.message,
          company: form.company,
          a: challenge.a,
          b: challenge.b,
          answer: form.answer,
          loadedAt,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('sent');
      setForm({ name: '', email: '', message: '', answer: '', company: '' });
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <>
      <Head>
        <title>Contact — The Dime Podcast</title>
        <meta name="description" content="Get in touch with The Dime Podcast — questions, feedback, or press inquiries." />
        <link rel="canonical" href="https://www.dimepodcast.com/contact" />
      </Head>
      <Header />

      <section style={{ padding: '80px 48px', maxWidth: 680 }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
          Get In Touch
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(44px,7vw,72px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.95, marginBottom: 32 }}>
          Contact us.
        </h1>
        <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.85, color: 'var(--text-secondary)', marginBottom: 40, fontWeight: 300 }}>
          Questions, feedback, or press inquiries — send us a note and we'll get back to you. Looking to sponsor an episode? Email{' '}
          <a href="mailto:sponsorship@dimepodcast.com">sponsorship@dimepodcast.com</a> directly. Want to be a guest?{' '}
          <a href="/guests">Apply here</a>.
        </p>

        {status === 'sent' ? (
          <p className="crimson" style={{ fontSize: 16, color: 'var(--text-headline)' }}>
            Thanks — your message is on its way. We'll respond as soon as we can.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
            {/* Honeypot — hidden from real visitors, bots tend to fill every field they find */}
            <input
              type="text"
              name="company"
              value={form.company}
              onChange={handleChange('company')}
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <input placeholder="Your name" value={form.name} onChange={handleChange('name')} required style={inputStyle} />
            <input type="email" placeholder="Your email address" value={form.email} onChange={handleChange('email')} required style={inputStyle} />
            <textarea placeholder="Your message" rows={5} value={form.message} onChange={handleChange('message')} required style={{ ...inputStyle, resize: 'vertical' }} />

            <label className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
              Quick check — what is {challenge.a} + {challenge.b}?
              <input
                type="text"
                inputMode="numeric"
                value={form.answer}
                onChange={handleChange('answer')}
                required
                style={{ ...inputStyle, width: 70, padding: '10px 12px' }}
              />
            </label>

            <button type="submit" className="btn-teal" disabled={status === 'sending'} style={{ alignSelf: 'flex-start', opacity: status === 'sending' ? 0.6 : 1 }}>
              {status === 'sending' ? 'Sending…' : 'Send Message'}
            </button>

            {status === 'error' && (
              <p className="mono" style={{ fontSize: '11px', color: 'var(--color-danger)' }}>
                {errorMessage}
              </p>
            )}
          </form>
        )}
      </section>

      <Footer />
    </>
  );
}
