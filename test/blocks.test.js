'use strict';

// #6 criterion 3: research 5.3's block rule, at the corner design 5 uses as its
// example: Shrader St and Waller St. Four swept blocks end there:
// Shrader St Haight-Waller (11856000) and Waller-Beulah (11857000), and
// Waller St Cole-Shrader (13379000) and Shrader-Stanyan (13380000).

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');
var spots = require('../tools/spots');

var NOW = '2026-10-19T04:00:00Z'; // Sunday 2026-10-18 21:00 PDT
var data = { fetchedAt: fixture.FETCHED_AT, rows: fixture.fullTable() };
var CORNER_BLOCKS = ['11856000', '11857000', '13379000', '13380000'];

// The vertex the four centrelines share.
var corner = (function () {
  var c = spots.rowsOf('13379000')[0].line.coordinates;
  var end = c[c.length - 1];
  CORNER_BLOCKS.forEach(function (cnn) {
    var line = spots.rowsOf(cnn)[0].line.coordinates;
    var ends = [line[0], line[line.length - 1]].map(String);
    assert.ok(ends.indexOf(String(end)) >= 0, cnn + ' does not end at the corner');
  });
  return { latitude: end[1], longitude: end[0] };
}());

function resolve(fix, h) {
  return sweeping.resolveSpot(data, { latitude: fix.latitude, longitude: fix.longitude, accuracy: h, now: NOW });
}

function candidateKeys(spot) {
  return spot.candidates.map(function (c) { return c.cnn + c.side; }).sort();
}

function bothSidesOf(cnns) {
  var keys = [];
  cnns.forEach(function (cnn) { keys.push(cnn + 'L', cnn + 'R'); });
  return keys.sort();
}

// The earliest window among both sides of every block, worked out here from
// windowsForSide directly rather than read from the spot.
function earliestStart(cnns) {
  var starts = [];
  cnns.forEach(function (cnn) {
    ['L', 'R'].forEach(function (side) {
      var r = sweeping.windowsForSide(data, { cnn: cnn, side: side, now: NOW });
      if (r.windows) r.windows.forEach(function (w) { starts.push(w.start); });
    });
  });
  return starts.sort()[0];
}

test('block rule with h: at the corner, the blocks within h + 10 m give which-block, every side a candidate, next the earliest', function () {
  var fix = spots.move(corner, 45, 4); // 4 m north-east of the corner
  var spot = resolve(fix, 5);
  assert.equal(spot.kind, 'which-block');
  assert.equal(spot.code, null);
  assert.equal(spot.radius, 15);
  assert.equal(spot.cnn, null);
  assert.equal(spot.side, null);
  assert.deepEqual(candidateKeys(spot), bothSidesOf(CORNER_BLOCKS));
  spot.candidates.forEach(function (c) { assert.ok(c.distance <= 15, c.cnn + ' is ' + c.distance + ' m away'); });
  // Waller St's south side, Monday 8-10am: the design's own example.
  assert.equal(earliestStart(CORNER_BLOCKS), '2026-10-19T15:00:00.000Z');
  assert.equal(spot.next.window.start, earliestStart(CORNER_BLOCKS));
  var named = spot.candidates.filter(function (c) { return c.cnn === spot.next.cnn && c.side === spot.next.side; })[0];
  assert.ok(named, 'next names no candidate');
  assert.ok(named.windows.indexOf(spot.next.window) >= 0, 'next is not one of its candidate\'s windows');
  assert.equal(named.corridor, 'Waller St');
});

test('block rule with h: the radius is h + 10 m, not h, so blocks 10-11 m away still count', function () {
  // 3 m off Shrader St (Waller-Beulah), about 10 m along it from the corner,
  // with h 2: the other three blocks are 10-11 m away, beyond h, within h + 10.
  var line = spots.rowsOf('11857000')[0].line.coordinates;
  var fix = spots.offsetFromSegment(line, 0, 0.1, 3, 'L');
  var spot = resolve(fix, 2);
  assert.equal(spot.kind, 'which-block');
  assert.equal(spot.radius, 12);
  assert.deepEqual(candidateKeys(spot), bothSidesOf(CORNER_BLOCKS));
  spot.candidates.forEach(function (c) {
    if (c.cnn !== '11857000') assert.ok(c.distance > 2 + 8 && c.distance <= 12, c.cnn + ' is ' + c.distance + ' m away');
  });
});

test('block rule with h missing: the radius is 60 m, so a fix that one block would hold with h 5 becomes which-block', function () {
  // 5 m off Shrader St (Waller-Beulah), about 32 m along it from the corner:
  // the other three blocks are 31-32 m away, outside h + 10 m for h 5.
  var line = spots.rowsOf('11857000')[0].line.coordinates;
  var fix = spots.offsetFromSegment(line, 0, 0.3, 5, 'L');
  var fromCorner = spots.metresBetween(corner, fix);
  assert.ok(fromCorner > 25 && fromCorner < 40, 'the fix is ' + fromCorner + ' m from the corner');

  var withH = resolve(fix, 5);
  assert.equal(withH.kind, 'which-side');
  assert.equal(withH.cnn, '11857000');

  var spot = resolve(fix, undefined);
  assert.equal(spot.kind, 'which-block');
  assert.equal(spot.accuracy, null);
  assert.equal(spot.radius, 60);
  assert.deepEqual(candidateKeys(spot), bothSidesOf(CORNER_BLOCKS));
  spot.candidates.forEach(function (c) { assert.ok(c.distance <= 60, c.cnn + ' is ' + c.distance + ' m away'); });
  assert.equal(spot.next.window.start, earliestStart(CORNER_BLOCKS));
  assert.equal(spot.next.window.start, '2026-10-19T15:00:00.000Z');
});

test('block rule: two blocks within the radius are enough', function () {
  // 3 m north of where 02nd St's Folsom-Dow and Dow-Harrison blocks meet.
  // Dow Pl is not swept, so only these two blocks are in the table here.
  var line = spots.rowsOf('139000')[0].line.coordinates;
  assert.equal(String(spots.rowsOf('138000')[0].line.coordinates.slice(-1)[0]), String(line[0]));
  var fix = spots.move({ latitude: line[0][1], longitude: line[0][0] }, 0, 3);
  [5, undefined].forEach(function (h) {
    var spot = resolve(fix, h);
    assert.equal(spot.kind, 'which-block', 'h ' + h);
    assert.deepEqual(candidateKeys(spot), bothSidesOf(['138000', '139000']));
    assert.equal(spot.next.window.start, earliestStart(['138000', '139000']));
  });
});
