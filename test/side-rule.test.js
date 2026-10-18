'use strict';

// #6 criterion 1: research 5.3's side and no-fix rules, row by row, on one
// real block. 18th St from Dolores St to Church St (CNN 887000) runs east to
// west along the north edge of Dolores Park, and no other swept centreline
// lies within 60 m of a fix 40 m to either side of its middle, so the block
// rule never fires here and each row tests the side rule alone.

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');
var spots = require('../tools/spots');

var NOW = '2026-10-19T04:00:00Z'; // Sunday 2026-10-18 21:00 PDT
var data = { fetchedAt: fixture.FETCHED_AT, rows: fixture.fullTable() };
var CNN = '887000';

// A fix `d` metres from the block's centreline, on side `side`, with accuracy
// `h` (left out of the query when undefined).
function resolve(h, d, side) {
  var fix = spots.besideBlock(CNN, d, side);
  var query = { latitude: fix.latitude, longitude: fix.longitude, now: NOW };
  if (h !== undefined) query.accuracy = h;
  var spot = sweeping.resolveSpot(data, query);
  return { spot: spot, fix: fix };
}

// The fix really is d from this block and no other block is in play, so the
// row tests the threshold and not the placement.
function assertOneBlockAt(spot, d) {
  assert.equal(spot.cnn, CNN);
  assert.ok(Math.abs(spot.distance - d) < 0.01, 'd is ' + spot.distance + ', not ' + d);
}

function assertWhichSide(spot, d) {
  assert.equal(spot.kind, 'which-side');
  assert.equal(spot.side, null);
  assertOneBlockAt(spot, d);
  assert.deepEqual(spot.candidates.map(function (c) { return c.cnn + c.side; }), [CNN + 'L', CNN + 'R']);
}

test('side rule: h 4, d 9 resolves to the side the fix is on, on both sides of the block', function () {
  var middle = spots.rowsOf(CNN)[0].line.coordinates;
  var midLat = (middle[0][1] + middle[middle.length - 1][1]) / 2;
  [['R', 'North'], ['L', 'South']].forEach(function (c) {
    var r = resolve(4, 9, c[0]);
    assert.equal(r.spot.kind, 'side-known', c[1]);
    assert.equal(r.spot.code, null);
    assertOneBlockAt(r.spot, 9);
    assert.equal(r.spot.side, c[0]);
    assert.equal(r.spot.candidates.length, 1);
    assert.equal(r.spot.candidates[0].side, c[0]);
    // Tied to the ground by the city's own label and the raw latitude, not by
    // the module's left-right convention: the north fix is on the North side.
    assert.equal(r.spot.candidates[0].blockside, c[1]);
    assert.equal(r.fix.latitude > midLat, c[1] === 'North');
  });
});

test('side rule: h 4, d 7.9 is which-side (needs d >= 8)', function () {
  assertWhichSide(resolve(4, 7.9, 'R').spot, 7.9);
});

// A fix that precise, that far from every centreline, is not on this block:
// the likeliest reason is a swept block the table has no `line` for. So the
// side resolves only within the block radius h + 10 m.
test('side rule: h 4, d 25 is which-side (needs d <= h + 10 = 14)', function () {
  assertWhichSide(resolve(4, 25, 'R').spot, 25);
  assertWhichSide(resolve(4, 14.1, 'R').spot, 14.1);
  var edge = resolve(4, 13.9, 'R').spot;
  assert.equal(edge.kind, 'side-known');
  assert.equal(edge.side, 'R');
  assertOneBlockAt(edge, 13.9);
});

test('side rule: h 1, d 2.9 is which-side (needs d >= 3)', function () {
  assertWhichSide(resolve(1, 2.9, 'R').spot, 2.9);
});

test('side rule: h 11, d 40 is which-side (needs h <= 10)', function () {
  assertWhichSide(resolve(11, 40, 'R').spot, 40);
});

test('side rule: missing accuracy, d 40 is which-side, however it is missing', function () {
  [undefined, null, NaN, '', 'unknown'].forEach(function (h) {
    var fix = spots.besideBlock(CNN, 40, 'R');
    var query = { latitude: fix.latitude, longitude: fix.longitude, now: NOW };
    if (h !== undefined) query.accuracy = h;
    var spot = sweeping.resolveSpot(data, query);
    assertWhichSide(spot, 40);
    assert.equal(spot.accuracy, null, String(h));
    assert.equal(spot.radius, 60);
  });
});

test('no-fix rule: h -1 is spot-unknown, even where h 4 would resolve', function () {
  var spot = resolve(-1, 9, 'R').spot;
  assert.equal(spot.kind, 'spot-unknown');
  assert.equal(spot.code, 'no-fix');
  assert.deepEqual(spot.candidates, []);
  assert.equal(spot.next, null);
});

test('no-fix rule: h 60 is spot-unknown, at any distance', function () {
  [9, 40].forEach(function (d) {
    var spot = resolve(60, d, 'R').spot;
    assert.equal(spot.kind, 'spot-unknown', 'd ' + d);
    assert.equal(spot.code, 'no-fix');
    assert.deepEqual(spot.candidates, []);
    assert.equal(spot.next, null);
  });
});
