'use strict';

// #4 criterion 6, the parts a test can check: the module loads with nothing
// but `module` and `exports`, no tracked file names a host it may not, and
// CLAUDE.md names the command. #11 criterion 6 made the host rules per path
// and added the credential scan.

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var hosts = require('../tools/hosts');

var root = path.join(__dirname, '..');

// Built from parts, so this file does not itself name a host.
var SCHEME = 'https' + ':' + '//';

test('the module evaluates, and computes one window, inside vm.runInNewContext given only module and exports', function () {
  var source = fs.readFileSync(path.join(root, 'src', 'sweeping.js'), 'utf8');
  var mod = { exports: {} };
  vm.runInNewContext(source, { module: mod, exports: mod.exports }, { filename: 'sweeping.js' });
  var sweeping = mod.exports;
  assert.equal(typeof sweeping.windowsForSide, 'function');

  // 8753101 R, Monday 02:00-06:00 (request 5), seen Sunday 2026-10-18 21:00 PDT.
  var row = {
    cnn: '8753101', cnnrightleft: 'R', blockside: 'NorthWest', fullname: 'Monday', weekday: 'Mon',
    fromhour: '2', tohour: '6', week1: '1', week2: '1', week3: '1', week4: '1', week5: '1',
    holidays: '0', blocksweepid: '1642343',
  };
  var result = sweeping.windowsForSide(
    { fetchedAt: '2026-10-16T08:58:18Z', rows: [row] },
    { cnn: '8753101', side: 'R', now: '2026-10-19T04:00:00Z', until: '2026-10-20T04:00:00Z' }
  );
  assert.equal(result.status, 'ok');
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].start, '2026-10-19T09:00:00.000Z');
  assert.equal(result.windows[0].day, 'tomorrow');
});

test('the host check allows data.sf.gov in the build script only, and chamaya00.github.io in the Scriptable scripts directory only', function () {
  var rules = hosts.ALLOWED.map(function (r) {
    return { host: r.host, paths: r.paths.map(function (re) { return re.source; }) };
  });
  assert.deepEqual(rules, [
    { host: 'data.sf.gov', paths: ['^tools\\/build-data\\.js$'] },
    { host: 'chamaya00.github.io', paths: ['^scriptable\\/'] },
  ]);
  assert.equal(hosts.allowedIn('tools/build-data.js', 'data.sf.gov', hosts.ALLOWED), true);
  assert.equal(hosts.allowedIn('scriptable/sweeping-install.js', 'chamaya00.github.io', hosts.ALLOWED), true);
  ['src/sweeping.js', 'scriptable/sweeping-install.js', 'tools/assemble-site.js', 'tools/build-data.js.bak', 'README.md'].forEach(function (f) {
    assert.equal(hosts.allowedIn(f, 'data.sf.gov', hosts.ALLOWED), false, 'data.sf.gov allowed in ' + f);
  });
  ['src/sweeping.js', 'tools/build-data.js', 'tools/assemble-site.js', 'README.md', 'scriptablex/a.js'].forEach(function (f) {
    assert.equal(hosts.allowedIn(f, 'chamaya00.github.io', hosts.ALLOWED), false, 'chamaya00.github.io allowed in ' + f);
  });
});

test('no tracked file outside docs/, the fixtures and the factory scaffolding names a host its path does not allow', function () {
  var files = hosts.trackedFiles();
  ['src/sweeping.js', 'CLAUDE.md', 'tools/build-data.js', 'scriptable/sweeping-install.js'].forEach(function (f) {
    assert.ok(files.indexOf(f) >= 0, f + ' is not among the scanned files');
  });
  assert.deepEqual(hosts.violations(files, hosts.ALLOWED), []);
});

test('src/sweeping.js still names no host', function () {
  assert.deepEqual(hosts.findHosts(fs.readFileSync(path.join(root, 'src', 'sweeping.js'), 'utf8')), []);
});

test('the host check finds a planted host', function () {
  assert.deepEqual(hosts.findHosts('fetch("' + SCHEME + 'evil.example.com/x.json")'), ['evil.example.com']);
  assert.deepEqual(hosts.findHosts('see ' + SCHEME + 'user@Data.SF.gov:443/resource'), ['data.sf.gov']);
  assert.deepEqual(hosts.findHosts('no address here, only a://'), []);
});

