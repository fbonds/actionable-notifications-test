/**
 * Notification test DSL — assertions against Datadog log events.
 *
 * Assumes the TTA Hub backend emits one structured event per dispatch
 * *decision* (not per actual send), with shape:
 *
 *   {
 *     event: "notification.dispatched",
 *     notification_id: "AR-6b",
 *     trigger_event_id: "ar.changes_requested",
 *     recipient_user_id: "uuid",
 *     recipient_email: "creator@example.test",
 *     channel: "email" | "in-app",
 *     cadence: "immediate" | "daily" | "weekly" | "monthly",
 *     subject: "...",            // rendered, post-interpolation
 *     body_excerpt: "...",       // first ~200 chars, post-interpolation
 *     suppressed: false,
 *     suppression_reason: null,  // e.g. "user_opted_out", "queued_for_digest"
 *     timestamp: "2026-05-28T..."
 *   }
 *
 * If a field is missing from the real log shape, adjust the `match()` helper
 * and the query strings below — the DSL surface stays the same.
 */

const SPECS = require('../fixtures/notifications.json');
const SPEC_INDEX = Object.fromEntries(SPECS.map(s => [s.id, s]));

const DEFAULT_WINDOW_MS = 30_000;
const POLL_INTERVAL_MS = 1_000;

// ---- Datadog client ---------------------------------------------------------

/**
 * Thin wrapper around Datadog Logs Search API.
 * https://docs.datadoghq.com/api/latest/logs/#search-logs
 *
 * In CI: DD_API_KEY / DD_APP_KEY come from env.
 * In dev: point at a local mock by overriding `fetchImpl`.
 */
