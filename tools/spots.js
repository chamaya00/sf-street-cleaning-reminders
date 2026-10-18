// Builds parking fixes at a known distance from a fixture block's centreline,
// for the tests. Lives outside test/ because `node --test` runs every .js file
// under a directory named test.
//
// It works in a plane tangent at the point it starts from, which over tens of
// metres is accurate to far below a millimetre per metre.

'use strict';

var fixture = require('./fixture');

var EARTH_RADIUS_M = 6371008.8;
var DEG = Math.PI / 180;

function rowsOf(cnn) {
  var rows = fixture.fullTable().filter(function (r) { return r.cnn === cnn; });
  if (rows.length === 0) throw new Error('no fixture rows for CNN ' + cnn);
  return rows;
}

// The point `metres` from a centreline, square to segment `segment`, at
// fraction `t` along it, on the side `side` ('L' or 'R') of the line read from
// its first coordinate to its last.
function offsetFromSegment(coords, segment, t, metres, side) {
  var a = coords[segment];
  var b = coords[segment + 1];
  var lon = a[0] + t * (b[0] - a[0]);
  var lat = a[1] + t * (b[1] - a[1]);
  var k = DEG * EARTH_RADIUS_M;
  var cos = Math.cos(lat * DEG);
  var dx = (b[0] - a[0]) * k * cos;
  var dy = (b[1] - a[1]) * k;
  var len = Math.sqrt(dx * dx + dy * dy);
  var sign = side === 'L' ? 1 : -1;
  var ox = sign * -dy / len * metres; // the left normal is (-dy, dx)
  var oy = sign * dx / len * metres;
  return { latitude: lat + oy / k, longitude: lon + ox / (k * cos) };
}

// A fix `metres` from the middle of a block's longest segment, on side `side`.
function besideBlock(cnn, metres, side) {
  var coords = rowsOf(cnn)[0].line.coordinates;
  var longest = 0;
  var best = -1;
  for (var i = 0; i + 1 < coords.length; i++) {
    var dx = coords[i + 1][0] - coords[i][0];
    var dy = coords[i + 1][1] - coords[i][1];
    var len = dx * dx + dy * dy;
    if (len > longest) { longest = len; best = i; }
  }
  return offsetFromSegment(coords, best, 0.5, metres, side);
}

// A point `metres` from another, on a compass bearing in degrees.
function move(point, bearing, metres) {
  var k = DEG * EARTH_RADIUS_M;
  return {
    latitude: point.latitude + Math.cos(bearing * DEG) * metres / k,
    longitude: point.longitude + Math.sin(bearing * DEG) * metres / (k * Math.cos(point.latitude * DEG)),
  };
}

// Straight-line metres between two points.
function metresBetween(p, q) {
  var k = DEG * EARTH_RADIUS_M;
  var dx = (q.longitude - p.longitude) * k * Math.cos(p.latitude * DEG);
  var dy = (q.latitude - p.latitude) * k;
  return Math.sqrt(dx * dx + dy * dy);
}

module.exports = {
  rowsOf: rowsOf,
  offsetFromSegment: offsetFromSegment,
  besideBlock: besideBlock,
  move: move,
  metresBetween: metresBetween,
};
