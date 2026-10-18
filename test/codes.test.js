'use strict';

// #6 criterion 4: every way a result can lack a schedule carries a stable
// `code` beside its `reason`, so #7 maps states by code rather than by
// matching a sentence. Spot-level codes are tested in test/spot-codes.test.js.

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var NOW = Date.parse('2026-10-19T04:00:00Z'); // Sunday 2026-10-18 21:00 PDT
var block = fixture.fullTable().filter(function (r) { return r.cnn === '8753101'; });
var data = { fetchedAt: NOW - DAY, rows: block };

function query(d, q) {
  return sweeping.windowsForSide(d, Object.assign({ cnn: '8753101', side: 'R', now: NOW }, q));
}

test('windowsForSide: a side with no row is unknown with code no-rows, and its reason is unchanged', function () {
  var r = query(data, { cnn: '0000000' });
  assert.equal(r.status, 'unknown');
  assert.equal(r.code, 'no-rows');
  assert.equal(r.reason, 'no sweeping rows for CNN 0000000 side R');
  assert.equal(r.windows, null);
});

test('windowsForSide: no data is unknown with code no-data, and its reason is unchanged', function () {
  [null, undefined, {}, { fetchedAt: NOW, rows: 'x' }].forEach(function (d) {
    var r = query(d, {});
    assert.equal(r.status, 'unknown');
    assert.equal(r.code, 'no-data', JSON.stringify(d));
    assert.equal(r.reason, 'no schedule data');
    assert.equal(r.windows, null);
  });
});

test('windowsForSide: a row that cannot be read is unknown with code bad-row, and its reason is unchanged', function () {
  var bad = JSON.parse(JSON.stringify(block));
  var target = bad.filter(function (r) { return r.cnnrightleft === 'R'; })[0];
  target.fromhour = 'two';
  var r = query({ fetchedAt: NOW, rows: bad }, {});
  assert.equal(r.status, 'unknown');
  assert.equal(r.code, 'bad-row');
  assert.equal(r.reason, 'row ' + target.blocksweepid + ' could not be read');
  assert.equal(r.windows, null);
});

test('windowsForSide: a bad instant or side is unknown with code bad-query, and each reason is unchanged', function () {
  var cases = [
    [{ now: 'not a date' }, 'no evaluation instant'],
    [{ now: undefined }, 'no evaluation instant'],
    [{ until: 'not a date' }, 'until is not an instant'],
    [{ side: 'North' }, 'side must be L or R'],
    [{ side: undefined }, 'side must be L or R'],
  ];
  cases.forEach(function (c) {
    var r = query(data, c[0]);
    assert.equal(r.status, 'unknown', c[1]);
    assert.equal(r.code, 'bad-query', c[1]);
    assert.equal(r.reason, c[1]);
    assert.equal(r.windows, null);
  });
});

test('windowsForSide: ok and stale results carry code null, so no result lacks the field', function () {
  var ok = query(data, {});
  assert.equal(ok.status, 'ok');
  assert.equal(ok.code, null);
  var stale = query({ fetchedAt: NOW - 20 * DAY, rows: block }, {});
  assert.equal(stale.status, 'stale');
  assert.equal(stale.code, null);
});
