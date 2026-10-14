# ADR 0001: Native iOS app on the paid account, with parking captured by a Shortcuts automation

Date: 2026-10-14
Status: accepted

Research: [`docs/research/3-parking-capture-and-reminders.md`](../research/3-parking-capture-and-reminders.md) (issue [#3](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/3)). Decided by the driver under O5 on [#2](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/2).

## Context

Objective #1 is for one person with one iPhone. The phone has to learn which block side the car is parked on, with no more than a tap. It then has to put San Francisco's sweeping schedule for that side on the lock screen: the evening before, and urgently near the window, with the app closed and a Focus on. It must never say "you're fine" when it cannot tell.

The constraints that force a decision:
- **Budget.** O4: the $99/yr Apple Developer account plus small hosting.
- **Outbound hosts.** O6 pre-approves only `data.sfgov.org` and free static hosting. That city portal now redirects to `data.sf.gov`, which O6 does not name.
- **The gate.** It runs on a Linux runner that agents cannot reconfigure.

How the phone learns where the car is, and what can deliver a reminder through Focus, decide the platform. The platform then decides the language, the tests and the build. Nothing has been chosen before this ADR.

Two facts weigh most:
- iOS gives a *native* app an interruption level that breaks through Focus (`.timeSensitive`, iOS 15+), and an alarm framework that overrides Focus and silent mode (AlarmKit, iOS 26+).
- Phone accuracy on a city street is usually coarser than the distance from the centreline to the curb, so most fixes cannot decide the side.

## Decision

We build a native SwiftUI iPhone app, signed under the paid Apple Developer Program, made of five parts:

- **Capture.** An iOS Shortcuts personal automation fires on CarPlay or car-Bluetooth disconnect. It passes the Shortcuts *Get Current Location* result to the app's "Record parking" App Intent, which runs in the background and is allowed while the phone is locked. A connect automation clears pending reminders.
- **Reminders.** Local notifications are scheduled on the phone with `UNCalendarNotificationTrigger`. The urgent one uses the Time Sensitive interruption level, plus an AlarmKit alarm on iOS 26+ if the design child wants one. There is no server and no push service.
- **Status.** A Lock Screen widget shows today's and tomorrow's risk, including "can't tell", "no data" and "stale".
- **Logic.** All schedule, holiday and side-of-street logic lives in a Foundation-only Swift package that the gate tests with `swift build` and `swift test` on Linux. Side resolution follows the rule in research section 5.3: a fix resolves to a side only when *h* ≤ 10 m and *d* ≥ max(2·*h*, 3 m), and otherwise reminds on the earlier of both sides' windows.
- **Data and installs.** The city's DataSF dataset `yhqp-riqs` is bundled as a snapshot and refreshed live at each capture. Installs go through Xcode Cloud and TestFlight internal testing, with direct Xcode installs as the fallback.

## Consequences

**Easier.**
- 0-tap capture.
- Delivery with the app closed, through Focus, by two independent mechanisms.
- A lock-screen status without opening anything.
- No runtime host apart from the city's data.
- No credential in the repository.
- The risky logic (week-of-month, the 5th week, DST, holidays, side ambiguity) is tested on every pull request.

**Harder.**
- The app target cannot be built or tested on the Linux gate. Capture, delivery under Focus and the widget are verified only on the iPhone, by the person, against #7's checklist.
- The gate does not run what publishes the app, because Xcode Cloud builds where the gate cannot reach. The gap is covered by Xcode Cloud's own build result and by the person's install check, and this sentence is the record `ci.yml` asks for.
- A Mac with Xcode is needed at least once to configure Xcode Cloud, and for any direct install.
- TestFlight builds expire after 90 days, so the app needs an update or a scheduled rebuild. The widget should show the build's expiry date so it never lapses silently.
- The holiday table is maintained by hand once a year from SFMTA's published schedule.

**Rules out.** Android and other non-Apple platforms. Building with no macOS anywhere, unless a later spike proves `xtool` sufficient. Dropping the $99/yr without replacing this ADR.

**On this pull request (driver).** `CLAUDE.md` **Stack** is rewritten to name this stack and cite this ADR: "Swift 6 (SwiftPM core package, tested on Linux) + SwiftUI iOS app, built by Xcode Cloud to TestFlight".

**For the first engineer child (#4).** **Commands** become `swift build` / `swift test`, run against the package. The `ci.yml` `commands` path keeps `check-name: 'checks'` and runs those two commands. A human applies that change.

**Still the person's.** Extending O6 to `data.sf.gov`. Enrolling. Configuring Xcode Cloud's access to the repository. Any App Store Connect API key, should CI ever upload builds itself.

## Alternatives rejected

- **iOS Shortcuts automation calling a small service.** It lost because the reminder logic must then run on a new, non-pre-approved host with its own credential, or inside a Shortcut no test can read, and it has no lock-screen status widget.
- **Installable Home Screen web app with Web Push.** It lost because it can only deliver through a scheduled server. A working SF implementation needed three or four new hosts and their secrets, and Focus is passed only if the person adds the web app to every Focus by hand.
- **Free 7-day re-signed sideload.** It lost because the app stops launching every seventh day unless it is rebuilt from a Mac. A reminder app that has silently stopped is the false "you're fine" this objective exists to prevent.
- **Scriptable (a free JavaScript runtime app) driven by the same Shortcuts automation.** It lost because its API has no Time Sensitive level or alarm, and the product would rest on one third-party developer whose maintenance status could not be verified. It becomes the pick if no Mac is available and no CI credential is approved.
- **Using an existing SF sweeping app (CURB, SpotAngels).** It lost because neither documents how it handles an undecidable side of the street, so neither can be shown to meet "never falsely says I'm fine". It also sends the person's parking location to a third party.
- **Critical alerts.** It lost because the entitlement needs Apple's approval for uses this is not, and AlarmKit gives the break-through without one.
