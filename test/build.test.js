'use strict';

// #11 criteria 1 and 2: the build script reads the SODA2 endpoint page by page
// and writes the compact file src/sweeping.js decodes, or fails and writes
// nothing. The endpoint is tools/soda-stub.js; nothing here is fetched live.

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var build = require('../tools/build-data');
var stub = require('../tools/soda-stub');
var fixture = require('../tools/fixture');
var sweeping = require('../src/sweeping');

var NOW = new Date(fixture.FETCHED_AT);
var PAGE = 15000; // 37,878 rows in three pages: 15,000, 15,000 and 7,878

function clock() { return NOW; }

var scratchDirs = [];
function scratch(prefix) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}
test.after(function () {
  scratchDirs.forEach(function (d) { fs.rmSync(d, { recursive: true, force: true }); });
});

// ---------------------------------------------------------------- criterion 1

var full = null;

function fullBuild() {
  if (!full) {
    var endpoint = stub.create(fixture.fullTable());
    full = build.build({ fetch: endpoint.fetch, now: clock, pageSize: PAGE }).then(function (out) {
      return { out: out, requests: endpoint.requests };
    });
  }
  return full;
}

test('build: every row request goes to /resource/yhqp-riqs.json with $limit, $offset and a fixed $order, never to the CSV export', async function () {
  var run = await fullBuild();
  var rowRequests = run.requests.filter(function (u) { return u.searchParams.get('$select') === null; });
  assert.equal(rowRequests.length, 3, 'the stub served the table in three pages');
  run.requests.forEach(function (u) {
    assert.equal(u.protocol, 'https:');
    assert.equal(u.host, 'data.sf.gov');
    assert.equal(u.pathname, '/resource/yhqp-riqs.json');
    assert.ok(!/rows\.csv/.test(u.href), 'a request went to the CSV export: ' + u.href);
    assert.ok(!/\/api\/views\//.test(u.pathname), 'a request went to /api/views/: ' + u.href);
  });
  assert.deepEqual(rowRequests.map(function (u) { return u.searchParams.get('$offset'); }), ['0', '15000', '30000']);
  rowRequests.forEach(function (u) {
    assert.equal(u.searchParams.get('$limit'), String(PAGE));
    assert.equal(u.searchParams.get('$order'), ':id');
  });
});

test('build: the output holds each fixture row exactly once, 37,878 rows keyed by blocksweepid', async function () {
  var run = await fullBuild();
  var file = JSON.parse(run.out.text);
  assert.equal(file.rows.length, 37878);
  assert.equal(file.count, 37878);
  var decoded = sweeping.decodeData(file);
  var seen = {};
  decoded.rows.forEach(function (r) {
    assert.equal(seen[r.blocksweepid], undefined, 'blocksweepid ' + r.blocksweepid + ' appears twice');
    seen[r.blocksweepid] = true;
  });
  fixture.fullTable().forEach(function (r) {
    assert.ok(seen[r.blocksweepid], 'blocksweepid ' + r.blocksweepid + ' is missing');
  });
});

test('build: fetchedAt is the injected time and rowsUpdatedAt is the X-SODA2-Truth-Last-Modified header the stub reports', async function () {
  var run = await fullBuild();
  var file = JSON.parse(run.out.text);
  assert.equal(file.fetchedAt, '2026-10-16T08:58:18.000Z');
  assert.equal(stub.LAST_MODIFIED, 'Thu, 14 May 2026 11:36:29 GMT');
  assert.equal(file.rowsUpdatedAt, '2026-05-14T11:36:29.000Z');
  // The same moment as the metadata's rowsUpdatedAt in research #3, request 1.
  assert.equal(Date.parse(file.rowsUpdatedAt) / 1000, 1778758589);
});

test('build: rowsUpdatedAt follows whatever the header says, and is null when the header is missing', async function () {
  var rows = fixture.fullTable().slice(0, 30);
  var a = await build.build({ fetch: stub.create(rows, { lastModified: 'Wed, 07 Oct 2026 01:02:03 GMT' }).fetch, now: clock, pageSize: 10 });
  assert.equal(JSON.parse(a.text).rowsUpdatedAt, '2026-10-07T01:02:03.000Z');
  var b = await build.build({ fetch: stub.create(rows, { lastModified: null }).fetch, now: clock, pageSize: 10 });
  assert.equal(JSON.parse(b.text).rowsUpdatedAt, null);
});

test('build: fetchedAt changes on every run even when the rows have not', async function () {
  var rows = fixture.fullTable().slice(0, 30);
  var later = new Date(NOW.getTime() + 7 * 24 * 3600000);
  var a = await build.build({ fetch: stub.create(rows).fetch, now: clock, pageSize: 10 });
  var b = await build.build({ fetch: stub.create(rows).fetch, now: function () { return later; }, pageSize: 10 });
  assert.notEqual(JSON.parse(a.text).fetchedAt, JSON.parse(b.text).fetchedAt);
  assert.equal(JSON.parse(b.text).fetchedAt, later.toISOString());
});

test('decodeData: the output decodes to { fetchedAt, rows }, each row equal to its fixture row field for field, line included', async function () {
  var run = await fullBuild();
  var decoded = sweeping.decodeData(JSON.parse(run.out.text));
  assert.deepEqual(Object.keys(decoded).sort(), ['fetchedAt', 'rows']);
  assert.equal(decoded.fetchedAt, '2026-10-16T08:58:18.000Z');
  var want = fixture.fullTable();
  assert.equal(decoded.rows.length, want.length);
  for (var i = 0; i < want.length; i++) {
    // Coordinates are kept exactly as the city sends them: no rounding.
    assert.deepEqual(decoded.rows[i], want[i]);
    assert.equal(JSON.stringify(decoded.rows[i]), JSON.stringify(want[i]), 'row ' + want[i].blocksweepid + ' differs in member order');
  }
  // The rows without a blockside or a line come back without them.
  assert.equal(decoded.rows.filter(function (r) { return !('blockside' in r); }).length, 839);
  assert.equal(decoded.rows.filter(function (r) { return !('line' in r); }).length, 22);
});

test('decodeData: also takes the file as text, as the phone reads it', async function () {
  var run = await fullBuild();
  var a = sweeping.decodeData(run.out.text);
  assert.equal(a.rows.length, 37878);
  assert.deepEqual(a.rows[0], fixture.fullTable()[0]);
});

test('windowsForSide: CNN 8753101 L and R give deep-equal results from the decoded output and from the fixture', async function () {
  var run = await fullBuild();
  var decoded = sweeping.decodeData(JSON.parse(run.out.text));
  var direct = { fetchedAt: fixture.FETCHED_AT, rows: fixture.fullTable() };
  ['L', 'R'].forEach(function (side) {
    var q = { cnn: '8753101', side: side, now: '2026-10-19T04:00:00Z', until: '2026-11-30T08:00:00Z' };
    var fromFile = sweeping.windowsForSide(decoded, q);
    var fromFixture = sweeping.windowsForSide(direct, q);
    assert.equal(fromFixture.status, 'ok');
    assert.ok(fromFixture.windows.length > 0);
    assert.deepEqual(fromFile, fromFixture);
  });
});

test('decodeData: a file whose format version is unknown gives windowsForSide an unknown, never an empty schedule', async function () {
  var run = await fullBuild();
  var file = JSON.parse(run.out.text);
  var q = { cnn: '8753101', side: 'R', now: '2026-10-19T04:00:00Z' };
  [2, '1', 0, null, undefined].forEach(function (format) {
    var other = Object.assign({}, file, { format: format });
    var decoded = sweeping.decodeData(other);
    assert.equal(decoded.rows, null, 'format ' + format + ' decoded to rows');
    var result = sweeping.windowsForSide(decoded, q);
    assert.equal(result.status, 'unknown', 'format ' + format);
    assert.equal(result.windows, null);
  });
  // Nor does anything that is not the file at all.
  ['', 'not json', '<!DOCTYPE html>', null, [], {}].forEach(function (junk) {
    assert.equal(sweeping.windowsForSide(sweeping.decodeData(junk), q).status, 'unknown');
  });
  // Nor a format-1 file with a row that does not fit its fields.
  var broken = Object.assign({}, file, { rows: file.rows.slice(0, 3).concat([['8753101']]) });
  assert.equal(sweeping.windowsForSide(sweeping.decodeData(broken), q).status, 'unknown');
});

// ---------------------------------------------------------------- criterion 2

// A run of main() against a stub, with a previous output already in place.
async function failingRun(options, rows) {
  var dir = scratch('build-');
  var out = path.join(dir, 'sweeping-data.json');
  fs.writeFileSync(out, 'previous file\n');
  var logged = [];
  var code = await build.main([out], {
    fetch: stub.create(rows || fixture.fullTable().slice(0, 2500), options).fetch,
    now: clock,
    pageSize: 1000,
    log: function (line) { logged.push(line); },
  });
  return { code: code, out: out, dir: dir, logged: logged.join('\n') };
}

function assertNothingWritten(run) {
  assert.notEqual(run.code, 0, 'the build exited 0');
  assert.equal(fs.readFileSync(run.out, 'utf8'), 'previous file\n', 'the previous file was changed');
  assert.deepEqual(fs.readdirSync(run.dir), ['sweeping-data.json'], 'the build left a file behind');
}

test('build fails, writing nothing, when a page errors', async function () {
  var run = await failingRun({ errorAt: 1000 });
  assertNothingWritten(run);
  assert.match(run.logged, /offset 1000.*HTTP 500/);
});

test('build fails, writing nothing, when a body is not JSON', async function () {
  var run = await failingRun({ notJsonAt: 2000 });
  assertNothingWritten(run);
  assert.match(run.logged, /offset 2000.*not JSON/);
});

test('build fails, writing nothing, on a short page before the city\'s row count is reached', async function () {
  var run = await failingRun({ shortAt: 1000 });
  assertNothingWritten(run);
  assert.match(run.logged, /short page at offset 1000: 500 rows/);
});

test('build fails, writing nothing, when the total differs from the city\'s count(*)', async function () {
  var fewer = await failingRun({ count: 2499 });
  assertNothingWritten(fewer);
  assert.match(fewer.logged, /2500 rows.*count\(\*\) is 2499/);
  // A count above the rows served ends on a page short of it.
  var more = await failingRun({ count: 2501 });
  assertNothingWritten(more);
  assert.match(more.logged, /count\(\*\) is 2501/);
});

test('build fails, writing nothing, when the table changes while it is being read', async function () {
  var run = await failingRun({
    lastModified: function (url) { return url.searchParams.get('$offset') === '2000' ? 'Fri, 16 Oct 2026 09:00:00 GMT' : stub.LAST_MODIFIED; },
  });
  assertNothingWritten(run);
  assert.match(run.logged, /changed while/);
});

test('build fails, writing nothing, when a row repeats', async function () {
  var rows = fixture.fullTable().slice(0, 2500);
  rows = rows.slice(0, 1999).concat([rows[0]]).concat(rows.slice(2000));
  var run = await failingRun({}, rows);
  assertNothingWritten(run);
  assert.match(run.logged, new RegExp('blocksweepid ' + rows[0].blocksweepid + ' appears twice'));
});

test('build succeeds over the same stub with no failure planted, replacing the previous file', async function () {
  var run = await failingRun({});
  assert.equal(run.code, 0);
  assert.equal(sweeping.decodeData(fs.readFileSync(run.out, 'utf8')).rows.length, 2500);
  assert.deepEqual(fs.readdirSync(run.dir), ['sweeping-data.json']);
});
