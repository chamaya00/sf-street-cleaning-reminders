# #5: what the heads-up, the alarm and the status widget say and look like, including "can't tell"

Issue: [#5](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/5), parent [#1](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/1).
Route: [ADR 0001](../decisions/0001-scriptable-with-shortcuts-capture.md) (Scriptable plus Shortcuts), as amended by D7 on [#2](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/2#issuecomment-6212518781).
Mock: [`5-lock-screen-reminders.html`](5-lock-screen-reminders.html). It is a drawing made of markup. It lives in `docs/`, nothing imports it, and it never reaches the phone.
Pictures:
- [`5-lock-screen-reminders-wide.png`](5-lock-screen-reminders-wide.png) and [`5-lock-screen-reminders-narrow.png`](5-lock-screen-reminders-narrow.png) are what `./scripts/design-render` writes, one viewport each;
- [`5-lock-screen-reminders-full-wide.png`](5-lock-screen-reminders-full-wide.png) and [`5-lock-screen-reminders-full-narrow.png`](5-lock-screen-reminders-full-narrow.png) are the whole sheet at the same two widths (how they were made: "Rendering" at the end).

Worked examples use real rows from the city's table (the fixture on PR #12): Shrader St between Waller St and Beulah St, CNN 11857000. Its east side is swept Fridays 8–10am and its west side Wednesdays 8–10am. Dates are the week of 18 October 2026.

---

## 1. What the issue fixes, and what it only guesses

**The outcome (fixed).** After parking, the person can tell from the Lock Screen whether to move the car, without opening anything. They get a heads-up early enough to act and a loud reminder close to the window. Nothing ever tells them there is nothing to do when the phone cannot know that.

**The constraints (checked, and they hold).**
- The four surfaces and their limits are the ones in ADR 0001, research §9.4 and D7.
  - Notifications come from "Scriptable", with no Time Sensitive level.
  - The Clock alarm has a time and no date. Its label is its only text, and *Create Alarm* always adds a new alarm.
  - The Lock Screen widget is rendered when iOS decides.
  - The side choice is two notification buttons, costs two taps, and brings Scriptable to the foreground.
- **One constraint the issue does not mention, and it shapes everything below: a Lock Screen widget has no colour.** iOS draws accessory widgets in its *vibrant* mode: "the system desaturates the widget into a monochrome version", where light content becomes opaque and dark content becomes a faint blur of the wallpaper ([Apple, WidgetRenderingMode](https://developer.apple.com/documentation/widgetkit/widgetrenderingmode); [WWDC22 "Complications and widgets: Reloaded"](https://developer.apple.com/wwdc22/10050)). So "can't tell" and the all-good state cannot be told apart by colour on the one surface the person sees most. They are told apart by words and by shape.
- **The data shape.** `windowsForSide` on PR #12 (section 12 maps every state onto it).

**The guesses, and what this spec does with them.**
- *"Thirteen states."* Four of them are not states the person is *in*. "Schedule may be out of date", "holiday list missing" and "side chosen by you" are **qualifiers** that sit on top of another state. "Moved" and "parking not captured" look identical to the phone: a spot was cleared and no new one was saved. The spec keeps all thirteen, with text for each, but builds them as **nine states plus three qualifiers**, and gives "moved" and "not captured" the same widget words on purpose (section 8, states 11 and 12).
- *"No cleaning in the next 48 h."* This is read as **"no window today or tomorrow, in Pacific calendar days"**. That is what the module's `day` field gives, and what done criterion 1 on #1 asks ("today or tomorrow"). The difference from a rolling 48 h is at most one evening: tomorrow evening's heads-up covers the day after tomorrow anyway.
- *"The heads-up fires the evening before."* Kept, as one fixed time.
- *"Urgent alarm close to the window."* Kept for windows from 7am. For the nightly windows that start between midnight and 6am, "close to the window" means an alarm at 1:15am. **This is the one question for the owner** (section 15). Until it is answered, this spec rings those alarms at 10pm the evening before.
- *Implied: the widget says "today" and "tomorrow".* **Rejected.** iOS decides when the widget renders, so a widget drawn at 11:50pm saying "tomorrow" is wrong ten minutes later. Every surface names the weekday and the clock time instead. The Lock Screen prints the date directly above the widget, so the weekday is never more than a glance from being decoded. The same goes for notifications, which stay in Notification Center long after delivery. **No surface uses a relative time word: not "today", "tomorrow", "tonight", or "in 20 min".**

---

## 2. What is there now

`./scripts/app-render / <out>` refuses, and that is honest. There is no web route to render, and there never will be: this product's surfaces are iOS system surfaces. Its exact output:

```
app-render: SERVE_DIR is empty, so there is nothing to serve.
  Open scripts/app-render and set BUILD_CMD and SERVE_DIR to what
  builds this repository and where it builds to. Both are this
  project's to decide; the interface above is not.
  Until then, no role can see this repository rendered, and a run
  told to compare a page against a mock should say so rather than
  describing a page nobody has opened.
```

How it reads today, honestly: after parking, the person's Lock Screen shows nothing about the car, so the street sign is the whole interface. A sign is posted every so often along the block, says something like "TUES 8AM–10AM", and does not say which side it means to anyone who is not standing in front of it. The product's main branch has no code. PR #12 has the schedule logic and nothing a person sees. Everything below starts from an empty Lock Screen, which makes it a new surface rather than a refresh, and makes the mock the only picture of it that exists.

---

## 3. Outside references

1. **Apple's vibrant rendering mode for Lock Screen widgets** ([WidgetRenderingMode](https://developer.apple.com/documentation/widgetkit/widgetrenderingmode), [WWDC22 10050](https://developer.apple.com/wwdc22/10050)).
   - *Taking:* the rule that a Lock Screen widget has three levers only: words, weight, and luminance mass (a light shape reads as solid, a dark one disappears). The widget's whole state vocabulary is built from those three.
   - *Refusing:* colour-coded status of any kind, including the green tick and red badge every parking or weather widget leans on. On this surface the system would throw the colour away, and a design that relies on it fails without telling anyone.
2. **Flighty's Live Activity** (Apple Design Award 2023, Interaction; [9to5Mac on its Live Activities](https://9to5mac.com/2022/10/24/flighty-dynamic-island-iphone-live-activities/)).
   - *Taking:* a status word as the headline, in a fixed slot, so the eye learns where to look. Also departure-board bluntness: "Delayed", not "Heads up! There's been a change".
   - *Refusing:* the live countdown and the colour coding. Flighty pushes updates from a server. This product cannot, and iOS chooses when its widget redraws, so a countdown would be wrong whenever it is seen late.
3. **SpotAngels' street-cleaning alerts** (Bluetooth-captured parking spot, alerts such as "Street cleaning in 20 minutes" per a [Harvard case study](https://d3.harvard.edu/platform-digit/wp-json/wp/v2/hck-submission/4739); [App Store](https://apps.apple.com/app/id897809583)).
   - *Taking:* a reminder is about *your car's spot* and names the rule by its plain name.
   - *Refusing:* relative times, which lie once the notification lingers, and silence about the side of the street. ADR 0001 already rejected SpotAngels because it never says how it handles a side it cannot tell. This design says it on every surface.
4. **Apple's guidance for Live Activities** ([HIG, Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities); WWDC23 10194, "Design dynamic Live Activities").
   - *Taking:* "prioritize the sizing and scale of elements to be visible at a quick glance", and "end promptly when the event concludes", which becomes the rule that a passed window's heads-up is removed (state 13).
   - *Refusing:* nothing structural. Scriptable cannot make a Live Activity, so only the principles carry over.
5. **iOS 26 Lock Screen material** ([MacRumors, iOS 26 Lock Screen](https://www.macrumors.com/guide/ios-26-lock-screen/)): notifications are frosted glass over the wallpaper. The mock draws them that way. This is reference for the drawing, not for any design choice, because the notification's appearance belongs to the system.

---

## 4. Direction

**Blunt, nocturnal, loud only when it matters.** Every surface leads with a verdict in the fewest words that are true. The single state with nothing to do is the quietest thing on the Lock Screen. Every state that needs you, including every "can't tell", is visibly heavier.

**It must not look like:**
- a friendly weather card with a green tick and pastel status chips;
- a parking app's map;
- anything with an emoji in it;
- a notification that says "Heads up!" before it says what.

### Two directions, carried far enough to compare

Both are drawn side by side in the mock (section "Two directions").

- **A. Departure board, time first.** Every widget leads with the next sweep's time in large numerals, such as "FRI 8AM", with the verdict as a small word above it.
  - It is good at one thing: a glance gives you *when*.
  - It fails three ways:
    - in "Which side?" the big time belongs to the *earlier* candidate, so the largest thing on the widget states as fact what is a guess;
    - in the nothing-to-do state the big time reads as urgency;
    - "Spot unknown" and "No spot saved" have no time at all, so the layout collapses into a different shape exactly when the person most needs to recognise it.
- **B. Verdict first, quiet when there's nothing to do (recommended).** The headline is one phrase from a closed set, and its first word differs per state. Every state that needs attention sits on a **plate**, a solid light bar. Vibrant mode renders that as the most opaque thing on the widget, with the headline knocked out of it. The nothing-to-do state alone has **no plate**: regular weight, a small tick, and nothing else.
  - The test "can't tell must not be mistaken for the all-good state" becomes structural rather than verbal. One has a solid bar and a "?", the other has neither, and that difference survives desaturation, the Always-On dimming, and a blurred glance.

**Recommendation: B.** On this surface, being right at a glance matters more than being informative, and A's informativeness is exactly what misleads in the can't-tell states.

### The deliberate oddity

**The reassuring state is the quietest thing on the screen.** Products usually celebrate the good outcome: big green tick, bold "You're good". Here it is regular weight, no plate, and slightly smaller than every warning. *Defence:* this product's single failure mode is a false "nothing to do". If reassurance is the visually weakest state, then any doubt (a plate, a "?", a bold word) always outweighs it. A glance that catches only mass will err toward "look closer", and that is the cheap direction to err.

---

## 5. Names

These nouns are the spec's, and #6 and #7 should use them in code and tests.

| Noun | Means |
|---|---|
| **spot** | The saved parking record: the fix, the candidate block sides, and the chosen side if any. Exactly one spot exists, or none. |
| **capture** | The car-disconnect run that saves a spot. |
| **clear** | The car-connect run that deletes the spot, removes notifications and turns alarms off. |
| **window** | One sweeping window, as `windowsForSide` returns it: `start`, `end`, `day`, `holiday`. |
| **next window** | The earliest window that has not ended, across every candidate side of the spot. |
| **capture notice** | The notification delivered at capture. |
| **heads-up** | The notification delivered the evening before a window. |
| **alarm** | The Clock alarm. Its text is the **alarm label**. |
| **daily run** | The 7pm Time of Day automation that arms the alarm for a car that stays parked. |
| **status widget** | The Lock Screen widget. Its three lines are **headline**, **detail** and **checked line**. |
| **plate** | The solid bar behind the headline in every state except Nothing soon. |
| **side buttons** | The two notification actions offered in "Which side?". |
| **side choice** | Tapping a side button. Its result is "your pick". |
| **spot sheet** | The Scriptable alert shown after a side choice, or when the widget is tapped. |
| **qualifier** | Old schedule, No holiday list, or Your pick. It modifies a state and is never a state alone. |

States, by the name they carry everywhere: **Nothing soon**, **Sweep coming**, **Move today**, **Which side?**, **Which block?**, **Spot unknown**, **No schedule here**, **No spot saved**, **Window passed**. The issue's "moved" is the moment that produces No spot saved. The issue's "cleaning tomorrow" and "cleaning today" are Sweep coming and Move today.

---

## 6. Composition, surface by surface

**Status widget (`accessoryRectangular`).** Three lines, left-aligned, no icon column.
- **Headline:** 15 pt, heavy; regular weight in Nothing soon. It is what the eye lands on. In every state but Nothing soon it sits on the plate: a rounded bar (radius 6 pt) the full width of the widget, filled solid white. Vibrant mode renders it opaque, and the headline inside it, drawn in black, becomes a cut-out of the wallpaper.
- **Detail:** 13 pt, semibold, full opacity. The place, or the most important qualifier.
- **Checked line:** 11 pt, regular, at 65% opacity, so vibrant mode shows it as quieter. It always begins "Checked" and gives the render time. This is ADR 0001's "shows when it last checked", and it is what tells the person the widget may be old.
- **Space:** the plate takes the full width and gets 3 pt above and below it, which makes it the only element with room around it. The detail and checked lines sit tight together under it.
- **What survives:** at the narrowest Lock Screen (iPhone SE class) the headline budget is 20 characters, the detail 26 and the checked line 22. Every string in section 8 is within those budgets. When a detail string would overflow, the place is dropped before the time. When a headline would overflow, it is a bug in this table.

**Status widget, the other two families** (specified for completeness; not in the mock).
- `accessoryInline` is one line beside the date. It cannot draw a plate, so its first character carries the shape: "✓" in Nothing soon only, "?" in every can't-tell state and in Old schedule, and the headline's own first word otherwise.
- `accessoryCircular` shows the headline's glyph ("✓", "?", or nothing) above a two-line weekday and hour, for example "FRI / 8AM".

**Notifications** (capture notice, heads-up, not-captured notice). Their look belongs to iOS: the frosted plate, Scriptable's name and icon, the delivery time. What this spec controls is the **title** (bold, one line, about 36 characters before truncation) and the **body** (up to 4 lines collapsed). The title is always the verdict, and the body always starts with the place.

**Alarm.** iOS draws the full-screen alarm: the time, the label, and Snooze and Stop. The label is the only design surface. It leads with the imperative ("Move car"), so the part that survives truncation is the part that matters.

**Spot sheet.** A system alert (Scriptable's `Alert`). It is not a custom screen: a native alert is the smallest thing that can be dismissed with one tap and needs no design upkeep.

---

## 7. The happy path (criterion 1)

The person parks on the east side of Shrader St on Wednesday 21 October at 6:40pm, and the fix is good enough to resolve the side. The next window is Friday 23 October, 8–10am.

| # | Step | When | What the person sees, and where | Taps |
|---|---|---|---|---|
| 1 | **Parking captured** | Wed 6:40pm, the moment the car's Bluetooth or CarPlay disconnects | A **capture notice** on the Lock Screen, from Scriptable: "Parked · Shrader St, east side", whose body is state 1's text (section 8). No alarm yet, because the window is more than 24 h away. | 0 |
| 2 | **Status known** | Every time the phone wakes, from the widget's next render | The **status widget**: no plate, state 1's headline for Friday, then "Shrader St · east side" / "Checked 6:41pm". On Thursday evening it becomes "Sweep Fri 8am" on a plate. | 0 |
| 3 | **Evening-before heads-up** | Thu 7:00pm | A **heads-up** notification: "Street sweeping Fri 8–10am" / "Shrader St, east side (Waller–Beulah). Move your car before 8am. Alarm at 7:15am." The **daily run** fires at the same minute and creates the alarm. | 0 to read |
| 4 | **Urgent alarm** | Fri 7:15am | The Clock **alarm** rings full screen, through Do Not Disturb and silent mode, labelled "Move car · sweep 8am · Shrader St". The widget reads "Move by 8am". | 1 (Stop) |
| 5a | **Cleared by moving** | Fri 7:40am, car reconnects | Nothing new appears. Pending and delivered notifications are removed, every "Move car" alarm is turned off, and the widget reads "No spot saved" / "Since you drove off 7:40am" (state 11). | 0 |
| 5b | **Cleared by the window ending** | Fri 10:00am | The heads-up is removed at the next script run after 10:00am. The widget moves on to the next window: on this side that is the following Friday, so it shows state 1's headline for Oct 30 (state 13). | 0 |

**Done criterion 1 on #1 ("without opening anything") is met at step 2**, by the status widget. That rests on two things this route cannot guarantee, so the design makes both visible instead:
- the person has added the widget, which is their step under ADR 0001;
- iOS chooses when the widget renders. Its checked line shows the render time, and the capture notice at step 1 covers the gap until the first render.

A widget whose checked line says "Checked Tue 9:02pm" on a Thursday is a widget the person knows not to trust.

---

## 8. Every state, with its exact text (criterion 2)

**How to read this section.**
- Each state gives the text for all four surfaces. **"—"** means the surface shows nothing in that state, on purpose.
- The **capture notice** is delivered at capture.
- The **heads-up** is delivered at 7:00pm the day before the next window (rule T1).
- The **alarm label** is used both by the daily run and by capture (rules T3–T7).
- Widget lines are headline / detail / checked line. **[plate]** marks a headline on the plate, and **[?]** marks a leading "?" in a circle.
- `{…}` are fields: `{corridor}` and `{limits}` come from the row, and `{from}–{to}` is `limits` split at its hyphen, keeping each cross street's full name and dropping its suffix (St, Ave, Blvd, Way, Dr, Ct, Ln, Pl, Ter, Aly, Rd, Cir).
- Times are 12-hour, lowercase, with no ":00" (`8am`, `7:15am`, `12pm`), and ranges use an en dash (`8–10am`).
- **Reassuring words appear only in states 1 and 2.**

### State 1. Nothing soon (side known, no window today or tomorrow)

- **When:** `status` is `ok`, the side is resolved by the side rule, and no window has `day` `today` or `tomorrow`.
- **Widget:** no plate, regular weight.
  - Headline: "✓ All clear till {weekday}". When the next window is 7 or more days away, `{weekday}` becomes the date ("Oct 30"). When there is no window in the 14-day horizon: "✓ All clear 2+ weeks".
  - Detail: "{corridor} · {side} side", for example "Shrader St · east side".
  - Checked line: "Checked 6:41pm".
- **Capture notice:** title "Parked · {corridor}, {side} side". Body "All clear till {weekday}. Next sweep {Wkd Mon d}, {from}–{to}; heads-up {Wkd} at 7pm."
  - *Example:* "Parked · Shrader St, east side" / "All clear till Fri. Next sweep Fri Oct 23, 8–10am; heads-up Thu at 7pm."
- **Heads-up:** — (none until a window is the next day).
- **Alarm label:** — (no alarm).
- **Never** shown while the Old schedule qualifier applies. That combination is drawn as Old schedule (section 9).

### State 2. Nothing soon, your pick (side chosen by you)

- **When:** state 1's conditions hold, except that the side comes from a side choice rather than from the fix.
- **Widget:** no plate. Headline "✓ All clear till {weekday}", detail "{Side} side · your pick" (for example "East side · your pick"), checked line as usual.
- **Capture notice:** — (a choice happens after capture).
- **Spot sheet after the choice:** title "{Side} side saved". Message "{corridor}, {side} side ({from}–{to}). Next sweep there {Wkd Mon d}, {from}–{to}. All clear till then."
- **Heads-up and alarm label:** — (none, as in state 1).
- **Never** shown while Old schedule applies. When a side choice leads to a window on the next day, the state is Sweep coming with "your pick" as its detail (section 10).

### State 3. Sweep coming (cleaning tomorrow)

- **When:** the next window has `day` `tomorrow`.
- **Widget:** [plate] headline "Sweep {Wkd} {start}" (for example "Sweep Fri 8am"), detail "{corridor} · {side} side", checked line as usual.
- **Capture notice** (only when capture happens after 7pm the day before, so that the heads-up time has passed):
  - title "Street sweeping {Wkd} {from}–{to}";
  - body "{corridor}, {side} side ({from}–{to}). Move your car before {start}. Alarm at {alarm time}."
- **Heads-up:** the same title and body. *Example:* "Street sweeping Fri 8–10am" / "Shrader St, east side (Waller–Beulah). Move your car before 8am. Alarm at 7:15am."
- **Alarm label:** "Move car · sweep {start} · {corridor}". *Example:* "Move car · sweep 8am · Shrader St".

### State 4. Move today (cleaning today, window imminent)

- **When:** the next window has `day` `today`.
- **Widget:** [plate] headline "Move by {start}" (for example "Move by 8am"). Once `inProgress` is true, it becomes "Sweeping until {end}". Detail "{corridor} · {side} side", checked line as usual. The widget asks iOS to refresh at the window's start and end (`refreshAfterDate`). iOS may be late, which is what the checked line is for.
- **Capture notice** (parking on the day of the window):
  - title "Street sweeping {Wkd} {from}–{to}";
  - body "{corridor}, {side} side. Move your car before {start}. Alarm at {alarm time}."
  - Inside the alarm's lead (rule T6) the body's last sentence becomes "Alarm rings at {capture + 2 min}."
  - When the window is already under way, the title is "Sweeping now, until {end}" and the body "{corridor}, {side} side. Tickets are issued during sweeping. Alarm rings at {capture + 2 min}."
- **Heads-up:** — (it was delivered the evening before, or the capture notice replaced it).
- **Alarm label:** "Move car · sweep {start} · {corridor}".

### State 5. Which side? (can't tell which side)

- **When:** the side rule (research §5.3) does not resolve, or the fix has no accuracy, and one block is the only candidate.
- **Widget:** [plate][?] headline "Which side?", detail "Earliest sweep {Wkd} {start}" (for example "Earliest sweep Wed 8am"), checked line as usual.
- **Capture notice:** title "Which side of {corridor}?".
  - Body "GPS couldn't tell. Until you pick, reminders follow the earlier sweep: {side A} side {Wkd} {from}–{to}. {Side B} side: {Wkd} {from}–{to}. Hold to pick."
  - It carries the two **side buttons** (section 10).
  - *Example:* "Which side of Shrader St?" / "GPS couldn't tell. Until you pick, reminders follow the earlier sweep: west side Wed 8–10am. East side: Fri 8–10am. Hold to pick."
- **Heads-up:** title "Street sweeping {Wkd} {start} — which side?". Body "{corridor} ({from}–{to}): {side A} side {Wkd} {from}–{to}, {side B} side {Wkd} {from}–{to}. Reminding for {side A} until you pick. Alarm at {alarm time}." It carries the side buttons too.
- **Alarm label:** "Move car · sweep {start} · {corridor} (side?)". *Example:* "Move car · sweep 8am · Shrader St (side?)". It names no side, because moving the car is right whichever side it is on.
- **Names the candidates:** both sides, with both windows, in every notification. **Reminds on the earliest:** yes.

### State 6. Which block? (can't tell which block)

- **When:** the block rule (research §5.3) finds two or more centrelines within *h* + 10 m. With no accuracy, D7's 60 m radius applies.
- **Widget:** [plate][?] headline "Which block?", detail "Earliest sweep {Wkd} {start}", checked line as usual.
- **Capture notice:** title "Which block? Near {street 1} & {street 2}". Body "GPS put you near {n} blocks. Reminders follow the earliest: {corridor}, {side} side ({from}–{to}), {Wkd} {from}–{to}." Here `{street 1}` and `{street 2}` are the two most common corridors among the candidates.
  - *Example:* "Which block? Near Shrader & Waller" / "GPS put you near 4 blocks. Reminders follow the earliest: Waller St, south side (Cole–Shrader), Mon 8–10am."
- **Heads-up:** title "Street sweeping {Wkd} {start} — which block?". Body "Near {street 1} & {street 2}. Earliest of {n} nearby blocks: {corridor}, {side} side, {Wkd} {from}–{to}. Move before {start} to be sure. Alarm at {alarm time}."
- **Alarm label:** "Move car · sweep {start} · near {corridor}".
- **No buttons.** Choosing among blocks is outside ADR 0001's two-button route. Moving the car is the remedy.
- **Names the candidates:** the count and the two streets that bound the corner. Every candidate's windows are on the spot sheet when the widget is tapped. **Reminds on the earliest:** yes.

### State 7. Spot unknown (can't tell where you parked)

- **When:** the no-fix rule applies (*h* < 0, *h* > 50 m, or no location from Shortcuts).
- **Widget:** [plate][?] headline "Spot unknown", detail "No reminders · check signs", checked line as usual.
- **Capture notice:** title "Couldn't tell where you parked". Body "The phone gave no usable location, so no sweeping reminders are set. Tap here while you're by the car to try again, or check the signs."
  - Tapping it opens Scriptable, which takes its own fix (`Location.current()`, which carries accuracy) and runs capture again. #7 verifies this.
- **Heads-up:** — (no window is known).
- **Alarm label:** — (no alarm).
- **Names the candidates:** there are none, and the notification says so in words ("no sweeping reminders are set").

### State 8. No schedule here (no record for this location)

- **When:** the fix resolves, but the city's table has no row for the resolved block side. `windowsForSide` returns `unknown` with "no sweeping rows". The same applies when no centreline lies within the candidate radius. Of the city's 12,253 blocks, 1,933 are swept on one side only, so choosing the unswept side lands here too.
- **Widget:** [plate] headline "No schedule here", detail "No reminders · check signs", checked line as usual.
- **Capture notice:** title "No sweeping schedule for this spot".
  - Body "The city's list has nothing for {corridor}, {side} side ({from}–{to}). That doesn't mean it's never swept. Check the signs. No reminders set."
  - When there is no block nearby: "The city's list has no street within 60 m of where you parked. Check the signs. No reminders set."
- **Heads-up:** — (no window).
- **Alarm label:** — (no alarm).

### State 9. Old schedule (schedule may be out of date)

This is a qualifier, given its own section because the issue lists it as a state.

- **When:** `stale` is true, because `fetchedAt` is more than 14 days before now or missing.
- **Widget:**
  - **Where it would otherwise be Nothing soon (state 1 or 2):** [plate][?] headline "Old schedule", detail "From {Mon d} · next {Wkd} {start}" (for example "From Sep 30 · next Fri 8am"), checked line as usual. Nothing on the widget reassures.
  - **In every other state**, the headline stands and the detail becomes "Schedule from {Mon d} (old)". It names the date.
  - **When nothing was ever downloaded:** [plate][?] "No schedule yet" / "Open Scriptable once online".
- **Notifications (capture notice and heads-up):** the body gains a final sentence, "Schedule last downloaded {Mon d}, so it may be out of date."
  - Where state 1 would have applied, the capture notice body is replaced by "Next sweep {Wkd Mon d}, {from}–{to}, by a schedule last downloaded {Mon d} that may be out of date. Check the signs."
  - *Example:* "Parked · Shrader St, east side" / "Next sweep Fri Oct 23, 8–10am, by a schedule last downloaded Sep 30 that may be out of date. Check the signs."
- **Alarm label:** unchanged. A stale schedule still arms alarms: a false alarm is cheap.

### State 10. No holiday list (holiday list missing for {year})

A qualifier.

- **When:** `notes` contains "holiday list missing for {year}" **and** the window the surface is about falls in {year}. From 18 December each year, the module's 14-day horizon already reaches the next January. Showing the note before the person's own window is in that year would teach them to ignore it.
- **Widget:** the detail becomes "No {year} holiday list". The headline stands. A missing holiday list can only cause a reminder that turns out unneeded, never a missing one, so it never earns the plate on its own.
- **Notifications:** the body gains "No {year} holiday list yet, so holidays count as sweeping days."
- **Alarm label:** unchanged.
- **Priority** when both qualifiers apply: Old schedule takes the detail line. Notifications carry both sentences, stale first.

### State 11. No spot saved (parking not captured)

- **When:** the spot was cleared by a car-connect and no capture has run since.
- **Widget:** [plate] headline "No spot saved", detail "Since you drove off {time}" (with the weekday when it was not today's date, for example "Since Tue 5:42pm"), checked line as usual.
- **Capture notice:** — (by definition nothing ran).
- **Not-captured notice** (delivered by the daily run at 7:00pm when no spot exists and the last clear was more than an hour ago): title "No parked spot saved". Body "Nothing was saved since you drove off at {time}. If your car is on the street, no reminders are set for it."
- **Heads-up:** — and **alarm label:** —.

### State 12. Moved

- **When:** the car-connect automation runs the clear.
- **What happens:**
  - pending notifications for the spot are removed (`removePending`), and delivered ones too (`removeDelivered`);
  - every Clock alarm whose label begins "Move car" is turned off;
  - the spot is deleted.
- **Widget:** state 11's words, "No spot saved" / "Since you drove off {time}". This is deliberate. While driving, those words are true. If the next park is never captured, they are still true, and they become the warning. The phone cannot tell "moved" from "not captured", so the widget does not pretend to.
- **Notifications:** none. The person is driving.
- **Alarm label:** — (turned off).

### State 13. Window passed

- **When:** a window's `end` is in the past and the car has not been moved.
- **What happens:** at the next script run after `end`, whether a widget render or the daily run, the window's delivered heads-up and capture notice are removed. The state is recomputed from the next window. The alarm was a one-time alarm, so iOS turned it off after it rang.
- **Widget:** whatever the next window makes it. For Shrader St's east side that is state 1, dated Oct 30. For a "Which side?" spot it is still state 5, now naming the other side's window as the earliest.
- **Notifications:** none new.
- **Alarm label:** — (none until the next window is within 24 h).

### The at-a-glance rule, stated once

On the status widget:
- only states 1 and 2 have **no plate**, and only they show "✓";
- every can't-tell state, plus Old schedule, shows "?" on a plate;
- no headline in any state begins with the same word as another state's headline, except where a qualifier changes only the detail.

That is three independent signals (mass, glyph, first word), and none of them is colour. The mock's "Glance test" panel shows all of them side by side, and the blurred copy beside it shows what survives without reading.

---

## 9. Timing rules (criterion 3)

All times are Pacific wall-clock times. Each rule is one sentence that #7 can copy into a test.

- **T1. Heads-up.** The heads-up for a window is delivered at 7:00pm on the calendar day before the window's date. A window starting between 12am and 6:59am is therefore announced the evening before, 5 to 12 hours ahead (example: a Tuesday 2am window's heads-up is Monday 7:00pm). If capture happens after that 7:00pm and before the window ends, the capture notice is delivered at capture instead.
- **T2. Daily run.** The daily Time of Day automation runs at 7:00pm every day. It creates the alarm for the next window when that window starts within 24 hours. Because every window in the city's table starts between 12am and 1pm, that means the next calendar day's windows.
- **T3. Alarm time.** The alarm rings 45 minutes before a window that starts at 7am or later, and at 10:00pm the evening before a window that starts before 7am. *Example:* Friday 8am → Friday 7:15am. Monday 2am → Sunday 10:00pm. The 10pm half is the owner's question in section 15. The other answer is "45 minutes before, always", which gives Sunday 1:15am.
- **T4. Alarm label.** The alarm label is "Move car · sweep {start} · {corridor}". When the side is unknown, " (side?)" is appended. When the block is unknown, `{corridor}` becomes "near {corridor}". The label always begins "Move car", which is how the clear finds it.
- **T5. Alarm at parking time (D7).** When capture finds a next window that starts within 24 hours, it creates the alarm at capture, with the time and label the daily run would have given. *Example:* parked Sunday 10:00pm, after the daily run, on Waller St's south side, for Monday 8am. The alarm "Move car · sweep 8am · Waller St" is created for Monday 7:15am before the person walks away.
- **T6. Parking inside the alarm's lead.** When the alarm's time has already passed at capture but the window has not ended, capture creates the alarm for the next whole minute plus one (2 minutes after capture, rounded up), with the same label. It rings while the person is still by the car, rather than *Create Alarm* ringing at the original time tomorrow. *Example:* parked Friday 7:30am for 8am → alarm 7:32am. And under T3, parked Sunday 10:30pm for Monday 2am → alarm 10:32pm. D7's own example (parked 10:00pm, after the daily run, for 6am the next morning) lands here under T3: the alarm is created at capture for 10:02pm, so it exists before the person walks away.
- **T7. No second alarm.** The daily run never creates a second alarm for a window that capture already armed. Capture records the start of the window it armed, and the daily run creates nothing for that window. *Why:* *Create Alarm* always adds a new alarm, so two would ring together. There is no Delete Alarm, so both would stay in Clock, turned off, after every clear, and the pile would grow twice as fast. A side choice does not change this either way: the alarm for the earlier candidate stays. By definition it rings no later than the chosen side's window, and the daily run arms the chosen side's later windows.

---

## 10. The side choice (criterion 5)

**Where it appears.** In the "Which side?" capture notice and heads-up. These are the only notifications with buttons.

**The two side buttons.** One per candidate side, earlier window first. Wording: **"{Compass} side · {corridor} ({from}–{to})"**.
- `{Compass}` is the row's `blockside`, written out: North, South, East, West, North-east, North-west, South-east or South-west.
- *Example:* "West side · Shrader St (Waller–Beulah)" and "East side · Shrader St (Waller–Beulah)".
- *Market St example:* "North-west side · Market St (Larkin–Polk)" and "South-east side · Market St (Larkin–Polk)".
- Budget: 42 characters. Above it, the parenthesis is dropped from both buttons (the body still names the cross streets), so the two buttons always share a form.
- The compass side is checkable at the car with the Compass app. The cross streets are checkable on the corner signs, and they confirm the block.

**When `blockside` is null.** This is 839 rows. They make up 255 whole blocks, and no block mixes named and null sides.
- **The compass side is derived from the block's centreline:** the bearing from its first coordinate to its last, turned 90° left for `L` or right for `R`, then rounded to the nearest of the eight points.
- Checked against the city's own `blockside` on every row that has one, this gives the same side on 37,009 of 37,017 rows, 99.98% (computed for this spec from the fixture on PR #12).
- The button wording is the same, with " (from map)" after the compass: "South-east (from map) side · Berry St (King–Berry Extension)". It is over budget, so the parenthesis drops: "South-east side (from map) · Berry St".
- The notification body adds "Side names here come from the map, not the city's list."
- **If a block's derived side disagrees with its own `blockside`** (8 rows), or the geometry is missing, there are no buttons. The notification body ends "Pick a side from the widget's spot sheet once you know it", and the earlier-window reminder stands.
- *Rejected alternative:* "this side" and "the other side", which research §5.2 suggested. They are not checkable by a person standing at the car, and a guess between them is wrong half the time, in the direction that gets a ticket.
- **One known data defect:** 92 rows have a cross street with its first letter cut off in `limits` (for example "ission Bay Cir"), 76 of them on null-side blocks. Buttons show `limits` as the city wrote it. #6 should not repair it silently.

**Taps.** Two:
1. press and hold the notification (or swipe left and tap View) to expand it;
2. tap a button.

Scriptable then comes to the foreground and runs the side-choice script with the side in its query parameters.

**What Scriptable shows: the spot sheet**, a system alert.
- **Title:** "{Side} side saved".
- **Message**, by the state the choice leads to:
  - *Window today or tomorrow:* "{corridor}, {side} side ({from}–{to}). Next sweep there {Wkd} {from}–{to}. Reminders now follow this side; the alarm already set stays."
  - *Nothing soon:* state 2's message.
  - *The chosen side has no rows:* "The city's list has nothing for {corridor}, {side} side. Check the signs. Reminders now follow the {other side} side's sweep, {Wkd} {from}–{to}, until you pick it or move." No row means no record, not "never swept", so the other side's reminders stay.
- **Buttons:** "Done", "Switch to {other side} side", "Undo — I'm not sure".

**What changes after the tap.**
- The spot stores the chosen side.
- Pending heads-ups for the spot are removed and rescheduled from the chosen side's windows only.
- The widget's detail line becomes "{Side} side · your pick" in every state, and its headline follows the chosen side's next window. Typically that turns "Which side?" into "Sweep {Wkd} {start}" or into state 2.
- The alarm, if armed, is left alone (T7).

**Undo, and how.**
- From the spot sheet itself: "Undo — I'm not sure" restores state 5, and the earlier-window reminders are rescheduled. "Switch to … side" picks the other side.
- Later: tapping the status widget opens Scriptable on the spot sheet for the current spot.
  - Its title is "{corridor} ({from}–{to})" and its message is the current state's notification body.
  - Its buttons are "{Side A} side", "{Side B} side", "Not sure — remind for the earlier" and "Cancel".
  - The current choice is suffixed " (current)". It never gets a tick, because a tick means Nothing soon.
- A choice lasts until the next capture or clear.

**If the person never taps, the earlier-window reminder stands, unchanged.** The heads-up, the alarm and the widget all follow the earlier window, and the "Which side?" plate stays.

---

## 11. Components, each once

| Component | Purpose | Inputs | States | Must never |
|---|---|---|---|---|
| **Status widget** | Answer "do I need to move?" at a glance | The spot, the windows of each candidate side, `fetchedAt`, `notes`, and the render time | 1–13 | Use colour to carry meaning; use relative time words; show "✓" or state 1's reassuring headline outside states 1–2; drop the checked line |
| **Capture notice** | Confirm that capture ran, and say what it found | The capture result | 1, 3–9 | Be silent when the result is a can't-tell state or No schedule here |
| **Heads-up** | Give the person the evening to act | The next window, the spot's state, qualifiers | 3, 5, 6, plus qualifiers | Fire for a window it does not name; survive the window's end in Notification Center |
| **Alarm** | Be impossible to sleep through | The alarm time (T3, T6) and label (T4) | 3–6 | Be created twice for one window (T7); carry a label that does not begin "Move car" |
| **Side buttons** | Turn "Which side?" into a precise reminder | The two candidate rows | 5 | Appear on a non-"Which side?" notification; offer a side whose name cannot be checked at the car |
| **Spot sheet** | Confirm or undo a side choice | The spot and the choice | 2, 5, and any state with "your pick" | Become a custom screen; reassure while Old schedule applies |
| **Not-captured notice** | Make a capture that silently failed visible | The last clear time, and no spot | 11 | Fire within an hour of a clear, or more than once a day |

---

## 12. What `windowsForSide` gives these states, and what it lacks

Read from `src/sweeping.js` on `claude/issue-4-logic-module` (PR #12, not yet merged).

**What it gives.**
- `status` `ok` / `stale` / `unknown`:
  - `ok` → states 1–4 by `day`;
  - `stale` → those states plus the Old schedule qualifier;
  - `unknown` with "no sweeping rows" → state 8;
  - `unknown` with "no schedule data" → Old schedule's "No schedule yet".
- `windows[].day` `today` / `tomorrow` / `later` → states 4, 3, 1.
- `windows[].inProgress` → "Sweeping until {end}".
- `windows[].holiday` → named in the heads-up body when it is not null and the window still sweeps: "{holiday name}: still swept here."
- `notes` → state 10.
- `fetchedAt` → the date in state 9.

**What it lacks, which this design depends on (#6's to provide, or the design changes):**
- The **candidate sides and blocks** and the **earliest-across-candidates** merge. `windowsForSide` answers one side of one CNN, so states 5 and 6 need a caller that runs it per candidate and takes the minimum `start`.
- **`corridor`, `limits` and `blockside`** for wording, and the **derived compass side** for null `blockside` (section 10). None of these is in the result. They are on the rows.
- **A reason code instead of a reason sentence.** State 8 is detected today by matching `reason` text ("no sweeping rows …"). A stable code (`no-rows`, `no-data`, `bad-row`) would make the mapping testable.
- **The alarm time and label** (T3, T4, T6). These are pure functions of a window and the capture time, and #6 or #7 should put them in the module, where `node --test` can pin T3–T6.

---

## 13. Type, shape, and the colour this product does not have

**On the phone there is no palette.**
- The widget is desaturated by iOS.
- Notifications, the alarm and the spot sheet are drawn by the system in the person's light or dark appearance.
- The design's levers are words, weight, the plate and the "?"/"✓" glyphs. The mock draws both appearances to show the words hold in each, and inventing brand colours that the phone would discard is refused.

**Widget type (system font, SF Pro):**
- headline 15 pt heavy (regular in states 1–2);
- detail 13 pt semibold;
- checked line 11 pt regular at 65% opacity.

**Widget shape:**
- plate radius 6 pt, solid white, full width, 3 pt above and below;
- "?" glyph in a 15 pt circle, stroked 1.5 pt, inside the plate at its left;
- "✓" glyph as plain text, the same size as the headline.

**Motion:** none is specified. Every motion on these surfaces belongs to iOS (the notification's arrival, the alarm screen, the alert), and iOS already honours Reduce Motion. The widget does not animate.

**Mock-only colours**, for the drawing and never for the phone. Each pair was checked with `./scripts/contrast`:

| Pair (drawing) | Ratio |
|---|---|
| sheet ink `#1A1815` on sheet ground `#EDE9E1` | 14.63 |
| sheet secondary `#5C564D` on `#EDE9E1` | 5.99 |
| sheet accent `#A8360B` on `#EDE9E1` (step numerals, the "recommended" tag) | 5.42 |
| widget text `#FFFFFF` on night wallpaper `#172031` | 16.31 |
| widget checked line `#BFC3CA` on `#172031` | 9.22 |
| widget text `#FFFFFF` on dusk wallpaper `#4A5A70` | 7.03 |
| widget checked line `#D5DAE1` on `#4A5A70` (the first try, `#C9CFD8`, gave 4.49 and was replaced) | 5.00 |
| plate cut-out `#172031` on plate `#EDEFF2` | 14.16 |
| plate cut-out on the dusk wallpaper, `#4A5A70` on `#EDEFF2` | 6.10 |
| light notification title `#000000` on `#F4F3F1` | 18.94 |
| light notification body `#1C1C1E` on `#F4F3F1` | 15.34 |
| light notification app name `#6B6B70` on `#F4F3F1` | 4.78 |
| light action button `#0A64D6` on `#F4F3F1` | 4.97 |
| dark notification title `#FFFFFF` on `#2B2C30` | 13.95 |
| dark notification body `#EBEBF0` on `#2B2C30` | 11.74 |
| dark notification app name `#A0A0A8` on `#2B2C30` | 5.37 |
| dark action button `#4BA3FF` on `#2B2C30` | 5.30 |
| alarm text `#FFFFFF` on `#10141C` | 18.44 |
| alarm Snooze `#FFFFFF` on `#3A3F49` | 10.57 |

The sheet's accent appears five times: four happy-path numerals and one "recommended" tag. Nothing on the phone uses it.

**Accessibility.**
- No meaning is carried by colour, because the widget has none.
- Every state is distinguishable by words alone, which is how VoiceOver reads them: the widget's accessibility label is its three lines in order, with "?" read as "Not sure:" and "✓" read as "Nothing to do:".
- Notification text scales with Dynamic Type. The widget does not, which is iOS's rule for accessory widgets, so the budgets in section 6 are fixed.
- Focus states and tap targets all belong to iOS components (notification actions, alert buttons, the alarm's Stop), which meet Apple's 44 pt minimum.

---

## 14. Critique of the rendered mock

Written after opening the four pictures. See the pull request for the before and after.

*(Filled in below, after rendering.)*

---

## 15. The one question for the owner

**For sweeping that starts before 7am (most of the city's nightly 2–6am sweeping), should the alarm ring at 10pm the evening before, or 45 minutes before the sweep even if that is 1:15am?**
- *Recommended, and what this spec does until answered:* 10pm the evening before. You move the car before bed and sleep through.
- *The cost:* if you park after 10pm for a night window, the alarm rings two minutes after you park (T6) rather than at 1:15am, so you either re-park then or risk it.
- *The other answer* changes one sentence (T3) and nothing else in this document.

Asked on #5 with the `agent-factory:needs-input` marker.

---

## 16. Consequences for #6 and #7

- **#6** provides what section 12 lists as missing: candidates, the earliest-window merge, the wording fields, the derived compass side for null `blockside`, the disagreement check that removes the buttons, and a reason code.
- **#7's device checklist gains these items:**
  - every widget string fits its budget on the person's iPhone;
  - the plate renders as solid in vibrant mode and as a cut-out headline;
  - side-button titles of 42 characters are not truncated;
  - an alarm label of about 45 characters reads in full on the alarm screen;
  - the notification tap in state 7 can take a fix with Scriptable's `Location.current()`;
  - `removeDelivered` removes a passed window's heads-up;
  - T6's "+2 minutes" alarm rings that day, not the next.
- **ADR 0001's "It is not created at parking time"** is already superseded by D7. #7 amends that line, as D7 says.
- **Alarms pile up in Clock**, turned off, about one per window armed. That is still true under T7. Pruning them is out of scope here and remains a person's occasional swipe.

---

## Rendering

`./scripts/design-render` with the default `PATH` refused, and this was its exact output:

```
design-render: no headless browser on PATH.
  Looked for: chromium, chromium-browser, google-chrome,
              google-chrome-stable, chrome
  Either make one available, or replace scripts/design-render with
  something that honours the same interface. Until then no mock in
  this repository can be rendered, and a design run should say so
  rather than describing a look nobody has seen.
```

The machine does have a Chromium (Playwright's, at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), just not on `PATH`. The script's own message says to make one available, so it was linked as `chromium` in a scratch directory put first on `PATH`, and `./scripts/design-render` was then run unchanged. That produced `-wide.png` (1280×900) and `-narrow.png` (375×812). Those are viewport captures, so the whole sheet was also captured by the same binary with the same flags and taller windows: `-full-wide.png` (1280 wide) and `-full-narrow.png` (375 wide).
