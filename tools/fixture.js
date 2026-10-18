// Loads the committed fixtures for the tests. Lives outside test/ because
// `node --test` runs every .js file under a directory named test.

'use strict';

var fs = require('fs');
var path = require('path');

var dir = path.join(__dirname, '..', 'test', 'fixtures');

// The moment request 6 was fetched (test/fixtures/README.md).
var FETCHED_AT = '2026-10-16T08:58:18Z';

var cached = null;

function fullTable() {
  if (!cached) cached = JSON.parse(fs.readFileSync(path.join(dir, 'yhqp-riqs.soda2.json'), 'utf8'));
  return cached;
}

function oneBlockBothSides() {
  return JSON.parse(fs.readFileSync(path.join(dir, '5-one-block-both-sides.body'), 'utf8'));
}

function row(blocksweepid) {
  var found = fullTable().filter(function (r) { return r.blocksweepid === blocksweepid; });
  if (found.length !== 1) throw new Error('expected one fixture row with blocksweepid ' + blocksweepid + ', found ' + found.length);
  return found[0];
}

module.exports = { FETCHED_AT: FETCHED_AT, fullTable: fullTable, oneBlockBothSides: oneBlockBothSides, row: row, dir: dir };
