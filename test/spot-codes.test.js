'use strict';

// #6 criterion 4: each way a spot can lack a schedule has an exact kind and
// code, and none of them is ever side-known or a window list with no code.
// windowsForSide's own codes are in test/codes.test.js.

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');
var spots = require('../tools/spots');

var NOW = '2026-10-19T04:00:00Z'; // Sunday 2026-10-18 21:00 PDT
var data = { fetchedAt: fixture.FETCHED_AT, rows: fixture.fullTable() };

function at(d, fix, h) {
  return sweeping.resolveSpot(d, { latitude: fix.latitude, longitude: fix.longitude, accuracy: h, now: NOW });
}

// Nothing here may read as a schedule: not side-known, no reminder to take,
// and a code saying why.
function assertNoSchedule(spot, kind, code) {
  assert.equal(spot.kind, kind);
  assert.equal(spot.code, code);
  assert.notEqual(spot.kind, 'side-known');
  assert.equal(spot.next, null);
  spot.candidates.forEach(function (c) {
    assert.equal(c.status, 'unknown');
    assert.equal(c.windows, null);
    assert.equal(typeof c.code, 'string');
  });
}

test('no-street: outside San Francisco, or no centreline within 60 m, is no-schedule-here with code no-street', function () {
  [
    { latitude: 37.8044, longitude: -122.2712 }, // Oakland, across the bay
    { latitude: 37.7680, longitude: -122.4930 }, // the Polo Field, Golden Gate Park
    { latitude: 0, longitude: 0 },
  ].forEach(function (fix) {
    [5, undefined].forEach(function (h) {
      var spot = at(data, fix, h);
      assertNoSchedule(spot, 'no-schedule-here', 'no-street');
      assert.deepEqual(spot.candidates, []);
      assert.equal(spot.distance, null);
    });
  });
  // The radius is 60 m: 59 m into Dolores Park from 18th St still finds the
  // block, and 61 m does not.
  assert.equal(at(data, spots.besideBlock('887000', 59, 'L'), undefined).kind, 'which-side');
  assertNoSchedule(at(data, spots.besideBlock('887000', 61, 'L'), undefined), 'no-schedule-here', 'no-street');
});

test('no-rows: a resolved side with no row is no-schedule-here with code no-rows', function () {
  // 08th Ave, Ortega St to Linares Ave: swept on its right side only.
  var spot = at(data, spots.besideBlock('402000', 10, 'L'), 2);
  assertNoSchedule(spot, 'no-schedule-here', 'no-rows');
  assert.equal(spot.candidates.length, 1);
  assert.equal(spot.candidates[0].code, 'no-rows');
});

test('no-data: no data loaded is no-schedule-yet with code no-data, whatever the fix', function () {
  var fix = spots.besideBlock('887000', 9, 'R');
  [null, undefined, {}, { fetchedAt: fixture.FETCHED_AT }, { fetchedAt: fixture.FETCHED_AT, rows: 'x' }].forEach(function (d) {
    [4, undefined, -1].forEach(function (h) {
      var spot = at(d, fix, h);
      assertNoSchedule(spot, 'no-schedule-yet', 'no-data');
      assert.deepEqual(spot.candidates, []);
    });
  });
});

test('bad-row: a row that cannot be read gives code bad-row, and never side-known', function () {
  // 18th St, Dolores St to Church St, with one north-side (R) row broken.
  var rows = data.rows.slice();
  var broken = null;
  rows = rows.map(function (r) {
    if (r.cnn !== '887000' || r.cnnrightleft !== 'R' || broken) return r;
    broken = JSON.parse(JSON.stringify(r));
    broken.week3 = 'yes';
    return broken;
  });
  var bad = { fetchedAt: fixture.FETCHED_AT, rows: rows };

  // A fix that resolves to the broken side.
  var resolved = at(bad, spots.besideBlock('887000', 9, 'R'), 4);
  assertNoSchedule(resolved, 'no-schedule-here', 'bad-row');
  assert.equal(resolved.candidates[0].code, 'bad-row');

  // A which-side fix: the readable side still reminds, and the spot says a
  // row could not be read.
  var either = at(bad, spots.besideBlock('887000', 40, 'R'), undefined);
  assert.equal(either.kind, 'which-side');
  assert.equal(either.code, 'bad-row');
  assert.deepEqual(either.candidates.map(function (c) { return c.code; }), [null, 'bad-row']);
  assert.equal(either.next.side, 'L');

  // Both sides broken: nothing to remind on.
  var both = JSON.parse(JSON.stringify(rows.filter(function (r) { return r.cnn === '887000'; })));
  both.forEach(function (r) { r.fromhour = 'six'; });
  var none = at({ fetchedAt: fixture.FETCHED_AT, rows: rows.filter(function (r) { return r.cnn !== '887000'; }).concat(both) },
    spots.besideBlock('887000', 40, 'R'), undefined);
  assertNoSchedule(none, 'no-schedule-here', 'bad-row');
});

test('no-fix: a missing or impossible coordinate is spot-unknown with code no-fix, never a schedule', function () {
  [
    {},
    { latitude: 37.76 },
    { longitude: -122.43 },
    { latitude: 'here', longitude: -122.43 },
    { latitude: 91, longitude: -122.43 },
    { latitude: 37.76, longitude: -181 },
  ].forEach(function (fix) {
    var spot = at(data, fix, 5);
    assertNoSchedule(spot, 'spot-unknown', 'no-fix');
    assert.deepEqual(spot.candidates, []);
  });
});

test('bad-query: a spot asked for at no instant is spot-unknown with code bad-query', function () {
  var fix = spots.besideBlock('887000', 9, 'R');
  var spot = sweeping.resolveSpot(data, { latitude: fix.latitude, longitude: fix.longitude, accuracy: 4, now: 'not a date' });
  assertNoSchedule(spot, 'spot-unknown', 'bad-query');
});
