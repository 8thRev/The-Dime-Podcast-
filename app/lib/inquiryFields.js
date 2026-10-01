// lib/inquiryFields.js
// The one definition of what the guest and sponsorship inquiry endpoints
// accept. Read by the API routes (api/guest-inquiry.js,
// api/sponsor-inquiry.js) to validate, by the two form pages for their
// maxLength, and by lib/llms.js to tell agents the limits. Before this the
// guest form capped the pitch at 1,000 characters while llms.txt and the
// route said 4,000, so a browser agent following the documentation was cut
// off by the form, and the routes silently truncated anything over the limit
// and still answered 200.

export const GUEST_INQUIRY_FIELDS = {
  name: { required: true, max: 200 },
  companyTitle: { required: true, max: 300 },
  email: { required: true, max: 320, email: true },
  pitch: { required: true, max: 4000 },
  links: { required: false, max: 2000 },
};

export const SPONSOR_INQUIRY_FIELDS = {
  name: { required: true, max: 200 },
  company: { required: true, max: 200 },
  email: { required: true, max: 320, email: true },
  targetCustomer: { required: false, max: 4000 },
  campaignGoal: { required: false, max: 4000 },
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Validates a request body against one of the specs above. Values are
 * trimmed; nothing is truncated. Returns the cleaned values and one entry
 * per problem, naming the field, so a 400 can say exactly what to fix:
 *
 *   { field: 'pitch', problem: 'too_long', max: 4000 }
 *
 * problem is one of: missing, not_a_string, too_long, invalid_email.
 */
export function validateInquiry(body, spec) {
  const values = {};
  const errors = [];
  for (const [field, rule] of Object.entries(spec)) {
    const raw = body[field];
    if (raw !== undefined && raw !== null && typeof raw !== 'string') {
      errors.push({ field, problem: 'not_a_string' });
      continue;
    }
    const value = (raw || '').trim();
    if (rule.required && !value) {
      errors.push({ field, problem: 'missing' });
    } else if (value.length > rule.max) {
      errors.push({ field, problem: 'too_long', max: rule.max, length: value.length });
    } else if (rule.email && value && !EMAIL_RE.test(value)) {
      errors.push({ field, problem: 'invalid_email' });
    }
    values[field] = value;
  }
  return { values, errors };
}

/** The 400 body both routes send. `error` stays a plain string for old clients. */
export function invalidFieldsBody(errors) {
  return {
    error: `Invalid fields: ${errors.map((e) => `${e.field} (${e.problem.replace(/_/g, ' ')}${e.max ? `, max ${e.max} characters` : ''})`).join('; ')}`,
    fields: errors,
  };
}