async function ddSearch({ query, from, to, fetchImpl = fetch }) {
  const res = await fetchImpl('https://api.datadoghq.com/api/v2/logs/events/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': process.env.DD_API_KEY,
      'DD-APPLICATION-KEY': process.env.DD_APP_KEY,
    },
    body: JSON.stringify({
      filter: { query, from: from.toISOString(), to: to.toISOString() },
      sort: 'timestamp',
      page: { limit: 100 },
    }),
  });
  if (!res.ok) throw new Error(`Datadog ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map(d => d.attributes.attributes); // unwrap to event payload
}

// ---- Polling primitive ------------------------------------------------------

async function pollFor({ query, predicate, windowMs, since }) {
  const deadline = Date.now() + windowMs;
  while (Date.now() < deadline) {
    const events = await ddSearch({ query, from: since, to: new Date() });
    const match = events.find(predicate);
    if (match) return match;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

// ---- Public DSL -------------------------------------------------------------

/**
 * Assert that a given notification spec was dispatched to a given recipient.
 *
 * @param {string} specId     e.g. "AR-6b"
 * @param {object} opts
 * @param {object} opts.recipient        { id, email }
 * @param {RegExp|string} [opts.subject] override; defaults to spec's subject
 * @param {string[]} [opts.bodyContains] substrings required in body_excerpt
 * @param {string} [opts.cadence]        default "immediate"
 * @param {number} [opts.withinMs]       default 30s
 * @param {Date}   [opts.since]          default = test start
 */
async function expectNotification(specId, opts) {
  const spec = SPEC_INDEX[specId];
  if (!spec) throw new Error(`Unknown spec: ${specId}`);

  const subject = opts.subject ?? spec.content_or_subject;
  const cadence = opts.cadence ?? 'immediate';
  const windowMs = opts.withinMs ?? DEFAULT_WINDOW_MS;
  const since = opts.since ?? new Date(Date.now() - 5_000);

  const query = [
    `@event:notification.dispatched`,
    `@notification_id:"${specId}"`,
    `@recipient_user_id:"${opts.recipient.id}"`,
    `@channel:"${spec.channel.toLowerCase().replace(' ', '-')}"`,
    `@cadence:"${cadence}"`,
    `@suppressed:false`,
  ].join(' ');

  const predicate = ev => {
    if (subject instanceof RegExp ? !subject.test(ev.subject) : ev.subject !== subject) return false;
    if (opts.bodyContains && !opts.bodyContains.every(s => ev.body_excerpt?.includes(s))) return false;
    return true;
  };

  const match = await pollFor({ query, predicate, windowMs, since });
  if (!match) {
    throw new Error(
      `Expected notification ${specId} to ${opts.recipient.email} within ${windowMs}ms; ` +
      `no matching event in Datadog. Query: ${query}`
    );
  }
  return match;
}

/**
 * Assert that a notification was NOT dispatched. Used for:
 *  - bystander negative cases ("this user should not receive")
 *  - opted-out users
 *  - suppression scenarios (collaborator removed mid-flight)
 *
 * Polls for full window before passing — slower than positive assertion
 * by design.
 */
async function expectNoNotification(specId, opts) {
  const windowMs = opts.withinMs ?? DEFAULT_WINDOW_MS;
  const since = opts.since ?? new Date(Date.now() - 5_000);

  const query = [
    `@event:notification.dispatched`,
    `@notification_id:"${specId}"`,
    `@recipient_user_id:"${opts.recipient.id}"`,
    `@suppressed:false`,
  ].join(' ');

  await new Promise(r => setTimeout(r, windowMs));
  const events = await ddSearch({ query, from: since, to: new Date() });
  if (events.length > 0) {
    throw new Error(
      `Expected NO notification ${specId} to ${opts.recipient.email}; ` +
      `found ${events.length} event(s).`
    );
  }
}

/**
 * Assert that a notification was *queued for digest* (suppressed at immediate
 * dispatch time, with reason = "queued_for_digest"). Catches the
 * preference-honoring path without waiting for the digest window to close.
 */
async function expectQueuedForDigest(specId, opts) {
  const since = opts.since ?? new Date(Date.now() - 5_000);
  const query = [
    `@event:notification.dispatched`,
    `@notification_id:"${specId}"`,
    `@recipient_user_id:"${opts.recipient.id}"`,
    `@suppressed:true`,
    `@suppression_reason:"queued_for_digest"`,
  ].join(' ');

  const match = await pollFor({
    query,
    predicate: () => true,
    windowMs: opts.withinMs ?? DEFAULT_WINDOW_MS,
    since,
  });
  if (!match) throw new Error(`Expected ${specId} queued for digest; not found.`);
  return match;
}

/**
 * Assert that a digest email was dispatched containing the listed report
 * numbers as bullet items. Typically called after `advanceClock()`.
 */
async function expectDigest(specId, opts) {
  const spec = SPEC_INDEX[specId];
  if (!spec) throw new Error(`Unknown spec: ${specId}`);

  const cadence = opts.cadence ?? 'daily';
  const since = opts.since ?? new Date(Date.now() - 5_000);
  const windowMs = opts.withinMs ?? 60_000;

  const query = [
    `@event:notification.dispatched`,
    `@notification_id:"${specId}"`,
    `@recipient_user_id:"${opts.recipient.id}"`,
    `@channel:"email"`,
    `@cadence:"${cadence}"`,
    `@suppressed:false`,
  ].join(' ');

  const predicate = ev =>
    (opts.containsItems ?? []).every(item => ev.body_excerpt?.includes(item));

  const match = await pollFor({ query, predicate, windowMs, since });
  if (!match) {
    throw new Error(
      `Expected ${cadence} digest ${specId} containing [${opts.containsItems?.join(', ')}]; not found.`
    );
  }
  return match;
}

// ---- Spreadsheet-driven matrix runner ---------------------------------------

/**
 * Filter the spec sheet by arbitrary fields. Use to drive parameterized tests:
 *
 *   forEachSpec({ category: 'Activity Report', channel: 'Email', status: 'Published' }, spec => {
 *     it(`${spec.id}: ${spec.trigger} → ${spec.received_by}`, async () => { ... });
 *   });
 */
function forEachSpec(filter, fn) {
  SPECS
    .filter(s => Object.entries(filter).every(([k, v]) =>
      v instanceof RegExp ? v.test(s[k] ?? '') : s[k] === v
    ))
    .forEach(fn);
}

module.exports = {
  expectNotification,
  expectNoNotification,
  expectQueuedForDigest,
  expectDigest,
  forEachSpec,
  SPECS,
  SPEC_INDEX,
};
