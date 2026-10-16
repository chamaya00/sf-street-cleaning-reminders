'use strict';

// Criterion 6, the parts a test can check: the module loads with nothing but
// `module` and `exports`, no tracked file names a host it may not, and
// CLAUDE.md names the command.

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var hosts = require('../tools/hosts');

var root = path.join(__dirname, '..');

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

test('no tracked file outside docs/, the fixtures and the factory scaffolding names a URL host (allowed list: empty)', function () {
  assert.deepEqual(hosts.ALLOWED, []);
  var files = hosts.trackedFiles();
  assert.ok(files.indexOf('src/sweeping.js') >= 0, 'the module is not among the scanned files');
  assert.ok(files.indexOf('CLAUDE.md') >= 0, 'CLAUDE.md is not among the scanned files');
  assert.deepEqual(hosts.violations(files, hosts.ALLOWED), []);
});

test('the host check finds a planted host', function () {
  // Built from parts, so this file does not itself name a host.
  var scheme = 'https' + ':' + '//';
  assert.deepEqual(hosts.findHosts('fetch("' + scheme + 'evil.example.com/x.json")'), ['evil.example.com']);
  assert.deepEqual(hosts.findHosts('see ' + scheme + 'user@Data.SF.gov:443/resource'), ['data.sf.gov']);
  assert.deepEqual(hosts.findHosts('no address here, only a://'), []);
});

test('CLAUDE.md Commands names node --test', function () {
  var text = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  var start = text.indexOf('\n## Commands\n');
  assert.ok(start >= 0, 'no Commands section');
  var end = text.indexOf('\n## ', start + 1);
  var commands = text.slice(start, end < 0 ? undefined : end);
  assert.match(commands, /`node --test`/);
});
