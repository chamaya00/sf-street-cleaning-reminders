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

// Research 4.5: data fetched more than 14 days before `now`, or at an unknown
// time, is stale.
function freshness(data, now) {
  var fetchedAtMs = data ? toInstant(data.fetchedAt) : null;
  return {
    fetchedAt: fetchedAtMs === null ? null : new Date(fetchedAtMs).toISOString(),
    stale: fetchedAtMs === null || now === null || now - fetchedAtMs > STALE_AFTER_MS,
  };
}

// Stable codes for an unknown result, so a caller maps states by code rather
// than by matching `reason`, whose wording is for people.
function unknown(base, code, reason) {
  base.status = 'unknown';
  base.code = code;
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
// Returns { status, cnn, side, stale, fetchedAt, notes, windows, code, reason }:
// - status 'unknown': no row for that CNN and side, a row that cannot be read,
//   or no data. `windows` is null, never an empty list, and `reason` says why.
//   `code` is 'no-rows', 'bad-row', 'no-data', or 'bad-query' for a bad `now`,
//   `until` or side; it is null on every other result.
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
  var fresh = freshness(data, now);
  var stale = fresh.stale;
  var fetchedAt = fresh.fetchedAt;
  var result = {
    status: stale ? 'stale' : 'ok',
    cnn: query.cnn,
    side: query.side,
    stale: stale,
    fetchedAt: fetchedAt,
    notes: [],
    windows: [],
    code: null,
  };

  if (now === null) return unknown(result, 'bad-query', 'no evaluation instant');
  var until = query.until === undefined ? now + DEFAULT_HORIZON_MS : toInstant(query.until);
  if (until === null) return unknown(result, 'bad-query', 'until is not an instant');
  if (query.side !== 'L' && query.side !== 'R') return unknown(result, 'bad-query', 'side must be L or R');
  if (!data || !Array.isArray(data.rows)) return unknown(result, 'no-data', 'no schedule data');

  var rows = [];
  for (var i = 0; i < data.rows.length; i++) {
    var raw = data.rows[i];
    if (!raw || raw.cnn !== String(query.cnn) || raw.cnnrightleft !== query.side) continue;
    var r = readRow(raw);
    if (!r) return unknown(result, 'bad-row', 'row ' + raw.blocksweepid + ' could not be read');
    rows.push(r);
  }
  if (rows.length === 0) return unknown(result, 'no-rows', 'no sweeping rows for CNN ' + query.cnn + ' side ' + query.side);

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

// ------------------------------------------------------------------- location

// Research 5.3's rules, as numbers. They may be tuned with field data in one
// direction only: tighter.
var SIDE_MAX_ACCURACY_M = 10; // a side resolves only when h <= 10 m ...
var SIDE_ACCURACY_FACTOR = 2; // ... and d >= max(2h, 3 m)
var SIDE_MIN_DISTANCE_M = 3;
var BLOCK_MARGIN_M = 10; // the block rule's radius is h + 10 m
var MAX_ACCURACY_M = 50; // the no-fix rule: h < 0 or h > 50 m
// The block rule's radius when the accuracy is unknown (D8's default, on #2).
var UNKNOWN_ACCURACY_RADIUS_M = 60;
// No centreline this close is "No schedule here" (design 5, state 8).
var STREET_RADIUS_M = 60;

var EARTH_RADIUS_M = 6371008.8;
var DEG = Math.PI / 180;

// `blockside` values, clockwise from north, 45 degrees apart.
var COMPASS = ['North', 'NorthEast', 'East', 'SouthEast', 'South', 'SouthWest', 'West', 'NorthWest'];

// A row's centreline as [[lon, lat], ...], or null when it has fewer than two
// points or a point that is not two finite numbers.
function readLine(row) {
  var line = row && row.line;
  if (!line || line.type !== 'LineString' || !Array.isArray(line.coordinates)) return null;
  var c = line.coordinates;
  if (c.length < 2) return null;
  for (var i = 0; i < c.length; i++) {
    if (!Array.isArray(c[i]) || typeof c[i][0] !== 'number' || typeof c[i][1] !== 'number' ||
      !isFinite(c[i][0]) || !isFinite(c[i][1])) return null;
  }
  return c;
}

// Metres east (x) and north (y) of an origin, on a plane tangent at the
// origin. Over the tens of metres this module measures, the error is far
// below a phone's accuracy.
function planar(lon, lat, lon0, lat0) {
  return {
    x: (lon - lon0) * DEG * EARTH_RADIUS_M * Math.cos(lat0 * DEG),
    y: (lat - lat0) * DEG * EARTH_RADIUS_M,
  };
}

// The compass direction, in degrees clockwise from north, of a side of a
// centreline: the bearing from its first coordinate to its last, turned 90
// degrees left for L or right for R (design 10). Null when the two ends are
// the same point, as on a loop.
function sideBearing(coords, side) {
  var a = coords[0];
  var b = coords[coords.length - 1];
  var p = planar(b[0], b[1], a[0], a[1]);
  if (p.x === 0 && p.y === 0) return null;
  var bearing = Math.atan2(p.x, p.y) / DEG + (side === 'L' ? -90 : 90);
  return ((bearing % 360) + 360) % 360;
}

function compassName(degrees) {
  return COMPASS[Math.round(degrees / 45) % 8];
}

// Whether a row's `blockside` lies on the side of its centreline that its
// `cnnrightleft` names, read in the line's digitised direction (research 5.2).
// 'agree' when the city's compass direction is within 90 degrees of the
// derived side's, so both name the same side of the street; 'disagree' when
// it is not; 'no-geometry' when the row has no usable centreline; 'no-label'
// when `blockside` is null.
function blocksideCheck(row) {
  if (!row || !row.blockside) return 'no-label';
  var coords = readLine(row);
  var derived = coords && (row.cnnrightleft === 'L' || row.cnnrightleft === 'R') ? sideBearing(coords, row.cnnrightleft) : null;
  if (derived === null) return 'no-geometry';
  var named = COMPASS.indexOf(row.blockside);
  if (named < 0) return 'disagree';
  var apart = Math.abs((((derived - named * 45) % 360) + 540) % 360 - 180);
  return apart < 90 ? 'agree' : 'disagree';
}

// How far the fix, at the origin, is from a centreline given in planar
// coordinates, and which side of it the fix is on: the sign of the cross
// product against the nearest segment, in the line's digitised direction,
// with L on the left (research 5.2). Where the nearest point is a vertex
// between two segments, the side is read against the sum of both segments'
// left normals, which a cross product against either alone can get wrong.
function measureLine(points) {
  var best = null;
  for (var i = 0; i + 1 < points.length; i++) {
    var a = points[i];
    var b = points[i + 1];
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    var px = a.x + t * dx;
    var py = a.y + t * dy;
    var distance = Math.sqrt(px * px + py * py);
    if (best === null || distance < best.distance) best = { distance: distance, segment: i, t: t };
  }
  var vertex = best.t === 1 && best.segment + 2 < points.length ? best.segment + 1
    : best.t === 0 && best.segment > 0 ? best.segment : -1;
  var leftness;
  if (vertex > 0) {
    var n1 = leftNormal(points[vertex - 1], points[vertex]);
    var n2 = leftNormal(points[vertex], points[vertex + 1]);
    var v = points[vertex];
    leftness = -v.x * (n1.x + n2.x) - v.y * (n1.y + n2.y);
  } else {
    var s = points[best.segment];
    var e = points[best.segment + 1];
    leftness = (e.x - s.x) * -s.y - (e.y - s.y) * -s.x;
  }
  return { distance: best.distance, side: leftness > 0 ? 'L' : 'R' };
}

function leftNormal(a, b) {
  var dx = b.x - a.x;
  var dy = b.y - a.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  return len === 0 ? { x: 0, y: 0 } : { x: -dy / len, y: dx / len };
}

// Every block (CNN) whose centreline lies within `radius` metres of the fix,
// nearest first: { cnn, rows, coords, distance, side }. A block's centreline
// is its first row's; one with no usable centreline cannot be found by
// position at all.
function blocksNear(rows, latitude, longitude, radius) {
  var byCnn = {};
  var order = [];
  rows.forEach(function (raw) {
    if (!raw || typeof raw.cnn !== 'string') return;
    if (!byCnn[raw.cnn]) {
      byCnn[raw.cnn] = { cnn: raw.cnn, rows: [] };
      order.push(raw.cnn);
    }
    byCnn[raw.cnn].rows.push(raw);
  });
  // A box `radius` around the fix, in degrees, rejects most blocks cheaply.
  var dLat = radius / (DEG * EARTH_RADIUS_M);
  var dLon = dLat / Math.cos(latitude * DEG);
  var near = [];
  order.forEach(function (cnn) {
    var block = byCnn[cnn];
    var coords = readLine(block.rows[0]);
    if (!coords) return;
    var minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (var i = 0; i < coords.length; i++) {
      if (coords[i][0] < minLon) minLon = coords[i][0];
      if (coords[i][0] > maxLon) maxLon = coords[i][0];
      if (coords[i][1] < minLat) minLat = coords[i][1];
      if (coords[i][1] > maxLat) maxLat = coords[i][1];
    }
    if (longitude < minLon - dLon || longitude > maxLon + dLon || latitude < minLat - dLat || latitude > maxLat + dLat) return;
    var m = measureLine(coords.map(function (c) { return planar(c[0], c[1], longitude, latitude); }));
    if (m.distance > radius) return;
    block.coords = coords;
    block.distance = m.distance;
    block.side = m.side;
    near.push(block);
  });
  near.sort(function (a, b) { return a.distance - b.distance || (a.cnn < b.cnn ? -1 : a.cnn > b.cnn ? 1 : 0); });
  return near;
}

// Whether a block's sides can be offered as buttons, and resolved by the side
// rule: every row has the block's own usable centreline, and no row's
// `blockside` disagrees with it (design 10).
function sideButtonsFor(block) {
  var same = JSON.stringify(block.coords);
  if (sideBearing(block.coords, 'L') === null) return false;
  return block.rows.every(function (r) {
    var c = readLine(r);
    return c !== null && JSON.stringify(c) === same && blocksideCheck(r) !== 'disagree';
  });
}

// One candidate block side: windowsForSide's result for it, with the words
// design 10 needs from its rows. `limits` is passed through as the city wrote
// it, never repaired.
function candidate(data, query, block, side) {
  var result = windowsForSide(data, { cnn: block.cnn, side: side, now: query.now, until: query.until });
  var sideRows = block.rows.filter(function (r) { return r.cnnrightleft === side; });
  var row = sideRows.length > 0 ? sideRows[0] : block.rows[0];
  var compass = sideBearing(block.coords, side);
  result.corridor = row.corridor === undefined ? null : row.corridor;
  result.limits = row.limits === undefined ? null : row.limits;
  result.blockside = sideRows.length > 0 && sideRows[0].blockside ? sideRows[0].blockside : null;
  result.compass = compass === null ? null : compassName(compass);
  result.compassFromMap = result.blockside === null;
  result.sideButtons = block.sideButtons;
  result.distance = block.distance;
  return result;
}

function readNumber(value) {
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string' && /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(value)) return Number(value);
  return null;
}

// Where the car is parked: a spot, from a fix and the city's table alone.
//
// data:  { fetchedAt, rows }, as windowsForSide takes it. Each row's `line`
//        is the block's centreline, the only geometry used.
// query: { latitude, longitude, accuracy, now, until (optional) }. `accuracy`
//        is the fix's horizontal accuracy h in metres, and may be missing.
//
// Returns { kind, code, cnn, side, accuracy, radius, distance, candidates,
// next, stale, fetchedAt, notes }. `kind` is one of design 5's states:
// - 'no-schedule-yet', code 'no-data': no data loaded.
// - 'spot-unknown', code 'no-fix': the no-fix rule (research 5.3), or no
//   usable coordinate. Code 'bad-query' when `now` is not an instant.
// - 'no-schedule-here', code 'no-street': no centreline within 60 m.
// - 'which-block': two or more centrelines within h + 10 m, or 60 m when h is
//   missing. Both sides of every one of them are candidates.
// - 'side-known': one block, and the side rule resolves. Its one candidate
//   is the side the fix is on. Never for a block whose sideButtons is false.
// - 'which-side': one block, and the side rule does not. Both its sides are
//   candidates.
// - 'no-schedule-here', code 'no-rows' or 'bad-row': no candidate has a
//   schedule, as when the side rule resolves to a side with no rows.
// A 'which-side' or 'which-block' spot with a candidate whose row cannot be
// read carries code 'bad-row'. Every other code is null.
//
// Each candidate is windowsForSide's result for one side of one block, plus
// `corridor`, `limits` and `blockside` from its rows, `compass` (the side
// derived from the centreline, one of the eight `blockside` names),
// `compassFromMap` (true where `blockside` is null), `sideButtons` and
// `distance` (metres from the fix to the block's centreline).
// `next` is { cnn, side, window }: the earliest window, across every
// candidate, that has not ended, or null when there is none before `until`.
// `stale`, `fetchedAt` and `notes` are the candidates' own.
function resolveSpot(data, query) {
  query = query || {};
  var now = toInstant(query.now);
  var fresh = freshness(data, now);
  var spot = {
    kind: null,
    code: null,
    cnn: null,
    side: null,
    accuracy: null,
    radius: null,
    distance: null,
    candidates: [],
    next: null,
    stale: fresh.stale,
    fetchedAt: fresh.fetchedAt,
    notes: [],
  };
  function finish(kind, code) {
    spot.kind = kind;
    spot.code = code;
    return spot;
  }

  if (now === null) return finish('spot-unknown', 'bad-query');
  if (!data || !Array.isArray(data.rows)) return finish('no-schedule-yet', 'no-data');

  var h = readNumber(query.accuracy);
  var latitude = readNumber(query.latitude);
  var longitude = readNumber(query.longitude);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
    !isFinite(latitude) || !isFinite(longitude)) return finish('spot-unknown', 'no-fix');
  if (h !== null && (h < 0 || h > MAX_ACCURACY_M)) return finish('spot-unknown', 'no-fix');
  spot.accuracy = h;
  spot.radius = h === null ? UNKNOWN_ACCURACY_RADIUS_M : h + BLOCK_MARGIN_M;

  var blocks = blocksNear(data.rows, latitude, longitude, Math.max(STREET_RADIUS_M, spot.radius));
  if (blocks.length === 0) return finish('no-schedule-here', 'no-street');
  spot.distance = blocks[0].distance;
  blocks.forEach(function (b) { b.sideButtons = sideButtonsFor(b); });

  var within = blocks.filter(function (b) { return b.distance <= spot.radius; });
  var kind;
  if (within.length >= 2) {
    kind = 'which-block';
    within.forEach(function (b) {
      spot.candidates.push(candidate(data, query, b, 'L'), candidate(data, query, b, 'R'));
    });
  } else {
    var block = blocks[0];
    spot.cnn = block.cnn;
    var resolves = h !== null && h <= SIDE_MAX_ACCURACY_M &&
      block.distance >= Math.max(SIDE_ACCURACY_FACTOR * h, SIDE_MIN_DISTANCE_M) && block.sideButtons;
    if (resolves) {
      kind = 'side-known';
      spot.side = block.side;
      spot.candidates.push(candidate(data, query, block, block.side));
    } else {
      kind = 'which-side';
      spot.candidates.push(candidate(data, query, block, 'L'), candidate(data, query, block, 'R'));
    }
  }

  spot.candidates.forEach(function (c) {
    spot.stale = c.stale;
    spot.fetchedAt = c.fetchedAt;
    c.notes.forEach(function (n) { if (spot.notes.indexOf(n) < 0) spot.notes.push(n); });
  });
  var scheduled = spot.candidates.filter(function (c) { return c.status !== 'unknown'; });
  var badRow = spot.candidates.some(function (c) { return c.code === 'bad-row'; });
  if (scheduled.length === 0) return finish('no-schedule-here', badRow ? 'bad-row' : spot.candidates[0].code);
  scheduled.forEach(function (c) {
    c.windows.forEach(function (w) {
      var n = spot.next && spot.next.window;
      if (!n || w.start < n.start || (w.start === n.start && w.end < n.end)) {
        spot.next = { cnn: c.cnn, side: c.side, window: w };
      }
    });
  });
  return finish(kind, badRow ? 'bad-row' : null);
}

module.exports = {
  windowsForSide: windowsForSide,
  resolveSpot: resolveSpot,
  blocksideCheck: blocksideCheck,
  pacificParts: pacificParts,
  pacificInstant: pacificInstant,
  HOLIDAYS: HOLIDAYS,
  STALE_AFTER_MS: STALE_AFTER_MS,
};
