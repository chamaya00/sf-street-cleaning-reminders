'use strict';

// Criterion 4: the holiday rule from research 4.4, against the module's own
// holiday table.
//
// | Date       | Holiday                | Nightly (00-06) | Daytime (06-14) |
// | 2026-11-11 | Veterans Day           | enforced        | not enforced    |
// | 2026-11-26 | Thanksgiving           | not enforced    | not enforced    |
// | 2026-11-27 | Day after Thanksgiving | enforced        | not enforced    |
// | 2026-12-25 | Christmas              | not enforced    | not enforced    |

var test = require('node:test');
var assert = require('node:assert/strict');
var sweeping = require('../src/sweeping');
var fixture = require('../tools/fixture');

var TABLE_DATES = ['2026-11-11', '2026-11-26', '2026-11-27', '2026-12-25'];

// The windows a side has on one local date: from 00:00 to 24:00 Pacific.
// All four dates are in standard time except 2026-11-11, which is too.
function onDate(rows, cnn, side, date) {
  var midnight = Date.parse(date + 'T08:00:00Z'); // 00:00 PST
  var result = sweeping.windowsForSide(
    { fetchedAt: new Date(midnight - 86400000).toISOString(), rows: rows },
    { cnn: cnn, side: side, now: midnight, until: midnight + 86400000 }
  );
  assert.notEqual(result.status, 'unknown', result.reason);
  return result;
}

function hours(result) {
  return result.windows.map(function (w) { return [w.fromHour, w.toHour]; });
}

var block = fixture.fullTable().filter(function (r) { return r.cnn === '8753101'; });

test('the holiday table holds the four remaining 2026 dates, with their bands and provenance', function () {
  var y = sweeping.HOLIDAYS[2026];
  assert.ok(y, 'no 2026 entry');
  assert.match(y.provenance, /\[V-x\]/);
  assert.deepEqual(y.dates['2026-11-11'], { name: 'Veterans Day', nightly: true, daytime: false });
  assert.deepEqual(y.dates['2026-11-26'], { name: 'Thanksgiving', nightly: false, daytime: false });
  assert.deepEqual(y.dates['2026-11-27'], { name: 'Day after Thanksgiving', nightly: true, daytime: false });
  assert.deepEqual(y.dates['2026-12-25'], { name: 'Christmas', nightly: false, daytime: false });
});

test('a regular-weekday row with holidays 0 is skipped only when its whole window lies inside an unenforced band', function () {
  // 8753101 R, Wed 02:00-06:00: nightly is enforced on Veterans Day, so it is returned.
  var vet = onDate(block, '8753101', 'R', '2026-11-11');
  assert.deepEqual(hours(vet), [[2, 6]]);
  assert.equal(vet.windows[0].holiday, 'Veterans Day');

  // 8753101 R, Thu 02:00-06:00: nightly is not enforced on Thanksgiving, so it is skipped.
  assert.deepEqual(hours(onDate(block, '8753101', 'R', '2026-11-26')), []);

  // Real row 1646382, 20th St, Wed 08:00-10:00, holidays 0: inside the daytime
  // band, which is not enforced on Veterans Day, so it is skipped...
  var day = fixture.row('1646382');
  assert.deepEqual(hours(onDate([day], day.cnn, day.cnnrightleft, '2026-11-11')), []);
  // ...and on an ordinary Wednesday it is returned.
  assert.deepEqual(hours(onDate([day], day.cnn, day.cnnrightleft, '2026-11-18')), [[8, 10]]);

  // Real row 1626382, Mission St, Thu 05:00-07:00, holidays 0: crosses 06:00,
  // so it is not skipped, even on Thanksgiving when neither band is enforced.
  var cross6 = fixture.row('1626382');
  assert.deepEqual(hours(onDate([cross6], cross6.cnn, cross6.cnnrightleft, '2026-11-26')), [[5, 7]]);

  // Real row 1612385, 46th Ave, Fri 2nd & 4th 13:00-15:00, holidays 0: crosses
  // 14:00, so it is not skipped on the day after Thanksgiving (the 4th Friday).
  var cross14 = fixture.row('1612385');
  assert.deepEqual(hours(onDate([cross14], cross14.cnn, cross14.cnnrightleft, '2026-11-27')), [[13, 15]]);

  // Synthetic: no real row starts at 14:00 or later. A copy of 1626382 moved to
  // 14:00-16:00 lies outside both bands, so it is not skipped on Thanksgiving.
  var outside = JSON.parse(JSON.stringify(cross6));
  outside.fromhour = '14';
  outside.tohour = '16';
  assert.deepEqual(hours(onDate([outside], outside.cnn, outside.cnnrightleft, '2026-11-26')), [[14, 16]]);
});

