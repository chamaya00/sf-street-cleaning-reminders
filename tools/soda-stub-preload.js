// Loaded with `node --require` into a publish command that a test runs, so the
// command runs exactly as the workflow writes it while its fetch answers from
// tools/soda-stub.js instead of the city. Lives outside test/ because
// `node --test` runs every .js file under a directory named test.
//
// SODA_STUB_ROWS: the JSON file of rows to serve (the fixture).
// SODA_STUB_LOG:  a file each requested URL is appended to, one per line.
// Any request to a host other than the city's fails.

'use strict';

var fs = require('fs');
var stub = require('./soda-stub');

var rows = JSON.parse(fs.readFileSync(process.env.SODA_STUB_ROWS, 'utf8'));
var endpoint = stub.create(rows);

globalThis.fetch = function (input) {
  var url = new URL(String(input));
  if (process.env.SODA_STUB_LOG) fs.appendFileSync(process.env.SODA_STUB_LOG, url.href + '\n');
  if (url.host !== 'data.sf.gov') return Promise.reject(new Error('the stub serves the city only, not ' + url.host));
  return endpoint.fetch(input);
};
