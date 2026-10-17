'use strict';

// Criterion 1: the converted fixture. The byte-for-byte re-run needs request 6
// from the data branch, so it is a gate command rather than a test here; see
// test/fixtures/README.md.

var test = require('node:test');
var assert = require('node:assert/strict');
var fixture = require('../tools/fixture');

test('fixture has all 37,878 rows of the table', function () {
  assert.equal(fixture.fullTable().length, 37878);
});

test('fixture rows for CNN 8753101 equal request 5 (SODA2 JSON), field for field', function () {
  var want = fixture.oneBlockBothSides();
  var got = fixture.fullTable().filter(function (r) { return r.cnn === '8753101'; });
  assert.equal(want.length, 13);
  assert.equal(got.length, 13);
  var byId = {};
  got.forEach(function (r) { byId[r.blocksweepid] = r; });
  want.forEach(function (w) {
    var g = byId[w.blocksweepid];
    assert.ok(g, 'fixture is missing blocksweepid ' + w.blocksweepid);
    assert.deepEqual(g, w);
    // Same members in the same order, so the serialised rows match too.
    assert.equal(JSON.stringify(g), JSON.stringify(w));
  });
});

test('fixture rows are in the SODA2 shape: string values, null fields left out, line as GeoJSON', function () {
  var rows = fixture.fullTable();
  rows.forEach(function (r) {
    Object.keys(r).forEach(function (k) {
      if (k === 'line') {
        assert.equal(r.line.type, 'LineString');
        assert.ok(Array.isArray(r.line.coordinates) && r.line.coordinates.length >= 2);
      } else {
        assert.equal(typeof r[k], 'string', k + ' on ' + r.blocksweepid);
        assert.notEqual(r[k], '', k + ' on ' + r.blocksweepid);
      }
    });
  });
  // The research counts 839 rows with no blockside (4.2); SODA2 omits them.
  assert.equal(rows.filter(function (r) { return !('blockside' in r); }).length, 839);
});
