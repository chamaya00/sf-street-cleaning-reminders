'use strict';

// Criterion 3: exact instants in America/Los_Angeles, including both DST
// changes. These must pass under any host time zone; the PR runs them under
// TZ=UTC and TZ=Asia/Tokyo.

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');

var block = fixture.fullTable().filter(function (r) { return r.cnn === '8753101'; });

function next(rows, cnn, side, now) {
  // Data fetched a day earlier, so staleness is not under test here.
  var result = sweeping.windowsForSide(
    { fetchedAt: new Date(Date.parse(now) - 86400000).toISOString(), rows: rows },
    { cnn: cnn, side: side, now: now }
  );
  assert.equal(result.status, 'ok');
  return result.windows[0];
}

test('8753101 R side, Monday 02:00-06:00, seen Sunday 2026-10-18 21:00 Pacific: tomorrow, from 2026-10-19T09:00Z', function () {
  var now = '2026-10-19T04:00:00Z';
  assert.deepEqual(sweeping.pacificParts(Date.parse(now)), { year: 2026, month: 10, day: 18, hour: 21, minute: 0, weekday: 0 });
  var w = next(block, '8753101', 'R', now);
  assert.equal(w.start, '2026-10-19T09:00:00.000Z');
  assert.equal(w.end, '2026-10-19T13:00:00.000Z');
  assert.equal(w.day, 'tomorrow');
});

test('8753101 L side, Sunday 05:00-07:00 on 2026-11-01 (DST ends), seen 21:00 the evening before: from 13:00Z', function () {
  var w = next(block, '8753101', 'L', '2026-11-01T04:00:00Z'); // Sat 2026-10-31 21:00 PDT
  assert.equal(w.start, '2026-11-01T13:00:00.000Z');
  assert.equal(w.end, '2026-11-01T15:00:00.000Z');
  assert.equal(w.day, 'tomorrow');
});

test('8753101 L side, Sunday 05:00-07:00 on 2027-03-14 (DST starts), seen 21:00 the evening before: from 12:00Z', function () {
  var w = next(block, '8753101', 'L', '2027-03-14T05:00:00Z'); // Sat 2027-03-13 21:00 PST
  assert.equal(w.start, '2027-03-14T12:00:00.000Z');
  assert.equal(w.end, '2027-03-14T14:00:00.000Z');
  assert.equal(w.day, 'tomorrow');
});

test('a window starting at 01:00 on 2026-11-01, which happens twice, starts at the earlier one, 08:00Z', function () {
  // Real row, not synthetic: King St, 02nd St - 03rd St, R, Sunday 01:00-03:00.
  var row = fixture.row('1627909');
  assert.equal(row.weekday, 'Sun');
  assert.equal(row.fromhour, '1');
  var w = next([row], row.cnn, row.cnnrightleft, '2026-11-01T04:00:00Z');
  assert.equal(w.start, '2026-11-01T08:00:00.000Z'); // 01:00 PDT
  assert.equal(w.end, '2026-11-01T11:00:00.000Z'); // 03:00 PST
});

test('a window starting at 02:00 on 2027-03-14, which does not exist, starts no later than 10:00Z', function () {
  // Real row, not synthetic: Grant Ave, Washington St - Jackson St, L, Sunday 02:00-06:00.
  var row = fixture.row('1606424');
  assert.equal(row.weekday, 'Sun');
  assert.equal(row.fromhour, '2');
  var w = next([row], row.cnn, row.cnnrightleft, '2027-03-14T05:00:00Z');
  assert.ok(w.start <= '2027-03-14T10:00:00.000Z', w.start);
  // The first instant at or after 02:00 that exists: 03:00 PDT.
  assert.equal(w.start, '2027-03-14T10:00:00.000Z');
  assert.equal(w.end, '2027-03-14T13:00:00.000Z'); // 06:00 PDT
});
