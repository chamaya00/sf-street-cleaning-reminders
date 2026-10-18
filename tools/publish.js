// The commands that publish the site, in order, exactly as the weekly workflow
// (.github/proposed/publish.yml) runs them. test/site.test.js runs these same
// strings against a stubbed city endpoint, and test/workflow.test.js fails if
// the workflow's `run:` lines ever differ from them. Lives outside test/
// because `node --test` runs every .js file under a directory named test.

'use strict';

var COMMANDS = [
  'node tools/build-data.js _data/sweeping-data.json',
  'node tools/assemble-site.js _data/sweeping-data.json _site',
];

// The directory the workflow uploads to Pages.
var SITE_DIR = '_site';

module.exports = { COMMANDS: COMMANDS, SITE_DIR: SITE_DIR };
