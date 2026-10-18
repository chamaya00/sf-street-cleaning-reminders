# Test fixtures

Both files come from branch `data/sf-street-sweeping`, written by GitHub Actions
run 38877227921 on 2026-10-16T08:58:18Z (research #3, section 4.7). Nothing here
is fetched live.

- `yhqp-riqs.soda2.json` is the full table, all 37,878 rows, converted from
  request 6 (`6-full-table.body`, the CSV export) into the SODA2 JSON row shape
  by `tools/csv-to-soda2.js`. It is committed uncompressed so that a re-run
  reproduces it byte for byte, whatever zlib build the machine has.
- `5-one-block-both-sides.body` is request 5's response, copied unchanged: the
  13 rows for CNN `8753101`, as SODA2 JSON. `test/fixture.test.js` compares
  them with the converted table.

Regenerate, and check the committed file is reproduced byte for byte, from the
repository root:

```sh
git fetch origin data/sf-street-sweeping
git show origin/data/sf-street-sweeping:6-full-table.body \
  | node tools/csv-to-soda2.js \
  | cmp - test/fixtures/yhqp-riqs.soda2.json && echo identical
```
