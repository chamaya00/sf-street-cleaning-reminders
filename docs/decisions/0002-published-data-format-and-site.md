# ADR 0002: The published schedule file, the Pages site's layout, and how the installer replaces files

Date: 2026-10-18
Status: proposed

Issue: [#11](https://github.com/chamaya00/sf-street-cleaning-reminders/issues/11). Works out ADR 0001's **Data** and **Installs and updates**; decides nothing ADR 0001 already decided.

## Context

ADR 0001 has a weekly GitHub Action read DataSF's table `yhqp-riqs` through the SODA2 endpoint, publish "a compact JSON stamped with its own fetch time and the city's `rowsUpdatedAt`" on GitHub Pages with the scripts, and has an installer that swaps a file in only after a complete download that parses. It does not say what the file looks like, how the site is laid out, or how the installer knows what is complete. These are data shapes that the phone, the build and #6 and #7 all depend on, which is why they need an ADR.

The constraints:
- **The phone and the tests read the same file the same way.** `windowsForSide` already takes `{ fetchedAt, rows }` with rows in SODA2 shape: every value a string, a null field left out (research #3, 4.2). #6 and #7 read `line`, `corridor`, `limits` and `blockside` as well (design #5, sections 10 and 12), so nothing can be dropped.
- **Size.** The SODA2 rows for the full table are 16.2 MB, mostly repeated member names. The phone downloads the file at each capture.
- **The city's endpoint.** The CSV export is being retired on 2026-12-22 (research 4.5). SODA2 pages by `$limit` and `$offset`, and paging without a fixed `$order` can skip or repeat rows.
- **A refresh must be visible when it stops.** A scheduled workflow in a public repository is disabled after 60 days without activity (research 4.5), so `fetchedAt` must change on every run.
- **Scriptable has no hash function** and keeps every script flat in one documents directory (research 9.4, point 6).

## Decision

**The file is `sweeping-data.json`, format 1:** a JSON object with, in this order, `format` (the number 1), `dataset` (`"yhqp-riqs"`), `fetchedAt` (the build's own clock, ISO 8601), `rowsUpdatedAt` (ISO 8601, or null when the city did not say), `count`, `fields` (the column names in the city's order) and `rows`. Each row is an array in `fields` order: the SODA2 string as the city sent it, `null` where SODA2 left the field out, and a `line` LineString stored as its coordinates array alone, unrounded. One key and one row per line, so a person opening the URL sees `fetchedAt` near the top. `decodeData` in `src/sweeping.js` turns it back into `{ fetchedAt, rows }` exactly. Any other `format`, text that is not JSON, or a row that does not fit `fields` decodes to `{ fetchedAt: null, rows: null }`, which `windowsForSide` reports as `unknown`.

**The build reads only `https://data.sf.gov/resource/yhqp-riqs.json`.** It asks for `count(*)`, then pages with `$order=:id`, Socrata's unique row id, and 10,000 rows a page. It writes the file only when every page answered 200 with a JSON array, no page came back short before the count was reached, the total equals `count(*)`, no `blocksweepid` appeared twice, and every response carried the same `X-SODA2-Truth-Last-Modified`. **`rowsUpdatedAt` is that response header**, which research #3 shows equals the metadata's `rowsUpdatedAt` (1778758589 = 2026-05-14T11:36:29Z against `Thu, 14 May 2026 11:36:29 GMT`). Using it keeps every request on the SODA2 endpoint rather than adding the `/api/views/` metadata endpoint. A failed build exits 1 and leaves the previous file untouched.

**The site is flat**, as the phone's script directory is: `sweeping-data.json`, `sweeping.js` (copied from `src/sweeping.js`), every file in `scriptable/` under its own name, and `manifest.json`. Every file is copied byte for byte. The manifest is `{ version, files: [{ path, bytes, sha256 }] }`, where `version` is the first 16 hex digits of the sha256 of the `files` list, so it changes whenever any file does. Nothing under `test/` is ever a source. #7 publishes a new script by adding it to `scriptable/`.

**The installer (`scriptable/sweeping-install.js`)** reads the manifest from `https://chamaya00.github.io/sf-street-cleaning-reminders/`. It downloads only files whose sha256 differs from the manifest it last applied, which it keeps as `sweeping-installed.json`, or which are missing. A file is complete when its UTF-8 byte length equals the manifest's `bytes`. JSON files must pass `JSON.parse`, and scripts must compile as an async function body, which is how Scriptable runs them. Every changed file has to pass before any installed file is touched. Each is then written to `<name>.download` and moved over the old one, and the record is written last.

## Consequences

**Easier.**
- The full table is 8,524,951 bytes as format 1 against 16,198,542 as SODA2 rows, and 2.46 MB gzipped, which is what Pages sends. Nothing is lost: every row decodes to the fixture row field for field, coordinates included.
- `windowsForSide` and its tests are unchanged. The phone and the gate read the same file through the same decoder.
- A file the decoder does not understand fails safe, to `unknown`, rather than to an empty schedule that would read as "all clear".
- A week in which the city answers badly publishes nothing, and the phone keeps last week's file until the 14-day staleness rule speaks.
- Adding a script is adding a file.

**Harder.**
- The format has a version. Changing the layout means bumping `format` in `tools/build-data.js` and `DATA_FORMAT` in `src/sweeping.js` together. A phone with the old module then reads the new file as `unknown` until the installer has run, which is the safe direction.
- The installer checks length and syntax, not the sha256, because Scriptable has no hash function. A same-length corruption that still parses would get through. HTTPS from Pages makes that unlikely, and the manifest's sha256 is there for a later installer that hashes.
- The installer trusts its record. A file edited by hand on the phone with the record unchanged is not replaced until the next version is published.
- `$order=:id` and `X-SODA2-Truth-Last-Modified` are Socrata behaviour the gate cannot check. The stub assumes them, and the first live run of the workflow is what proves them.
- The flat layout means two sources can never share a name. The assembly refuses rather than overwrites.

**Rules out.**
- Publishing anything from `test/`, including the 16 MB fixture.
- Fetching from the city on the phone (ADR 0001 already does).

## Alternatives rejected

- **Publishing the SODA2 rows as they come.** Lost on size: twice the bytes of format 1 for the same content.
- **Rounding coordinates to 6 decimal places.** It would save about 1.2 MB raw and 0.7 MB gzipped. It lost because the rows would no longer equal the city's field for field, and #6's side-of-street geometry would then rest on a copy nobody can compare directly with the source.
- **Dictionary-encoding repeated strings** (corridor, limits, fullname). Gzip already removes most of that repetition in transit, and it would make the file unreadable to a person checking `fetchedAt`.
- **`$order=blocksweepid`.** It is unique in today's table, but only because the city says so. `:id` is unique by construction.
- **`rowsUpdatedAt` from the metadata endpoint** (`/api/views/yhqp-riqs.json`). It adds a second endpoint, from the family of the CSV export being retired.
- **Swapping each file in as soon as it passes.** A failed script download would then leave a new `sweeping.js` beside old scripts, or the reverse. All-or-nothing keeps the module and its callers on one version.
- **Raw GitHub URLs for scripts.** D5 on #2 already rejected these as a second host.
