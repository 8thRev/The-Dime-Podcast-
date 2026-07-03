// lib/spamGuard.js
// Shared anti-spam checks for public forms (/contact, /guests) that don't
// have a backend service or reCAPTCHA key to lean on: a honeypot field real
// visitors never fill, a math check re-verified server-side, and a minimum
// time-on-page (bots tend to submit within milliseconds of page load).

export function runAntiSpamChecks({ company, a, b, answer, loadedAt }, minElapsedMs = 3000) {
  // Honeypot tripped — pretend success so the bot doesn't learn to avoid it.
  if (company) {
    return { blocked: true, silent: true };
  }

  const aNum = Number(a);
  const bNum = Number(b);
  const answerNum = Number(answer);
  if (!Number.isFinite(aNum) || !Number.isFinite(bNum) || aNum + bNum !== answerNum) {
    return { blocked: true, silent: false, error: 'That verification answer is incorrect.' };
  }

  const elapsed = Date.now() - Number(loadedAt || 0);
  if (!Number.isFinite(elapsed) || elapsed < minElapsedMs) {
    return { blocked: true, silent: false, error: 'Please try submitting again.' };
  }

  return { blocked: false };
}
