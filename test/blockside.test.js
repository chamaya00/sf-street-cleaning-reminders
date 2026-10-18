'use strict';

// #6 criterion 5: the side derived from each centreline, checked against the
// city's own `blockside` over the whole table (research 5.2, design 10), and
// what a block whose two disagree, or whose geometry is missing, may do.

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

// The table with one block's rows replaced.
function withBlock(cnn, change) {
  var rows = data.rows.map(function (r) {
    if (r.cnn !== cnn) return r;
    var copy = JSON.parse(JSON.stringify(r));
    change(copy);
    return copy;
  });
  return { fetchedAt: data.fetchedAt, rows: rows };
}

test('blockside: over the whole fixture, 37,009 rows agree, 8 disagree and 22 have no usable geometry', function () {
  var counts = { agree: 0, disagree: 0, 'no-geometry': 0, 'no-label': 0 };
  var disagreeing = [];
  data.rows.forEach(function (r) {
    var verdict = sweeping.blocksideCheck(r);
    counts[verdict] += 1;
    if (verdict === 'disagree') disagreeing.push(r.cnn + ' ' + r.cnnrightleft + ' ' + r.blockside);
  });
  var labelled = data.rows.filter(function (r) { return r.blockside != null; }).length;
  assert.equal(labelled, 37878 - 839);
  assert.deepEqual(counts, { agree: 37009, disagree: 8, 'no-geometry': 22, 'no-label': 839 });
  assert.equal(counts.agree + counts.disagree + counts['no-geometry'], labelled);
  // Five blocks: Nahua Ave (two), Jerrold Ave (two, one row each) and Chenery St.
  assert.deepEqual(disagreeing.sort(), [
    '3933000 L South', '3933000 R North',
    '7500102 L SouthWest', '7500201 R NorthEast',
    '9483000 L NorthWest', '9483000 R SouthEast',
    '9484000 L West', '9484000 R East',
  ]);
  // Why 37,017 and not 37,039: every row with no usable geometry is a row the
  // table gives no `line` at all.
  var noLine = data.rows.filter(function (r) { return !r.line; });
  assert.equal(noLine.length, 22);
  assert.ok(noLine.every(function (r) { return r.blockside != null && sweeping.blocksideCheck(r) === 'no-geometry'; }));
});

test('blockside: a block with a disagreeing row never resolves a side, and its candidates carry sideButtons false', function () {
  // Chenery St, urrey St to Elk St (CNN 3933000): both rows point the wrong way.
  ['L', 'R'].forEach(function (side) {
    var fix = spots.besideBlock('3933000', 10, side);
    var spot = at(data, fix, 2); // h 2, d 10: the side rule alone would resolve
    assert.equal(spot.kind, 'which-side', side);
    assert.equal(spot.cnn, '3933000');
    assert.equal(spot.candidates.length, 2);
    spot.candidates.forEach(function (c) { assert.equal(c.sideButtons, false); });

    // With the city's labels swapped to agree, the same fix resolves.
    var agreeing = withBlock('3933000', function (r) { r.blockside = r.blockside === 'North' ? 'South' : 'North'; });
    var fixed = at(agreeing, fix, 2);
    assert.equal(fixed.kind, 'side-known', side);
    assert.equal(fixed.side, side);
    assert.equal(fixed.candidates[0].sideButtons, true);
  });
});

test('blockside: a block whose geometry is missing on any row never resolves a side, and its candidates carry sideButtons false', function () {
  // 18th St, Dolores St to Church St, where h 4, d 9 resolves (criterion 1).
  var fix = spots.besideBlock('887000', 9, 'R');
  assert.equal(at(data, fix, 4).kind, 'side-known');

  var first = true;
  var gap = withBlock('887000', function (r) { if (first) { delete r.line; first = false; } });
  var spot = at(gap, fix, 4);
  assert.equal(spot.kind, 'which-side');
  spot.candidates.forEach(function (c) { assert.equal(c.sideButtons, false); });

  // A centreline whose ends meet has no direction, so no derived side.
  var loop = withBlock('887000', function (r) {
    var c = r.line.coordinates;
    c.push(c[0].slice());
  });
  var looped = at(loop, fix, 4);
  assert.equal(looped.kind, 'which-side');
  looped.candidates.forEach(function (c) {
    assert.equal(c.sideButtons, false);
    assert.equal(c.compass, null);
  });
});

test('blockside: every candidate carries a derived compass, from the map where blockside is null', function () {
  // Hester Ave, Lauren Ct to Lois Ln: no blockside on either side.
  var spot = at(data, spots.besideBlock('6894004', 6, 'R'), 11);
  assert.deepEqual(spot.candidates.map(function (c) { return [c.blockside, c.compass, c.compassFromMap]; }),
    [[null, 'East', true], [null, 'West', true]]);
});
