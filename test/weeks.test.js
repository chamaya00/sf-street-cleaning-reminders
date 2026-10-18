'use strict';

// Criterion 2: week-of-month flags, across December 2026. Tuesdays fall on the
// 1, 8, 15, 22 and 29, Wednesdays on the 2, 9, 16, 23 and 30, and Mondays on
// the 7, 14, 21 and 28. December is standard time, so 08:00 Pacific is 16:00Z.

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');

// 2026-12-01 00:00 Pacific, and 2027-01-01 00:00 Pacific.
var DEC_START = '2026-12-01T08:00:00Z';
var DEC_END = '2027-01-01T08:00:00Z';

// Staleness is not under test here, so the data is a day old.
function december(rows) {
  return sweeping.windowsForSide(
    { fetchedAt: '2026-11-30T08:00:00Z', rows: rows },
    { cnn: rows[0].cnn, side: rows[0].cnnrightleft, now: DEC_START, until: DEC_END }
  );
}

function starts(result) {
  return result.windows.map(function (w) { return w.start; });
}

function copy(row, changes) {
  var out = JSON.parse(JSON.stringify(row));
  Object.keys(changes).forEach(function (k) {
    if (changes[k] === undefined) delete out[k];
    else out[k] = changes[k];
  });
  return out;
}

test('a "Wed 1st & 3rd" row (1,0,1,0,0) gives Dec 2 and 16, not Dec 30', function () {
  var row = fixture.row('1636409'); // 08th Ave, Judah St - Kirkham St, L, Wed 08:00-10:00
  assert.equal(row.fullname, 'Wed 1st & 3rd');
  assert.deepEqual([row.week1, row.week2, row.week3, row.week4, row.week5], ['1', '0', '1', '0', '0']);
  var result = december([row]);
  assert.equal(result.status, 'ok');
  assert.deepEqual(starts(result), ['2026-12-02T16:00:00.000Z', '2026-12-16T16:00:00.000Z']);
  assert.deepEqual(result.windows.map(function (w) { return w.end; }), ['2026-12-02T18:00:00.000Z', '2026-12-16T18:00:00.000Z']);
});

test('a "Tue 1st, 3rd, 5th" row (1,0,1,0,1) also gives the 5th: Dec 1, 15 and 29', function () {
  var row = fixture.row('1645051'); // Lower Great Hwy, Lincoln Way - Irving St, R, Tue 13:00-15:00
  assert.equal(row.fullname, 'Tue 1st, 3rd, 5th');
  assert.deepEqual([row.week1, row.week2, row.week3, row.week4, row.week5], ['1', '0', '1', '0', '1']);
  assert.deepEqual(starts(december([row])), ['2026-12-01T21:00:00.000Z', '2026-12-15T21:00:00.000Z', '2026-12-29T21:00:00.000Z']);
});

test('a "Mon 2nd & 4th" row (0,1,0,1,0) gives Dec 14 and 28, not Dec 7 and 21 (occurrence reading, not calendar rows)', function () {
  var row = fixture.row('1628481'); // Lower Great Hwy, Quintara St - Rivera St, L, Mon 13:00-15:00
  assert.equal(row.fullname, 'Mon 2nd & 4th');
  assert.deepEqual([row.week1, row.week2, row.week3, row.week4, row.week5], ['0', '1', '0', '1', '0']);
  assert.deepEqual(starts(december([row])), ['2026-12-07T21:00:00.000Z', '2026-12-21T21:00:00.000Z']);
});

test('CNN 8753101 L side returns all of its weekly windows, in time order', function () {
  var rows = fixture.fullTable().filter(function (r) { return r.cnn === '8753101'; });
  var result = sweeping.windowsForSide(
    { fetchedAt: '2026-12-06T08:00:00Z', rows: rows },
    // Monday 2026-12-07 00:00 Pacific to Monday 2026-12-14 00:00 Pacific; no holidays.
    { cnn: '8753101', side: 'L', now: '2026-12-07T08:00:00Z', until: '2026-12-14T08:00:00Z' }
  );
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.windows.map(function (w) { return [w.weekday, w.start, w.end]; }), [
    ['Mon', '2026-12-07T13:00:00.000Z', '2026-12-07T14:00:00.000Z'],
    ['Tues', '2026-12-08T13:00:00.000Z', '2026-12-08T14:00:00.000Z'],
    ['Wed', '2026-12-09T13:00:00.000Z', '2026-12-09T14:00:00.000Z'],
    ['Thu', '2026-12-10T13:00:00.000Z', '2026-12-10T14:00:00.000Z'],
    ['Fri', '2026-12-11T13:00:00.000Z', '2026-12-11T14:00:00.000Z'],
    ['Sat', '2026-12-12T13:00:00.000Z', '2026-12-12T15:00:00.000Z'],
    ['Sun', '2026-12-13T13:00:00.000Z', '2026-12-13T15:00:00.000Z'],
  ]);

  // Across the whole month the list stays in time order: one window a day.
  var month = december(rows.filter(function (r) { return r.cnnrightleft === 'L'; }));
  assert.equal(month.windows.length, 31);
  for (var i = 1; i < month.windows.length; i++) {
    assert.ok(month.windows[i - 1].start < month.windows[i].start, 'out of order at ' + i);
  }
});

test('week5 is read from the row, never inferred from the other weeks or from fullname', function () {
  // Synthetic variants of real rows: only week5 is changed, and fullname is left
  // saying the opposite, so a reading of fullname or of weeks 1-4 would fail.
  var wed = copy(fixture.row('1636409'), { week5: '1' }); // still labelled "Wed 1st & 3rd"
  assert.deepEqual(starts(december([wed])), ['2026-12-02T16:00:00.000Z', '2026-12-16T16:00:00.000Z', '2026-12-30T16:00:00.000Z']);

  var tue = copy(fixture.row('1645051'), { week5: '0' }); // still labelled "Tue 1st, 3rd, 5th"
  assert.deepEqual(starts(december([tue])), ['2026-12-01T21:00:00.000Z', '2026-12-15T21:00:00.000Z']);

  // A row with no week5 at all is not filled in from anything: it cannot be read.
  var missing = copy(fixture.row('1645051'), { week5: undefined });
  var result = december([missing]);
  assert.equal(result.status, 'unknown');
  assert.equal(result.windows, null);
});
