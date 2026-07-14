import Script from 'next/script';

// Official Kit (ConvertKit) "First Principles" inline form embed.
// Copied verbatim from Settings > Landing Pages & Forms > Embed on kit.com
// so the loader script's AJAX submit, validation, and success-message
// behavior keeps working — do not hand-edit the markup or data-options JSON.
const FORM_HTML = `
<form action="https://app.kit.com/forms/2466258/subscriptions" class="seva-form formkit-form" method="post" data-sv-form="2466258" data-uid="101112441d" data-format="inline" data-version="6" data-options='{"settings":{"after_subscribe":{"action":"message","success_message":"Look out for new releases every week!","redirect_url":""},"analytics":{"google":null,"fathom":null,"facebook":null,"segment":null,"pinterest":null,"sparkloop":null,"googletagmanager":null},"modal":{"trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15},"powered_by":{"show":false,"url":"https://kit.com/features/forms?utm_campaign=poweredby&utm_content=form&utm_medium=referral&utm_source=dynamic"},"recaptcha":{"enabled":true},"return_visitor":{"action":"hide","custom_content":""},"slide_in":{"display_in":"bottom_right","trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15},"sticky_bar":{"display_in":"top","trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15}},"version":"6"}' min-width="400 500 600 700 800">
  <div data-style="clean">
    <ul class="formkit-alert formkit-alert-error" data-element="errors" data-group="alert"></ul>
    <div data-element="fields" data-stacked="false" class="seva-fields formkit-fields">
      <div class="formkit-field">
        <input class="formkit-input" name="email_address" aria-label="Your Email Address" placeholder="Your email address" required type="email" />
      </div>
      <button data-element="submit" class="formkit-submit formkit-submit">
        <div class="formkit-spinner"><div></div><div></div><div></div></div>
        <span>Subscribe to First Principles</span>
      </button>
    </div>
  </div>
</form>
`;

// Overrides Kit's default light-theme form styling to match the site's
// dark design system, without touching the markup the loader script binds to.
const FORM_STYLE = `
  [data-uid="101112441d"] { max-width: 420px; }
  [data-uid="101112441d"] .formkit-fields { display: flex; flex-direction: column; gap: 12px; }
  [data-uid="101112441d"] .formkit-field { flex: none; margin: 0; }
  [data-uid="101112441d"] .formkit-input {
    background: var(--navy2);
    border: 1px solid var(--border);
    color: var(--white);
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    padding: 14px 16px;
    width: 100%;
    outline: none;
  }
  [data-uid="101112441d"] .formkit-submit {
    background: var(--btn-primary-bg);
    color: var(--btn-primary-text);
    border: none;
    cursor: pointer;
    font-family: 'Syne', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 14px 32px;
    border-radius: var(--radius-md);
    width: 100%;
    flex: none;
    margin: 0;
  }
  [data-uid="101112441d"] .formkit-submit:hover { background: var(--btn-primary-bg-hover); }
  [data-uid="101112441d"] .formkit-alert-error { color: var(--text-secondary); background: var(--navy2); border-color: var(--border); }
`;

export default function ConvertKitEmbed() {
  return (
    <>
      <Script id="convertkit-loader" src="https://f.convertkit.com/ckjs/ck.6.js" strategy="afterInteractive" />
      <style dangerouslySetInnerHTML={{ __html: FORM_STYLE }} />
      <div dangerouslySetInnerHTML={{ __html: FORM_HTML }} />
    </>
  );
}
