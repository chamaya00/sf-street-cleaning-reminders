// Converts DataSF's CSV export of the street sweeping table (yhqp-riqs) into
// rows in the SODA2 JSON shape that src/sweeping.js reads (research #3, 4.2):
//
// - field names are the lower-cased column names, in the CSV's column order;
// - every value is a string, numbers included;
// - an empty CSV value is a null, and SODA2 leaves a null field out of the row;
// - `line` is a GeoJSON LineString with [longitude, latitude] pairs.
//
// The output is laid out the way the SODA2 endpoint lays out a response: one
// row per line, joined by "\n,", inside [ and ], with a trailing newline.
//
// Usage, from the repository root (see test/fixtures/README.md):
//   git show origin/data/sf-street-sweeping:6-full-table.body \
//     | node tools/csv-to-soda2.js > test/fixtures/yhqp-riqs.soda2.json

'use strict';

function parseCsvLine(line) {
  var out = [];
  var i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      var j = i + 1;
      var s = '';
      for (;;) {
        if (j >= line.length) throw new Error('unterminated quote: ' + line);
        if (line[j] === '"' && line[j + 1] === '"') { s += '"'; j += 2; }
        else if (line[j] === '"') break;
        else s += line[j++];
      }
      out.push(s);
      i = j + 2;
    } else {
      var k = line.indexOf(',', i);
      if (k < 0) k = line.length;
      out.push(line.slice(i, k));
      i = k + 1;
    }
  }
  return out;
}

function wktLineString(text) {
  var m = /^LINESTRING \((.*)\)$/.exec(text);
  if (!m) throw new Error('not a WKT LINESTRING: ' + text);
  return {
    type: 'LineString',
    coordinates: m[1].split(', ').map(function (pair) {
      var xy = pair.split(' ');
      if (xy.length !== 2) throw new Error('bad coordinate pair: ' + pair);
      return xy.map(function (t) {
        var n = Number(t);
        // A coordinate whose text does not survive Number() would print
        // differently from the city's JSON. None does today; fail if one ever does.
        if (String(n) !== t) throw new Error('coordinate does not round-trip: ' + t);
        return n;
      });
    }),
  };
}

function convert(csv) {
  var lines = csv.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  var header = parseCsvLine(lines[0]).map(function (h) { return h.toLowerCase(); });
  var rows = lines.slice(1).map(function (line, n) {
    var values = parseCsvLine(line);
    if (values.length !== header.length) {
      throw new Error('row ' + (n + 1) + ' has ' + values.length + ' fields, expected ' + header.length);
    }
    var row = {};
    header.forEach(function (name, c) {
      if (values[c] === '') return;
      row[name] = name === 'line' ? wktLineString(values[c]) : values[c];
    });
    return JSON.stringify(row);
  });
  return '[' + rows.join('\n,') + ']\n';
}

module.exports = { convert: convert, parseCsvLine: parseCsvLine };

if (require.main === module) {
  var chunks = [];
  process.stdin.on('data', function (c) { chunks.push(c); });
  process.stdin.on('end', function () {
    process.stdout.write(convert(Buffer.concat(chunks).toString('utf8')));
  });
}
