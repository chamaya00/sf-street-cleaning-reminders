# Lessons for the engineer in this repository

<!--
One line per lesson, specific to this repository, stated as a rule with the
reason attached. Hard cap of 40 non-blank lines, enforced by the guard.

Past the cap, rewrite rather than append: merge two lessons that say the same
thing, drop the one that has stopped being relevant, tighten what survives.

Delete any lesson that has graduated into a test, a lint rule, or a type.
-->
Keep test helpers in `tools/`, never under `test/`: `node --test` runs every .js file in a directory named test, so a helper there runs as a test file.
Run the suite under `/opt/node20/bin/node` as well as the default Node: the gate's `commands` path installs nothing, so CI gets whatever Node `ubuntu-latest` ships, and only the floor of 20 is promised.
Pick a real block for a location test by resolving a fix beside it first, never by its name: some CNNs share one centreline (Owens St 19995000 and 19996000) and divided roads are two parallel CNNs (Alemany Blvd), so a "single block" can silently be which-block.
Expect not to read the CI job's log from an agent sandbox (the log host answers Forbidden), only each step's result: run the gate's own commands locally first, and say in the PR body which of the two you saw.
