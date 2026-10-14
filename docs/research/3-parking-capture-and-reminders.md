# Research #3: how the iPhone learns where I parked, and how a reminder reaches the lock screen

Issue: [#3](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/3) · Parent: [#1](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/1) · Decision log: [#2](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/2) · ADR: [`docs/decisions/0001-native-ios-app-with-shortcuts-capture.md`](../decisions/0001-native-ios-app-with-shortcuts-capture.md) (proposed)

**Decision this serves:** which route to build for capturing where the car is parked and getting a reminder onto one iPhone's lock screen (and so which stack), within O4's budget of the $99/yr Apple Developer account plus small hosting.

**State of this document (2026-10-14).** The comparison is stable: the last four sources I read (TestFlight incident threads, the CURB repository, the Scriptable type definitions, the AlarmKit sample) changed what the routes cost, not how they rank. **One item is pending:** criterion 2's check needs real records from DataSF, and this environment cannot reach the city's data host. Section 4.7 says exactly what to run. Nothing in this document is a reconstructed or invented record.

**Two findings the driver should see before anything else:**

1. **The city's open-data portal has moved hosts.** O6 pre-approves `data.sfgov.org`. An open-source SF sweeping app reported on 2026-09-09 that `data.sfgov.org` now answers with a redirect to `data.sf.gov`. Its maintainer confirmed this and switched hosts on 2026-09-27 ([alevizio/curb#26](https://github.com/alevizio/curb/issues/26)) [S]. A native HTTP client follows that redirect, so at runtime the app would talk to `data.sf.gov`, a host O6 does not name. **That needs the person's word** (section 4.6).
2. **The recommended route needs a Mac with Xcode at least once.** Xcode Cloud's first workflow has to be configured in Xcode ([Apple](https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow)) [V]. The issue and the objective never said whether the person has a Mac. If they do not, the answer may flip (section 9).

## Legend

Every factual claim carries one of these tags:

- **[V]** Verified. I read it in a primary source (Apple, WebKit, GitHub's own docs or runner image, the statute) and could quote the line.
- **[V-x]** Verified from an excerpt only. The page is primary (mostly `support.apple.com`, `webkit.org`, `sfmta.com`, `gps.gov`), but this environment could not resolve its host (`getaddrinfo ENOTFOUND`), so I read the page's text as quoted by a search index. Treat this as one step weaker than [V], and re-read the page before relying on it for anything the gate cannot check.
- **[S]** Secondary. A third-party page, a forum, or another project's repository.
- **[I]** Inference. I reasoned to it, and the sentence says from what.
- **[A]** Assumption. Neither of the above, but the comparison rests on it. All of these are listed in section 8.

Hosts this environment could not reach: `data.sfgov.org`, `data.sf.gov`, `support.apple.com`, `webkit.org`, `sfmta.com`, `gps.gov`, `docs.scriptable.app`, `apps.apple.com`, `docs.github.com`, `en.wikipedia.org`, `curb.guide`, `spotangels.com`, `catalog.data.gov`, `hub.arcgis.com`. `developer.apple.com` (through its JSON documentation endpoints), `github.com` and `raw.githubusercontent.com` were reachable.

---

## 1. The issue, taken apart

**The decision** (fixed): which capture-and-delivery route to build, and so the stack. The driver makes the call under O5 and records it in ADR 0001.

**The constraints** (checked, not assumed):

- One person and one iPhone (O1, O2). Out of scope: Android, other cities, other parking rules ([#1](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/1)).
- Budget (O4): $99/yr plus small hosting. Apple's price is "$99 annual membership" ([Apple Developer Program](https://developer.apple.com/programs/)) [V].
- Outbound hosts (O6): only `data.sfgov.org` and free static hosting are pre-approved, and any credential has to come to the person. This constraint has partly moved under us: see finding 1 above.
- The gate runs on a Linux runner through the factory's reusable workflow, and agents may not edit `.github/workflows/` ([`ci.yml`](../../.github/workflows/ci.yml), house-rules). The `ubuntu-24.04` image ships Swift 6.4 ([runner image readme, image 20261004](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)) [V], Node, and the usual toolchains.
- Done criterion 4 on #1: "never falsely says I'm fine". A false alarm is cheap. A false "safe" is the failure the objective exists to prevent.

**The guesses** (things the issue named that I treated as hypotheses):

- *The four named routes.* I compared them, but they are not the whole field. I added one unnamed route (Scriptable, 3.5) and the option of changing nothing and using an app that already exists (3.6). Both turned out to be stronger than the issue implies.
- *"Time Sensitive interruption level" as the way through Focus.* It is one of three mechanisms. A Focus's allowed-apps list also lets any app's notifications through, including Home Screen web apps ([Apple, Set up a Focus](https://support.apple.com/guide/iphone/set-up-a-focus-iphd6288a67f/ios)) [V-x]. AlarmKit alarms (iOS 26+) override Focus and silent mode outright ([Apple, Scheduling an alarm with AlarmKit](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit)) [V]. So "does it need the paid account" turns out to matter less than the issue assumed.
- *"Whether the geometry can tell the sides apart" as the hard part of side-of-street.* The harder part is that phone accuracy in a city is usually coarser than the distance from the centreline to the curb (section 5). Most fixes will be undecidable whatever the geometry says.
- *"Snapshot or refresh"* as an either/or. The recommendation does both (section 4.5).

---

## 2. The routes at a glance

"Lock screen, app closed, Focus on" means the person does not have to open anything, and a Focus such as Sleep or Work is active.

| Route | Capture (taps per parking) | Delivery | Reaches lock screen, app closed, Focus on? | Paid account needed for that? | Recurring cost | Hosts not pre-approved | Credentials |
|---|---|---|---|---|---|---|---|
| 3.1 Shortcuts automation + small service | 0 (CarPlay/Bluetooth disconnect automation) | Reminders alert and Clock alarm, created by the Shortcut | Yes: Clock alarms ignore Do Not Disturb and silent [V-x]. Reminders get through via allowed apps [V-x] | No | $0–5/mo hosting [I] | The service's host | Service deploy token [I] |
| 3.2 Home Screen web app + Web Push | 2–3 (open app, tap "parked here") or 0 with a Shortcut posting to the server | Web Push from a scheduled server | Only if the person adds the web app to each Focus's allowed list [V-x]. There is no documented Time Sensitive level for web push (absence, section 7) | No [V] | $0 on free tiers, but a scheduler [S] | Scheduler/server host, `*.push.apple.com` | VAPID private key, scheduler secrets [S] |
| 3.3 Native app on paid account (**recommended**) | 0 (Shortcuts automation calls the app's App Intent). +1–2 to choose a side when undecidable | Local notifications scheduled on-device. Optional AlarmKit alarm | Yes: `.timeSensitive` breaks through Focus [V], and AlarmKit overrides Focus and silent mode [V] | Time Sensitive capability: likely yes [I]. AlarmKit: no entitlement named [V] | $99/yr | None at runtime beyond the data host. Build-time: Apple's own services | None in the repo. App Store Connect key only if CI uploads builds |
| 3.4 Free 7-day sideload | Same as 3.3 | Same as 3.3 | Same mechanisms, **until day 7**, when the app stops launching [S] | Time Sensitive on a Personal Team unverified | $0, plus a weekly rebuild from a Mac | None | Apple ID (person-held) |
| 3.5 *Unnamed:* Scriptable + Shortcuts | 0 (automation runs the script) | Scriptable's scheduled notifications. Clock alarm via Shortcut for urgent | Through allowed apps only. No interruption-level property exists in Scriptable's API [V from types] | No | $0 [S] | None (data host or GitHub Pages) | None |
| 3.6 *Existing app* (CURB, SpotAngels) | Varies: SpotAngels claims Bluetooth auto-detect [S] | Their push | Unknown | n/a | $0 or subscription [S] | Their servers get your location | Their account |

---

## 3. Route by route

Each route below records what it does, the capture and its taps, delivery, the lock screen under Focus, the cost against O4, its hosts and credentials, what it rules out later, and what would have to be true for it to be the right pick.

### 3.1 iOS Shortcuts automation calling a small service

**What it does.** A personal automation fires when the iPhone disconnects from CarPlay or from the car's Bluetooth. It runs *Get Current Location* and posts the coordinate to a small web service. The service resolves the block side and returns the next windows. The Shortcut then creates a Reminder with an alert for the evening-before heads-up and a Clock alarm for the urgent one.

**Capture and taps.** 0 taps per parking once it is set up. Apple's Shortcuts guide for iOS 26 lists both CarPlay and Bluetooth among the automations that can run without asking ([Shortcuts User Guide 9.0, iOS 26](https://support.apple.com/guide/shortcuts/enable-or-disable-a-personal-automation-apd602971e63/9.0/ios/26)) [V-x]. Older guide versions listed Bluetooth as needing confirmation ([iOS 15-era guide](https://support.apple.com/guide/shortcuts/enable-or-disable-a-personal-automation-apd602971e63/5.0/ios/15.0)) [V-x], so this depends on the iOS version. *Get Current Location* is a built-in action ([Apple Shortcuts guide, action connections example](https://support.apple.com/en-us/guide/shortcuts/apdd882cf653/2.2/ios/12.0)) [V-x], [Cassinelli action reference](https://matthewcassinelli.com/actions/get-current-location/) [S].

**Delivery.** Shortcuts has no action that schedules a notification for later (absence: I found none, section 7). So the future reminder has to live in another app: Reminders (an alert time) or Clock (an alarm).

**Lock screen, app closed, Focus on.** Apple says Do Not Disturb and the Ring/Silent switch do not affect the alarm sound ([Apple, set and change alarms](https://support.apple.com/118444)) [V-x]. Reminders' alerts get through a Focus if Reminders is on its allowed list ([Set up a Focus](https://support.apple.com/guide/iphone/set-up-a-focus-iphd6288a67f/ios)) [V-x]. Third-party guides describe an "Urgent" toggle on a reminder that makes it time-sensitive and alarm-like ([Apple Community thread](https://discussions.apple.com/thread/253362318), [iOS Hacker](https://ioshacker.com/how-to/create-time-sensitive-reminders-that-bypass-focus-modes)) [S]. I could not verify which iOS version added it, or whether Shortcuts can set it. **No paid account is involved.**

**Recurring cost.** The account costs $0. The service needs a host: a free tier of a serverless platform probably fits [I]. That is "small hosting" under O4, but it is not *free static* hosting, so it is not pre-approved.

**Hosts and credentials.**
- `data.sfgov.org` (now `data.sf.gov`, see 4.6): pre-approved under O6 (the old name).
- The service's host (for example a serverless platform): **not pre-approved**.
- The service's deploy token: **a credential**, the person's call.

*Variant without a service:* put the logic in the Shortcut itself and have it read static tiles from GitHub Pages (pre-approved, no credential). I am naming it, not carrying it further. Point-to-segment geometry and week-of-month arithmetic built from Shortcuts' Calculate actions would live in a signed binary plist that no test on the gate can read [I].

**What it rules out later.** The risky logic either sits on a server, which is a new host, a credential and an uptime dependency, or inside a Shortcut, where it cannot be tested. There is no Lock Screen status widget, so done criterion 1 ("know without opening anything") would rest on Reminders' and Calendar's own widgets [I]. Cancelling on "I moved" means a second automation that deletes alarms and reminders it did not create through any API that tracks them [I].

**What would have to be true.** The person approves a new host and a credential, and accepts that the reminder logic is tested on a server rather than next to the alarm it sets.

### 3.2 Installable Home Screen web app with Web Push (iOS 16.4+)

**What it does.** A web app on free static hosting (GitHub Pages, pre-approved) is added to the Home Screen and subscribes to Web Push. A server keeps the parking spot and sends "move your car" pushes at the right times.

**Capture and taps.** The person unlocks, opens the web app and taps "I parked here", which is 2–3 taps. The app reads the Geolocation API while it is in the foreground. A web app has no background location and no automation trigger of its own [I, from the absence of any such API in Apple's web push page and WebKit's posts]. A Shortcut could post the location straight to the server for 0 taps, but then the server is doing route 3.1's job as well.

**Delivery.** Web Push needs a server to send at the scheduled time. GitHub Pages cannot send anything. The browser's only scheduled-local-notification API, Notification Triggers, never launched: Chrome's own status table says "Launch: Not started" ([Chrome for Developers](https://developer.chrome.com/docs/web-platform/notification-triggers)) [V], and I found no WebKit implementation (section 7). Apple's rules:
- Web push works "to Home Screen web apps in iOS 16.4 or later".
- "You don't need to join the Apple Developer Program to send web push notifications."
- The subscription must come from a user gesture.
- Your server must be able to reach `https://*.push.apple.com`.
- "Safari doesn't support invisible push notifications... If you don't [present them], Safari revokes the push notification permission for your site."

All of these are from [Apple, Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) [V]. Declarative Web Push reached iOS 18.4 Home Screen web apps ([WebKit, Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)) [V-x]. It removes the service worker, not the server.

**Lock screen, app closed, Focus on.** A push is shown by the system with the app closed: that is the only kind Safari allows [V, above]. For Focus, neither Apple's web push page nor any WebKit post I found mentions an interruption level or Time Sensitive for web push (absence, section 7). What does work: "you can allow or silence notifications from specific web apps you've added to your Home Screen" in a Focus's settings ([Set up a Focus](https://support.apple.com/guide/iphone/set-up-a-focus-iphd6288a67f/ios)) [V-x]. So it gets through Focus **only if the person adds the web app to every Focus they use**. A Focus created later silently drops it [I]. **No paid account.**

**Recurring cost.** An existing SF sweeping PWA built on this exact route says "Everything runs on free tiers". It also says its cron needs a paid plan, and it moved scheduling to a separate queue service ([alevizio/curb README](https://github.com/alevizio/curb)) [S]. So $0 is reachable, but only by stitching several free tiers together.

**Hosts and credentials.** I counted these from the working implementation above [S]:
- GitHub Pages: pre-approved.
- `data.sfgov.org`: pre-approved (but see 4.6).
- A serverless host: **not pre-approved**.
- A scheduler/queue service: **not pre-approved**.
- A key-value store: **not pre-approved**.
- `*.push.apple.com`: **not pre-approved**.
- Credentials: `VAPID_PRIVATE_KEY`, scheduler signing keys, a store token. **Every one is a credential.**

**What it rules out later.** No Lock Screen widget: done criterion 1 has to be met by a notification that is already sitting there [I]. Reminders stop the moment any of the three services has an outage, and the failure is silent: no push simply looks like "you're fine" [I]. Notably, the same project also ships "a WKWebView wrapper with native APNs" for iOS ([curb README](https://github.com/alevizio/curb)) [S]. That is weak forward evidence that the builder of this route did not find the web route sufficient on iPhone [I].

**What would have to be true.** No Mac, and no wish to pay $99, *and* the person is willing to approve three or four new hosts and their secrets. It would also have to be acceptable that the guard against a false "safe" lives on infrastructure outside the phone.

### 3.3 Native app on the paid account (recommended, see section 9)

**What it does.** A small SwiftUI app with four parts:
- an **App Intent** "Record parking" that takes a location;
- **local notifications** scheduled on the phone;
- a **Lock Screen widget** showing today and tomorrow;
- optionally, an **AlarmKit** alarm for the urgent reminder.

All schedule and side logic lives in a plain Swift package with no Apple-only imports, which is what CI tests (section 6).

**Capture and taps.** 0 taps. The same Shortcuts automation as 3.1 (CarPlay or Bluetooth disconnect) runs *Get Current Location* and passes the result to the app's intent. The app needs no location permission of its own for this [I: the location comes from Shortcuts' action]. App Intents can declare `.alwaysAllowed`, "allows the app intent to run at any time, including when the device is locked" ([Apple, IntentAuthenticationPolicy](https://developer.apple.com/documentation/appintents/intentauthenticationpolicy)) [V]. They can declare `supportedModes = [.background]` "to run the action entirely in the background" (iOS 26+, replacing the deprecated `openAppWhenRun`) ([Apple, supportedModes](https://developer.apple.com/documentation/appintents/appintent/supportedmodes)) [V]. A second automation, on CarPlay/Bluetooth *connect*, runs "Start driving", which clears pending reminders and implements "stop once I've moved" [I].

When the side is undecidable, the heads-up notification can carry "North side" / "South side" action buttons, which is one tap after expanding it. Fallback for a car with neither CarPlay nor Bluetooth: a Lock Screen control, since controls "enhance Control Center, the Lock Screen, and the Action button with actions from your app" ([Apple, controls](https://developer.apple.com/documentation/widgetkit/adding-refinements-and-configuration-to-controls)) [V]. That is one press.

One thing it cannot borrow: Apple Maps' own parked-car pin. "This is a user-level feature in the Maps app. There is no API for this data" ([Apple DTS, 2020](https://developer.apple.com/forums/thread/648929)) [V]. I found nothing newer that changes that (section 7).

**Delivery.** `UNCalendarNotificationTrigger` at fixed local times. "If the delivery of the notification occurs when your app isn't running or in the background, the system interacts with the user for you" ([Apple, Scheduling a notification locally](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app)) [V]. No server, no APNs and no push credential.

**Lock screen, app closed, Focus on.** Three mechanisms, strongest last:
1. **Allowed apps.** The person adds the app to each Focus [V-x].
2. **Time Sensitive interruption level.** Time Sensitive notifications "can break through system controls such as Notification Summary and Focus. The user can turn off the ability for time sensitive notification interruptions" ([Apple, `.timeSensitive`](https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive), iOS 15+) [V]. It applies to local notifications: "For a local notification, the Time Sensitive interruption level is set on the content object", and it needs "the associated capability" enabled ([WWDC21 10091](https://developer.apple.com/videos/play/wwdc2021/10091/)) [V].
   - *Paid account?* Apple's capability table lists "Time Sensitive Notifications" with per-membership columns ([Supported capabilities (iOS)](https://developer.apple.com/help/account/reference/supported-capabilities-ios)) [V], but its availability marks did not render in any tool I had. **Whether a free Personal Team can use it is unverified.** I infer it needs the paid account, from three things: Apple's line "to build more advanced app capabilities ... you'll need to be an Apple Developer Program member" ([compare memberships](https://developer.apple.com/support/compare-memberships/)) [V]; one developer's report that it must be ticked by hand on the App ID in the portal ([ridy#178](https://github.com/ahmaddev27/ridy/pull/178)) [S]; and Personal Teams having no portal. **A reviewer with a browser can settle this by opening that table.** It does not change the ranking (section 3.4).
   - Without the entitlement, iOS reportedly delivers the notification as `active`, so it still arrives but does not break through Focus ([ridy#178](https://github.com/ahmaddev27/ridy/pull/178)) [S].
   - Critic: on Apple Intelligence devices, the "Reduce Interruptions" Focus decides by itself what breaks through ([Gadget Hacks](https://ios.gadgethacks.com/how-to/how-to-use-reduce-interruptions-on-ios-18-and-what-it-does)) [S]. Apple's Mac help says to turn on Time Sensitive Notifications for "events or tasks that need immediate attention" ([Apple Mac User Guide, via excerpt](https://support.apple.com/guide/mac-help/mchl613dc43f/)) [V-x]. I found no Apple statement on how that Focus treats Time Sensitive on iPhone. #7's device check should include it if the person uses it.
3. **AlarmKit (iOS 26+).** An alarm "overrides both a device's focus and silent mode, if necessary". It needs `NSAlarmKitUsageDescription` and the person's authorization ([Apple, Scheduling an alarm with AlarmKit](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit)) [V]. Neither that page nor the [framework overview](https://developer.apple.com/documentation/alarmkit) names an entitlement [V, as an absence]. So I infer it works on any account [I]. Whether a full alarm is the right *tone* for "move your car" is the designer's call (#5). The mechanism is available.

**Recurring cost.** $99/yr [V], inside O4. Hosting is $0 because there is no server. Xcode Cloud: "Apple Developer Program membership includes 25 compute hours per month" ([Xcode Cloud](https://developer.apple.com/xcode-cloud/)) [V], far more than one app needs [I].

**Hosts and credentials.**
- At runtime: only the data host (`data.sfgov.org`, pre-approved, now redirecting to `data.sf.gov`, which is **not**; see 4.6). No push service, because notifications are local.
- At build time: Apple's developer services (App Store Connect, TestFlight, Xcode Cloud). These are not pre-approved under O6, but they are what O4's accepted account *is* [I]. The driver should say so in the D-entry rather than leave it implied.
- Credentials: the person's Apple ID and team, which never enter the repository. If, and only if, the person later wants GitHub Actions to upload builds, an App Store Connect API key. That is a credential and a workflow change, both the person's.

**What it rules out later.** Android (out of scope anyway). Building without macOS (see 3.4 and section 9 on xtool). It ties the product to Apple's yearly fee and to TestFlight or Xcode for installs. TestFlight builds last "up to 90 days" ([Apple, TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)) [V]. Development-signed installs need Developer Mode on the phone ([Apple, Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)) [V], and a development profile "is valid for one year" ([Apple archived DevPortal guide](https://developer.apple.com/library/archive/documentation/ToolsLanguages/Conceptual/DevPortalGuide/CreatingandDownloadingDevelopmentProvisioningProfiles/CreatingandDownloadingDevelopmentProvisioningProfiles.html)) [V-x, archived].

**What would have to be true.** The person has, or can borrow, a Mac with current Xcode for the one-time setup, and they enroll ($99, already accepted under O4).

### 3.4 Free 7-day re-signed sideload

**What it does.** The same app as 3.3, signed by a free Personal Team.

**Limits, verbatim from Apple** ([compare memberships](https://developer.apple.com/support/compare-memberships/)) [V]:
- "Provisioning profiles that enable apps to be installed on a device will expire 7 days from issuance. You'll need to rebuild and reinstall your app to your device after expiration."
- Up to 3 apps per device and 3 devices, which is fine for one person.

**Capture and taps, delivery.** Identical to 3.3.

**Lock screen, app closed, Focus on.** The allowed-apps and AlarmKit mechanisms work as in 3.3 [I, AlarmKit names no entitlement]. Time Sensitive availability on a Personal Team is unverified (see 3.3), An Apple DTS engineer points to the same table for this question ("The first column shows what you can do with a Personal Team", [forum thread 669516](https://developer.apple.com/forums/thread/669516)) [V]. That confirms the table is the authority, but its marks still did not render ([app-capabilities](https://developer.apple.com/support/app-capabilities/)) [V, as an absence]. After day 7 the app no longer launches [S]. Whether notifications it already scheduled still fire after that is **unknown**. I found no source either way (section 7).

**Recurring cost.** $0, plus a reinstall from a Mac every week, indefinitely. Tools that automate re-signing (AltStore, SideStore) add a helper on a computer or a third-party signing service. I am naming them, not researching them.

**Hosts and credentials.** As 3.3 at runtime. The person's Apple ID.

**What it rules out later.** Any week the rebuild is missed, the product fails *silently*. A reminder app that has quietly stopped is the false "you're fine" in its purest form [I]. **That is its single losing reason.**

**What would have to be true.** The person refuses the $99 *and* has a Mac at hand every week. Even then, 3.5 is better, because it needs no Mac at all.

### 3.5 Unnamed route: Scriptable (a free JavaScript runtime app) driven by the same Shortcuts automation

**Why this one.** It is the only route that keeps 3.3's 0-tap capture and keeps the logic testable on the Linux gate, without a Mac, a fee, a server or a credential. That makes it the serious outsider.

**What it does.** The CarPlay/Bluetooth automation calls Scriptable's *Run Script* with the location. A JavaScript module resolves the side, computes the windows, schedules notifications and returns the urgent time, and the Shortcut then creates a Clock alarm. The same module can be unit-tested with Node on the gate's Linux runner [I: plain JS with the Scriptable calls kept at the edge].

**Capabilities.** I checked these against the community type definitions, which are generated from Scriptable's own docs: "This project downloads a Tern definition file from https://docs.scriptable.app ... and creates the TypeScript declaration file" ([schl3ck/ios-scriptable-types](https://github.com/schl3ck/ios-scriptable-types)) [S]. The definitions are published as [`@types/scriptable-ios`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/scriptable-ios/index.d.ts) [V, the file itself]. They declare:
- `Notification.setTriggerDate(date)`, `schedule()`, `removePending(ids)` and `addAction(title, url)`;
- `Location.current()` with `setAccuracyToBest()`;
- `args.shortcutParameter`;
- `config.widgetFamily` values `accessoryRectangular` / `accessoryInline` / `accessoryCircular`, "These widgets can appear on the Lock Screen".

**There is no interruption-level, time-sensitive or critical member** in the `Notification` declaration. docs.scriptable.app itself was unreachable.

**Capture and taps.** 0, the same as 3.3. Choosing a side takes 1–2 taps via a notification action that opens a `scriptable://` URL, which brings the app to the foreground [I].

**Lock screen, app closed, Focus on.** Scriptable's scheduled notifications are delivered by iOS like any app's [I]. Through Focus they pass **only via the allowed-apps list**, because the API exposes no Time Sensitive level [V from types]. The urgent reminder can be a Clock alarm created by the Shortcut [V-x on alarm behaviour]. **No paid account.**

**Recurring cost.** $0. The app is listed as free ([AppBrain listing](https://www.appbrain.com/appstore/scriptable/ios-1405459188)) [S].

**Hosts and credentials.** The data host (pre-approved), and optionally GitHub Pages (pre-approved) to deliver the script and data. No credentials.

**What it rules out later.** Everything Scriptable does not expose: Time Sensitive, AlarmKit, App Intents with typed parameters, and control widgets. The product's floor becomes one third-party developer's maintenance. **Its maintenance status is unverified.** The App Store page was unreachable, and the one aggregator I could read gives two conflicting "last updated" dates (2024-09-30 and 2026-05-31) on the same page ([AppBrain](https://www.appbrain.com/appstore/scriptable/ios-1405459188)) [S].

**What would have to be true.** The person has no Mac and will not approve a CI credential. Scriptable is current on iOS 27. And the person accepts that urgent reminders pass Focus only through settings they configure per Focus. **This is the route that wins if 3.3's Mac assumption fails** (section 9).

### 3.6 What already exists: use an SF sweeping app instead of building one

Projects already doing this:
- **CURB** (`curb.guide`, open source): a PWA plus native wrapper on DataSF `yhqp-riqs`, with Web Push "move-your-car" alerts and observed ticket times per block side ([alevizio/curb](https://github.com/alevizio/curb)) [S].
- **SpotAngels**: says it detects parking over car Bluetooth and alerts before street cleaning ([App Store listing, via search excerpt](https://apps.apple.com/us/app/spotangels-parking-gas/id897809583)) [S]. Its free and paid split is inconsistent across sources.
- **SweepWatch**: publishes derived SQLite builds of the same dataset ([mithr4ndir/sweepwatch-data](https://github.com/mithr4ndir/sweepwatch-data)) [S].

**Capture and taps.** SpotAngels claims 0 (Bluetooth). CURB needs a tap on the map and a subscribe [S].

**Lock screen, app closed, Focus on.** Unknown for both. Neither README nor listing mentions Focus or Time Sensitive [S, absence].

**Cost.** $0 to a subscription [S]. **Hosts.** The vendor's servers receive the person's parking location. **Credentials.** The vendor account.

**What it rules out later.** Control over objective criterion 4, "never falsely says I'm fine". I could not find how either app handles an undecidable side (section 7). It also means a third party keeps a log of where the person parks [I].

**What would have to be true.** The person only wants the outcome, not the app, and is satisfied after a week of trial that the chosen app says "can't tell" rather than picking a side. **Cheapest experiment in this document:** install one for a week while #4 is being built. That costs nothing and gives a baseline. It is the person's call and does not block anything.

### 3.7 Discarded, one line each

- **Critical alerts.** "Critical interruption will continue to require an approved entitlement" ([WWDC21 10091](https://developer.apple.com/videos/play/wwdc2021/10091/)) [V], and parking is not the medical or safety use they are granted for. AlarmKit gives the break-through without an approval [V].
- **SMS or a push relay (Twilio, ntfy).** Explicitly not pre-approved (O6) and a recurring cost. Everything they add, local notifications already do.
- **Apple Wallet pass with a relevant date.** Updating a pass needs a pass-type certificate and a web service. That is a server plus a credential for less than a local notification gives [I].
- **Course-at-stop to infer the side.** California requires parking at the right-hand curb on two-way roads, but allows the left-hand curb on one-way roadways ([CVC §22502](https://law.justia.com/codes/california/code-veh/division-11/chapter-9/section-22502)) [S, aggregator of the statute]. So the direction of travel just before stopping implies the side *only on two-way streets*. Using it needs background location while driving and a one-way street layer the sweeping dataset does not have [I]. Worth a spike behind #6 if the "can't tell" rate proves annoying. Not part of the stack decision.

---

## 4. The city's data: DataSF Street Sweeping Schedule

### 4.1 Identity

- **Dataset id `yhqp-riqs`**, "Street Sweeping Schedule", managed by San Francisco Public Works. About 37.9K rows and 17 columns; "Each row is a: Sweeping block schedule" ([DataSF page via search excerpt](https://data.sf.gov/City-Infrastructure/Street-Sweeping-Schedule/yhqp-riqs/about_data)) [V-x]. The id is confirmed independently by [sweepwatch-data](https://github.com/mithr4ndir/sweepwatch-data) and [curb#26](https://github.com/alevizio/curb/issues/26) [S].
- URLs:
  - `https://data.sfgov.org/d/yhqp-riqs` (O6's host)
  - `https://data.sf.gov/City-Infrastructure/Street-Sweeping-Schedule/yhqp-riqs` (the portal's current host, 4.6)
  - API base `https://data.sf.gov/resource/yhqp-riqs.json`
  - Full CSV `https://data.sfgov.org/api/views/yhqp-riqs/rows.csv?accessType=DOWNLOAD` [V-x, URL seen in the search index]
- Bike-lane sweeping is not included [V-x]. An archive of the previous version exists as `xsry-uuyt`, "Archived Street Sweeping data (as of Jan 27, 2025)" ([DataSF](https://data.sf.gov/City-Infrastructure/Archived-Street-Sweeping-data-as-of-Jan-27-2025-/xsry-uuyt/data)) [V-x]. The current dataset's first-published date is 2025-01-27 [S, catalog excerpt]. So the city replaced the whole dataset once, less than two years ago [I].

### 4.2 Fields

Descriptions below are the portal's own column descriptions where the search index showed them [V-x]. Otherwise they come from mirrors [S] or are inferred [I]. Section 4.7 is what turns each row into [V].

| Carries | Field | What is known |
|---|---|---|
| Block | `cnn` | "Centerline Network Number", a unique id per street segment [V-x] |
| Block | `corridor`, `limits` | Street name, and from/to cross streets [V-x] |
| Block side | `cnnrightleft` | "Side of Street Swept (L=Left, R=Right)" [V-x]. **Left/right relative to what** is not stated. I infer it is relative to the segment's digitised direction [I]. Pending check 5 |
| Block side | `blockside` | "Cardinal Side of Street (North, South, etc.)" [V-x] |
| Weekday | `weekday`, `fullname` | Day of service. Mirrors show `fullname` values like "Tuesday" or "Tue 1st & 3rd" [S] |
| Hours | `fromhour`, `tohour` | "Start hour of service in 24 hour format" / end hour [V-x]. Whole hours only [I] |
| Week of month | `week1` … `week5` | "Whether a block is serviced in that week of the month", 1 or 0 [V-x on the archived dataset's description; S on values] |
| Holiday behaviour | `holidays` | 0/1 in mirrors [S]. **Meaning not stated anywhere I could reach.** I infer that 1 = swept on holidays too [I]. Pending check 4 |
| Id | `blocksweepid` | Numeric id [S] |
| Geometry | a line column (name unconfirmed). An ArcGIS mirror shows `Shape__Length` [S] | Pending checks 1 and 5 |

### 4.3 Week of month, and what a 5th week means

- **Representation:** a 5th week is the `week5` flag [V-x for the column's existence].
- **Inferred semantics [I], to pin in #4's fixed-date tests once 4.7 confirms them:** `weekN` = 1 means the block is swept on the *N*th occurrence of `weekday` in that calendar month. Days 1–7 are week 1, 8–14 week 2, 15–21 week 3, 22–28 week 4, and 29–31 week 5.
  - A "1st & 3rd Tue" block is `1,0,1,0,0`, so it is *not* swept on a fifth Tuesday.
  - A weekly block is `1,1,1,1,1`.
- **Searched and not found:** any city statement of that rule (section 7). A block with `week5 = 1` but not every other week would contradict this inference. Check 3 in 4.7 lists every week pattern that occurs, which settles it.

### 4.4 Holidays: where the list comes from, and who maintains it

- **Source.** The holiday list is **not in the dataset**. It is SFMTA's "Holiday Street Parking Enforcement Schedule" ([sfmta.com](https://www.sfmta.com/getting-around/drive-park/holiday-enforcement-schedule)) [V-x]. From its 2026 table as quoted by the search index:
  - **Weekday Daytime Street Sweeping (Street Cleaning 6am–2pm)** is not enforced on every listed holiday.
  - **Nightly street sweeping (12am–6am)** *is* enforced on most of them: MLK Day 1/19/2026, Memorial Day, Juneteenth, Independence Day, Labor Day, Veterans Day 11/11/2026, and the day after Thanksgiving.
  - Nightly sweeping is not enforced only on New Year's Day, Thanksgiving (11/26/2026) and Christmas (12/25/2026) [V-x].
  - A third-party site's list disagrees on Veterans Day ([SpotAngels map page, via excerpt](https://www.spotangels.com/sf-street-cleaning-map)) [S]. SFMTA wins.
- **Consequence.** Holiday handling depends on the window's *hours* (daytime or nightly) as well as the date. Possibly it also depends on the `holidays` flag [I]. #4's criteria need both.
- **Who maintains it.** This repository, by hand. A dated table (one year per entry, with the SFMTA URL and retrieval date) is updated once a year when SFMTA publishes the next year. That is a person's step or a driver's issue.
- **Fail-safe rule for #4 [I, from done criterion 4].** For a date whose year is not in the table, treat the day as a normal sweeping day and say "holiday list missing for <year>". Never assume a suspension. A false alarm is cheap.

### 4.5 How often the city changes the data, and snapshot vs refresh

- The portal says it is "updated on an 'as needed' basis, when sweeping schedules change" [V-x].
- Catalog listings show last-modified dates between April and August 2026 [S]. A county ArcGIS mirror is labelled "pulled weekly" [S].
- The whole dataset was replaced on 2025-01-27 (4.1) [V-x].
- Public Works notes that actual service varies with staffing and equipment [S].
- **Recommendation: both, at two intervals.**
  1. **Snapshot** at build time, committed as a test fixture and bundled in the app. The app works offline, and every CI test runs against real rows.
  2. **Refresh at each parking capture**: fetch the current rows for the candidate CNNs only, a few rows per request [I], and use them if the fetch succeeds.
  3. **Staleness rule [I]:** if the live fetch fails *and* the bundled snapshot is older than **30 days**, every status and reminder says "schedule may be out of date (data from <date>)". It never shows a plain "safe".
- 30 days is a judgement, not a measurement: monthly is about the cadence the catalog dates suggest [I]. #4 can tighten it.

### 4.6 The host has moved: `data.sfgov.org` → `data.sf.gov`

- [curb#26](https://github.com/alevizio/curb/issues/26), 2026-09-09 [S]: "the server returns an HTTP 301/302 redirect to `https://data.sf.gov/resource/...`" and browsers then fail on CORS. The maintainer's reply on 2026-10-01: "The city moved its data to data.sf.gov and the old address stopped allowing browser requests."
- Search results now point to `data.sf.gov` pages for this dataset (4.1) [V-x].
- **What it means for O6.** The person approved `data.sfgov.org` by name. A native `URLSession` follows redirects by default [I], so the app's real runtime destination is `data.sf.gov`. A web app's would simply fail.
- **This is the person's decision:** extend O6 to `data.sf.gov` (same publisher, new name), or keep the app on bundled snapshots only until they do. My recommendation is to extend it. Until then, #4 can be built and tested entirely on the snapshot.

### 4.7 PENDING: needs a live fetch from data.sfgov.org

> **PENDING: needs a live fetch from data.sfgov.org.** This environment's network policy denies `data.sfgov.org` (and `data.sf.gov`). No record below has been fetched, and none has been reconstructed. Criterion 2's check ("each named field appears in a sample record quoted in the document, next to the `data.sfgov.org` request that returned it") is **not met** until someone runs these requests and pastes the raw responses here, each under its request.

Run each request against `data.sfgov.org` exactly as written. Use `-L` so that a redirect to `data.sf.gov` is followed, and keep `-sS -D -` so the redirect itself is recorded too: that record is the evidence for 4.6. If `data.sfgov.org` refuses outright, repeat with the host replaced by `data.sf.gov` and say so next to the response.

```sh
# 1. Metadata: exact column names, column descriptions, rowsUpdatedAt, the geometry column's name and type
curl -sS -L -D - 'https://data.sfgov.org/api/views/yhqp-riqs.json'

# 2. Five complete sample records (every field, including geometry)
curl -sS -L -D - -G 'https://data.sfgov.org/resource/yhqp-riqs.json' --data-urlencode '$limit=5'

# 3. Every week-of-month pattern that occurs, and how often (settles 4.3 and the 5th-week semantics)
curl -sS -L -D - -G 'https://data.sfgov.org/resource/yhqp-riqs.json' \
  --data-urlencode '$select=week1,week2,week3,week4,week5,count(*) AS n' \
  --data-urlencode '$group=week1,week2,week3,week4,week5' \
  --data-urlencode '$order=n DESC'

# 4. The holidays flag: its values and how they line up with the hours (settles 4.4)
curl -sS -L -D - -G 'https://data.sfgov.org/resource/yhqp-riqs.json' \
  --data-urlencode '$select=holidays,fromhour,tohour,count(*) AS n' \
  --data-urlencode '$group=holidays,fromhour,tohour' \
  --data-urlencode '$order=n DESC'

# 5. Both sides of one block, to see whether L and R share one centreline geometry (settles section 5's geometry question).
#    Use the cnn of the first record from request 2 in place of <CNN>.
curl -sS -L -D - -G 'https://data.sfgov.org/resource/yhqp-riqs.json' \
  --data-urlencode "\$where=cnn='<CNN>'"

# 6. The full table for the snapshot fixture #4 commits (record the retrieval date and the rowsUpdatedAt value from request 1 beside it)
curl -sS -L -o yhqp-riqs.csv 'https://data.sfgov.org/api/views/yhqp-riqs/rows.csv?accessType=DOWNLOAD'
```

What the person running them pastes back, for each field in 4.2: the raw JSON record from request 2 that shows it, directly under request 2's command line. For requests 3 to 5, paste the raw responses. If `cnn` is numeric rather than text, request 5 needs `$where=cnn=<CNN>` without quotes. The metadata from request 1 says which.

---

## 5. Side of street

### 5.1 What accuracy iOS reports, and what it means

- **The value.** `CLLocation.horizontalAccuracy` is "the radius of uncertainty for the location, measured in meters... A negative value indicates that the latitude and longitude are invalid" ([Apple](https://developer.apple.com/documentation/corelocation/cllocation/horizontalaccuracy)) [V]. **Apple does not state the confidence level of that radius** [V, as an absence on the page].
- **Open sky.** "GPS-enabled smartphones are typically accurate to within a 4.9 m (16 ft.) radius under open sky", and accuracy "worsens near buildings, bridges, and trees" ([GPS.gov](https://www.gps.gov/systems/gps/performance/accuracy/)) [V-x]. The page attributes the figure to an ION paper. It also carries a notice that it has not been updated since February 2025 [V-x].
- **City streets.** The only iPhone-specific urban measurement I found found "overall average horizontal position accuracy of the iPhone 6 (7–13 m)", RMSE about 9.9 m, with individual errors up to 99.7 m, attributed to multipath from buildings ([Merry & Bettinger 2019, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0219890)) [V-x, read via its PMC abstract excerpt].
- **The critic.** That is a 2014 phone. Dual-frequency (L1+L5) receivers cut urban pseudorange error sharply (L1 6.32 m vs L5 1.46 m average in Hong Kong urban canyons, positioning "within 10 m on average") ([NAVIGATION 68(4)](https://navi.ion.org/content/navi/68/4/727.full.pdf)) [V-x]. A current iPhone in SF will usually do better than 7–13 m. I found no measurement of *how much* better on SF streets (section 7).
- **What to expect.** Expect reported horizontal accuracy of roughly **5–10 m** on a residential SF street, and worse among taller buildings [I, from the three sources above]. I found no study comparing iOS's *reported* `horizontalAccuracy` with true error in urban canyons (section 7), so the reported value may be optimistic.

### 5.2 Can the dataset's geometry tell a block's two sides apart?

- **Not by position, on present evidence [I].** Each row carries a line, and the two sides of a block are two rows with the same `cnn` and opposite `cnnrightleft`. If, as I infer, both rows carry the same centreline, then geometry alone puts the two sides at the same place.
- A point can still be classified: compute which side of the *directed* centreline it lies on (the sign of a cross product), then match it to the row whose `cnnrightleft` names that side. That works only if L/R is relative to the line's digitised direction.
- `blockside` (North/South/...) gives a second, independent check: an east-west block's north-side row should be the one whose side the point is on when the point is north of the line [I].
- **Pending:** request 5 in 4.7 shows whether L and R rows share a geometry. #6 should pin the L/R convention against one block whose cardinal side a person has checked on the street.

### 5.3 The ambiguity rule (copy this into #6 and #7)

> **Side rule.** A parking fix whose reported horizontal accuracy is *h* metres and whose perpendicular distance from the nearest block centreline is *d* metres resolves to the side of that centreline it lies on only when *h* ≤ 10 m and *d* ≥ max(2·*h*, 3 m); every other fix resolves to "can't tell", and its reminder is scheduled for the earlier of the two sides' next windows, never the later one.

Two companion rules, the same shape, so "can't tell" also covers *which block*:

> **Block rule.** If the centrelines of two or more blocks lie within *h* + 10 m of the fix, the result is "can't tell", and the reminder uses the earliest next window among both sides of every one of those blocks.

> **No-fix rule.** A fix with *h* < 0 (invalid, per Apple), *h* > 50 m, or no fix at all resolves to "can't tell where you parked", which is shown as such and never as safe.

**Fixtures #6 can lift directly** (single block, candidate rule not triggered):

| *h* | *d* | Result |
|---|---|---|
| 4 | 9 | side the fix is on |
| 4 | 7.9 | can't tell (needs 8) |
| 1 | 2.9 | can't tell (needs 3) |
| 11 | 40 | can't tell (*h* > 10) |
| −1 | any | can't tell where you parked |
| 60 | any | can't tell where you parked |

**Why 2·*h*, 3 m and 10 m.**
- Apple gives no confidence level for *h* (5.1). Requiring the fix to sit two radii from the centreline is a margin against *h* being a one-sigma figure [A: that it behaves roughly like one].
- The 3 m floor stops a very confident fix that is nearly on the centreline from resolving.
- The 10 m cap stops a coarse fix that happens to land far from the line from resolving, since far from the line is also where the *wrong block* lives.
- The candidate radius *h* + 10 m covers corners, where a cross street's centreline is close.
- All of these are judgements. The rule's *shape*, which resolves only on margin and otherwise takes the earliest window, is the requirement. The numbers are for #6 to tune with field data, in one direction only: tighter.

**What this means in practice [I].** A car at the curb sits roughly 4–6 m from the centreline of a typical two-lane SF residential street [A: I could not find a cited SF curb-to-curb width]. The side rule then resolves only when *h* ≤ about 2–3 m, which is better than the urban figures in 5.1. **Expect most real parking fixes to come out "can't tell".** That is the correct, safe answer, but it means the evening-before reminder often covers both sides. The one-tap side choice in 3.3 (a notification action, or a Lock Screen control) is what turns those into precise reminders. This is an input for #5's wording and #7's criteria. It is not a defect of the rule.

---

## 6. What the CI gate can prove for the recommended route

**On the gate's Linux runner.** Swift 6.4 is on `ubuntu-24.04` ([runner image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)) [V]. The command path runs `swift build && swift test` on a SwiftPM package, call it `SweepCore`, that imports only Foundation. The package holds:
- parsing of the committed DataSF snapshot fixture;
- week-of-month and 5th-week logic;
- several windows on one block;
- early-morning windows, and the "evening before" computation;
- `America/Los_Angeles` across both DST transitions;
- the holiday table, including the daytime/nightly split and the missing-year fail-safe;
- the staleness rule;
- the side, block and no-fix rules in 5.3, against the fixtures above;
- the pure function that turns a resolved spot into the list of local times to schedule.

Caveat [I]: Foundation on Linux and on iOS are different builds that read different time zone databases, so a DST test that passes on Linux shows the Linux behaviour. The same tests should also run under Xcode (locally, or as an Xcode Cloud test action) at least once per release. That runs outside the gate.

**Only on the iPhone, by the person.** Each of these depends on a real device and system state:
- the Shortcuts automation firing on CarPlay or Bluetooth disconnect and connect, without asking;
- the App Intent running while the phone is locked;
- local notifications arriving at the scheduled time with the app closed;
- Time Sensitive breaking through each Focus the person uses;
- the AlarmKit alarm sounding through Focus and silent mode;
- the Lock Screen widget showing the right state, including "can't tell", "no data" and "stale".

#7 owns a written checklist for these. Done criterion 5 on #1 closes on the person's word.

**What produces the build the person installs.**
- **Primary:** an Xcode Cloud workflow, configured once in Xcode on a Mac [V], that archives `main` and delivers to **TestFlight internal testing**. Each build lasts up to 90 days [V], so an update or a scheduled rebuild keeps it current. TestFlight installs do not need Developer Mode [V].
- **Fallback:** build and run from Xcode on the person's Mac with development signing. That needs Developer Mode [V], and the profile lasts up to a year [V-x].
- Either way, **the gate does not run what publishes the app.** In the terms of the question at the top of `ci.yml`, this is the third answer: the platform builds where this gate cannot reach. ADR 0001 records it, and says the gap is covered by Xcode Cloud's own build result and by the person's install check.
- Optional, and a human's edit to `.github/workflows/` only: a `macos-latest` job running `xcodebuild build` to catch app-target compile errors before merge. Standard GitHub-hosted runners are free on public repositories ([GitHub billing docs, via excerpt](https://docs.github.com/en/billing/concepts/product-billing/github-actions)) [V-x], and this repository is public [V: it renders without authentication].

**What #4's CI swap is written against.** Keep the `commands` path, replace the scaffolding checks with `swift build` and `swift test` for the package, and keep `check-name: 'checks'`.

---

## 7. Searches that came back empty

Each of these is a finding: the ground is thinner there than the rest of the document.

| Looked for | Result |
|---|---|
| The availability marks for "Time Sensitive Notifications" by membership type on Apple's capability tables ([supported-capabilities-ios](https://developer.apple.com/help/account/reference/supported-capabilities-ios), [app-capabilities](https://developer.apple.com/support/app-capabilities/)) | Both tables render without their marks in every tool I had (three fetches, two searches). No other source states it for a Personal Team. **Unverified either way.** A reviewer with a browser settles it in one look. |
| Any interruption level, Time Sensitive or Focus-bypass option for **web push** on iOS (Apple docs, WebKit posts, vendor guides) | None. Apple's web push page does not mention Focus. Vendor guides say it is native-only, but that is secondary. |
| A WebKit implementation of Notification Triggers (scheduled local notifications without a server) | None. Chrome's own status is "Launch: Not started". |
| A Shortcuts action that schedules a notification for later | None found. Only the immediate "Show Notification". |
| Whether notifications already scheduled by a free-sideloaded app still fire after its 7-day profile expires | No source either way. |
| A newer Apple API for the Maps parked-car location than the 2020 "there is no API" answer | None. |
| A city or Public Works statement of how week-of-month and a 5th week are counted | None. Section 4.3 is an inference pending check 3. |
| The meaning of the dataset's `holidays` flag | None. Pending check 4. |
| A study comparing iOS's *reported* `horizontalAccuracy` with true error in urban canyons, or any measurement of current iPhones on SF streets | None. Only the iPhone 6 study and a non-iPhone dual-frequency study. |
| A cited curb-to-curb width for typical SF residential streets | None. Planning Code results give sidewalk widths, not roadway. |
| Scriptable's current maintenance status (App Store version history) | Unreachable host. The aggregator contradicts itself. |
| How CURB or SpotAngels handle an undecidable side of the street | Not documented in either README or listing. |
| Reports from people who built a personal iPhone app on the paid account and regretted the route | No regret reports. The closest are the two August 2026 TestFlight team-wide expiry threads in section 9. |

---

## 8. Load-bearing assumptions

1. **The person has, or can borrow, a Mac with current Xcode, at least once.** The recommendation flips if not (section 9).
2. **The car has CarPlay or Bluetooth.** If neither, capture is a one-press Lock Screen control rather than 0 taps. All routes are affected, 3.3 least.
3. **The iPhone runs iOS 26 or later** (iOS 27 shipped on 2026-09-14 per [Wikipedia's iOS version history, via search excerpt](https://en.wikipedia.org/wiki/IOS_version_history) [S]). AlarmKit and `supportedModes` need iOS 26 [V]. On iOS 18 the urgent reminder falls back to Time Sensitive only.
4. **`horizontalAccuracy` behaves roughly like a one-sigma radius.** Apple does not say (5.1). The 2·*h* margin rests on this.
5. **SF curb-parked cars sit about 4–6 m from the block centreline.** This drives the "most fixes are can't-tell" expectation, not the rule itself.
6. **`cnnrightleft` is relative to the segment's digitised direction.** The side classification in 5.2 rests on it. Pending check 5, plus a street check by a person.
7. **The person will extend O6 to `data.sf.gov`** (4.6). Until then, the app runs on snapshots only.

---

## 9. Recommendation

**Build route 3.3: a native SwiftUI app on the paid Apple Developer account.**

- **Capture.** A Shortcuts personal automation fires on CarPlay or Bluetooth disconnect and passes *Get Current Location* to the app's background "Record parking" App Intent. A connect automation clears reminders.
- **Reminders.** Local notifications are scheduled on the phone. Urgent ones use the Time Sensitive interruption level, plus an AlarmKit alarm on iOS 26+ if #5 wants one.
- **Status.** A Lock Screen widget shows whether today or tomorrow is at risk.
- **Logic.** All schedule and side logic sits in a Foundation-only Swift package that the Linux gate tests.
- **Data.** A bundled DataSF snapshot, refreshed live at each capture, with the side, block and no-fix rules in 5.3.
- **Installs.** Builds reach the phone through Xcode Cloud and TestFlight.

It is the only route where every requirement on #1 rests on a verified Apple mechanism:
- 0-tap capture;
- delivery with the app closed;
- breaking through Focus (two independent mechanisms);
- status without opening anything (widget);
- testable logic;
- no new runtime host apart from the city's data;
- no credential in the repository.

It costs exactly what O4 already accepted.

### The strongest argument against it

I looked for this one rather than imagining it. The parts of this route the person actually feels are the capture firing and the reminder arriving, and those are exactly the parts no gate can test. The channel that delivers the app to the phone has failed recently in a way that would stop the product silently. In August 2026 two developers reported every TestFlight build on their team going "Expired" at once. Fresh uploads then failed to install with "The requested app is not available or doesn't exist", there was no Apple reply in either thread, and the problem was still unresolved weeks later ([thread 841782](https://developer.apple.com/forums/thread/841782), [thread 848523](https://developer.apple.com/forums/thread/848523)) [S].

Put that next to the Mac requirement, which nobody has confirmed. Route 3.5 (Scriptable) gets the same 0-tap capture, the same testable-on-Linux logic and the same Lock Screen widget support, at $0, with no Mac, no expiring builds and no Apple distribution service in the path. It loses only on two points: no Time Sensitive level (Focus passes through allowed-apps settings instead), and dependence on one third-party developer whose maintenance status I could not verify.

**Why it still loses.** A TestFlight outage blocks *updates*, while the installed build keeps running until its 90 days are up [V]. #7 can add a "build expires on <date>" line to the widget so expiry is never silent [I]. The fallback path, a direct Xcode install with a one-year profile, avoids TestFlight entirely. Scriptable's ceiling cannot be raised by this project at all.

### What would have to change for the answer to flip

- **No Mac, and no CI credential.** If the person has no Mac and will not approve an App Store Connect API key for a macOS GitHub runner, pick **3.5 Scriptable**: everything else is equal or better there. Before that, it is worth one spike behind its own issue on `xtool`, which claims to "build and deploy iOS apps with SwiftPM on Linux, Windows, and macOS" ([xtool](https://github.com/xtool-org/xtool)) [S]. Its support for widget extensions, App Intents and the Time Sensitive capability is unverified.
- **Apple's paid account stops being acceptable.** Again **3.5**, not the 7-day sideload.
- **Time Sensitive turns out to be unavailable** for the person's account type, *and* the phone is below iOS 26. The urgent reminder then rests on the allowed-apps setting alone, which removes 3.3's main delivery advantage over 3.5.
- **A week's trial of an existing app (3.6)** shows it handles "can't tell" honestly. The cheapest answer is then not to build.

### Steps only the person can take on this route

1. **Say whether a Mac with current Xcode is available.** This decides 3.3 vs 3.5.
2. **Extend O6 to `data.sf.gov`** (4.6), or confirm that snapshot-only is acceptable for now.
3. **Enroll in the Apple Developer Program** ($99/yr) with their Apple Account.
4. **On the Mac, in Xcode:** sign in to the team. Confirm the Time Sensitive Notifications capability is enabled on the App ID (Xcode or the developer portal). Configure the first Xcode Cloud workflow and grant it access to this GitHub repository, which is a new integration with the repo and so the person's call. Or build and run directly.
5. **On the iPhone:** install TestFlight and accept the internal build. Or, for direct installs, enable Developer Mode (Settings → Privacy & Security).
6. **Grant permissions:** notifications (leave Time Sensitive on for this app), AlarmKit's alarm permission if #5 uses it, and location for Shortcuts.
7. **Create the Shortcuts automations:** CarPlay (or the car's Bluetooth) *disconnect* → Get Current Location → Record parking, and *connect* → Start driving. Set both to run without asking.
8. **In every Focus they use (including Sleep):** allow Time Sensitive notifications, or add the app to the allowed apps.
9. **Add the Lock Screen widget**, and optionally the Lock Screen control.
10. **Verify on the device per #7's checklist**, with the app closed and a Focus on.
11. **Once a year:** renew the membership, and update the holiday table when SFMTA publishes the next year.

ADR 0001 ([`docs/decisions/0001-native-ios-app-with-shortcuts-capture.md`](../decisions/0001-native-ios-app-with-shortcuts-capture.md)) carries this recommendation as `Status: proposed`. The driver accepts or rewrites it under O5.
