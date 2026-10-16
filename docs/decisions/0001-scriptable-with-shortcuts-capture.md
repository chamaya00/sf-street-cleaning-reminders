# ADR 0001: Scriptable on the iPhone, with parking captured by a Shortcuts automation and data served from GitHub Pages

Date: 2026-10-16
Status: accepted

Research: [`docs/research/3-parking-capture-and-reminders.md`](../research/3-parking-capture-and-reminders.md) (issue [#3](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/3)), route 3.5 and the Scriptable addendum in section 9.4. Decided by the driver as D4 and D5 on [#2](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/2). This replaces the native-app draft of ADR 0001 (2026-10-14), which never merged.

## Context

Objective #1 is for one person with one iPhone. The phone has to learn which block side the car is parked on, with no more than a tap. It then has to put San Francisco's sweeping schedule for that side in front of the person: the evening before, and urgently near the window, with nothing opened and a Focus on. It must never say "you're fine" when it cannot tell.

The constraints that force a decision:
- **No Mac (O9).** A native app would then need an App Store Connect API key in a macOS CI job before anything reached the phone. That key is a credential only the person can approve.
- **Budget (O4).** The $99/yr Apple Developer account plus small hosting is the ceiling, not a target.
- **Hosts (O6, O12, D5).** The phone talks to one host, GitHub Pages (`chamaya00.github.io`), which is the free static hosting O6 pre-approved. City data is fetched by the repository on GitHub's runners. The city's portal now answers `data.sfgov.org` with a 301 to `data.sf.gov` (research 4.6).
- **The person's choices.** The urgent reminder is a real Clock alarm created through Shortcuts (O11). Script updates come from GitHub automatically (O13).
- **The gate.** It runs on a Linux runner that agents cannot reconfigure.

Two facts weigh most:
- Scriptable schedules notifications for a future date that iOS delivers while Scriptable is not running. It shows Lock Screen widgets and takes input from a Shortcuts automation, all at $0. It has no Time Sensitive interruption level (research 3.5, 9.4).
- Phone accuracy on a city street is usually coarser than the distance from the centreline to the curb. Most fixes cannot decide the side, so the one-tap side choice carries real weight (research 5).

## Decision

We build the product as Scriptable scripts on the iPhone. They are driven by Shortcuts personal automations, run on a dependency-free JavaScript logic module that the gate tests, and are fed by a city-data file the repository publishes weekly on GitHub Pages:

- **Capture.** A Shortcuts automation fires on CarPlay or car-Bluetooth **disconnect** and runs a Scriptable script with the location as the Shortcut parameter, a dictionary of latitude and longitude. The script:
  - resolves block and side by the rules in research 5.3: a side only when *h* ≤ 10 m and *d* ≥ max(2·*h*, 3 m), and a fix whose accuracy is unknown never resolves a side;
  - stores the parking;
  - schedules the reminders.
- **Reminders.**
  - **Heads-up:** Scriptable notifications scheduled with `setTriggerDate`. When the side is "can't tell", they remind for the earlier of both sides' windows and carry two action buttons named from the dataset's `blockside` ("North side", "South side"), so that one choice reschedules them for that side.
  - **Urgent:** a Clock alarm created by the Shortcuts *Create Alarm* action. A Clock alarm has a time and repeat days but no date. So a daily Time of Day automation creates it, after asking the script whether a window starts within the next 24 hours. It is not created at parking time.
  - **Clearing:** a CarPlay or car-Bluetooth **connect** automation (driving away) removes the pending notifications by identifier and turns the alarm off by its label. The next disconnect replaces both.
- **Status.** A Scriptable Lock Screen (accessory) widget, and optionally a Home Screen one. It works out today's and tomorrow's risk from the stored windows each time it renders. It shows "can't tell", "no data", "stale" and when it last checked.
- **Logic.** All schedule, holiday, staleness and side-of-street logic lives in one JavaScript module that:
  - has no dependencies, and calls neither Scriptable's nor Node's APIs;
  - is written with `module.exports`, which both Scriptable's `importModule` and Node read.

  The Scriptable scripts are thin glue around it. The gate runs `node --test` against it on Linux.
- **Data.** A weekly GitHub Action reads the DataSF table `yhqp-riqs` through the SODA2 `/resource/yhqp-riqs.json` endpoint. It builds a compact JSON stamped with its own fetch time and the city's `rowsUpdatedAt`, and publishes the file with the scripts on GitHub Pages. The phone fetches that file and keeps the last good copy. If the copy was fetched more than 14 days ago, every status and reminder says the schedule may be out of date, and never shows a plain "safe".
- **Installs and updates.** The person runs an installer script in Scriptable once. It downloads the scripts and the logic module from `chamaya00.github.io` into Scriptable's documents directory. Later runs replace them when a newer version is published, writing to a temporary file first and swapping only after the download is complete and parses.

## Consequences

**Easier.**
- No Mac, no App Store Connect key, no Apple distribution pipeline and no $99/yr. Recurring cost is $0.
- 0-tap capture, through the same Shortcuts automation the native route would have used.
- One outbound host on the phone, `chamaya00.github.io`, and no credential in the repository or on the phone.
- The risky logic (week-of-month and the explicit 5th week, DST, the holiday rules, staleness, side ambiguity) is tested on every pull request.
- Pages serves the module as a plain file, with no build step, so the file the gate tests is the file the phone downloads. That holds as long as the Pages workflow copies files unchanged, and the gate does not itself run that workflow. This sentence is the record `ci.yml` asks for.

**Harder.**
- **No Time Sensitive level.** Scriptable's notifications pass a Focus only if Scriptable is on that Focus's allowed list, set by hand in every Focus. The urgent reminder rests on the Clock alarm, which rings through Do Not Disturb and silent mode.
- **The alarm needs its own daily automation,** because Create Alarm cannot set a date. Create Alarm always makes a new alarm, and no Delete Alarm action was found, so turned-off alarms may pile up in Clock.
- **Side choice opens Scriptable.** It is two taps (expand the notification, tap a side) and brings Scriptable to the foreground.
- **Accuracy may not arrive.** Shortcuts may not pass the fix's accuracy, so more fixes come out "can't tell".
- **Widget refresh timing belongs to iOS.**
- **One third-party developer.** The whole runtime rests on a free app whose recent maintenance could not be verified (research 9.2). If an iOS release breaks its notifications, this project cannot patch it. The widget's "last checked" line and the daily automation are what make that visible.
- **Phone-only checks.** Capture, delivery with Scriptable closed, the alarm and the widget are verified only on the iPhone, by the person, against #7's checklist.
- **The weekly workflow can stop silently.** GitHub disables scheduled workflows in a public repository after 60 days without activity, and the city's rows can go months unchanged. The 14-day staleness rule makes that visible on the phone. The workflow also widens what the automation may do, so the person merges it (D4).
- **The CSV export is being retired.** DataSF's legacy CSV export (`/api/views/yhqp-riqs/rows.csv`) answers with a `Sunset: Tue, 22 Dec 2026` header, so the Action must not depend on it.
- **Holidays are hand-maintained.** The holiday-date table is updated by hand once a year from SFMTA's schedule. A window is suspended on a holiday only when both the dataset and SFMTA say so (research 4.4).

**Rules out.**
- Everything Scriptable does not expose: Time Sensitive and critical notifications, AlarmKit, App Intents, control widgets.
- Android.
- Moving to a native app later means rewriting the logic in Swift, as D4 says. Before #4 merges, reversing is an edit to this ADR.

**On this pull request (driver).** `CLAUDE.md` **Stack** is rewritten to name this stack and cite this ADR, for example: "JavaScript: a dependency-free logic module tested with `node --test` on Linux, run on the iPhone by Scriptable scripts that Shortcuts automations trigger, with data and scripts served from GitHub Pages".

**For the first engineer child (#4).** **Commands** become `node --test`, run against the logic module. The `ci.yml` `commands` path keeps `check-name: 'checks'` and runs that command. A human applies that change.

**Still the person's.**
- Merging the weekly data-refresh workflow.
- Turning on GitHub Pages.
- Installing Scriptable and running the installer.
- Creating the three automations and setting them to run without asking.
- Allowing notifications, and adding Scriptable to every Focus.
- Adding the widget.
- The real-device check.

## Alternatives rejected

- **Native SwiftUI app on the paid account, built by the person's TestFlight GitHub Action.** It lost on no Mac (O9) plus the App Store Connect API key the CI build would need, a credential only the person can approve.
- **Shortcuts automation calling a small service.** It lost because the reminder logic would run on a new, non-pre-approved host with its own deploy credential, or inside a Shortcut no test can read.
- **Installable Home Screen web app with Web Push.** It lost because it can deliver only through a scheduled server. A working SF implementation needed three or four new hosts and their secrets.
- **Free 7-day re-signed sideload.** It lost because it has to be rebuilt and re-signed from a Mac every seven days, and there is no Mac.
- **Using an existing SF sweeping app (CURB, SpotAngels).** It lost because neither documents how it handles an undecidable side of the street, so neither can be shown to meet "never falsely says I'm fine".
- **Critical alerts.** It lost because the entitlement needs Apple's approval for uses this is not, and Scriptable cannot request it anyway.
