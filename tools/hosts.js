// Finds URL hosts in the repository's tracked files. A new outbound host is a
// change a person approves (house rules, "what a revert does not undo"), so
// test/portability.test.js fails on any host a file names that ALLOWED does
// not allow in that file.

'use strict';

var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');

// Each host this project's own files may name, and the only paths that may name
// it. A host or a path added here is a decision, so it goes in the pull request
// body that adds it.
// - data.sf.gov: the city's SODA2 endpoint, read by the build on GitHub's
//   runner and by nothing else (ADR 0001, Data; research #3, 4.6).
// - chamaya00.github.io: GitHub Pages, the one host the phone talks to (D5 on
//   #2), named by the installer and the Scriptable scripts beside it.
// The logic module names no host (ADR 0001), so no rule covers src/.
var ALLOWED = [
  { host: 'data.sf.gov', paths: [/^tools\/build-data\.js$/] },
  { host: 'chamaya00.github.io', paths: [/^scriptable\//] },
];

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

// Whether `file` (a path from the repository root) may name `host`.
function allowedIn(file, host, rules) {
  return rules.some(function (rule) {
    return rule.host === host && rule.paths.some(function (re) { return re.test(file); });
  });
}

// Every host `text`, the contents of `file`, names and may not: [{ file, host }].
function textViolations(file, text, rules) {
  return findHosts(text)
    .filter(function (host) { return !allowedIn(file, host, rules); })
    .map(function (host) { return { file: file, host: host }; });
}

// Every disallowed host in the scanned files: [{ file, host }].
function violations(files, rules) {
  var out = [];
  files.forEach(function (f) {
    var full = path.join(root, f);
    if (!fs.existsSync(full)) return; // deleted in the working tree
    out = out.concat(textViolations(f, fs.readFileSync(full, 'utf8'), rules));
  });
  return out;
}

module.exports = {
  ALLOWED: ALLOWED,
  SKIPPED: SKIPPED,
  findHosts: findHosts,
  allowedIn: allowedIn,
  textViolations: textViolations,
  trackedFiles: trackedFiles,
  violations: violations,
  root: root,
};
