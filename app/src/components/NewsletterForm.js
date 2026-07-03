import { useState } from 'react';

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

export default function NewsletterForm({ buttonStyle }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('sent');
      setEmail('');
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  if (status === 'sent') {
    return (
      <p className="crimson" style={{ fontSize: 15, color: 'var(--text-headline)' }}>
        You're in — check your inbox to confirm your subscription.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        type="email"
        placeholder="Your email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={inputStyle}
      />
      <button type="submit" className="btn-teal" disabled={status === 'sending'} style={{ width: '100%', opacity: status === 'sending' ? 0.6 : 1, ...buttonStyle }}>
        {status === 'sending' ? 'Subscribing…' : 'Subscribe to First Principles'}
      </button>
      {status === 'error' && (
        <p className="mono" style={{ fontSize: '11px', color: 'var(--color-danger)' }}>
          {errorMessage}
        </p>
      )}
    </form>
  );
}
