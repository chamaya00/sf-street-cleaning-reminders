// A stand-in for the city's SODA2 endpoint, for the build's tests. Lives
// outside test/ because `node --test` runs every .js file under a directory
// named test.
//
// It answers the two kinds of request tools/build-data.js makes: the row count
// (`$select=count(*) AS n`) and a page of rows (`$limit`, `$offset`, `$order`).
// Rows are served in the order given, which stands for `$order=:id`. Every
// response carries X-SODA2-Truth-Last-Modified, as the city's do (research #3,
// 4.5: request 2's headers).
//
// Failures are planted by option:
// - errorAt:    the page at this offset answers HTTP 500
// - notJsonAt:  the page at this offset answers 200 with an HTML body
// - shortAt:    the page at this offset is cut to half its rows
// - count:      the count the stub reports, in place of rows.length
// - lastModified, or a function of the request, for the header

'use strict';

// The value request 1's metadata reports as rowsUpdatedAt (1778758589), and
// requests 2 to 6 as Last-Modified and X-SODA2-Truth-Last-Modified.
var LAST_MODIFIED = 'Thu, 14 May 2026 11:36:29 GMT';

function create(rows, options) {
  options = options || {};
  var requests = [];

  function lastModified(url) {
    var v = options.lastModified === undefined ? LAST_MODIFIED : options.lastModified;
    return typeof v === 'function' ? v(url) : v;
  }

  function respond(status, body, url, contentType) {
    var headers = { 'Content-Type': contentType || 'application/json;charset=utf-8' };
    var lm = lastModified(url);
    if (lm !== null) headers['X-SODA2-Truth-Last-Modified'] = lm;
    return new Response(body, { status: status, headers: headers });
  }

  // fetch(url) as the build calls it: one string argument, GET.
  function fetch(input) {
    var url = new URL(String(input));
    requests.push(url);
    var q = url.searchParams;
    if (q.get('$select') === 'count(*) AS n') {
      var n = options.count === undefined ? rows.length : options.count;
      return Promise.resolve(respond(200, JSON.stringify([{ n: String(n) }]), url));
    }
    var offset = Number(q.get('$offset') || 0);
    var limit = Number(q.get('$limit') || 1000);
    if (offset === options.errorAt) {
      return Promise.resolve(respond(500, '{"error":true,"message":"Internal error"}', url));
    }
    if (offset === options.notJsonAt) {
      return Promise.resolve(respond(200, '<!DOCTYPE html><html><body>Service unavailable</body></html>', url, 'text/html'));
    }
    var page = rows.slice(offset, offset + limit);
    if (offset === options.shortAt) page = page.slice(0, Math.floor(page.length / 2));
    // Laid out the way the city lays out a response: one row per line.
    var body = '[' + page.map(function (r) { return JSON.stringify(r); }).join('\n,') + ']\n';
    return Promise.resolve(respond(200, body, url));
  }

  return { fetch: fetch, requests: requests };
}

module.exports = { create: create, LAST_MODIFIED: LAST_MODIFIED };