test('the host check fails on an unknown host planted in a file that may name hosts', function () {
  ['tools/build-data.js', 'scriptable/sweeping-install.js'].forEach(function (f) {
    var text = fs.readFileSync(path.join(root, f), 'utf8');
    assert.deepEqual(hosts.textViolations(f, text, hosts.ALLOWED), []);
    var planted = text + '\nfetch("' + SCHEME + 'evil.example.com/x.json");\n';
    assert.deepEqual(hosts.textViolations(f, planted, hosts.ALLOWED), [{ file: f, host: 'evil.example.com' }]);
  });
});

test('the host check fails on an allowed host in the wrong file: data.sf.gov in the installer', function () {
  var f = 'scriptable/sweeping-install.js';
  var text = fs.readFileSync(path.join(root, f), 'utf8');
  var planted = text + '\nvar city = "' + SCHEME + 'data.sf.gov/resource/yhqp-riqs.json";\n';
  assert.deepEqual(hosts.textViolations(f, planted, hosts.ALLOWED), [{ file: f, host: 'data.sf.gov' }]);
  // And Pages in the build script, and in the logic module.
  var pages = '"' + SCHEME + 'chamaya00.github.io/sf-street-cleaning-reminders/"';
  assert.deepEqual(hosts.textViolations('tools/build-data.js', pages, hosts.ALLOWED), [{ file: 'tools/build-data.js', host: 'chamaya00.github.io' }]);
  assert.deepEqual(hosts.textViolations('src/sweeping.js', pages, hosts.ALLOWED), [{ file: 'src/sweeping.js', host: 'chamaya00.github.io' }]);
});

// Shapes of the credentials a file here could carry. Built from parts where a
// shape would otherwise match its own text in this file.
var CREDENTIALS = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  new RegExp('-----BEGIN [A-Z ]*' + 'PRIVATE KEY-----'),
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/,
  new RegExp('X-App' + '-Token|\\$\\$app' + '_token', 'i'),
  /\b(api[_-]?key|access[_-]?token|auth[_-]?token|secret|passw(or)?d)\b["']?\s*[:=]\s*["'][^"'\s]{6,}["']/i,
  new RegExp('\\$\\{\\{\\s*secrets' + '\\.'),
];

function credentialsIn(text) {
  return CREDENTIALS.filter(function (re) { return re.test(text); }).map(function (re) { return re.source; });
}

test('no key, token or password appears in a scanned file or a proposed workflow', function () {
  var proposed = fs.readdirSync(path.join(root, '.github', 'proposed')).map(function (f) { return '.github/proposed/' + f; });
  assert.ok(proposed.length > 0, 'no proposed workflow to scan');
  var found = [];
  hosts.trackedFiles().concat(proposed).forEach(function (f) {
    var full = path.join(root, f);
    if (!fs.existsSync(full)) return;
    credentialsIn(fs.readFileSync(full, 'utf8')).forEach(function (re) { found.push(f + ': ' + re); });
  });
  assert.deepEqual(found, []);
});

test('the credential scan finds a planted token', function () {
  assert.ok(credentialsIn('var t = "gh' + 'p_' + 'a'.repeat(36) + '";').length > 0);
  assert.ok(credentialsIn('password' + ': "hunter2hunter2"').length > 0);
  assert.ok(credentialsIn('token: ${{ ' + 'secrets.GITHUB_TOKEN }}').length > 0);
  assert.ok(credentialsIn('headers: { "X-App' + '-Token": t }').length > 0);
  assert.deepEqual(credentialsIn('var BASE_URL = "' + SCHEME + 'chamaya00.github.io/x/";'), []);
});

test('CLAUDE.md Commands names node --test', function () {
  var text = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  var start = text.indexOf('\n## Commands\n');
  assert.ok(start >= 0, 'no Commands section');
  var end = text.indexOf('\n## ', start + 1);
  var commands = text.slice(start, end < 0 ? undefined : end);
  assert.match(commands, /`node --test`/);
});
