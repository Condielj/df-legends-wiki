import assert from "node:assert/strict";
import test from "node:test";
import { groupExports } from "../importer.js";
import { parseWorld } from "../worker.js";

function xml(name, body, folder = "saves") {
  const file = new File([body], name);
  Object.defineProperty(file, "webkitRelativePath", {
    value: folder + "/" + name,
  });
  return file;
}

const prefix = "mountain-home-00250-03-02";
const base = xml(
  prefix + "-legends.xml",
  `<df_world><name>Endok</name>
<historical_figures><historical_figure><id>0</id><name>Urist</name><birth_year>0</birth_year></historical_figure></historical_figures>
<historical_events><historical_event><id>1</id><year>10</year><type>change hf state</type><hfid>0</hfid><site_id>-1</site_id></historical_event></historical_events>
<sites><site><id>7</id><name>Hammer &amp; Anvil</name></site></sites></df_world>`,
);
const plus = xml(
  prefix + "-legends_plus.xml",
  `<df_world><altname>The Mountain Home</altname>
<historical_figures><historical_figure><id>0</id><race>dwarf</race><deity/></historical_figure></historical_figures>
<historical_events><historical_event><id>1</id><site_id>7</site_id></historical_event></historical_events>
<landmasses><landmass><id>2</id><name>The Far Shore</name></landmass></landmasses></df_world>`,
);

test("matches one save and date per directory, with the base file first", () => {
  const otherDate = xml("mountain-home-00251-03-02-legends.xml", "");
  const otherFolder = xml(base.name, "", "other");
  const ignored = xml("unrelated.xml", "");
  const groups = groupExports([plus, otherDate, ignored, otherFolder, base]);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0].files, [base, plus]);
});

test("ingests and merges the whole snapshot, including plus-only sections", async () => {
  const world = await parseWorld([base, plus]);
  assert.equal(world.name, "Endok");
  assert.equal(world.alternateName, "The Mountain Home");
  assert.deepEqual(world.files, [base.name, plus.name]);
  assert.equal(world.figures.length, 1);
  assert.equal(world.figures[0].name, "Urist");
  assert.equal(world.figures[0].year, 0);
  assert.equal(world.figures[0].type, "dwarf");
  assert.equal(world.events[0].year, 10);
  assert.deepEqual(world.events[0].refs, [
    { kind: "figures", id: "0", role: "hfid" },
    { kind: "sites", id: "7", role: "site_id" },
  ]);
  assert.equal(world.sites[0].name, "Hammer & Anvil");
  assert.equal(world.other.landmasses[0].name, "The Far Shore");
});

test("decodes byte 0x81 in CP437 world names", async () => {
  const file = new File(
    [
      Buffer.from('<?xml version="1.0" encoding="CP437"?><df_world><name>K'),
      new Uint8Array([0x81]),
      "r</name></df_world>",
    ],
    "legends.xml",
  );
  assert.equal((await parseWorld([file])).name, "Kür");
});

test("rejects truncated, foreign, ambiguous, and empty XML", async () => {
  for (const content of [
    "<df_world><sites>",
    "<unrelated/>",
    "<df_world/><df_world/>",
    "<!DOCTYPE test><df_world/>",
    "",
  ]) {
    await assert.rejects(
      parseWorld([xml("legends.xml", content)]),
      /legends\.xml/,
    );
  }
});
