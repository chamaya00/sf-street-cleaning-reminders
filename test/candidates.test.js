'use strict';

// #6 criterion 2: a "which side?" spot carries both candidate sides with their
// wording, and reminds on the earlier side's next window, never the nearer
// side's. Design 5, sections 10, 12 and 16.

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');
var spots = require('../tools/spots');

var DAY = 24 * 3600000;
var NOW = '2026-10-19T04:00:00Z'; // Sunday 2026-10-18 21:00 PDT
// Reaches into 2027, which HOLIDAYS does not hold, so `notes` is not empty.
var UNTIL = '2027-01-15T00:00:00Z';
var data = { fetchedAt: fixture.FETCHED_AT, rows: fixture.fullTable() };

function resolve(d, cnn, metres, side, h) {
  var fix = spots.besideBlock(cnn, metres, side);
  return sweeping.resolveSpot(d, { latitude: fix.latitude, longitude: fix.longitude, accuracy: h, now: NOW, until: UNTIL });
}

// Hester Ave from Lauren Ct to Lois Ln (CNN 6894004): its left side is swept
// on Tuesdays 7-8am and its right side on Thursdays 7-8am, every week. Seen on
// a Sunday evening, the left side is swept first.
var HESTER = '6894004';

test('which-side: the fix is on the later side, and next is the earlier side\'s window, naming that candidate', function () {
  // The same fix with h 2 resolves, so it really is on the right (Thursday) side.
  var precise = resolve(data, HESTER, 6, 'R', 2);
  assert.equal(precise.kind, 'side-known');
  assert.equal(precise.side, 'R');
  assert.equal(precise.next.window.weekday, 'Thu');

  var spot = resolve(data, HESTER, 6, 'R', 11);
  assert.equal(spot.kind, 'which-side');
  assert.equal(spot.code, null);
  assert.equal(spot.cnn, HESTER);
  assert.deepEqual(spot.next && [spot.next.cnn, spot.next.side], [HESTER, 'L']);
  assert.equal(spot.next.window.start, '2026-10-20T14:00:00.000Z'); // Tuesday 7am PDT
  assert.equal(spot.next.window.weekday, 'Tues');
  assert.notEqual(spot.next.side, precise.side, 'a nearest-side guess would remind for Thursday');

  // `next` is the earliest window of every candidate, worked out here from
  // each candidate's own windows rather than trusted.
  var earliest = [];
  spot.candidates.forEach(function (c) { earliest = earliest.concat(c.windows); });
  earliest.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
  assert.deepEqual(spot.next.window, earliest[0]);
});

test('which-side: both candidates carry cnn, side, corridor, limits, blockside and the derived compass from their rows', function () {
  var spot = resolve(data, HESTER, 6, 'R', 11);
  var rows = spots.rowsOf(HESTER);
  assert.equal(spot.candidates.length, 2);
  spot.candidates.forEach(function (c, i) {
    var side = ['L', 'R'][i];
    var own = rows.filter(function (r) { return r.cnnrightleft === side; })[0];
    assert.equal(c.cnn, HESTER);
    assert.equal(c.side, side);
    assert.equal(c.corridor, own.corridor);
    assert.equal(c.limits, own.limits);
    assert.equal(c.blockside, null); // this block has no blockside: "no label"
    assert.equal(c.compassFromMap, true);
    assert.equal(c.sideButtons, true);
    // Each candidate's windows are its own side's, from windowsForSide.
    assert.deepEqual(c.windows, sweeping.windowsForSide(data, { cnn: HESTER, side: side, now: NOW, until: UNTIL }).windows);
  });
  assert.equal(spot.candidates[0].corridor, 'Hester Ave');
  assert.equal(spot.candidates[0].compass, 'East');
  assert.equal(spot.candidates[1].compass, 'West');

  // A block that has blockside carries it beside the derived compass, which
  // agrees with it: 18th St, Dolores St to Church St.
  var named = resolve(data, '887000', 40, 'R', undefined);
  assert.equal(named.kind, 'which-side');
  assert.deepEqual(named.candidates.map(function (c) { return [c.side, c.blockside, c.compass, c.compassFromMap]; }),
    [['L', 'South', 'South', false], ['R', 'North', 'North', false]]);
  assert.deepEqual(named.candidates.map(function (c) { return [c.corridor, c.limits]; }),
    [['18th St', 'Dolores St  -  Church St'], ['18th St', 'Dolores St  -  Church St']]);
});