// Every fixture row whose weekday and week flag match a date: the windows it
// should give on that date, grouped by block side.
function matchingRows(date, predicate) {
  var d = new Date(date + 'T12:00:00Z');
  var weekday = ['Sun', 'Mon', 'Tues', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  var week = Math.ceil(d.getUTCDate() / 7);
  return fixture.fullTable().filter(function (r) {
    return r.weekday === weekday && r['week' + week] === '1' && predicate(r);
  });
}

function bySide(rows) {
  var groups = {};
  rows.forEach(function (r) {
    var k = r.cnn + '|' + r.cnnrightleft;
    (groups[k] = groups[k] || []).push(r);
  });
  return groups;
}

test('a row with holidays 1 is never skipped', function () {
  // Real row 1618904, Mission St, Thu 02:00-06:00, holidays 1, on Thanksgiving,
  // when nightly sweeping is not enforced.
  var row = fixture.row('1618904');
  assert.deepEqual(hours(onDate([row], row.cnn, row.cnnrightleft, '2026-11-26')), [[2, 6]]);

  // And every holidays-1 row in the table, on every date in the holiday table.
  var checked = 0;
  TABLE_DATES.forEach(function (date) {
    var rows = matchingRows(date, function (r) { return r.holidays === '1'; });
    rows.forEach(function (r) {
      var got = hours(onDate([r], r.cnn, r.cnnrightleft, date));
      assert.deepEqual(got, [[Number(r.fromhour), Number(r.tohour)]], 'row ' + r.blocksweepid + ' on ' + date);
      checked++;
    });
  });
  // Counted from the fixture: so the loop above cannot pass by checking nothing.
  assert.equal(checked, 967);
});

test('a Holiday weekday row applies on every date in the table, whatever its holidays flag', function () {
  // 8753101 L: HOLIDAY 05:00-07:00 on Thanksgiving. Its Thu 05:00-06:00 row
  // (holidays 0, nightly band, not enforced) is skipped.
  var thanks = onDate(block, '8753101', 'L', '2026-11-26');
  assert.deepEqual(hours(thanks), [[5, 7]]);
  assert.equal(thanks.windows[0].weekday, 'Holiday');
  assert.equal(thanks.windows[0].holiday, 'Thanksgiving');

  // Real row 1614305, 06th St: HOLIDAY 04:00-06:00 with holidays 0, one of the 287.
  var zero = fixture.row('1614305');
  assert.equal(zero.weekday, 'Holiday');
  assert.equal(zero.holidays, '0');
  TABLE_DATES.forEach(function (date) {
    assert.deepEqual(hours(onDate([zero], zero.cnn, zero.cnnrightleft, date)), [[4, 6]], date);
  });

  // Every Holiday row in the table, on every date in the holiday table.
  var holidayRows = fixture.fullTable().filter(function (r) { return r.weekday === 'Holiday'; });
  assert.equal(holidayRows.length, 824);
  assert.equal(holidayRows.filter(function (r) { return r.holidays === '0'; }).length, 287);
  TABLE_DATES.forEach(function (date) {
    holidayRows.forEach(function (r) {
      assert.deepEqual(hours(onDate([r], r.cnn, r.cnnrightleft, date)), [[Number(r.fromhour), Number(r.tohour)]], r.blocksweepid + ' on ' + date);
    });
  });

  // And never on a date that is not in the table.
  assert.deepEqual(hours(onDate([zero], zero.cnn, zero.cnnrightleft, '2026-11-25')), []);
});

test('a date in a year the table does not hold is a normal sweeping day, and says "holiday list missing for <year>"', function () {
  assert.equal(sweeping.HOLIDAYS[2027], undefined, 'the table now holds 2027: move this test to a year it does not hold');
  // 2027-01-01, New Year's Day, a Friday. 8753101 R, Fri 02:00-06:00, holidays 0,
  // would be skipped if the day were known to be a holiday. It is returned.
  var r = onDate(block, '8753101', 'R', '2027-01-01');
  assert.deepEqual(hours(r), [[2, 6]]);
  assert.ok(r.notes.indexOf('holiday list missing for 2027') >= 0, JSON.stringify(r.notes));

  // A date in a year the table holds carries no such note.
  var held = onDate(block, '8753101', 'R', '2026-12-24');
  assert.deepEqual(held.notes, []);
});
