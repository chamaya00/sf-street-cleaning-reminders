# Research #3: how the iPhone learns where I parked, and how a reminder reaches the lock screen

Issue: [#3](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/3) · Parent: [#1](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/1) · Decision log: [#2](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/2) · ADR: [`docs/decisions/0001-scriptable-with-shortcuts-capture.md`](../decisions/0001-scriptable-with-shortcuts-capture.md) (accepted)

**Decision this serves:** which route to build for capturing where the car is parked and getting a reminder onto one iPhone's lock screen (and so which stack), within O4's budget of the $99/yr Apple Developer account plus small hosting.

**State of this document (revision round 1, 2026-10-16).** Two things changed after the first version (2026-10-14), and this revision addresses only those:

1. **Criterion 2's check is met.** The requests in section 4.7 ran on a GitHub runner on 2026-10-16T08:58:18Z ([run 38877227921](https://github.com/chamaya00/sf-street-cleaning-reminders/actions/runs/38877227921)). Section 4.7 quotes the raw responses from branch [`data/sf-street-sweeping`](https://github.com/chamaya00/sf-street-cleaning-reminders/tree/data/sf-street-sweeping). Sections 4.2–4.6 and 5.2 now mark as verified what that data settles. Nothing in this document is a reconstructed or invented record.
2. **The stack is now route 3.5, Scriptable** (D4 and D5 on [#2](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/2)). The person has no Mac (O9), which is the first flip condition section 9 named. ADR 0001 is rewritten to that route as `Status: proposed`. Section 9.4 adds a Scriptable addendum that checks what the ADR relies on. Section 9.2 puts the strongest argument against Scriptable beside the old argument against the native route (9.1). Sections 2, 3, 9.1 and 9.3 still read as they did on 2026-10-14: they are the comparison the decision was made from. Section 6 carries a note where it no longer applies.

The comparison itself is stable. The addendum's sources changed what the Scriptable route costs, not how the routes rank once there is no Mac.

**Two findings from the first version, and where they stand:**

1. **The city's open-data portal has moved hosts.** This is now **verified**: every request to `data.sfgov.org` was answered `301 Moved Permanently` with a `Location:` on `data.sf.gov` (section 4.6). It was first reported by an open-source SF sweeping app ([alevizio/curb#26](https://github.com/alevizio/curb/issues/26)) [S]. O12 and D5 settle it for the phone: the phone never calls either city host, and the weekly Action on GitHub's runner does.
2. **The native route needed a Mac with Xcode at least once** ([Apple](https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow)) [V]. The person answered: **no Mac** (O9). The answer flipped to 3.5 (sections 9 and 9.4).

## Legend

Every factual claim carries one of these tags:

- **[V]** Verified. I read it in a primary source (Apple, WebKit, GitHub's own docs or runner image, the statute) and could quote the line.
- **[V-x]** Verified from an excerpt only. The page is primary (mostly `support.apple.com`, `webkit.org`, `sfmta.com`, `gps.gov`), but this environment could not resolve its host (`getaddrinfo ENOTFOUND`), so I read the page's text as quoted by a search index. Treat this as one step weaker than [V], and re-read the page before relying on it for anything the gate cannot check.
- **[S]** Secondary. A third-party page, a forum, or another project's repository.
- **[I]** Inference. I reasoned to it, and the sentence says from what.
- **[A]** Assumption. Neither of the above, but the comparison rests on it. All of these are listed in section 8.

Hosts this environment could not reach: `data.sfgov.org`, `data.sf.gov`, `support.apple.com`, `webkit.org`, `sfmta.com`, `gps.gov`, `docs.scriptable.app`, `apps.apple.com`, `docs.github.com`, `en.wikipedia.org`, `curb.guide`, `spotangels.com`, `catalog.data.gov`, `hub.arcgis.com`. In revision round 1 these were also unreachable: `matthewcassinelli.com`, `talk.automators.fm`, `www.similarweb.com`, `apps.appfollow.io`, `www.iphone-ticker.de`. `developer.apple.com` (through its JSON documentation endpoints), `github.com` and `raw.githubusercontent.com` were reachable.

**The city data is the exception.** Section 4.7's requests were run against `data.sfgov.org` on a GitHub runner, not from here, and their raw responses are committed on branch `data/sf-street-sweeping`. Claims tagged [V] in sections 4 and 5.2 are read from those files.

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

- **Dataset id `yhqp-riqs`**, "Street Sweeping Schedule", attributed to "San Francisco Public Works". It has 37,878 rows and 17 columns, and its row label is "Sweeping block schedule". All of this is from the metadata, request 1 in 4.7 [V]. The id is confirmed independently by [sweepwatch-data](https://github.com/mithr4ndir/sweepwatch-data) and [curb#26](https://github.com/alevizio/curb/issues/26) [S].
- URLs:
  - `https://data.sfgov.org/d/yhqp-riqs` (O6's host)
  - `https://data.sf.gov/City-Infrastructure/Street-Sweeping-Schedule/yhqp-riqs` (the portal's current host, 4.6)
  - API base `https://data.sf.gov/resource/yhqp-riqs.json`
  - Full CSV `https://data.sfgov.org/api/views/yhqp-riqs/rows.csv?accessType=DOWNLOAD` [V-x, URL seen in the search index]
- "Please note that bike lane sweeping is not included in this dataset." (request 1) [V]. An archive of the previous version exists as `xsry-uuyt`, "Archived Street Sweeping data (as of Jan 27, 2025)" ([DataSF](https://data.sf.gov/City-Infrastructure/Archived-Street-Sweeping-data-as-of-Jan-27-2025-/xsry-uuyt/data)) [V-x]. The current dataset's `publicationDate` is `1738000541` (request 1) [V], which is 2025-01-27 [I: Unix-time conversion]. So the city replaced the whole dataset once, less than two years ago [I].

### 4.2 Fields

Every column name, API field name, type and description below is verbatim from the `columns` array of the metadata (request 1 in 4.7) [V]. The value counts are from that response's `cachedContents` [V]. The "Sample value" column is from the first record of request 2 [V].

| Carries | Column (`fieldName`), type | The city's description | Sample value | Notes |
|---|---|---|---|---|
| Block | `CNN` (`cnn`), text | "Centerline network number – unique identifier for every street segment in CCSF basemap" | `"8753101"` | Text, so request 5 filters with `cnn='…'` in quotes |
| Block | `Corridor` (`corridor`), text | "Street Name" | `"Market St"` | |
| Block | `Limits` (`limits`), text | "From / To Streets" | `"Larkin St  -  Polk St"` | Two spaces either side of the hyphen |
| Block side | `CNNRightLeft` (`cnnrightleft`), text | "Side of Street Swept (L=Left, R=Right)" | `"L"` | R 19,183 rows, L 18,695. Left/right relative to what is not stated. It matches the line's digitised direction on all five blocks checked (5.2) |
| Block side | `BlockSide` (`blockside`), text | "Cardinal Side of Street (North, South, etc.)" | `"SouthEast"` | Values: North, South, West, East, NorthWest, SouthEast, SouthWest, NorthEast. **Null on 839 rows** |
| Weekday | `WeekDay` (`weekday`), text | "Abbreviated day of week serviced" | `"Tues"` | Values: Mon, Tues, Wed, Thu, Fri, Sat, Sun, and **Holiday** (824 rows; see 4.4). Note "Tues" for Tuesday, with the others three letters |
| Weekday and weeks, as a label | `FullName` (`fullname`), text | "Full Name of day of the Week or abbreviated day of week + week of the month serviced" | `"Tuesday"` | For example "Tue 1st, 3rd, 5th", "Mon 2nd & 4th", "HOLIDAY" |
| Hours | `FromHour` (`fromhour`), number | "Start hour of service in 24 hour format" | `"5"` | Whole hours, 0 to 13 |
| Hours | `ToHour` (`tohour`), number | "End hour of service in 24 hour format" | `"6"` | Whole hours, 2 to 15. Request 4 covers every row, and in every group `tohour` is later than `fromhour`, so no window crosses midnight |
| Week of month | `Week1` … `Week5` (`week1` … `week5`), number | "1= serviced on the first week of the month" … "1= serviced on the fifth week of the month" | `"1"` ×5 | See 4.3 |
| Holiday behaviour | `Holidays` (`holidays`), number | "1= swept on holidays" | `"0"` | 0 on 35,145 rows, 1 on 2,733 rows. See 4.4 |
| Id | `BlockSweepID` (`blocksweepid`), number | "Unique ID for this dataset" | `"1640782"` | |
| Geometry | `Line` (`line`), line | "Represents vector geometry objects on a map" | GeoJSON `LineString` (shown in 4.7) | Coordinates are `[longitude, latitude]` |

The SODA2 JSON returns every value as a string, even in columns the headers type as `number` (`X-SODA2-Types` in request 2's headers, against `"fromhour":"5"` in its body) [V]. #4's parser has to convert them.

### 4.3 Week of month, and what a 5th week means

- **Representation [V].** Every row carries five explicit flags, `week1` to `week5`, each "1= serviced on the *N*th week of the month" (request 1). Exactly six patterns occur, and their counts sum to all 37,878 rows (request 3):

  | `week1`–`week5` | Rows | A `fullname` label that goes with it |
  |---|---|---|
  | 1,1,1,1,1 | 23,908 | "Tuesday": every week (request 2, record 1) |
  | 0,1,0,1,0 | 6,880 | "Mon 2nd & 4th" (a value in request 1; paired with this pattern by name) |
  | 1,0,1,0,0 | 4,367 | "Wed 1st & 3rd" (request 2, record 3) |
  | 1,0,1,0,1 | 2,287 | "Tue 1st, 3rd, 5th" (request 2, record 2) |
  | 0,1,0,1,1 | 334 | "Fri 2nd, 4th, 5th" (a grep of the full table, request 6) |
  | 1,0,0,0,0 | 102 | "Fri 1st" (request 1's smallest `fullname`; paired by name) |

- **A 5th week is explicit, row by row [V].** A "1st & 3rd" block is either `1,0,1,0,0` (not swept on a fifth occurrence) or `1,0,1,0,1` (swept), and `fullname` says which ("Wed 1st & 3rd" against "Tue 1st, 3rd, 5th" in request 2). The same split exists for "2nd & 4th". **#4 must read `week5`, and never infer it from the other weeks or from the label.** No row has `week5 = 1` with weeks 1–4 all 0.
- **What "week *N*" counts [I, now well supported].** It means the *N*th occurrence of that weekday in the calendar month: days 1–7 are week 1, 8–14 week 2, 15–21 week 3, 22–28 week 4, and 29–31 week 5.
  - The city's description says only "serviced on the fifth week of the month" [V]. But labels such as "Tue 1st, 3rd, 5th" name occurrences of a weekday, and a fifth occurrence can only fall on days 29–31.
  - The one competing reading counts calendar rows (weeks starting on a Sunday). It differs only in months that do not start on Sunday. #4's fixed-date tests should pin the occurrence reading, and #7's device check should compare one 5th-week date against a posted sign.
- **Searched and not found:** any city statement of the rule (section 7).

### 4.4 Holidays: where the list comes from, and who maintains it

**What the dataset says, in two separate places [V].**

1. **The `holidays` flag** on every row: "1= swept on holidays" (request 1). It is `"0"` on 35,145 rows and `"1"` on 2,733.
   - In request 4, which groups every row by flag and hours, the eight largest groups all have `holidays` `"0"`.
   - Every `"1"` group is an early-morning window, starting by 06:00 and ending by 08:00. The largest is `{"holidays":"1","fromhour":"2","tohour":"6","n":"1405"}`.
2. **A separate holiday schedule:** 824 rows whose `weekday` is `"Holiday"` and `fullname` is `"HOLIDAY"` (request 1's value counts). Request 5 shows how the two fit together on one block, Market St between Larkin and Polk (CNN 8753101):
   - **L / SouthEast side:** Monday–Friday 05:00–06:00 with `holidays` `"0"`; Saturday, Sunday and **HOLIDAY** 05:00–07:00 with `holidays` `"1"`.
   - **R / NorthWest side:** Monday–Friday 02:00–06:00 with `holidays` `"0"`, and no Holiday row.

**How to read them [I, from request 5's block].**
- A regular-weekday row with `holidays` 0 does not run when its day is a holiday.
- A row with `holidays` 1 still runs.
- A `Holiday` row is a window that runs on a holiday, whatever weekday the holiday falls on.

**The two fields disagree on some rows [V].** In the full table (request 6, counted by grep, not reproduced), 537 of the 824 `Holiday` rows have `holidays` 1, and **287 have `holidays` 0**. A row that exists only to say "this runs on holidays" while flagged "not swept on holidays" cannot be read both ways. #4 should treat a `Holiday` row as applying on every listed holiday, whatever its flag [I, from done criterion 4].

**What this means for the holiday table [I].** The dataset says *which windows* run on holidays. It does not say *which dates are holidays*. So the table this repository maintains becomes a dated list of holiday dates per year. SFMTA's split between daytime and nightly sweeping stays as a second source, because it disagrees with the dataset in both directions:
- **The dataset suspends where SFMTA enforces.** Market St's R side runs Monday 02:00–06:00 with `holidays` 0, so the dataset says it is not swept on a Monday holiday. SFMTA enforces nightly sweeping (12am–6am) on MLK Day, Memorial Day and Labor Day, all Mondays (below).
- **The dataset sweeps where SFMTA does not enforce.** 113 rows run 06:00–08:00 with `holidays` 1 (request 4), which is inside SFMTA's daytime band, and SFMTA does not enforce daytime sweeping on any listed holiday.

So the rule #4 should implement, on a date in the holiday table: a window is suspended only when its row is a regular-weekday row with `holidays` 0 **and** SFMTA's table says that window's band (daytime or nightly) is not enforced that day. Every other case reminds as normal. A false alarm is cheap.

- **Where the dates come from.** The holiday list is **not in the dataset**. It is SFMTA's "Holiday Street Parking Enforcement Schedule" ([sfmta.com](https://www.sfmta.com/getting-around/drive-park/holiday-enforcement-schedule)) [V-x]. From its 2026 table as quoted by the search index:
  - **Weekday Daytime Street Sweeping (Street Cleaning 6am–2pm)** is not enforced on every listed holiday.
  - **Nightly street sweeping (12am–6am)** *is* enforced on most of them: MLK Day 1/19/2026, Memorial Day, Juneteenth, Independence Day, Labor Day, Veterans Day 11/11/2026, and the day after Thanksgiving.
  - Nightly sweeping is not enforced only on New Year's Day, Thanksgiving (11/26/2026) and Christmas (12/25/2026) [V-x].
  - A third-party site's list disagrees on Veterans Day ([SpotAngels map page, via excerpt](https://www.spotangels.com/sf-street-cleaning-map)) [S]. SFMTA wins.
- **Consequence.** Holiday handling depends on the date, on the window's band (daytime or nightly), and on the row's `holidays` flag and `weekday`. The rule above combines all three, and #4's criteria need each one.
- **Who maintains it.** This repository, by hand. A dated table (one year per entry, with the SFMTA URL and retrieval date) is updated once a year when SFMTA publishes the next year. That is a person's step or a driver's issue.
- **Fail-safe rule for #4 [I, from done criterion 4].** For a date whose year is not in the table, treat the day as a normal sweeping day and say "holiday list missing for <year>". Never assume a suspension. A false alarm is cheap.

### 4.5 How often the city changes the data, and snapshot vs refresh

- **How often the city says it changes [V].** "This dataset will be updated on an 'as needed' basis, when sweeping schedules change." The metadata's publishing details read `"Data change frequency" : "As needed"` and `"Publishing frequency" : "As needed"` (request 1).
- **When it last changed [V].** `"rowsUpdatedAt" : 1778758589` (request 1). Every data response reports the same moment as `Last-Modified: Thu, 14 May 2026 11:36:29 GMT` (request 2's to 5's headers). At the time of the fetch, the rows had not changed for five months [I: arithmetic].
- The current dataset was published on 2025-01-27, replacing the archived one (4.1) [V for the date; I for the replacement]. Public Works adds: "Actual service may vary depending on staffing, equipment availability, and operational needs." (request 1) [V].
- **Recommendation (changed with the route, O12 and D5): refresh weekly, done by the repository.**
  1. A scheduled GitHub Action fetches the table from DataSF once a week. It builds a compact JSON stamped with its own fetch time (`fetchedAt`) and the city's `rowsUpdatedAt`, and publishes it on GitHub Pages.
  2. The phone downloads that file at each capture and from its daily automation, and keeps the last good copy. Nothing on the phone calls DataSF.
  3. A snapshot of the table is also committed as #4's test fixture, so every CI test runs against real rows.
- **Staleness rule [I].** Staleness is measured from `fetchedAt`, not from `rowsUpdatedAt`, because the rows can rightly stay unchanged for months. If the phone's copy was fetched more than **14 days** ago, which is two missed weekly runs, every status and reminder says "schedule may be out of date (checked <date>)". It never shows a plain "safe". This replaces the first version's 30-day rule for a bundled snapshot, which was set against a guessed monthly cadence. #4 can tighten it.
- **Two facts the weekly Action has to design around.**
  - **The CSV export is being retired [V].** The full-table CSV export used by request 6 (`/api/views/yhqp-riqs/rows.csv`) answered with `Deprecation: @1791331200` and `Sunset: Tue, 22 Dec 2026 00:00:00 GMT` ([`6-full-table.headers`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/6-full-table.headers)). Socrata's notice says the legacy SODA1 `/api/views/{4x4}/rows` endpoints are deprecated from October 2026, with SODA2 and SODA3 the replacements for reads ([Socrata, weekly updates 2026-07-16](https://support.socrata.com/hc/en-us/articles/41869841509783-Weekly-updates-July-16-2026)) [V-x]. The Action should read the SODA2 `/resource/yhqp-riqs.json` endpoint that requests 2–5 used, paging with `$limit` and `$offset` [I].
  - **Scheduled workflows can pause [V-x].** GitHub disables scheduled workflows in a public repository after 60 days without repository activity ([GitHub docs, disabling and enabling a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)). An Action that commits only when the rows change could stop without warning in a quiet stretch [I]. The staleness rule is what makes that visible on the phone.

### 4.6 The host has moved: `data.sfgov.org` → `data.sf.gov`

- **Verified [V].** Every request in 4.7 went to `data.sfgov.org`, and every one was answered first with `HTTP/1.1 301 Moved Permanently` and a `Location:` on `data.sf.gov`. The 200 responses then came from `data.sf.gov`. The `Location:` lines, verbatim from each `.headers` file on branch [`data/sf-street-sweeping`](https://github.com/chamaya00/sf-street-cleaning-reminders/tree/data/sf-street-sweeping) ([run 38877227921](https://github.com/chamaya00/sf-street-cleaning-reminders/actions/runs/38877227921)):

  ```
  1-metadata.headers:             Location: https://data.sf.gov/api/views/yhqp-riqs.json
  2-sample5.headers:              Location: https://data.sf.gov/resource/yhqp-riqs.json?%24limit=5
  3-week-patterns.headers:        Location: https://data.sf.gov/resource/yhqp-riqs.json?%24group=week1%2Cweek2%2Cweek3%2Cweek4%2Cweek5&%24order=n%20DESC&%24select=week1%2Cweek2%2Cweek3%2Cweek4%2Cweek5%2Ccount%28%2A%29%20AS%20n
  4-holidays-hours.headers:       Location: https://data.sf.gov/resource/yhqp-riqs.json?%24group=holidays%2Cfromhour%2Ctohour&%24order=n%20DESC&%24select=holidays%2Cfromhour%2Ctohour%2Ccount%28%2A%29%20AS%20n
  5-one-block-both-sides.headers: Location: https://data.sf.gov/resource/yhqp-riqs.json?%24where=cnn%3D%278753101%27
  ```

  Each 301 also carries `Access-Control-Allow-Origin: https://data.sfgov.org`, and the metadata names its own host: `"domainCName" : "data.sf.gov"` (request 1).
- **Who saw it first:** [curb#26](https://github.com/alevizio/curb/issues/26), 2026-09-09 [S]: "the server returns an HTTP 301/302 redirect to `https://data.sf.gov/resource/...`" and browsers then fail on CORS. The maintainer replied on 2026-10-01: "The city moved its data to data.sf.gov and the old address stopped allowing browser requests."
- **What it means for O6: settled by the person.** Under O12 and D5 the phone never calls `data.sfgov.org` or `data.sf.gov`. The weekly Action on GitHub's runner does, and the phone reads only `chamaya00.github.io`. The open question the first version of this section asked is closed.

### 4.7 The live fetch: criterion 2's check

**Criterion 2's check is met.** Every field named in 4.2 appears below in a record or response quoted from `data.sfgov.org`, next to the request that returned it.

The requests ran on a GitHub-hosted runner on **2026-10-16T08:58:18Z**, in [run 38877227921](https://github.com/chamaya00/sf-street-cleaning-reminders/actions/runs/38877227921), against `data.sfgov.org` with `curl -sS -L -D -`. That way each redirect was followed and recorded. The raw bodies and headers are committed on branch [`data/sf-street-sweeping`](https://github.com/chamaya00/sf-street-cleaning-reminders/tree/data/sf-street-sweeping), one `.body` and one `.headers` file per request, plus a `README.md`. Everything below is copied from those files, and nothing is reconstructed. Each request was answered `301` to `data.sf.gov` and then `200`; the `Location:` lines are quoted in 4.6. Request 6, the full table, is #4's fixture and is not reproduced here. Section 4 cites it only for two counts and its headers.

#### Request 1: metadata

```sh
curl -sS -L -D - 'https://data.sfgov.org/api/views/yhqp-riqs.json'
```

Source: [`1-metadata.body`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/1-metadata.body), [`1-metadata.headers`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/1-metadata.headers), run 38877227921. The response is 920 lines, so these are verbatim excerpts, with the file's line numbers on the left:

```
2    "id" : "yhqp-riqs",
3    "name" : "Street Sweeping Schedule",
4    "assetType" : "dataset",
5    "attribution" : "San Francisco Public Works",
13   "domainCName" : "data.sf.gov",
24   "publicationDate" : 1738000541,
27   "rowsUpdatedAt" : 1778758589,
...
749  }, {
750    "id" : 604564234,
751    "name" : "Holidays",
752    "dataTypeName" : "number",
753    "description" : "1= swept on holidays",
754    "fieldName" : "holidays",
755    "position" : 15,
...
886  "Data change frequency" : "As needed",
887  "Program link" : "",
888  "Publishing frequency" : "As needed",
...
892  "rowLabel" : "Sweeping block schedule",
```

The `description` string on line 10 contains the substring `<strong>C. UPDATE PROCESS</strong>\nThis dataset will be updated on an 'as needed' basis, when sweeping schedules change.` The other 16 columns carry the same four keys (`name`, `dataTypeName`, `description`, `fieldName`). The table in 4.2 copies them verbatim, together with the value counts each column's `cachedContents` reports.

#### Request 2: five complete records

```sh
curl -sS -L -D - -G 'https://data.sfgov.org/resource/yhqp-riqs.json' --data-urlencode '$limit=5'
```

Source: [`2-sample5.body`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/2-sample5.body), [`2-sample5.headers`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/2-sample5.headers), run 38877227921. The first record is verbatim below, except that its last member, `line`, has been moved to its own block:

```json
{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"Tuesday","weekday":"Tues","fromhour":"5","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1640782"}
```

Its geometry, the `line` member:

```json
"line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}
```

The response headers list the fields and their types:

```
X-SODA2-Fields: ["cnn","corridor","limits","cnnrightleft","blockside","fullname","weekday","fromhour","tohour","week1","week2","week3","week4","week5","holidays","blocksweepid","line"]
X-SODA2-Types: ["text","text","text","text","text","text","text","number","number","number","number","number","number","number","number","number","line"]
Last-Modified: Thu, 14 May 2026 11:36:29 GMT
```

Records 2–5 in the same file carry the same 17 members. Section 5.2 uses all five rows' geometry.

#### Request 3: every week-of-month pattern

```sh
curl -sS -L -D - -G 'https://data.sfgov.org/resource/yhqp-riqs.json' \
  --data-urlencode '$select=week1,week2,week3,week4,week5,count(*) AS n' \
  --data-urlencode '$group=week1,week2,week3,week4,week5' \
  --data-urlencode '$order=n DESC'
```

Source: [`3-week-patterns.body`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/3-week-patterns.body), [`3-week-patterns.headers`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/3-week-patterns.headers), run 38877227921. The full response:

```json
[{"week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","n":"23908"}
,{"week1":"0","week2":"1","week3":"0","week4":"1","week5":"0","n":"6880"}
,{"week1":"1","week2":"0","week3":"1","week4":"0","week5":"0","n":"4367"}
,{"week1":"1","week2":"0","week3":"1","week4":"0","week5":"1","n":"2287"}
,{"week1":"0","week2":"1","week3":"0","week4":"1","week5":"1","n":"334"}
,{"week1":"1","week2":"0","week3":"0","week4":"0","week5":"0","n":"102"}]
```

#### Request 4: the holidays flag against the hours

```sh
curl -sS -L -D - -G 'https://data.sfgov.org/resource/yhqp-riqs.json' \
  --data-urlencode '$select=holidays,fromhour,tohour,count(*) AS n' \
  --data-urlencode '$group=holidays,fromhour,tohour' \
  --data-urlencode '$order=n DESC'
```

Source: [`4-holidays-hours.body`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/4-holidays-hours.body), [`4-holidays-hours.headers`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/4-holidays-hours.headers), run 38877227921. The full response:

```json
[{"holidays":"0","fromhour":"2","tohour":"6","n":"4418"}
,{"holidays":"0","fromhour":"6","tohour":"8","n":"4239"}
,{"holidays":"0","fromhour":"8","tohour":"10","n":"4210"}
,{"holidays":"0","fromhour":"9","tohour":"11","n":"4099"}
,{"holidays":"0","fromhour":"12","tohour":"14","n":"3560"}
,{"holidays":"0","fromhour":"7","tohour":"8","n":"3431"}
,{"holidays":"0","fromhour":"4","tohour":"6","n":"1992"}
,{"holidays":"0","fromhour":"0","tohour":"6","n":"1564"}
,{"holidays":"1","fromhour":"2","tohour":"6","n":"1405"}
,{"holidays":"0","fromhour":"13","tohour":"15","n":"1386"}
,{"holidays":"0","fromhour":"0","tohour":"2","n":"1348"}
,{"holidays":"0","fromhour":"7","tohour":"9","n":"879"}
,{"holidays":"0","fromhour":"10","tohour":"12","n":"756"}
,{"holidays":"0","fromhour":"11","tohour":"13","n":"743"}
,{"holidays":"0","fromhour":"5","tohour":"7","n":"734"}
,{"holidays":"0","fromhour":"8","tohour":"11","n":"568"}
,{"holidays":"0","fromhour":"12","tohour":"15","n":"518"}
,{"holidays":"1","fromhour":"5","tohour":"7","n":"414"}
,{"holidays":"1","fromhour":"0","tohour":"2","n":"360"}
,{"holidays":"0","fromhour":"5","tohour":"6","n":"240"}
,{"holidays":"1","fromhour":"4","tohour":"6","n":"169"}
,{"holidays":"0","fromhour":"3","tohour":"5","n":"165"}
,{"holidays":"1","fromhour":"0","tohour":"6","n":"118"}
,{"holidays":"0","fromhour":"6","tohour":"7","n":"114"}
,{"holidays":"1","fromhour":"6","tohour":"8","n":"113"}
,{"holidays":"1","fromhour":"1","tohour":"3","n":"90"}
,{"holidays":"0","fromhour":"8","tohour":"9","n":"71"}
,{"holidays":"0","fromhour":"10","tohour":"15","n":"49"}
,{"holidays":"1","fromhour":"1","tohour":"6","n":"35"}
,{"holidays":"0","fromhour":"1","tohour":"6","n":"26"}
,{"holidays":"0","fromhour":"2","tohour":"3","n":"24"}
,{"holidays":"1","fromhour":"2","tohour":"4","n":"22"}
,{"holidays":"0","fromhour":"2","tohour":"5","n":"9"}
,{"holidays":"1","fromhour":"3","tohour":"5","n":"7"}
,{"holidays":"0","fromhour":"1","tohour":"2","n":"2"}]
```

The `n` values sum to 37,878, so these groups cover every row.

#### Request 5: both sides of one block

The CNN is the first record's from request 2, `8753101`. It is quoted as text because the metadata types `cnn` as `text`.

```sh
curl -sS -L -D - -G 'https://data.sfgov.org/resource/yhqp-riqs.json' \
  --data-urlencode "\$where=cnn='8753101'"
```

Source: [`5-one-block-both-sides.body`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/5-one-block-both-sides.body), [`5-one-block-both-sides.headers`](https://github.com/chamaya00/sf-street-cleaning-reminders/blob/data/sf-street-sweeping/5-one-block-both-sides.headers), run 38877227921. The full response, 13 rows:

```json
[{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"Tuesday","weekday":"Tues","fromhour":"5","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1640782","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"R","blockside":"NorthWest","fullname":"Tuesday","weekday":"Tues","fromhour":"2","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1642430","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"R","blockside":"NorthWest","fullname":"Wednesday","weekday":"Wed","fromhour":"2","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1642517","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"Friday","weekday":"Fri","fromhour":"5","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1640713","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"Saturday","weekday":"Sat","fromhour":"5","tohour":"7","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"1","blocksweepid":"1618088","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"HOLIDAY","weekday":"Holiday","fromhour":"5","tohour":"7","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"1","blocksweepid":"1640736","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"Sunday","weekday":"Sun","fromhour":"5","tohour":"7","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"1","blocksweepid":"1618101","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"Wednesday","weekday":"Wed","fromhour":"5","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1640805","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"R","blockside":"NorthWest","fullname":"Monday","weekday":"Mon","fromhour":"2","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1642343","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"R","blockside":"NorthWest","fullname":"Thursday","weekday":"Thu","fromhour":"2","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1642604","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"Thursday","weekday":"Thu","fromhour":"5","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1640828","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"L","blockside":"SouthEast","fullname":"Monday","weekday":"Mon","fromhour":"5","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1640759","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}
,{"cnn":"8753101","corridor":"Market St","limits":"Larkin St  -  Polk St","cnnrightleft":"R","blockside":"NorthWest","fullname":"Friday","weekday":"Fri","fromhour":"2","tohour":"6","week1":"1","week2":"1","week3":"1","week4":"1","week5":"1","holidays":"0","blocksweepid":"1642691","line":{"type":"LineString","coordinates":[[-122.416291701103,37.777493843394],[-122.416317106137,37.777410028361],[-122.417392074888,37.776560951931],[-122.417501462483,37.776540893509]]}}]
```

**Where each 4.2 field appears.**
- In request 2's first record: `cnn`, `corridor`, `limits`, `cnnrightleft` (block side), `blockside` (block side), `weekday` and `fullname` (weekday), `fromhour` and `tohour` (hours), `week1`–`week5` (week of month, including `week5`), `holidays` (holiday behaviour), `blocksweepid` and `line`.
- `weekday` `"Holiday"` (the separate holiday schedule): request 5, sixth row.
- Every week pattern and every `holidays`/hours combination: requests 3 and 4.
- The city's own meaning for each column: request 1.

---

## 5. Side of street

### 5.1 What accuracy iOS reports, and what it means

- **The value.** `CLLocation.horizontalAccuracy` is "the radius of uncertainty for the location, measured in meters... A negative value indicates that the latitude and longitude are invalid" ([Apple](https://developer.apple.com/documentation/corelocation/cllocation/horizontalaccuracy)) [V]. **Apple does not state the confidence level of that radius** [V, as an absence on the page].
- **Open sky.** "GPS-enabled smartphones are typically accurate to within a 4.9 m (16 ft.) radius under open sky", and accuracy "worsens near buildings, bridges, and trees" ([GPS.gov](https://www.gps.gov/systems/gps/performance/accuracy/)) [V-x]. The page attributes the figure to an ION paper. It also carries a notice that it has not been updated since February 2025 [V-x].
- **City streets.** The only iPhone-specific urban measurement I found found "overall average horizontal position accuracy of the iPhone 6 (7–13 m)", RMSE about 9.9 m, with individual errors up to 99.7 m, attributed to multipath from buildings ([Merry & Bettinger 2019, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0219890)) [V-x, read via its PMC abstract excerpt].
- **The critic.** That is a 2014 phone. Dual-frequency (L1+L5) receivers cut urban pseudorange error sharply (L1 6.32 m vs L5 1.46 m average in Hong Kong urban canyons, positioning "within 10 m on average") ([NAVIGATION 68(4)](https://navi.ion.org/content/navi/68/4/727.full.pdf)) [V-x]. A current iPhone in SF will usually do better than 7–13 m. I found no measurement of *how much* better on SF streets (section 7).
- **What to expect.** Expect reported horizontal accuracy of roughly **5–10 m** on a residential SF street, and worse among taller buildings [I, from the three sources above]. I found no study comparing iOS's *reported* `horizontalAccuracy` with true error in urban canyons (section 7), so the reported value may be optimistic.

### 5.2 Can the dataset's geometry tell a block's two sides apart?

- **Not by position [V].** In request 5, all 13 rows for CNN 8753101 share one and the same `LineString`, coordinate for coordinate. That covers both L/SouthEast rows and R/NorthWest rows. The dataset draws each block as its centreline only, so geometry alone puts the two sides at the same place. No distance to a "side line" exists to measure.
- **What side resolution has to be [I].** Compute which side of the *directed* centreline the fix lies on, from the sign of a cross product against the segment nearest the fix. Then pick the rows of that `cnn` whose `cnnrightleft` names that side.
  - **This works only if L and R are relative to the line's digitised direction (first coordinate to last).** The data supports that on every row I could check [I, computed from verified coordinates]. Market St's line runs from its north-east end to its south-west end, and the left of that direction is south-east: L is `SouthEast` and R is `NorthWest` (request 5).
  - The same test agrees on the other four rows of request 2:
    - Lower Great Hwy is drawn southward, so its right is west: R/West ✓.
    - 08th Ave is drawn southward, so its left is east: L/East ✓.
    - Alemany Blvd is drawn west-south-west, so its left is south-east: L/SouthEast ✓.
    - Laguna St is drawn northward, so its right is east: R/East ✓.
  - That is five blocks, not 37,878 rows. #6 should run the same check over the whole fixture, as a test, and pin it against one block whose side a person has checked on the street.
- **`blockside` gives the words for the side choice [V for the values; I for the use].** Each row names its side as a compass direction: North, South, East, West, NorthEast, NorthWest, SouthEast or SouthWest (request 1). When a fix is "can't tell", the one-tap choice (5.3, and #5's design) can read the block's two `blockside` values and offer them in plain words, for example "South-east side" and "North-west side" on Market St. That beats "left" and "right", which mean nothing to a person standing at the car.
  - `blockside` is **null on 839 rows** (request 1). For those, #5 needs a fallback wording, such as the cross streets in `limits` with "this side" or "the other side". #6 should treat a null side name as "no label", never as "no sweeping".
  - `blockside` is also a cross-check on the L/R reading above: a fix the cross product puts on a block's left should be on that block's `blockside` compass side [I].

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

> **Route changed in revision round 1 (2026-10-16).** This section was written for route 3.3, and the Swift commands below no longer apply. Under ADR 0001 as rewritten (Scriptable, D4), the answers to criterion 4 are:
> - **The gate's Linux runner** runs `node --test` against the dependency-free JavaScript module. Node is on the `ubuntu-24.04` image ([runner image readme](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)) [V]. The module holds the same list of logic as the `SweepCore` list below. The DST caveat changes form: Node on Linux and Scriptable on iOS are different JavaScript engines with different time zone data, so #7's device check should cover one DST date [I].
> - **Only the iPhone** can verify the items in the addendum (9.4): the automation firing, a notification arriving with Scriptable closed, the Clock alarm, and the Lock Screen widget.
> - **What the person installs** is the scripts GitHub Pages serves, fetched by the installer script. Pages copies the tested module without a build step, but the gate does not run the Pages workflow (ADR 0001).
>
> #4's CI swap is written against the ADR, not against the Swift commands below.

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
| A city or Public Works statement of how week-of-month and a 5th week are counted | Still none. The data now shows that a 5th week is an explicit flag on every row (4.3). What "week *N*" counts is still an inference, now well supported. |
| The meaning of the dataset's `holidays` flag | **No longer empty.** The metadata's column description says "1= swept on holidays" (4.2, request 1). |
| A study comparing iOS's *reported* `horizontalAccuracy` with true error in urban canyons, or any measurement of current iPhones on SF streets | None. Only the iPhone 6 study and a non-iPhone dual-frequency study. |
| A cited curb-to-curb width for typical SF residential streets | None. Planning Code results give sidewalk widths, not roadway. |
| Scriptable's current maintenance status (App Store version history) | Unreachable host. The aggregator contradicts itself. Revision round 1: the newest version any source shows is 1.7.19, undated. No 2025–2026 release note or iOS 26 statement turned up in two searches (9.2). |
| *Revision round 1, Scriptable addendum (9.4):* `docs.scriptable.app` itself | Does not resolve from this environment (`ENOTFOUND`). Read instead through the DefinitelyTyped declarations generated from it and through search excerpts. A 2026-03-20 commit in the types project says the docs' definition file is "no longer online" (9.2). |
| An Apple page documenting the Shortcuts *Create Alarm* action and its parameters | None. Apple's Shortcuts guide does not document individual Clock actions. The only reference is third-party (9.4, point 5). |
| A Shortcuts *Delete Alarm* action | None found. Only Create Alarm, Toggle Alarm, Get All Alarms and Start Timer. |
| Whether the Create Alarm action asks for confirmation inside an automation set to run without asking | No source either way. Device check. |
| Whether Shortcuts exposes a location's horizontal accuracy (for example through *Get Details of Locations*) | None. |
| Whether Scriptable's `Location.current()` works in a script started by a background Shortcuts automation | None. |
| Reports of Scriptable *scheduled notifications* failing to arrive (r/Scriptable, talk.automators.fm) | None. The only failure reports are widgets erroring after the iOS 17 and iOS 18.4 updates (9.2). |
| How CURB or SpotAngels handle an undecidable side of the street | Not documented in either README or listing. |
| Reports from people who built a personal iPhone app on the paid account and regretted the route | No regret reports. The closest are the two August 2026 TestFlight team-wide expiry threads in section 9. |

---

## 8. Load-bearing assumptions

1. **The person has, or can borrow, a Mac with current Xcode, at least once.** **Answered: no** (O9). The recommendation flipped to 3.5 (D4, ADR 0001, section 9.4).
2. **The car has CarPlay or Bluetooth.** If neither, capture is a one-press Lock Screen control rather than 0 taps. All routes are affected, 3.3 least.
3. **The iPhone runs iOS 26 or later** (iOS 27 shipped on 2026-09-14 per [Wikipedia's iOS version history, via search excerpt](https://en.wikipedia.org/wiki/IOS_version_history) [S]). AlarmKit and `supportedModes` need iOS 26 [V]. On iOS 18 the urgent reminder falls back to Time Sensitive only.
4. **`horizontalAccuracy` behaves roughly like a one-sigma radius.** Apple does not say (5.1). The 2·*h* margin rests on this.
5. **SF curb-parked cars sit about 4–6 m from the block centreline.** This drives the "most fixes are can't-tell" expectation, not the rule itself.
6. **`cnnrightleft` is relative to the segment's digitised direction.** The side classification in 5.2 rests on it. It now holds on all five blocks checked (5.2), so it is an inference rather than a bare assumption. #6 still checks the whole table, plus one street check by a person.
7. ~~The person will extend O6 to `data.sf.gov`.~~ **Settled differently** (O12, D5): the phone never calls DataSF (4.6).
8. **Scriptable keeps working on the person's iOS version** (revision round 1). Its maintenance could not be verified (9.2), and the route depends on it.

---

## 9. Recommendation

> **Revision round 1 (2026-10-16).** The recommendation below was written on 2026-10-14, under assumption 1 (a Mac). The person has no Mac (O9). The first condition in 9.3 was met, and the driver chose route 3.5, Scriptable (D4 and D5 on #2). ADR 0001 now records that route.
>
> This section keeps the original recommendation and its argument (9.1) as the record of the comparison, and adds:
> - the strongest argument against Scriptable, beside the old one (9.2);
> - an addendum that verifies what the Scriptable route relies on (9.4), including what would flip it back and the steps only the person can take on it.
>
> **The addendum does not find the one thing that would reopen D4:** Scriptable can schedule a notification for a future date that is delivered while the app is closed.

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

### 9.1 The strongest argument against route 3.3 (2026-10-14)

I looked for this one rather than imagining it. The parts of this route the person actually feels are the capture firing and the reminder arriving, and those are exactly the parts no gate can test. The channel that delivers the app to the phone has failed recently in a way that would stop the product silently. In August 2026 two developers reported every TestFlight build on their team going "Expired" at once. Fresh uploads then failed to install with "The requested app is not available or doesn't exist", there was no Apple reply in either thread, and the problem was still unresolved weeks later ([thread 841782](https://developer.apple.com/forums/thread/841782), [thread 848523](https://developer.apple.com/forums/thread/848523)) [S].

Put that next to the Mac requirement, which nobody has confirmed. Route 3.5 (Scriptable) gets the same 0-tap capture, the same testable-on-Linux logic and the same Lock Screen widget support, at $0, with no Mac, no expiring builds and no Apple distribution service in the path. It loses only on two points: no Time Sensitive level (Focus passes through allowed-apps settings instead), and dependence on one third-party developer whose maintenance status I could not verify.

**Why it still loses.** A TestFlight outage blocks *updates*, while the installed build keeps running until its 90 days are up [V]. #7 can add a "build expires on <date>" line to the widget so expiry is never silent [I]. The fallback path, a direct Xcode install with a one-year profile, avoids TestFlight entirely. Scriptable's ceiling cannot be raised by this project at all.

### 9.2 The strongest argument against Scriptable (revision round 1, 2026-10-16)

I went looking for people who built on Scriptable and regretted it, and for signs that it is no longer maintained. Here is what came back.

**The product's whole runtime would rest on one free app by one developer, whose latest release I could not date.**
- The newest version any source shows is 1.7.19, with no date ([App Store listing, via search excerpt](https://apps.apple.com/it/app/1405459188)) [S].
- In the type-definition project that mirrors Scriptable's API, the most recent commit that names a Scriptable version is dated 2022-11-13 ("update for Scriptable 1.7"). Its ten most recent commits (March to August 2026) are all dependency bumps.
- On 2026-03-20 that project's maintainer committed the docs' definition file "since it is no longer online" ([schl3ck/ios-scriptable-types, commit 0acef2b](https://github.com/schl3ck/ios-scriptable-types/commit/0acef2bb0d457a5bf4ab81f4a3dec903f65adf06); [commit history](https://github.com/schl3ck/ios-scriptable-types/commits/master)) [V, the commits]. I infer from this that part of docs.scriptable.app has stopped being served [I]. That fits the docs host failing to resolve here, though many hosts fail here.

**Forward evidence from people who used it.**
- After the iOS 17 update, a user's unchanged widget script started throwing a `TypeError`. It was fixed by retrieving a settings file that iCloud had offloaded ([talk.automators.fm thread](https://talk.automators.fm/t/scriptable-on-ios-throwing-new-typeerror-maybe-app-update-maybe-ios-17-0-1-maybe-something-else/16586), via search excerpt) [S].
- After iOS 18.4, widgets showed errors until the script was run by hand, and commenters said they were waiting on a fix ([r/Scriptable, "iOS 18.4 issues", via a Reddit mirror's search excerpt](https://redlib.ssps.io/r/Scriptable/comments/1jtsc2h/ios_184_issues)) [S].
- I found no report of Scriptable's *scheduled notifications* failing (section 7). Both reports are about widgets.

**Why that matters here [I].** If an iOS release breaks Scriptable's notifications, this project cannot patch it, and a heads-up that silently stops arriving is exactly the false "you're fine" the objective exists to prevent. The route also has more seams than the native one:
- three automations, one of them daily;
- an alarm that can only be created within 24 hours of the window (9.4, point 5);
- a Focus pass that depends on per-Focus settings;
- possibly no location accuracy, so more "can't tell" (9.4, point 4).

**Compared with 9.1.** A TestFlight failure blocks updates while the installed build keeps working, and it has a visible expiry date. A Scriptable failure could stop the installed product itself. On failure mode alone, this argument is stronger than the one against 3.3.

**Why the route still stands.**
- The native route cannot reach the phone without a Mac, or without an App Store Connect key the person would have to approve (O9). The person chose this trade knowingly (O11–O13).
- The loudest channel, the urgent Clock alarm, is Apple's own app. Only *computing* its time runs in Scriptable [I].
- The widget's "last checked" line and the daily automation make a dead Scriptable visible within about a day rather than never [I].
- The logic lives in a plain JavaScript module, so the tests survive any later move [I].

### 9.3 What would have to change for the answer to flip (2026-10-14)

**The first condition below was met on 2026-10-16 (O9, D4).** The conditions that would flip Scriptable back are in 9.4.

- **No Mac, and no CI credential.** If the person has no Mac and will not approve an App Store Connect API key for a macOS GitHub runner, pick **3.5 Scriptable**: everything else is equal or better there. Before that, it is worth one spike behind its own issue on `xtool`, which claims to "build and deploy iOS apps with SwiftPM on Linux, Windows, and macOS" ([xtool](https://github.com/xtool-org/xtool)) [S]. Its support for widget extensions, App Intents and the Time Sensitive capability is unverified.
- **Apple's paid account stops being acceptable.** Again **3.5**, not the 7-day sideload.
- **Time Sensitive turns out to be unavailable** for the person's account type, *and* the phone is below iOS 26. The urgent reminder then rests on the allowed-apps setting alone, which removes 3.3's main delivery advantage over 3.5.
- **A week's trial of an existing app (3.6)** shows it handles "can't tell" honestly. The cheapest answer is then not to build.

### 9.4 Scriptable addendum (revision round 1, 2026-10-16)

ADR 0001 now rests on six things Scriptable and Shortcuts have to do. `docs.scriptable.app` does not resolve from this environment, so the Scriptable claims come from two places:
- **The DefinitelyTyped declarations** ([`index.d.ts`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/scriptable-ios/index.d.ts), package version 1.7.x). They are generated from the docs' own definition file and carry its text as comments. Tagged **[V from types]**, as in 3.5.
- **Search-index excerpts of docs.scriptable.app**, tagged [V-x].

| # | Question | Verdict |
|---|---|---|
| 1 | Schedule a notification for a future date that fires with the app closed? Does the app need to run again? | **Yes [V-x]. No**: delivery does not need the app to run again. The review's flip condition is **not** met |
| 2 | Notification actions or `openURL` for the one-tap side choice? | **Yes**, but tapping opens Scriptable, and it is two taps |
| 3 | Lock Screen (accessory) widgets? | **Yes**, from iOS 16. Refresh timing belongs to iOS |
| 4 | Location from Shortcuts into a script? | **Yes, as a dictionary**. The fix's accuracy may not come with it |
| 5 | Shortcuts **Create Alarm** on current iOS, and runs without asking? | **Exists [S]**, but it sets a time, not a date. Unattended running is verified for the automation, not for the action |
| 6 | Download and replace its own files? | **Yes**, all the pieces are documented [V from types] |

**1. A future notification fires with Scriptable closed.**
- Scriptable's notification page says "A notification may be delivered even when Scriptable is not running" and points to `setTriggerDate` for a future delivery date ([docs.scriptable.app/notification](https://docs.scriptable.app/notification/), the same sentence in two separate search excerpts) [V-x].
- The declarations add [V from types]:
  - `setTriggerDate`: "Sets the notification to be triggered on a date and time."
  - `schedule()`: "When a new notification is constructed, it must be scheduled, otherwise it will not be delivered."
  - `identifier`: "To reschedule a notification, use the identifier of an existing notification."
  - `removePending(ids)`, `allPending()` and a read-only `nextTriggerDate`.
- That API mirrors Apple's local notifications: pending and delivered requests, and a next trigger date. For those, "Your app does not need to be running for the system to deliver the notification" ([Apple archived guide, via search excerpt](https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/SchedulingandHandlingLocalNotifications.html)) [V-x]. That Scriptable uses that mechanism is an inference from the API's shape [I].
- The script has to run again only to schedule *later* windows. It does: at every capture, and daily for the alarm (point 5).
- **So the condition the review named for reopening D4 is not met.** #7's device check confirms it on the phone with Scriptable force-quit.

**2. The side choice can ride on notification actions.**
- `addAction(title, url, destructive)`: "Actions are shown as buttons in the notification." Up to ten when space allows, and at most two when it is limited, which is exactly two sides [V from types].
- `openURL`: "The Scriptable application will open the URL when the notification is tapped." [V from types].
- A `scriptable:///run/<script>?side=…` URL reaches the script as `args.queryParameters`: "Query parameters are supplied to a script when running it from a URL scheme." `URLScheme.forRunningScript()` returns that URL [V from types].
- So the choice costs two taps (expand, then tap e.g. "South-east side", labelled from `blockside` as in 5.2), and **Scriptable comes to the foreground** [I].
- `scriptName` can run a script inside the expanded notification without opening the app [V from types]. Whether that view accepts a tap that reschedules is unverified, and is #5's and #7's to try.

**3. Lock Screen widgets are supported.**
- `config.widgetFamily` includes `accessoryRectangular`, `accessoryInline` and `accessoryCircular`, "only available starting from iOS 16" [V from types].
- `config.runsInAccessoryWidget`: "These widgets can appear on the Lock Screen." [V from types].
- Refresh is not the script's to decide: `refreshAfterDate` "It is not guaranteed that the widget will refresh at exactly the specified date. The refresh rate of a widget is partly up to iOS/iPadOS." [V from types].
- So the widget computes today and tomorrow from stored windows at render time, and shows when it last checked [I].

**4. Shortcuts can pass a location, but probably not its accuracy.**
- `args.shortcutParameter` "can be any text, list, dictionary or file and will be exposed in your script using the appropriate type" [V from types].
- A Shortcuts location value is none of those, so the Shortcut has to turn it into a dictionary of latitude and longitude first [I].
- I found no source saying Shortcuts exposes a location's horizontal accuracy (section 7).
- Scriptable's own `Location.current()` returns `horizontalAccuracy` alongside latitude and longitude [V from types]. Whether it works in a script started by a background automation is unverified (section 7).
- **Consequence for #6 [I]:** a fix with no accuracy has an unknown *h*. The side rule in 5.3 resolves only when *h* ≤ 10 m, so such a fix is always "can't tell" and point 2's choice does the work. #7's device check decides which fix the capture uses.

**5. Create Alarm exists, but it cannot be created at parking time.**
- No Apple page I could reach documents the action (section 7).
- A long-standing action reference lists **Create Alarm** with a time, a label and repeat days. It says the action always creates a new alarm, and that changing one means *Get All Alarms* then *Toggle Alarm* ([Cassinelli, Create Alarm](https://matthewcassinelli.com/actions/create-alarm/), via search excerpt) [S].
- Apple's alarm page offers Repeat but no date ([Apple, set and change alarms](https://support.apple.com/118444), via search excerpt) [V-x].
- **So a one-off alarm rings at the next occurrence of its time, within 24 hours [I].** One created at parking time would ring on the wrong day for any window more than a day away. The ADR therefore creates it from a daily **Time of Day** automation, which asks the script whether a window starts within the next 24 hours.
- Running without asking:
  - Apple's guide lists Time of Day among the automations that "can be run automatically" ([Shortcuts User Guide, via search excerpt](https://support.apple.com/guide/shortcuts/apd602971e63/ios)) [V-x].
  - CarPlay and Bluetooth are on the iOS 26 list (3.1) [V-x].
  - Whether the Create Alarm action itself asks for confirmation inside such an automation: no source either way. That is #7's to check.
- Clearing: *Toggle Alarm* turns it off [S]. I found no *Delete Alarm* action (section 7), so turned-off alarms may pile up in Clock [I].
- Alarms sound through Do Not Disturb and silent mode (3.1) [V-x].

**6. A script can update itself from GitHub Pages.**
- `Request.loadString()`: "The response is parsed to a string and provided when the returned promise is fulfilled." [V from types].
- `FileManager.writeString`: "If the file already exists the contents of the file will be overwritten with the new content." [V from types].
- `documentsDirectory`: "Your scripts are stored in this directory. If you have iCloud enabled, your scripts will be stored in the documents directory in iCloud otherwise they will be stored in the local documents directory." `downloadFileFromiCloud` brings down an iCloud file before it is read [V from types].
- `importModule` searches the importing file's directory first and returns the module's `module.exports` [V from types].
- So an installer script can fetch the scripts and the logic module from `chamaya00.github.io` and write them where Scriptable keeps scripts. Later runs can do the same when a newer version is published [I].
- Two rules for the ADR [I]:
  - write to a temporary file, and replace only after the download is complete and parses, so that an error page never overwrites a working script;
  - write the module with `module.exports`, which both `importModule` and Node read.

**What would flip the route back to native (D4's alternative, the TestFlight GitHub Action).**
- #7's device check shows that a notification scheduled by a script that a Shortcuts automation started does not fire with Scriptable closed.
- Create Alarm cannot run unattended, and no other loud channel replaces it.
- Scriptable stops working on the person's iOS version, or leaves the App Store.
- The person approves an App Store Connect API key and prefers Time Sensitive to a per-Focus allowed list.

**Steps only the person can take on the Scriptable route** (D4's "still theirs", and O14's checklist):
1. **Merge the weekly data-refresh workflow PR.** It widens what the automation may do, so it is theirs to merge (D4).
2. **Turn on GitHub Pages** in the repository settings.
3. **Install Scriptable** (free), and run the installer script once.
4. **Create the three Shortcuts automations**, each set to run immediately, without asking:
   - car disconnect: location, then run the capture script;
   - car connect: run the clear script and turn off the alarm;
   - daily at a set time: run the alarm script, then Create Alarm.
5. **Allow notifications for Scriptable**, and location for Shortcuts (and for Scriptable, if #7's check uses its fix).
6. **In every Focus they use (including Sleep):** add Scriptable to the allowed apps. There is no Time Sensitive level to rely on.
7. **Add the Lock Screen widget.**
8. **Verify on the device per #7's checklist**, with Scriptable force-quit and a Focus on.
9. **Apply the `ci.yml` change on #4** when that PR exists.
10. **Once a year:** update the holiday table when SFMTA publishes the next year.

### 9.5 Steps only the person can take on route 3.3 (2026-10-14, superseded by 9.4)

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

ADR 0001 ([`docs/decisions/0001-scriptable-with-shortcuts-capture.md`](../decisions/0001-scriptable-with-shortcuts-capture.md)) was rewritten in revision round 1 to record route 3.5, Scriptable (D4, D5). The driver renamed it to match and accepted it under O5 (D6 on #2).
