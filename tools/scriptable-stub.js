// Runs a Scriptable script under Node with stand-ins for Scriptable's Request
// and FileManager, for the installer's tests. Lives outside test/ because
// `node --test` runs every .js file under a directory named test.
//
// The script runs the way Scriptable runs one: as the body of an async
// function, so top-level await works, inside a fresh vm context that holds the
// language's built-ins and only the Scriptable globals given here. A script
// that reached for Node's require, process or fetch would fail.
//
// The stand-ins follow the declarations research #3, 9.4 point 6 cites:
// Request.loadString() resolves with the body whatever the status, which is
// then on request.response.statusCode; FileManager.move() throws when the
// destination exists.

'use strict';

var fs = require('fs');
var vm = require('vm');

var DOCS = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents';

// A FileManager over an in-memory directory. `files` maps a name in the
// documents directory to its text. Every call that changes a file is logged
// in `ops`, in order.
function fileManager(files, options) {
  options = options || {};
  var store = {};
  Object.keys(files || {}).forEach(function (name) { store[DOCS + '/' + name] = files[name]; });
  var ops = [];
  var inCloud = {};
  (options.inCloud || []).forEach(function (name) { inCloud[DOCS + '/' + name] = true; });

  var fm = {
    documentsDirectory: function () { return DOCS; },
    joinPath: function (a, b) { return a + '/' + b; },
    fileExists: function (p) { return Object.prototype.hasOwnProperty.call(store, p); },
    isFileStoredIniCloud: function (p) { return !!inCloud[p]; },
    downloadFileFromiCloud: function (p) { ops.push(['downloadFileFromiCloud', p]); delete inCloud[p]; return Promise.resolve(); },
    readString: function (p) {
      if (inCloud[p]) throw new Error('read before download from iCloud: ' + p);
      return fm.fileExists(p) ? store[p] : null;
    },
    writeString: function (p, text) { ops.push(['writeString', p]); store[p] = text; },
    remove: function (p) {
      if (!fm.fileExists(p)) throw new Error('remove: no file ' + p);
      ops.push(['remove', p]);
      delete store[p];
    },
    move: function (from, to) {
      if (!fm.fileExists(from)) throw new Error('move: no file ' + from);
      if (fm.fileExists(to)) throw new Error('move: destination exists ' + to);
      ops.push(['move', from, to]);
      store[to] = store[from];
      delete store[from];
    },
  };
  return {
    fm: fm,
    ops: ops,
    // The directory's contents, by name.
    files: function () {
      var out = {};
      Object.keys(store).forEach(function (p) { out[p.slice(DOCS.length + 1)] = store[p]; });
      return out;
    },
  };
}

// A Request class answering from `routes`, a map of URL to { status, body },
// or { error } for a request that fails outright. An unknown URL is a 404.
function requestClass(routes) {
  var urls = [];
  function Request(url) {
    this.url = url;
    this.response = null;
    urls.push(url);
  }
  Request.prototype.loadString = function () {
    var self = this;
    var route = routes[self.url];
    if (route && route.error) return Promise.reject(new Error(route.error));
    if (!route) route = { status: 404, body: '<!DOCTYPE html><html><body>404 File not found</body></html>' };
    self.response = { statusCode: route.status, url: self.url };
    return Promise.resolve(route.body);
  };
  return { Request: Request, urls: urls };
}

// Runs the script at `file` with the given stand-ins. Resolves with
// { exports, logs, error }, where `error` is what the script threw, if it did.
async function run(file, env) {
  var source = fs.readFileSync(file, 'utf8');
  var logs = [];
  var mod = { exports: {}, filename: DOCS + '/' + require('path').basename(file) };
  var completed = false;
  var context = vm.createContext({
    Request: env.Request,
    FileManager: { iCloud: function () { return env.fm; }, local: function () { return env.fm; } },
    Script: { complete: function () { completed = true; } },
    console: { log: function (s) { logs.push(String(s)); }, error: function (s) { logs.push(String(s)); } },
  });
  var wrapped = vm.runInContext('(async function (module, exports) {' + source + '\n})', context, { filename: file });
  var error = null;
  try {
    await wrapped(mod, mod.exports);
  } catch (e) {
    error = e;
  }
  return { exports: mod.exports, logs: logs, error: error, completed: completed };
}

module.exports = { fileManager: fileManager, requestClass: requestClass, run: run, DOCS: DOCS };
