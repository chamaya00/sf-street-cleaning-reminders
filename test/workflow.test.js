'use strict';

// #11 criterion 5: the weekly publish workflow, proposed at .github/proposed/
// for a person to copy unchanged into .github/workflows/. Read line by line:
// the file keeps to plain block YAML so that this stays a dependency-free read.

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var publish = require('../tools/publish');

var root = path.join(__dirname, '..');
var DIR = path.join(root, '.github', 'proposed');

function lines() {
  return fs.readFileSync(path.join(DIR, 'publish.yml'), 'utf8').split('\n')
    .filter(function (l) { return !/^\s*#/.test(l) && l.trim() !== ''; });
}

// The lines under a top-level key, up to the next top-level key.
function block(key) {
  var all = lines();
  var start = all.indexOf(key + ':');
  assert.ok(start >= 0, 'no top-level ' + key + ':');
  var out = [];
  for (var i = start + 1; i < all.length && /^\s/.test(all[i]); i++) out.push(all[i]);
  return out;
}

function values(re) {
  return lines().map(function (l) { return re.exec(l); }).filter(Boolean).map(function (m) { return m[1].trim(); });
}

test('workflow: exactly one file is proposed, the publish workflow', function () {
  assert.deepEqual(fs.readdirSync(DIR), ['publish.yml']);
});

test('workflow: runs on a weekly schedule and on workflow_dispatch, and on nothing else', function () {
  var on = block('on');
  var triggers = on.filter(function (l) { return /^ {2}\S/.test(l); }).map(function (l) { return l.trim().replace(/:.*$/, ''); });
  assert.deepEqual(triggers, ['schedule', 'workflow_dispatch']);
  var crons = values(/^\s+- cron:\s*'([^']*)'\s*$/);
  assert.equal(crons.length, 1);
  // Minute, hour, any day of the month, any month, one day of the week.
  assert.match(crons[0], /^\d{1,2} \d{1,2} \* \* [0-6]$/);
});

test('workflow: grants exactly contents: read, pages: write and id-token: write', function () {
  assert.deepEqual(block('permissions').map(function (l) { return l.trim(); }), [
    'contents: read',
    'pages: write',
    'id-token: write',
  ]);
  // And no job widens or narrows that with a permissions block of its own.
  assert.equal(lines().filter(function (l) { return /^\s*permissions:/.test(l); }).length, 1);
});

test('workflow: uses only actions/* actions, each pinned to a 40-character commit SHA', function () {
  var uses = values(/^\s*(?:- )?uses:\s*(.*)$/);
  assert.deepEqual(uses.map(function (u) { return u.replace(/@.*$/, ''); }), [
    'actions/checkout',
    'actions/upload-pages-artifact',
    'actions/deploy-pages',
  ]);
  uses.forEach(function (u) {
    assert.match(u, /^actions\/[a-z0-9-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, u);
  });
});

test('workflow: its run: commands are exactly the publish commands the tests run', function () {
  var runs = values(/^\s*(?:- )?run:\s*(.*)$/);
  runs.forEach(function (r) { assert.doesNotMatch(r, /^[|>]/, 'a multi-line run: block'); });
  assert.deepEqual(runs, publish.COMMANDS);
  // And what it uploads is the directory the second command assembles.
  assert.deepEqual(values(/^\s+path:\s*(.*)$/), [publish.SITE_DIR]);
  assert.ok(publish.COMMANDS[1].split(' ').pop() === publish.SITE_DIR);
});

test('workflow: deploys the site to Pages and references no secret', function () {
  var text = fs.readFileSync(path.join(DIR, 'publish.yml'), 'utf8');
  assert.match(text, /\n {6}name: github-pages\n/);
  assert.match(text, /uses: actions\/deploy-pages@/);
  assert.doesNotMatch(text, /secrets\./);
  assert.doesNotMatch(text, /pull_request|push:|workflow_run/);
});