test('which-side: a truncated limits value from design 10 is passed through verbatim, not repaired', function () {
  var spot = resolve(data, HESTER, 6, 'R', 11);
  spot.candidates.forEach(function (c) { assert.equal(c.limits, 'auren Ct - Lois Ln'); });
  // The next block along names the same cross street whole.
  assert.match(spots.rowsOf('6894003')[0].limits, / - Lauren Ct$/);
});

test('which-side: stale, fetchedAt and notes are the candidates\' windowsForSide values', function () {
  [data, { fetchedAt: Date.parse(NOW) - 20 * DAY, rows: data.rows }].forEach(function (d) {
    var spot = resolve(d, HESTER, 6, 'R', 11);
    var direct = sweeping.windowsForSide(d, { cnn: HESTER, side: 'L', now: NOW, until: UNTIL });
    assert.equal(spot.kind, 'which-side');
    spot.candidates.forEach(function (c) {
      assert.equal(spot.stale, c.stale);
      assert.equal(spot.fetchedAt, c.fetchedAt);
      assert.deepEqual(spot.notes, c.notes);
    });
    assert.equal(spot.stale, direct.stale);
    assert.equal(spot.fetchedAt, direct.fetchedAt);
    assert.deepEqual(spot.notes, direct.notes);
  });
  var fresh = resolve(data, HESTER, 6, 'R', 11);
  assert.equal(fresh.stale, false);
  assert.equal(fresh.fetchedAt, '2026-10-16T08:58:18.000Z');
  assert.deepEqual(fresh.notes, ['holiday list missing for 2027']);
  var old = resolve({ fetchedAt: Date.parse(NOW) - 20 * DAY, rows: data.rows }, HESTER, 6, 'R', 11);
  assert.equal(old.stale, true);
  assert.equal(old.fetchedAt, '2026-09-29T04:00:00.000Z');
});

// 08th Ave from Ortega St to Linares Ave (CNN 402000) is swept on its right
// (West) side only, on the 1st and 3rd Tuesday. Its left side has no row.
var ONE_SIDED = '402000';

test('one-sided block: a which-side fix stays which-side, next comes from the swept side, and the other candidate carries no-rows', function () {
  var rows = spots.rowsOf(ONE_SIDED);
  assert.ok(rows.every(function (r) { return r.cnnrightleft === 'R'; }));
  var spot = resolve(data, ONE_SIDED, 6, 'L', 11);
  assert.equal(spot.kind, 'which-side');
  assert.equal(spot.code, null);
  assert.deepEqual(spot.next && [spot.next.cnn, spot.next.side], [ONE_SIDED, 'R']);
  assert.equal(spot.next.window.start, '2026-10-20T15:00:00.000Z'); // 3rd Tuesday, 8am PDT
  var unswept = spot.candidates.filter(function (c) { return c.side === 'L'; })[0];
  assert.equal(unswept.status, 'unknown');
  assert.equal(unswept.code, 'no-rows');
  assert.equal(unswept.windows, null);
  // Still worded, from the block's other rows and its centreline.
  assert.equal(unswept.corridor, '08th Ave');
  assert.equal(unswept.blockside, null);
  assert.equal(unswept.compass, 'East');
});

test('one-sided block: a fix that resolves to the unswept side is no-schedule-here with code no-rows, never side-known', function () {
  var spot = resolve(data, ONE_SIDED, 10, 'L', 2);
  assert.equal(spot.kind, 'no-schedule-here');
  assert.equal(spot.code, 'no-rows');
  assert.equal(spot.side, 'L');
  assert.equal(spot.next, null);
  assert.deepEqual(spot.candidates.map(function (c) { return [c.side, c.code]; }), [['L', 'no-rows']]);
  // The same fix on the swept side resolves, so the rule, not the place, decides.
  var swept = resolve(data, ONE_SIDED, 10, 'R', 2);
  assert.equal(swept.kind, 'side-known');
  assert.equal(swept.side, 'R');
});
