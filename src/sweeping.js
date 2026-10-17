// Street sweeping windows for one block side, as exact instants.
//
// The logic module ADR 0001 names. It reads rows in the SODA2 JSON shape of
// DataSF's table yhqp-riqs (research #3, 4.2: every value a string, a null
// field left out), and works out a side's upcoming windows in San Francisco
// time. It applies the week-of-month flags (4.3), the holiday rule (4.4) and
// the 14-day staleness rule (4.5), and says `unknown` rather than guess.
//
// Loaded unchanged by Node's require and by Scriptable's importModule, so it
// has no dependencies and touches only `module.exports` and the language's own
// built-ins. It never reads the host's time zone: Pacific time is worked out
// here, from the US rule, with UTC arithmetic only.

'use strict';

var HOUR_MS = 3600000;
var DAY_MS = 24 * HOUR_MS;

// Data fetched more than this long before the evaluation instant is stale
// (research 4.5): two missed weekly refreshes.
var STALE_AFTER_MS = 14 * DAY_MS;

// How far ahead windowsForSide looks when the caller gives no `until`.
var DEFAULT_HORIZON_MS = 14 * DAY_MS;

// SFMTA's holiday enforcement, by year. Maintained by hand (research 4.4): add
// next year's dates when SFMTA publishes them. A year missing from this table
// is treated as having no holidays, and the result says so.
//
// Bands: `nightly` is street sweeping from 00:00 to 06:00 and `daytime` is
// 06:00 to 14:00. `true` means SFMTA enforces that band on that date.
var HOLIDAYS = {
  2026: {
    source: "SFMTA, \"Holiday Street Parking Enforcement Schedule\", 2026 table; the page's address is in docs/research/3-parking-capture-and-reminders.md, section 4.4",
    provenance: "[V-x]: the page's text as quoted by a search index, read 2026-10-16, not the page itself. Re-read the page before relying on it for anything the gate cannot check.",
    // Only the dates still ahead when this table was written (2026-10-16).
    dates: {
      '2026-11-11': { name: 'Veterans Day', nightly: true, daytime: false },
      '2026-11-26': { name: 'Thanksgiving', nightly: false, daytime: false },
      '2026-11-27': { name: 'Day after Thanksgiving', nightly: true, daytime: false },
      '2026-12-25': { name: 'Christmas', nightly: false, daytime: false },
    },
  },
};

