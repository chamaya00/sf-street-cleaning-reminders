// Installs and updates this project's files in Scriptable, from GitHub Pages
// (ADR 0001, Installs and updates; ADR 0002 for the manifest).
//
// Run it once by hand to install; run it again, by hand or from a Shortcuts
// automation, to update. It reads the published manifest, and downloads only
// the files whose sha256 differs from the last manifest it applied. Every one
// of those has to arrive complete (its byte length matches the manifest) and
// parse (JSON for data, a syntax check for scripts) before any installed file
// is touched. Each is then written to a temporary file and only then swapped
// in. If any file fails, nothing is replaced, and the run names the file.
//
// The one host it talks to is GitHub Pages (D5 on #2). It uses only
// Scriptable's own Request and FileManager.

'use strict';

var BASE_URL = 'https://chamaya00.github.io/sf-street-cleaning-reminders/';
var MANIFEST = 'manifest.json';

// The manifest this script last applied, kept beside the files it installed.
var RECORD = 'sweeping-installed.json';

var TEMP_SUFFIX = '.download';

var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// The UTF-8 byte length of a string, to compare with the manifest's `bytes`.
function utf8Length(s) {
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

// Throws unless `text` parses as what `name` says it is. A script is compiled
// the way Scriptable runs it, as the body of an async function, and not run.
function checkParses(name, text) {
  if (/\.json$/.test(name)) {
    JSON.parse(text);
  } else if (/\.js$/.test(name)) {
    new AsyncFunction(text);
  } else {
    throw new Error('no check for this kind of file');
  }
}

async function download(name) {
  var req = new Request(BASE_URL + name);
  var text = await req.loadString();
  var status = req.response ? req.response.statusCode : undefined;
  if (status !== 200) throw new Error('HTTP ' + status);
  return text;
}

// A manifest entry names a plain file in Scriptable's documents directory and
// nothing else, so a manifest can never write outside it or over this record.
function checkManifest(manifest) {
  if (!manifest || typeof manifest.version !== 'string' || !Array.isArray(manifest.files)) {
    throw new Error('not a manifest');
  }
  manifest.files.forEach(function (f) {
    if (!f || typeof f.path !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(f.path) ||
        f.path === RECORD || f.path === MANIFEST || /\.download$/.test(f.path)) {
      throw new Error('bad file name ' + JSON.stringify(f && f.path));
    }
    if (typeof f.bytes !== 'number' || typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256)) {
      throw new Error('bad entry for ' + f.path);
    }
  });
}

async function readIfExists(fm, file) {
  if (!fm.fileExists(file)) return null;
  if (fm.isFileStoredIniCloud(file)) await fm.downloadFileFromiCloud(file);
  return fm.readString(file);
}

// Writes `text` to a temporary file beside `target`, then swaps it in.
function swapIn(fm, target, text) {
  var temp = target + TEMP_SUFFIX;
  fm.writeString(temp, text);
  if (fm.fileExists(target)) fm.remove(target);
  fm.move(temp, target);
}

// Returns { status: 'current' | 'updated' | 'failed', written, failed, message }.
async function update(fm) {
  var dir = fm.documentsDirectory();
  var manifestText, manifest;
  try {
    manifestText = await download(MANIFEST);
    manifest = JSON.parse(manifestText);
    checkManifest(manifest);
  } catch (e) {
    return failed([{ path: MANIFEST, reason: e.message }]);
  }

  var installed = {};
  try {
    var record = JSON.parse(await readIfExists(fm, fm.joinPath(dir, RECORD)) || '{"files":[]}');
    record.files.forEach(function (f) { installed[f.path] = f.sha256; });
  } catch (e) {
    installed = {}; // an unreadable record means every file is downloaded again
  }

  var changed = manifest.files.filter(function (f) {
    return installed[f.path] !== f.sha256 || !fm.fileExists(fm.joinPath(dir, f.path));
  });
  if (changed.length === 0) {
    return { status: 'current', written: [], failed: [], message: 'Up to date (version ' + manifest.version + ').' };
  }

  // Every changed file is downloaded and checked before any installed one is
  // touched, so the scripts and the module they import never mix versions.
  var staged = [];
  var failures = [];
  for (var i = 0; i < changed.length; i++) {
    var f = changed[i];
    try {
      var text = await download(f.path);
      var got = utf8Length(text);
      if (got !== f.bytes) throw new Error('incomplete: ' + got + ' bytes where the manifest says ' + f.bytes);
      try {
        checkParses(f.path, text);
      } catch (e) {
        throw new Error('does not parse: ' + e.message);
      }
      staged.push({ path: f.path, text: text });
    } catch (e) {
      failures.push({ path: f.path, reason: e.message });
    }
  }
  if (failures.length > 0) return failed(failures);

  staged.forEach(function (s) { swapIn(fm, fm.joinPath(dir, s.path), s.text); });
  swapIn(fm, fm.joinPath(dir, RECORD), manifestText);
  var written = staged.map(function (s) { return s.path; });
  return {
    status: 'updated',
    written: written,
    failed: [],
    message: 'Updated to version ' + manifest.version + ': ' + written.join(', ') + '.',
  };
}

function failed(failures) {
  return {
    status: 'failed',
    written: [],
    failed: failures,
    message: 'Nothing was replaced. ' + failures.map(function (f) { return f.path + ': ' + f.reason; }).join('; '),
  };
}

module.exports = { BASE_URL: BASE_URL, update: update, utf8Length: utf8Length };

var fm = module.filename && module.filename.indexOf('iCloud') >= 0 ? FileManager.iCloud() : FileManager.local();
var result = await update(fm);
console.log(result.message);
if (result.status === 'failed') throw new Error(result.message);
Script.complete();
