// Lays out the GitHub Pages site (ADR 0001, Installs and updates; ADR 0002 for
// the manifest).
//
// Usage, from the repository root, as the weekly publish workflow runs it:
//   node tools/assemble-site.js <data file> <site directory>
//
// The site is flat, because Scriptable keeps its scripts in one directory and
// the installer writes each file there under its site name:
// - sweeping-data.json: the data file tools/build-data.js wrote
// - sweeping.js: src/sweeping.js
// - every file in scriptable/, under its own name. #7's scripts are published
//   by adding them there; nothing here changes.
// - manifest.json: each file's path, byte length and sha256, and a version
//
// Every file is copied byte for byte. Nothing under test/ is ever a source, so
// the 16 MB fixture never reaches the site.

'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');

var DATA_NAME = 'sweeping-data.json';
var MANIFEST_NAME = 'manifest.json';
var SCRIPTS_DIR = path.join(root, 'scriptable');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// The site's files and where each comes from: [{ path, source }], `source`
// an absolute path. `scriptsDir` is scriptable/ unless a test says otherwise.
function plan(dataFile, scriptsDir) {
  scriptsDir = scriptsDir || SCRIPTS_DIR;
  var files = [
    { path: DATA_NAME, source: path.resolve(dataFile) },
    { path: 'sweeping.js', source: path.join(root, 'src', 'sweeping.js') },
  ];
  fs.readdirSync(scriptsDir).sort().forEach(function (name) {
    var source = path.join(scriptsDir, name);
    if (name.charAt(0) === '.' || !fs.statSync(source).isFile()) return;
    files.push({ path: name, source: source });
  });
  var seen = {};
  files.forEach(function (f) {
    if (seen[f.path] || f.path === MANIFEST_NAME) throw new Error('two site files would be named ' + f.path);
    seen[f.path] = true;
    var rel = path.relative(root, f.source);
    if (rel.split(path.sep)[0] === 'test') throw new Error(rel + ' is under test/, and nothing under test/ is published');
  });
  return files;
}

// Copies the planned files into `siteDir`, which must not exist yet or be
// empty, and writes the manifest. Returns the manifest.
function assemble(dataFile, siteDir, scriptsDir) {
  // Never publish a data file the phone could not read.
  var decoded = require('../src/sweeping').decodeData(fs.readFileSync(dataFile, 'utf8'));
  if (decoded.rows === null) throw new Error(dataFile + ' is not a schedule file src/sweeping.js can decode');

  var files = plan(dataFile, scriptsDir);
  if (fs.existsSync(siteDir) && fs.readdirSync(siteDir).length > 0) {
    throw new Error(siteDir + ' is not empty');
  }
  fs.mkdirSync(siteDir, { recursive: true });
  var entries = files.map(function (f) {
    fs.copyFileSync(f.source, path.join(siteDir, f.path));
    var bytes = fs.readFileSync(path.join(siteDir, f.path));
    return { path: f.path, bytes: bytes.length, sha256: sha256(bytes) };
  });
  // The version changes whenever any file does: weekly at least, with fetchedAt.
  var manifest = { version: sha256(JSON.stringify(entries)).slice(0, 16), files: entries };
  fs.writeFileSync(path.join(siteDir, MANIFEST_NAME), JSON.stringify(manifest, null, 1) + '\n');
  return manifest;
}

function main(args, log) {
  log = log || function (line) { console.error(line); };
  if (args.length !== 2) {
    log('usage: node tools/assemble-site.js <data file> <site directory>');
    return 2;
  }
  try {
    var manifest = assemble(args[0], args[1]);
    log('assemble-site: version ' + manifest.version + ', ' + manifest.files.map(function (f) {
      return f.path + ' (' + f.bytes + ' bytes)';
    }).join(', '));
    return 0;
  } catch (e) {
    log('assemble-site: failed: ' + e.message);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { plan: plan, assemble: assemble, main: main, sha256: sha256, DATA_NAME: DATA_NAME, MANIFEST_NAME: MANIFEST_NAME, SCRIPTS_DIR: SCRIPTS_DIR };