// `weekday` values in the table, by JavaScript day number (0 is Sunday).
var WEEKDAYS = ['Sun', 'Mon', 'Tues', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------- Pacific time

// US daylight saving time since 2007: from the second Sunday in March at 02:00
// standard time until the first Sunday in November at 02:00 daylight time.
// Pacific standard time is UTC-8 and daylight time UTC-7.
function nthSundayUtc(year, monthIndex, n) {
  var firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return Date.UTC(year, monthIndex, 1 + ((7 - firstDay) % 7) + 7 * (n - 1));
}

function offsetMs(instant) {
  var year = new Date(instant).getUTCFullYear();
  var dstStart = nthSundayUtc(year, 2, 2) + 10 * HOUR_MS; // 02:00 PST
  var dstEnd = nthSundayUtc(year, 10, 1) + 9 * HOUR_MS; // 02:00 PDT
  return instant >= dstStart && instant < dstEnd ? -7 * HOUR_MS : -8 * HOUR_MS;
}

// The Pacific wall clock at an instant. `weekday` is 0 for Sunday.
function pacificParts(instant) {
  var d = new Date(instant + offsetMs(instant));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

// The instant a Pacific wall-clock hour begins. Where the hour happens twice
// (01:00 when DST ends) it is the earlier one. Where it does not exist (02:00
// when DST starts) it is the first instant after the gap, 03:00 daylight time.
function pacificInstant(year, month, day, hour) {
  var wall = Date.UTC(year, month - 1, day, hour);
  var canonical = new Date(wall); // normalises hour 24 to the next day
  var found = [7, 8].map(function (h) { return wall + h * HOUR_MS; }).filter(function (t) {
    var p = pacificParts(t);
    return p.year === canonical.getUTCFullYear() && p.month === canonical.getUTCMonth() + 1 &&
      p.day === canonical.getUTCDate() && p.hour === canonical.getUTCHours() && p.minute === 0;
  });
  if (found.length > 0) return Math.min.apply(null, found);
  return wall + 8 * HOUR_MS;
}

function isoDate(year, month, day) {
  return year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
}

// --------------------------------------------------------------------- inputs

function toInstant(value) {
  if (value instanceof Date) value = value.getTime();
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (typeof value === 'string' && value !== '') {
    var t = Date.parse(value);
    return isNaN(t) ? null : t;
  }
  return null;
}

function readFlag(row, name) {
  var v = row[name];
  if (v === '0') return false;
  if (v === '1') return true;
  return null;
}

function readHour(row, name) {
  var v = row[name];
  if (typeof v !== 'string' || !/^\d{1,2}$/.test(v)) return null;
  var n = Number(v);
  return n <= 24 ? n : null;
}

// A row as the rules below use it, or null when any field they need is missing
// or not one of the values the table uses. Nothing is filled in: week5 in
// particular is never inferred from the other weeks or from `fullname`.
function readRow(row) {
  if (!row || typeof row !== 'object') return null;
  var isHolidayRow = row.weekday === 'Holiday';
  var weekday = WEEKDAYS.indexOf(row.weekday);
  if (!isHolidayRow && weekday < 0) return null;
  var from = readHour(row, 'fromhour');
  var to = readHour(row, 'tohour');
  if (from === null || to === null || from >= to) return null;
  var weeks = [];
  for (var i = 1; i <= 5; i++) {
    var w = readFlag(row, 'week' + i);
    if (w === null) return null;
    weeks.push(w);
  }
  var sweptOnHolidays = readFlag(row, 'holidays');
  if (sweptOnHolidays === null) return null;
  return {
    source: row,
    isHolidayRow: isHolidayRow,
    weekday: weekday,
    from: from,
    to: to,
    weeks: weeks,
    sweptOnHolidays: sweptOnHolidays,
  };
}

// ---------------------------------------------------------------------- rules

// Research 4.4. On a date in the holiday table, a regular-weekday row with
// holidays 0 is skipped only when its whole window lies inside one band SFMTA
// does not enforce that day. A window crossing 06:00 or 14:00, or outside both
// bands, is never skipped. A row with holidays 1 is never skipped.
function skippedOnHoliday(r, holiday) {
  if (r.sweptOnHolidays) return false;
  var insideNightly = r.from >= 0 && r.to <= 6;
  var insideDaytime = r.from >= 6 && r.to <= 14;
  return (insideNightly && !holiday.nightly) || (insideDaytime && !holiday.daytime);
}

// Whether a row sweeps on a local date. `week` is the occurrence of the weekday
// in its month (research 4.3): days 1-7 are week 1, 8-14 week 2, and so on.
// A Holiday row sweeps on every date in the holiday table, whatever its
// holidays flag, and on no other date.
function sweepsOn(r, weekday, week, holiday) {
  if (r.isHolidayRow) return !!holiday;
  if (r.weekday !== weekday || !r.weeks[week - 1]) return false;
  return !(holiday && skippedOnHoliday(r, holiday));
}

// ------------------------------------------------------------------------ API

function unknown(base, reason) {
  base.status = 'unknown';
  base.reason = reason;
  base.windows = null;
  return base;
}

// The sweeping windows of one block side between `now` and `until`.
//
// data:  { fetchedAt, rows }. `rows` are SODA2 rows of yhqp-riqs; `fetchedAt`
//        is when they were fetched (an ISO string, a Date or milliseconds).
// query: { cnn, side ('L' or 'R'), now, until (optional, default now + 14 days) }
//
// Returns { status, cnn, side, stale, fetchedAt, notes, windows, reason }:
// - status 'unknown': no row for that CNN and side, a row that cannot be read,
//   or no data. `windows` is null, never an empty list, and `reason` says why.
// - status 'stale': fetchedAt is missing or more than 14 days before `now`.
//   Every window carries stale: true and the fetchedAt.
// - status 'ok': windows is the complete list, possibly empty.
// `notes` holds "holiday list missing for <year>" for each year in range that
// HOLIDAYS does not hold.
//
// Each window: { start, end } as ISO instants, its local `date`, `fromHour`,
// `toHour`, the row's `weekday`, `day` ('today', 'tomorrow' or 'later', in
// Pacific time relative to now), `inProgress`, `holiday` (the holiday's name
// or null), `blocksweepids`, `stale` and `fetchedAt`. Windows are in time
// order, and a window already under way at `now` is included.
function windowsForSide(data, query) {
  query = query || {};
  var now = toInstant(query.now);
  var fetchedAtMs = data ? toInstant(data.fetchedAt) : null;
  var fetchedAt = fetchedAtMs === null ? null : new Date(fetchedAtMs).toISOString();
  var stale = fetchedAtMs === null || now === null || now - fetchedAtMs > STALE_AFTER_MS;
  var result = {
    status: stale ? 'stale' : 'ok',
    cnn: query.cnn,
    side: query.side,
    stale: stale,
    fetchedAt: fetchedAt,
    notes: [],
    windows: [],
  };

  if (now === null) return unknown(result, 'no evaluation instant');
  var until = query.until === undefined ? now + DEFAULT_HORIZON_MS : toInstant(query.until);
  if (until === null) return unknown(result, 'until is not an instant');
  if (query.side !== 'L' && query.side !== 'R') return unknown(result, 'side must be L or R');
  if (!data || !Array.isArray(data.rows)) return unknown(result, 'no schedule data');

  var rows = [];
  for (var i = 0; i < data.rows.length; i++) {
    var raw = data.rows[i];
    if (!raw || raw.cnn !== String(query.cnn) || raw.cnnrightleft !== query.side) continue;
    var r = readRow(raw);
    if (!r) return unknown(result, 'row ' + raw.blocksweepid + ' could not be read');
    rows.push(r);
  }
  if (rows.length === 0) return unknown(result, 'no sweeping rows for CNN ' + query.cnn + ' side ' + query.side);

  var today = pacificParts(now);
  var todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  var last = pacificParts(until);
  var lastUtc = Date.UTC(last.year, last.month - 1, last.day);
  var byInterval = {};
  var windows = [];

  for (var dayUtc = todayUtc; dayUtc <= lastUtc; dayUtc += DAY_MS) {
    var d = new Date(dayUtc);
    var y = d.getUTCFullYear();
    var m = d.getUTCMonth() + 1;
    var dom = d.getUTCDate();
    var date = isoDate(y, m, dom);
    var year = HOLIDAYS[y];
    if (!year) {
      var note = 'holiday list missing for ' + y;
      if (result.notes.indexOf(note) < 0) result.notes.push(note);
    }
    var holiday = year && year.dates[date] ? year.dates[date] : null;
    var weekday = d.getUTCDay();
    var week = Math.ceil(dom / 7);
    var offsetDays = Math.round((dayUtc - todayUtc) / DAY_MS);

    rows.forEach(function (r) {
      if (!sweepsOn(r, weekday, week, holiday)) return;
      var start = pacificInstant(y, m, dom, r.from);
      var end = pacificInstant(y, m, dom, r.to);
      if (end <= now || start >= until) return;
      var key = start + '/' + end;
      if (byInterval[key]) {
        byInterval[key].blocksweepids.push(r.source.blocksweepid);
        return;
      }
      var w = {
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        date: date,
        fromHour: r.from,
        toHour: r.to,
        weekday: r.source.weekday,
        day: offsetDays === 0 ? 'today' : offsetDays === 1 ? 'tomorrow' : 'later',
        inProgress: start <= now,
        holiday: holiday ? holiday.name : null,
        blocksweepids: [r.source.blocksweepid],
        stale: stale,
        fetchedAt: fetchedAt,
      };
      byInterval[key] = w;
      windows.push(w);
    });
  }

  windows.sort(function (a, b) {
    return a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0;
  });
  result.windows = windows;
  return result;
}

module.exports = {
  windowsForSide: windowsForSide,
  pacificParts: pacificParts,
  pacificInstant: pacificInstant,
  HOLIDAYS: HOLIDAYS,
  STALE_AFTER_MS: STALE_AFTER_MS,
};
