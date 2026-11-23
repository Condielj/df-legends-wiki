import assert from "node:assert/strict";
import test from "node:test";
import { atlasModel, politicalState, warRecords } from "../atlas.js";
import { groupExports } from "../importer.js";
import { parseWorld } from "../worker.js";
import { population } from "../census.js";
import { exampleWorld } from "../demo.js";

test("political state respects same-year ordering, evidence gaps, and destruction", () => {
  const world = exampleWorld();
  const site_id = "0";
  world.events = [
    ["4", "destroyed site", 10, {}],
    ["3", "new site leader", 9, { attacker_civ_id: "2" }],
    ["2", "site taken over", 9, { attacker_civ_id: "1" }],
    ["1", "created site", 2, { civ_id: "0" }],
  ].map(([id, type, year, fields]) => ({
    id,
    type,
    year,
    fields: { site_id, ...fields },
  }));
  const model = atlasModel(world),
    site = model.sites.get("0");
  assert.equal(politicalState(site, 1).status, "Before founding");
  assert.equal(politicalState(site, 8).owner, "0");
  assert.equal(politicalState(site, 9).owner, "2");
  assert.equal(politicalState(site, 10).status, "Destroyed");
  assert.equal(politicalState(model.sites.get("1"), 8).status, "Unknown");
});

test("a census attaches only to its XML snapshot and excludes wild and global totals from sites", async () => {
  const prefix = "region1-00100-01-01";
  const census = new File(
    [
      "Civilized World Population\n\t99 dwarves\nSites\n12: A, B\nOwner: C, dwarves\n\t14 dwarves\n\t7 cats\n13: Other, Another\n\tUnnumbered bees\nOutdoor Animal Populations (Including Undead)\n\t40 cats",
    ],
    prefix + "-world_sites_and_pops.txt",
  );
  const xml = new File(
    ["<df_world><name>Test</name></df_world>"],
    prefix + "-legends.xml",
  );
  const stray = new File(
    ["unread"],
    "region2-00100-01-01-world_sites_and_pops.txt",
  );
  const [g] = groupExports([stray, census, xml]);
  assert.deepEqual(g.files, [xml, census]);
  const w = await parseWorld(g.files);
  assert.equal(w.census.year, 100);
  assert.equal(w.census.civilized.dwarves, 99);
  assert.equal(population(w.census.sites["12"]), 21);
  assert.equal(population(w.census.sites["12"], "dwarves"), 14);
  assert.equal(population(w.census.sites["12"], "elves"), 0);
  assert.equal(population(w.census.sites["13"]), null);
  assert.equal(population(w.census.sites["14"]), null);
});
test("war articles follow collection membership, deduplicate cycles, and exclude unrelated transfers", () => {
  const w = exampleWorld();
  w.collections[1].fields.eventcol = "0";
  const model = atlasModel(w),
    campaign = warRecords(model, w.collections[0]);
  assert.equal(campaign.actions.length, 1);
  assert.deepEqual(
    campaign.transfers.map((e) => e.year),
    [89],
  );
});
