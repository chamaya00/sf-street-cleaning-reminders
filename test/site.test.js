'use strict';

// #11 criterion 3: the site the workflow publishes. The publish commands in
// tools/publish.js - the strings the workflow runs - run here as written, in a
// scratch directory, with fetch answering from the fixture through
// tools/soda-stub-preload.js. What the gate still does not run: the live fetch
// from the city, and the upload to Pages.

var test = require('node:test');
var assert = require('node:assert/strict');
var childProcess = require('child_process');
var crypto = require('crypto');
var fs = require('fs');
var os = require('os');
var path = require('path');
var publish = require('../tools/publish');
var site = require('../tools/assemble-site');
var fixture = require('../tools/fixture');
var sweeping = require('../src/sweeping');

var root = path.join(__dirname, '..');
var FIXTURE = path.join(fixture.dir, 'yhqp-riqs.soda2.json');

function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

var scratchDirs = [];
function scratch(prefix) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}
test.after(function () {
  scratchDirs.forEach(function (d) { fs.rmSync(d, { recursive: true, force: true }); });
});

// Every file under `dir`, as paths relative to it.
function walk(dir) {
  var out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    var p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p).forEach(function (q) { out.push(path.join(d.name, q)); });
    else out.push(d.name);
  });
  return out.sort();
}

var published = null;

// Runs the publish commands once, as the workflow does, and returns where.
function publishOnce() {
  if (published) return published;
  var work = scratch('publish-');
  fs.symlinkSync(path.join(root, 'tools'), path.join(work, 'tools'));
  var log = path.join(work, 'requests.log');
  var env = Object.assign({}, process.env, {
    NODE_OPTIONS: '--require ' + path.join(root, 'tools', 'soda-stub-preload.js'),
    SODA_STUB_ROWS: FIXTURE,
    SODA_STUB_LOG: log,
  });
  var started = Date.now();
  var output = publish.COMMANDS.map(function (cmd) {
    return childProcess.execFileSync('bash', ['-e', '-c', cmd], { cwd: work, env: env, encoding: 'utf8', stdio: 'pipe' });
  });
  published = {
    work: work,
    site: path.join(work, publish.SITE_DIR),
    data: path.join(work, '_data', 'sweeping-data.json'),
    requests: fs.readFileSync(log, 'utf8').trim().split('\n').map(function (u) { return new URL(u); }),
    started: started,
    finished: Date.now(),
    output: output,
  };
  return published;
}

// The files the site must hold, by site name, and the repository file each
// must be identical to. Worked out here from the layout ADR 0002 names, not
// from tools/assemble-site.js's own plan.
function expectedSources(dataFile) {
  var want = { 'sweeping-data.json': dataFile, 'sweeping.js': path.join(root, 'src', 'sweeping.js') };
  fs.readdirSync(path.join(root, 'scriptable')).forEach(function (n) { want[n] = path.join(root, 'scriptable', n); });
  return want;
}

// Throws unless `siteDir` holds exactly the expected files plus the manifest,
// each sha256-identical to its source, and the manifest describes each one.
function assertSiteMatchesSources(siteDir, dataFile) {
  var want = expectedSources(dataFile);
  var names = Object.keys(want).sort();
  assert.deepEqual(walk(siteDir), names.concat(['manifest.json']).sort(), 'the site holds other files than expected');
  names.forEach(function (n) {
    assert.equal(sha256(path.join(siteDir, n)), sha256(want[n]), n + ' in the site is not identical to ' + path.relative(root, want[n]));
  });
  var manifest = JSON.parse(fs.readFileSync(path.join(siteDir, 'manifest.json'), 'utf8'));
  assert.equal(typeof manifest.version, 'string');
  assert.ok(manifest.version.length > 0);
  assert.deepEqual(manifest.files.map(function (f) { return f.path; }).sort(), names);
  manifest.files.forEach(function (f) {
    var file = path.join(siteDir, f.path);
    assert.equal(f.bytes, fs.statSync(file).size, 'manifest bytes for ' + f.path);
    assert.equal(f.sha256, sha256(file), 'manifest sha256 for ' + f.path);
  });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  walk(from).forEach(function (rel) { fs.copyFileSync(path.join(from, rel), path.join(to, rel)); });
}

