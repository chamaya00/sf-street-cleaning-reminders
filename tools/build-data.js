// Builds the schedule file the phone reads (ADR 0001, Data; ADR 0002 for the
// format) from DataSF's table yhqp-riqs, read through the SODA2 endpoint.
//
// Usage, from the repository root, as the weekly publish workflow runs it:
//   node tools/build-data.js <output file>
//
// It reads the city's row count, then pages through the rows in a fixed order,
// and writes the file only when every page arrived, parsed, and added up to
// that count with no row twice. On any failure it exits 1 and leaves whatever
// was at <output file> untouched, so a bad week publishes nothing rather than
// a partial table.
//
// The phone never runs this. GitHub's runner does, and it is the only code in
// the repository that talks to the city (ADR 0001, Hosts).

'use strict';

var fs = require('fs');
var path = require('path');

// The city's portal answers data.sfgov.org with a 301 to data.sf.gov
// (research #3, 4.6), so the build asks data.sf.gov directly. The CSV export
// under /api/views/ is being retired on 2026-12-22 (4.5) and is never used.
var ENDPOINT = 'https://data.sf.gov/resource/yhqp-riqs.json';

// Socrata's system row id: unique and stable, so paging in this order neither
// skips nor repeats a row.
var ORDER = ':id';

var PAGE_SIZE = 10000;

// The format version src/sweeping.js's decodeData reads. Change it, and the
// decoder with it, whenever the layout below changes.
var FORMAT = 1;

// The SODA2 response header carrying the moment the city's rows last changed.
// It equals the dataset metadata's rowsUpdatedAt (research #3, 4.5: request
// 1's rowsUpdatedAt 1778758589 against requests 2 to 6's headers), and reading
// it here keeps every request on the SODA2 endpoint.
var ROWS_UPDATED_HEADER = 'X-SODA2-Truth-Last-Modified';

function requestUrl(params) {
  return ENDPOINT + '?' + new URLSearchParams(params).toString();
}

async function get(fetch, what, params) {
  var res;
  try {
    res = await fetch(requestUrl(params));
  } catch (e) {
    throw new Error(what + ': request failed: ' + e.message);
  }
  if (!res.ok) throw new Error(what + ': HTTP ' + res.status);
  var text = await res.text();
  var body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    throw new Error(what + ': body is not JSON (starts ' + JSON.stringify(text.slice(0, 40)) + ')');
  }
  if (!Array.isArray(body)) throw new Error(what + ': body is not a JSON array');
  return { body: body, rowsUpdated: res.headers.get(ROWS_UPDATED_HEADER) };
}

// The column order of the rows: each field in the order the rows give it. A
// field a row leaves out (SODA2 leaves out nulls) keeps its place from the
// rows that have it.
function fieldOrder(rows) {
  var fields = [];
  rows.forEach(function (row) {
    var after = -1;
    Object.keys(row).forEach(function (k) {
      var at = fields.indexOf(k);
      if (at < 0) {
        fields.splice(after + 1, 0, k);
        at = after + 1;
      }
      after = at;
    });
  });
  return fields;
}

// A GeoJSON LineString is stored as its coordinates alone; anything else in
// `line` is stored as it came, and decodes as it came.
function encodeValue(field, value) {
  if (value === undefined || value === null) return null;
  if (field === 'line' && value.type === 'LineString' && Object.keys(value).length === 2 &&
      Array.isArray(value.coordinates)) {
    return value.coordinates;
  }
  return value;
}

// The file: a header a person can read at the top (open the URL, see
// fetchedAt), then one row per line, each an array in `fields` order.
function encode(rows, meta) {
  var fields = fieldOrder(rows);
  var header = {
    format: FORMAT,
    dataset: 'yhqp-riqs',
    fetchedAt: meta.fetchedAt,
    rowsUpdatedAt: meta.rowsUpdatedAt,
    count: rows.length,
    fields: fields,
  };
  var lines = rows.map(function (row) {
    return JSON.stringify(fields.map(function (f) { return encodeValue(f, row[f]); }));
  });
  var head = Object.keys(header).map(function (k) { return JSON.stringify(k) + ':' + JSON.stringify(header[k]); });
  return '{' + head.join(',\n') + ',\n"rows":[\n' + lines.join(',\n') + '\n]}\n';
}

