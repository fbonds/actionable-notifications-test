/**
 * Example spec — Activity Report: Approver 1 requests changes.
 *
 * Covers the AR-6 fan-out: one trigger event produces three dispatched
 * notifications (to Creator, Collaborator, Approver 2) plus a negative
 * assertion that an unrelated user gets nothing.
 *
 * Uses Cypress conventions for the UI driver, but the DSL itself is
 * framework-agnostic — swap `cy.visit` etc. for Playwright if needed.
 */

const {
  expectNotification,
  expectNoNotification,
  expectQueuedForDigest,
  expectDigest,
  forEachSpec,
} = require('../lib/notifications');

const { seedCast, loginAs, advanceClock } = require('../lib/harness'); // not sketched here

describe('AR — Approver 1 requests changes (AR-6 family)', () => {
  let cast;
  let report;
  let testStart;

  before(async () => {
    // One reusable cast per region: Creator, Collaborator, Approver1, Approver2,
    // plus a bystander who should never appear in any assertion.
    cast = await seedCast({ region: 14 });
    report = await cast.fixtures.submittedActivityReport();
  });

  beforeEach(() => {
    testStart = new Date();
  });

  it('AR-6b: Creator receives "Changes requested" email immediately', async () => {
    loginAs(cast.approver1);
    cy.visit(`/activity-reports/${report.id}/review`);
    cy.findByLabelText('Status').select('Needs action');
    cy.findByRole('textbox', { name: /Comments/ }).type("Fix typo in objective's description.");
    cy.findByRole('button', { name: 'Submit' }).click();

    await expectNotification('AR-6b', {
      recipient: cast.creator,
      since: testStart,
      // subject defaults to the spreadsheet value, with regex tolerance
      subject: /Activity Report .*: Changes requested$/,
      bodyContains: [
        `requested changes to report ${report.number}`,
        cast.approver1.name,
        "Fix typo in objective",
      ],
    });
  });

  it('AR-6d: Collaborator receives "Changes requested" email immediately', async () => {
    loginAs(cast.approver1);
    cy.visit(`/activity-reports/${report.id}/review`);
    cy.findByLabelText('Status').select('Needs action');
    cy.findByRole('button', { name: 'Submit' }).click();

    await expectNotification('AR-6d', {
      recipient: cast.collaborator,
      since: testStart,
    });
  });

  it('AR-6f: Approver 2 receives "Changes requested by [Approver 1 name]" email', async () => {
    loginAs(cast.approver1);
    cy.visit(`/activity-reports/${report.id}/review`);
    cy.findByLabelText('Status').select('Needs action');
    cy.findByRole('button', { name: 'Submit' }).click();

    await expectNotification('AR-6f', {
      recipient: cast.approver2,
      since: testStart,
      subject: new RegExp(`Changes requested by ${cast.approver1.name}`),
    });
  });

  it('bystander outside the report gets nothing', async () => {
    loginAs(cast.approver1);
    cy.visit(`/activity-reports/${report.id}/review`);
    cy.findByLabelText('Status').select('Needs action');
    cy.findByRole('button', { name: 'Submit' }).click();

    await expectNoNotification('AR-6b', {
      recipient: cast.bystander,
      since: testStart,
    });
  });

  it('AR-6b is queued (not sent immediately) when Creator opted into daily digest', async () => {
    await cast.creator.setPreference('AR-6', { channel: 'email', cadence: 'daily' });

    loginAs(cast.approver1);
    cy.visit(`/activity-reports/${report.id}/review`);
    cy.findByLabelText('Status').select('Needs action');
    cy.findByRole('button', { name: 'Submit' }).click();

    await expectQueuedForDigest('AR-6b', {
      recipient: cast.creator,
      since: testStart,
    });

    // Approver 2 still gets immediate — independent preference.
    await expectNotification('AR-6f', {
      recipient: cast.approver2,
      since: testStart,
    });
  });

  it('AR-11: daily digest aggregates multiple changes-requested into one email', async () => {
    await cast.creator.setPreference('AR-6', { channel: 'email', cadence: 'daily' });
    const r1 = await cast.fixtures.submittedActivityReport();
    const r2 = await cast.fixtures.submittedActivityReport();
    const r3 = await cast.fixtures.submittedActivityReport();

    for (const r of [r1, r2, r3]) {
      loginAs(cast.approver1);
      cy.visit(`/activity-reports/${r.id}/review`);
      cy.findByLabelText('Status').select('Needs action');
      cy.findByRole('button', { name: 'Submit' }).click();
    }

    await advanceClock('1d'); // triggers the daily digest job

    await expectDigest('AR-11', {
      recipient: cast.creator,
      cadence: 'daily',
      containsItems: [r1.number, r2.number, r3.number],
      since: testStart,
    });
  });
});

// -----------------------------------------------------------------------------
// Spreadsheet-driven matrix example: shape-check every Published AR email spec.
// Not a functional test — verifies that for each Published row, the recorded
// subject in our fixture matches the regex tests downstream expect.
// -----------------------------------------------------------------------------
describe('Published AR email specs — schema sanity', () => {
  forEachSpec({ category: 'Activity Report', channel: 'Email', status: 'Published' }, spec => {
    it(`${spec.id}: subject matches expected format`, () => {
      expect(spec.content_or_subject).to.match(/^(Revised )?Activity Report R\d+-AR-\d+:/);
      expect(spec.received_by).to.be.oneOf([
        'Creator', 'Collaborator', 'Collaborators', 'Approvers', 'Approver 1', 'Approver 2',
      ]);
    });
  });
});