test('site: the publish commands run as written, and the build read the stubbed city endpoint in four pages', function () {
  var p = publishOnce();
  var rows = p.requests.filter(function (u) { return u.searchParams.get('$select') === null; });
  assert.equal(rows.length, 4);
  p.requests.forEach(function (u) {
    assert.equal(u.origin, 'https' + '://' + 'data.sf.gov');
    assert.equal(u.pathname, '/resource/yhqp-riqs.json');
  });
  var decoded = sweeping.decodeData(fs.readFileSync(path.join(p.site, 'sweeping-data.json'), 'utf8'));
  assert.equal(decoded.rows.length, 37878);
  var fetchedAt = Date.parse(decoded.fetchedAt);
  assert.ok(fetchedAt >= p.started - 1000 && fetchedAt <= p.finished, 'fetchedAt is the time of the run');
});

test('site: the data file, src/sweeping.js and every file in scriptable/ are in the site, each sha256-identical to its file in the repository', function () {
  var p = publishOnce();
  assertSiteMatchesSources(p.site, p.data);
  assert.ok(fs.readdirSync(path.join(root, 'scriptable')).indexOf('sweeping-install.js') >= 0);
});

test('site: the hash comparison fails on a deliberately altered copy', function () {
  var p = publishOnce();
  var copy = scratch('site-altered-');
  copyDir(p.site, copy);
  assertSiteMatchesSources(copy, p.data); // the untouched copy passes
  var file = path.join(copy, 'sweeping.js');
  var text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, text.replace('var STALE_AFTER_MS = 14 * DAY_MS;', 'var STALE_AFTER_MS = 99 * DAY_MS;'));
  assert.throws(function () { assertSiteMatchesSources(copy, p.data); }, /sweeping\.js in the site is not identical to src\/sweeping\.js/);
});

test('site: the manifest gives each file\'s path, byte length and sha256, plus a version', function () {
  var p = publishOnce();
  var manifest = JSON.parse(fs.readFileSync(path.join(p.site, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest), ['version', 'files']);
  assert.match(manifest.version, /^[0-9a-f]{16}$/);
  manifest.files.forEach(function (f) {
    assert.deepEqual(Object.keys(f), ['path', 'bytes', 'sha256']);
    assert.match(f.sha256, /^[0-9a-f]{64}$/);
  });
  // The data file's size for the full table, for the pull request body.
  var data = manifest.files.filter(function (f) { return f.path === 'sweeping-data.json'; })[0];
  assert.ok(data.bytes > 1000000 && data.bytes < fs.statSync(FIXTURE).size, 'data file is ' + data.bytes + ' bytes');
});

test('site: no site path comes from test/, and the 16 MB fixture is not in the site', function () {
  var p = publishOnce();
  site.plan(p.data).forEach(function (f) {
    assert.notEqual(path.relative(root, f.source).split(path.sep)[0], 'test', f.path + ' comes from ' + f.source);
  });
  var testHashes = {};
  walk(path.join(root, 'test')).forEach(function (rel) { testHashes[sha256(path.join(root, 'test', rel))] = rel; });
  walk(p.site).forEach(function (rel) {
    var h = sha256(path.join(p.site, rel));
    assert.equal(testHashes[h], undefined, rel + ' in the site is test/' + testHashes[h]);
    assert.ok(fs.statSync(path.join(p.site, rel)).size < fs.statSync(FIXTURE).size);
  });
  // And the assembly refuses a source under test/ outright.
  assert.throws(function () { site.plan(FIXTURE); }, /under test\//);
});

test('site: a file added to the Scriptable scripts directory is published with no change to the assembly', function () {
  var p = publishOnce();
  var scripts = scratch('scriptable-');
  copyDir(path.join(root, 'scriptable'), scripts);
  fs.writeFileSync(path.join(scripts, 'sweeping-capture.js'), 'const sweeping = importModule("sweeping");\n');
  var out = path.join(scratch('site-'), 'site');
  var manifest = site.assemble(p.data, out, scripts);
  var added = manifest.files.filter(function (f) { return f.path === 'sweeping-capture.js'; });
  assert.equal(added.length, 1);
  assert.equal(added[0].sha256, sha256(path.join(scripts, 'sweeping-capture.js')));
  assert.equal(sha256(path.join(out, 'sweeping-capture.js')), added[0].sha256);
});

test('site: the assembly refuses a data file src/sweeping.js cannot decode, and a site directory that is not empty', function () {
  var p = publishOnce();
  var dir = scratch('site-refuse-');
  var bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{"format":2}');
  assert.throws(function () { site.assemble(bad, path.join(dir, 'a')); }, /is not a schedule file src\/sweeping\.js can decode/);
  assert.equal(fs.existsSync(path.join(dir, 'a')), false);
  assert.throws(function () { site.assemble(p.data, p.site); }, /not empty/);
});
