// lib/newsletterSignup.ts
// Newsletter signup tracking for the Kit (ConvertKit) embed.
// See docs/analytics-spec.md Part 2.6. newsletter_signup is a key event.
//
// The spec left one thing to settle during QA — which path Kit actually fires on
// this deployment — and says to keep only that one. Settled by reading the
// loader this site embeds, f.convertkit.com/ckjs/ck.6.js:
//
//   * `convertkit:form-success`, the event the spec guessed at, does not exist
//     in ck.6.js. The string appears nowhere in the file.
//   * ck.6.js binds its own submit handler and submits over AJAX, so the form
//     never navigates. A native `submit` listener would therefore fire on every
//     attempt — failed validation, rejected recaptcha, network error — and this
//     is a key event, so counting attempts as conversions would corrupt the one
//     number that says the newsletter is growing.
//   * On success it dispatches `ckjs:submission:complete` on the form element
//     with bubbles: true, so one document-level listener catches every embed.
//
// That event's `detail` carries `email_address`. Nothing here reads `detail`;
// only the form's own id is taken off the element. Never forward it.
//
// Trade-off worth knowing: if ck.6.js is blocked or fails to load, the form
// falls back to a native cross-domain POST and no event fires, so the signup
// goes uncounted. Undercounting a key event is the right side to fail on.

import { useEffect } from 'react';
import { track, once } from './analytics';

// Part 1 enumerates these four.
export type SignupLocation = 'newsletter_page' | 'footer' | 'episode_inline' | 'home_hero';

const KIT_SUCCESS_EVENT = 'ckjs:submission:complete';
const FALLBACK_FORM_ID = '2466258';

export function useNewsletterSignupTracking(
  location: SignupLocation,
  episodeSlug?: string
): void {
  useEffect(() => {
    const onKitSuccess = (event: Event) => {
      const form = (event.target as HTMLElement | null)?.closest?.('form.formkit-form');
      once('newsletter_signup', () =>
        track('newsletter_signup', {
          signup_location: location,
          episode_slug: episodeSlug,
          form_id: (form as HTMLFormElement | null)?.dataset?.svForm || FALLBACK_FORM_ID,
        })
      );
    };

    document.addEventListener(KIT_SUCCESS_EVENT, onKitSuccess);
    return () => document.removeEventListener(KIT_SUCCESS_EVENT, onKitSuccess);
  }, [location, episodeSlug]);
}