function isoOrNull(httpDate) {
  if (typeof httpDate !== 'string') return null;
  var t = Date.parse(httpDate);
  return isNaN(t) ? null : new Date(t).toISOString();
}

// Reads the whole table and returns { text, count, pages }, or throws.
// deps: { fetch, now (returns a Date), pageSize, log }
async function build(deps) {
  var fetch = deps.fetch;
  var pageSize = deps.pageSize || PAGE_SIZE;
  var log = deps.log || function () {};
  var fetchedAt = deps.now().toISOString();

  var counted = await get(fetch, 'row count', { $select: 'count(*) AS n' });
  var n = counted.body[0] && counted.body[0].n;
  if (typeof n !== 'string' || !/^\d+$/.test(n)) throw new Error('row count: no count in ' + JSON.stringify(counted.body).slice(0, 80));
  var count = Number(n);
  var rowsUpdated = counted.rowsUpdated;
  var rowsUpdatedAt = isoOrNull(rowsUpdated);
  if (rowsUpdatedAt === null) log('warning: no usable ' + ROWS_UPDATED_HEADER + ' header; rowsUpdatedAt is null');
  log('count(*) is ' + count + '; rows updated ' + (rowsUpdatedAt || 'unknown'));

  var rows = [];
  var seen = Object.create(null);
  var pages = 0;
  for (var offset = 0; ; offset += pageSize) {
    if (offset > count + pageSize) throw new Error('still paging at offset ' + offset + ' past count(*) ' + count);
    var what = 'page at offset ' + offset;
    var page = await get(fetch, what, { $limit: String(pageSize), $offset: String(offset), $order: ORDER });
    pages++;
    if (page.rowsUpdated !== rowsUpdated) {
      throw new Error(what + ': the table changed while it was being read (' + ROWS_UPDATED_HEADER + ' ' +
        rowsUpdated + ', now ' + page.rowsUpdated + ')');
    }
    if (page.body.length > pageSize) throw new Error(what + ': ' + page.body.length + ' rows, more than $limit ' + pageSize);
    page.body.forEach(function (row) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.blocksweepid !== 'string') {
        throw new Error(what + ': a row has no blocksweepid');
      }
      if (seen[row.blocksweepid]) throw new Error(what + ': blocksweepid ' + row.blocksweepid + ' appears twice');
      seen[row.blocksweepid] = true;
      rows.push(row);
    });
    if (page.body.length < pageSize) {
      if (rows.length < count) {
        throw new Error('short page at offset ' + offset + ': ' + page.body.length + ' rows, leaving ' +
          rows.length + ' in all where count(*) is ' + count);
      }
      break;
    }
  }
  if (rows.length !== count) throw new Error('read ' + rows.length + ' rows, but count(*) is ' + count);

  return { text: encode(rows, { fetchedAt: fetchedAt, rowsUpdatedAt: rowsUpdatedAt }), count: count, pages: pages };
}

// The command: builds, then swaps the file into place. Returns the exit code.
async function main(args, deps) {
  deps = deps || {};
  var log = deps.log || function (line) { console.error(line); };
  var out = args[0];
  if (!out || args.length !== 1) {
    log('usage: node tools/build-data.js <output file>');
    return 2;
  }
  var fetch = deps.fetch || globalThis.fetch;
  if (typeof fetch !== 'function') {
    log('build-data: this Node has no fetch; Node 20 or newer is needed');
    return 1;
  }
  var result;
  try {
    result = await build({
      fetch: fetch,
      now: deps.now || function () { return new Date(); },
      pageSize: deps.pageSize,
      log: log,
    });
  } catch (e) {
    log('build-data: failed, nothing written: ' + e.message);
    return 1;
  }
  // Written beside the target and renamed over it, so the target is either
  // the previous file or the complete new one, never part of one.
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  var tmp = out + '.partial';
  fs.writeFileSync(tmp, result.text);
  fs.renameSync(tmp, out);
  log('build-data: wrote ' + result.count + ' rows in ' + result.pages + ' pages, ' +
    Buffer.byteLength(result.text) + ' bytes, to ' + out);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exitCode = code; });
}

module.exports = {
  build: build,
  main: main,
  encode: encode,
  ENDPOINT: ENDPOINT,
  ORDER: ORDER,
  PAGE_SIZE: PAGE_SIZE,
  FORMAT: FORMAT,
  ROWS_UPDATED_HEADER: ROWS_UPDATED_HEADER,
};
