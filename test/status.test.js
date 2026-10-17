'use strict';

// Criterion 5: unknown and stale results, and their shapes.

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var NOW = Date.parse('2026-10-19T04:00:00Z'); // Sunday 2026-10-18 21:00 PDT
var block = fixture.fullTable().filter(function (r) { return r.cnn === '8753101'; });

function query(data, cnn, side, until) {
  return sweeping.windowsForSide(data, { cnn: cnn, side: side, now: NOW, until: until });
}

// Nothing in a result may read as "no cleaning soon" unless its status is ok.
function assertNotReadableAsClear(result) {
  assert.notEqual(result.status, 'ok');
  if (result.status === 'unknown') {
    assert.equal(result.windows, null, 'an unknown result must not carry a list a caller could find empty');
    assert.equal(typeof result.reason, 'string');
  } else {
    assert.equal(result.status, 'stale');
    assert.equal(result.stale, true);
  }
}

test('a CNN with no row returns an explicit unknown', function () {
  var r = query({ fetchedAt: NOW - DAY, rows: fixture.fullTable() }, '0000000', 'L');
  assert.equal(r.status, 'unknown');
  assertNotReadableAsClear(r);
});

test('a side with no row returns unknown even when the other side has rows', function () {
  // Real CNN 2184101, Alemany Blvd: the table has L rows and no R rows.
  var rows = fixture.fullTable().filter(function (r) { return r.cnn === '2184101'; });
  assert.ok(rows.length > 0);
  assert.ok(rows.every(function (r) { return r.cnnrightleft === 'L'; }));
  var r = query({ fetchedAt: NOW - DAY, rows: rows }, '2184101', 'R');
  assert.equal(r.status, 'unknown');
  assertNotReadableAsClear(r);
  assert.equal(query({ fetchedAt: NOW - DAY, rows: rows }, '2184101', 'L').status, 'ok');
});

test('fetchedAt 13 days 23 hours before the evaluation instant is not stale', function () {
  var fetchedAt = new Date(NOW - (13 * DAY + 23 * HOUR)).toISOString();
  var r = query({ fetchedAt: fetchedAt, rows: block }, '8753101', 'R');
  assert.equal(r.status, 'ok');
  assert.equal(r.stale, false);
  assert.ok(r.windows.length > 0);
  r.windows.forEach(function (w) {
    assert.equal(w.stale, false);
    assert.equal(w.fetchedAt, fetchedAt);
  });
});

test('fetchedAt 14 days 1 hour before the evaluation instant is stale, on every window', function () {
  var fetchedAt = new Date(NOW - (14 * DAY + HOUR)).toISOString();
  var r = query({ fetchedAt: fetchedAt, rows: block }, '8753101', 'R');
  assert.equal(r.status, 'stale');
  assert.equal(r.fetchedAt, fetchedAt);
  assert.ok(r.windows.length > 0);
  r.windows.forEach(function (w) {
    assert.equal(w.stale, true);
    assert.equal(w.fetchedAt, fetchedAt); // 2026-10-04T03:00:00.000Z
  });
  assertNotReadableAsClear(r);
});

test('a missing fetchedAt is stale, on every window', function () {
  [undefined, null, '', 'not a date'].forEach(function (fetchedAt) {
    var r = query({ fetchedAt: fetchedAt, rows: block }, '8753101', 'R');
    assert.equal(r.status, 'stale', String(fetchedAt));
    assert.equal(r.fetchedAt, null);
    assert.ok(r.windows.length > 0);
    r.windows.forEach(function (w) {
      assert.equal(w.stale, true);
      assert.equal(w.fetchedAt, null);
    });
  });
});

test('no unknown or stale result has a shape a caller could read as "no cleaning soon"', function () {
  // Stale, with no window in range (one hour ahead): the status still says stale.
  var empty = query({ fetchedAt: NOW - 20 * DAY, rows: block }, '8753101', 'R', NOW + HOUR);
  assert.deepEqual(empty.windows, []);
  assertNotReadableAsClear(empty);

  // Unknown on stale data: unknown wins, and it still says stale.
  var both = query({ rows: [] }, '8753101', 'R');
  assertNotReadableAsClear(both);
  assert.equal(both.status, 'unknown');
  assert.equal(both.stale, true);

  // No data at all, rows that are not an array, a side that is neither L nor R.
  assertNotReadableAsClear(query(null, '8753101', 'R'));
  assertNotReadableAsClear(query({ fetchedAt: NOW, rows: 'x' }, '8753101', 'R'));
  assertNotReadableAsClear(query({ fetchedAt: NOW, rows: block }, '8753101', 'North'));

  // A row the module cannot read makes its whole side unknown, rather than
  // quietly dropping one of its windows.
  var bad = JSON.parse(JSON.stringify(block));
  bad.filter(function (r) { return r.cnnrightleft === 'R'; })[0].fromhour = 'two';
  var r = query({ fetchedAt: NOW, rows: bad }, '8753101', 'R');
  assertNotReadableAsClear(r);
  assert.match(r.reason, /could not be read/);

  // An ok result with no window in range is the one empty list allowed, and its
  // status says ok, so it is the only thing a caller may read as clear.
  var clear = query({ fetchedAt: NOW, rows: block }, '8753101', 'R', NOW + HOUR);
  assert.equal(clear.status, 'ok');
  assert.deepEqual(clear.windows, []);
});
