// Finds URL hosts in the repository's tracked files. A new outbound host is a
// change a person approves (house rules, "what a revert does not undo"), so
// test/hosts.test.js fails on any host found that ALLOWED does not list.

'use strict';

var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');

// Hosts this project's own files may name. Empty: the logic module has no
// outbound host (ADR 0001). A host added here is a decision, so it goes in the
// pull request body that adds it.
var ALLOWED = [];

// Paths not scanned:
// - docs/ cites its sources by URL, and ships nowhere;
// - test/fixtures/ is the city's data, copied as it came;
// - .claude/, .github/ and the three role scripts are the agent factory's
//   scaffolding, installed and updated by the factory rather than written here.
var SKIPPED = [
  /^docs\//,
  /^test\/fixtures\//,
  /^\.claude\//,
  /^\.github\//,
  /^scripts\/(app-render|contrast|design-render)$/,
];

// A scheme, a colon and two slashes, then the host, which stops at the first
// character a host cannot hold.
var URL_HOST = /\b[a-z][a-z0-9+.-]*:\/\/(?:[^\s\/?#@"'`<>()\[\]{}]*@)?(\[[0-9a-f:.]+\]|[^\s\/?#:"'`<>()\[\]{},;\\]+)/gi;

function findHosts(text) {
  var hosts = [];
  var m;
  URL_HOST.lastIndex = 0;
  while ((m = URL_HOST.exec(text)) !== null) {
    var host = m[1].toLowerCase().replace(/\.$/, '');
    if (host && hosts.indexOf(host) < 0) hosts.push(host);
  }
  return hosts;
}

function trackedFiles() {
  return childProcess.execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter(function (f) { return !SKIPPED.some(function (re) { return re.test(f); }); });
}

// Every disallowed host in the scanned files: [{ file, host }].
function violations(files, allowed) {
  var out = [];
  files.forEach(function (f) {
    var full = path.join(root, f);
    if (!fs.existsSync(full)) return; // deleted in the working tree
    findHosts(fs.readFileSync(full, 'utf8')).forEach(function (host) {
      if (allowed.indexOf(host) < 0) out.push({ file: f, host: host });
    });
  });
  return out;
}

module.exports = { ALLOWED: ALLOWED, SKIPPED: SKIPPED, findHosts: findHosts, trackedFiles: trackedFiles, violations: violations, root: root };
