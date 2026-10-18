'use strict';

// #11 criterion 4: the Scriptable installer, run as Scriptable runs it, against
// stand-ins for Request and FileManager (tools/scriptable-stub.js).

var test = require('node:test');
var assert = require('node:assert/strict');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var scriptable = require('../tools/scriptable-stub');

var root = path.join(__dirname, '..');
var INSTALLER = path.join(root, 'scriptable', 'sweeping-install.js');
var BASE = 'https' + ':' + '//' + 'chamaya00.github.io/sf-street-cleaning-reminders/';

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

// A small published schedule file, in the format tools/build-data.js writes.
function dataFile(fetchedAt) {
  return '{"format":1,\n"dataset":"yhqp-riqs",\n"fetchedAt":"' + fetchedAt + '",\n"rowsUpdatedAt":"2026-05-14T11:36:29.000Z",\n' +
    '"count":1,\n"fields":["cnn","cnnrightleft","weekday"],\n"rows":[\n["8753101","R","Mon"]\n]}\n';
}

function entry(name, text) {
  return { path: name, bytes: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex') };
}

// A published site: { files: name -> text, manifest, manifestText }.
function site(files, version) {
  var manifest = { version: version, files: Object.keys(files).map(function (n) { return entry(n, files[n]); }) };
  return { files: files, manifest: manifest, manifestText: JSON.stringify(manifest, null, 1) + '\n' };
}

var V1 = site({
  'sweeping-data.json': dataFile('2026-10-12T11:17:00.000Z'),
  'sweeping.js': read('src/sweeping.js'),
  'sweeping-install.js': read('scriptable/sweeping-install.js'),
}, 'v1');

var V2 = site({
  'sweeping-data.json': dataFile('2026-10-19T11:17:00.000Z'),
  'sweeping.js': read('src/sweeping.js'),
  'sweeping-install.js': read('scriptable/sweeping-install.js'),
}, 'v2');

// Routes serving `s`, with `override` replacing what one URL answers.
function routes(s, override) {
  var r = {};
  r[BASE + 'manifest.json'] = { status: 200, body: s.manifestText };
  Object.keys(s.files).forEach(function (n) { r[BASE + n] = { status: 200, body: s.files[n] }; });
  Object.keys(override || {}).forEach(function (n) { r[BASE + n] = override[n]; });
  return r;
}

// The phone after V1 was installed.
function installedV1() {
  var files = Object.assign({}, V1.files);
  files['sweeping-installed.json'] = V1.manifestText;
  return files;
}

async function runInstaller(installed, served, options) {
  var dir = scriptable.fileManager(installed, options);
  var req = scriptable.requestClass(served);
  var before = dir.files();
  var result = await scriptable.run(INSTALLER, { Request: req.Request, fm: dir.fm });
  return { result: result, dir: dir, urls: req.urls, before: before };
}

// Each name in `names` went to a temporary file first and was then moved into
// place; nothing was ever written straight over an installed file.
function assertSwappedIn(run, names) {
  var D = scriptable.DOCS + '/';
  names.forEach(function (n) {
    var temp = D + n + '.download';
    var wrote = run.dir.ops.findIndex(function (op) { return op[0] === 'writeString' && op[1] === temp; });
    var moved = run.dir.ops.findIndex(function (op) { return op[0] === 'move' && op[1] === temp && op[2] === D + n; });
    assert.ok(wrote >= 0, n + ' was not written to a temporary file');
    assert.ok(moved > wrote, n + ' was not swapped in after its temporary file was written');
  });
  run.dir.ops.forEach(function (op) {
    if (op[0] === 'writeString') assert.match(op[1], /\.download$/, 'wrote straight to ' + op[1]);
  });
  assert.deepEqual(Object.keys(run.dir.files()).filter(function (n) { return /\.download$/.test(n); }), [], 'a temporary file was left behind');
}

// A failed run: nothing on the phone changed, nothing was written at all, and
// the run named `name` both in its log and in the error it ended on.
function assertUnchangedAndNamed(run, name) {
  assert.deepEqual(run.dir.files(), run.before, 'an installed file changed');
  assert.deepEqual(run.dir.ops.filter(function (op) { return op[0] !== 'downloadFileFromiCloud'; }), [], 'the run wrote, moved or removed a file');
  assert.ok(run.result.error, 'the run did not end on an error');
  assert.match(run.result.error.message, new RegExp(name.replace('.', '\\.') + ':'));
  assert.match(run.result.logs.join('\n'), new RegExp(name.replace('.', '\\.') + ':'));
  assert.equal(run.result.completed, false);
}

function truncated(text) { return text.slice(0, Math.floor(text.length / 2)); }

// Same length, does not parse.
function brokenJson(text) { return '<' + text.slice(1); }
function brokenScript(text) { return text.replace('function utf8Length(s) {', 'function utf8Length(s) ('); }

test('installer: a fresh install writes each file to a temporary file first, then swaps it in', async function () {
  var run = await runInstaller({}, routes(V1));
  assert.equal(run.result.error, null);
  assert.equal(run.result.completed, true);
  var files = run.dir.files();
  Object.keys(V1.files).forEach(function (n) { assert.equal(files[n], V1.files[n], n); });
  assert.equal(files['sweeping-installed.json'], V1.manifestText);
  assertSwappedIn(run, Object.keys(V1.files).concat(['sweeping-installed.json']));
  assert.match(run.result.logs.join('\n'), /Updated to version v1/);
});

test('installer: an update downloads and swaps in only the file that changed', async function () {
  var run = await runInstaller(installedV1(), routes(V2));
  assert.equal(run.result.error, null);
  assert.deepEqual(run.urls, [BASE + 'manifest.json', BASE + 'sweeping-data.json']);
  assert.equal(run.dir.files()['sweeping-data.json'], V2.files['sweeping-data.json']);
  assertSwappedIn(run, ['sweeping-data.json', 'sweeping-installed.json']);
  assert.deepEqual(run.dir.ops.filter(function (op) { return op[0] === 'remove'; }).map(function (op) { return op[1]; }),
    [scriptable.DOCS + '/sweeping-data.json', scriptable.DOCS + '/sweeping-installed.json']);
});

test('installer: a truncated download leaves the installed file unchanged and names it', async function () {
  var run = await runInstaller(installedV1(), routes(V2, {
    'sweeping-data.json': { status: 200, body: truncated(V2.files['sweeping-data.json']) },
  }));
  assertUnchangedAndNamed(run, 'sweeping-data.json');
  assert.match(run.result.error.message, /incomplete/);
});

test('installer: an HTML error page leaves the installed file unchanged and names it', async function () {
  var changed = site(Object.assign({}, V2.files, { 'sweeping.js': V2.files['sweeping.js'] + '\n' }), 'v3');
  var run = await runInstaller(installedV1(), routes(changed, {
    'sweeping.js': { status: 200, body: '<!DOCTYPE html>\n<html><head><title>Site not found · GitHub Pages</title></head></html>\n' },
  }));
  assertUnchangedAndNamed(run, 'sweeping.js');
});

test('installer: an HTTP error leaves the installed file unchanged and names it', async function () {
  for (var status of [404, 500]) {
    var run = await runInstaller(installedV1(), routes(V2, {
      'sweeping-data.json': { status: status, body: V2.files['sweeping-data.json'] },
    }));
    assertUnchangedAndNamed(run, 'sweeping-data.json');
    assert.match(run.result.error.message, new RegExp('HTTP ' + status));
  }
  var offline = await runInstaller(installedV1(), routes(V2, { 'sweeping-data.json': { error: 'The Internet connection appears to be offline.' } }));
  assertUnchangedAndNamed(offline, 'sweeping-data.json');
});

test('installer: a data file that does not parse leaves the installed file unchanged and names it', async function () {
  var bad = brokenJson(V2.files['sweeping-data.json']);
  assert.equal(Buffer.byteLength(bad), V2.manifest.files[0].bytes);
  var run = await runInstaller(installedV1(), routes(V2, { 'sweeping-data.json': { status: 200, body: bad } }));
  assertUnchangedAndNamed(run, 'sweeping-data.json');
  assert.match(run.result.error.message, /does not parse/);
});

test('installer: a script that does not parse leaves every installed file unchanged and names it', async function () {
  var script = V2.files['sweeping-install.js'] + '\n// v3\n';
  var v3 = site(Object.assign({}, V2.files, { 'sweeping-install.js': script }), 'v3');
  var bad = brokenScript(script);
  assert.notEqual(bad, script);
  assert.equal(Buffer.byteLength(bad), Buffer.byteLength(script));
  var run = await runInstaller(installedV1(), routes(v3, { 'sweeping-install.js': { status: 200, body: bad } }));
  // The data file arrived intact and is still not swapped in on its own.
  assertUnchangedAndNamed(run, 'sweeping-install.js');
  assert.match(run.result.error.message, /does not parse/);
  assert.doesNotMatch(run.result.error.message, /sweeping-data\.json:/);
});

test('installer: a manifest that fails leaves everything unchanged and names it', async function () {
  var notFound = await runInstaller(installedV1(), routes(V2, { 'manifest.json': { status: 404, body: '<html>404</html>' } }));
  assertUnchangedAndNamed(notFound, 'manifest.json');
  var html = await runInstaller(installedV1(), routes(V2, { 'manifest.json': { status: 200, body: '<!DOCTYPE html><html></html>' } }));
  assertUnchangedAndNamed(html, 'manifest.json');
  var escape = site({ '../sweeping.js': 'x' }, 'v9');
  var outside = await runInstaller(installedV1(), routes(escape));
  assertUnchangedAndNamed(outside, 'manifest.json');
});

test('installer: when everything is already current, nothing is written', async function () {
  var run = await runInstaller(installedV1(), routes(V1), { inCloud: ['sweeping-installed.json'] });
  assert.equal(run.result.error, null);
  assert.deepEqual(run.urls, [BASE + 'manifest.json']);
  assert.deepEqual(run.dir.ops, [['downloadFileFromiCloud', scriptable.DOCS + '/sweeping-installed.json']]);
  assert.deepEqual(run.dir.files(), run.before);
  assert.match(run.result.logs.join('\n'), /Up to date \(version v1\)/);
});

test('installer: a file deleted from the phone is downloaded again even when the manifest has not changed', async function () {
  var installed = installedV1();
  delete installed['sweeping.js'];
  var run = await runInstaller(installed, routes(V1));
  assert.equal(run.result.error, null);
  assert.deepEqual(run.urls, [BASE + 'manifest.json', BASE + 'sweeping.js']);
  assert.equal(run.dir.files()['sweeping.js'], V1.files['sweeping.js']);
});

test('installer: the base URL is exactly the Pages site, and every request goes under it', async function () {
  var run = await runInstaller({}, routes(V1));
  assert.equal(run.result.exports.BASE_URL, 'https' + '://chamaya00.github.io/sf-street-cleaning-reminders/');
  assert.ok(run.urls.length > 1);
  run.urls.forEach(function (u) { assert.ok(u.indexOf(BASE) === 0, u); });
});

test('installer: counts bytes as UTF-8, as the manifest does', async function () {
  var run = await runInstaller({}, routes(V1));
  var utf8Length = run.result.exports.utf8Length;
  ['plain', 'Café', '—', '🚗 car', ''].forEach(function (s) {
    assert.equal(utf8Length(s), Buffer.byteLength(s), JSON.stringify(s));
  });
});
