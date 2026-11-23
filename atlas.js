import { population, censusDate, parseCensus } from "./census.js";

// Only explicit political events assign allegiance. Local government IDs
// (site_civ_id) are distinct from the parent civilization.
const changes = new Map([
  ["created site", ["Founded", "civ_id"]],
  ["settlement founded", ["Founded", "civ_id"]],
  ["reclaim site", ["Reclaimed", "civ_id"]],
  ["site taken over", ["Taken over", "attacker_civ_id"]],
  ["new site leader", ["New leadership", "attacker_civ_id"]],
  ["destroyed site", ["Destroyed"]],
  ["hf destroyed site", ["Destroyed"]],
  ["abandoned site", ["Abandoned"]],
]);
function coordinates(value) {
  const match = /^(\d+),\s*(\d+)$/.exec(String(value || ""));
  return match ? [Number(match[1]), Number(match[2])] : null;
}
export function atlasModel(world) {
  const sites = new Map(
    world.sites.map((s) => [
      s.id,
      { ...s, xy: coordinates(s.fields.coords), history: [] },
    ]),
  );
  const entities = new Map(world.entities.map((e) => [e.id, e]));
  let min = Infinity,
    max = -Infinity;
  for (const e of world.events) {
    if (!Number.isFinite(e.year)) continue;
    min = Math.min(min, e.year);
    max = Math.max(max, e.year);
    const change = changes.get(e.type.toLowerCase());
    if (!change) continue;
    const site = sites.get(e.fields.site_id);
    if (site)
      site.history.push({
        event: e,
        action: change[0],
        owner: e.fields[change[1]],
      });
  }
  for (const s of sites.values())
    s.history.sort(
      (a, b) =>
        a.event.year - b.event.year ||
        Number(a.event.fields.seconds72 ?? -1) -
          Number(b.event.fields.seconds72 ?? -1) ||
        Number(a.event.id) - Number(b.event.id),
    );
  const dated = world.files
    .map((f) => /-(\d+)-\d\d-\d\d-legends(?:_plus)?\.xml$/i.exec(f))
    .find(Boolean);
  max = Math.max(Number(dated?.[1] || 0), max, world.census?.year || 0);
  min = Math.min(min, max);
  return {
    sites,
    entities,
    min,
    max,
    census: world.census,
    collections: new Map(world.collections.map((c) => [c.id, c])),
    events: new Map(world.events.map((e) => [e.id, e])),
  };
}
export function politicalState(site, year) {
  const last = site.history.findLast((h) => h.event.year <= year);
  if (last)
    return {
      status:
        last.action === "Destroyed" || last.action === "Abandoned"
          ? last.action
          : "Recorded",
      owner: last.owner,
      source: last.event,
    };
  return {
    status:
      site.history[0]?.action === "Founded" ? "Before founding" : "Unknown",
  };
}
const many = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
export function warRecords(model, war) {
  const queue = [
    war,
    ...[...model.collections.values()].filter(
      (c) => c.fields.war_eventcol === war.id,
    ),
  ];
  const visited = new Set(),
    events = new Set(),
    actions = [];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (!c || visited.has(c.id)) continue;
    visited.add(c.id);
    if (c.type === "battle" || c.type === "site conquered") actions.push(c);
    for (const id of many(c.fields.event)) events.add(id);
    for (const id of many(c.fields.eventcol))
      queue.push(model.collections.get(id));
  }
  const transfers = [...events]
    .map((id) => model.events.get(id))
    .filter((e) => e?.type === "site taken over");
  return { actions: actions.sort((a, b) => a.year - b.year), transfers };
}
function color(id) {
  if (!id || id === "-1") return "#889199";
  let hash = 0;
  for (const c of id) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return "hsl(" + Math.round((hash * 137.508) % 360) + " 52% 40%)";
}
export function warSection(model, war, { link, escape, pretty }) {
  const { actions, transfers } = warRecords(model, war);
  const entity = (id) =>
    model.entities.has(id)
      ? link("entities", id, pretty(model.entities.get(id).name))
      : "Unknown";
  const locate = (id, y) =>
    model.sites.has(id)
      ? '<a href="#atlas/' +
        encodeURIComponent(id) +
        "?year=" +
        Number(y) +
        '">' +
        escape(pretty(model.sites.get(id).name)) +
        "</a>"
      : "Unspecified site";
  const rows = actions
    .map(
      (c) =>
        "<tr><td>" +
        escape(c.year) +
        "</td><td>" +
        link("collections", c.id, pretty(c.name)) +
        "</td><td>" +
        locate(c.fields.site_id, c.year) +
        "</td></tr>",
    )
    .join("");
  const captures = transfers
    .map(
      (e) =>
        "<li>Year " +
        e.year +
        " — " +
        locate(e.fields.site_id, e.year) +
        " passed from " +
        entity(e.fields.defender_civ_id) +
        " to " +
        entity(e.fields.attacker_civ_id) +
        ". " +
        link("events", e.id, "Source event") +
        "</li>",
    )
    .join("");
  return (
    "<h2>Campaign</h2><p>" +
    entity(war.fields.aggressor_ent_id) +
    " fought " +
    entity(war.fields.defender_ent_id) +
    ".</p>" +
    (rows
      ? '<table class="atlas-table"><caption>Battles and conquests linked to this war</caption><thead><tr><th>Year</th><th>Engagement</th><th>Site on atlas</th></tr></thead><tbody>' +
        rows +
        "</tbody></table>"
      : "<p>No battles or conquests are linked to this war.</p>") +
    (captures
      ? "<h3>Recorded transfers of control</h3><ul>" + captures + "</ul>"
      : "")
  );
}

export function mountAtlas(
  root,
  model,
  requestedSite,
  params,
  { escape, pretty, link },
) {
  const sites = [...model.sites.values()]
    .filter((s) => s.xy)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!sites.length) {
    root.innerHTML =
      "<p>This export contains no sites with map coordinates.</p>";
    return;
  }
  const contested = sites.toSorted(
    (a, b) =>
      b.history.filter((h) => h.action === "Taken over").length -
      a.history.filter((h) => h.action === "Taken over").length,
  );
  let site = model.sites.get(requestedSite);
  if (!site?.xy) site = contested[0];
  const clampYear = (y) =>
    Math.min(
      model.max,
      Math.max(model.min, Number.isFinite(y) ? y : model.max),
    );
  let year = clampYear(
    params.has("year") ? Number(params.get("year")) : model.max,
  );
  const census = model.census;
  let layer = "political",
    species = "",
    zoom = 1,
    prior = null;
  const censusYear = census?.year ?? model.max;
  const fmt = (n) => (n == null ? "Unknown" : n.toLocaleString());
  const option = (v, t) =>
    '<option value="' + escape(v) + '">' + escape(t) + "</option>";
  const mapSites = sites.map((s) => option(s.id, pretty(s.name))).join("");
  const speciesNames = census
    ? [
        ...new Set(
          Object.values(census.sites).flatMap((rows) => Object.keys(rows)),
        ),
      ].sort()
    : [];
  const extent = sites.reduce(
    (a, s) => [Math.max(a[0], s.xy[0]), Math.max(a[1], s.xy[1])],
    [1, 1],
  );
  root.innerHTML =
    '<div class="atlas-controls"><label>Map layer <select data-layer><option value="political">Political control</option><option value="population">Population census</option></select></label><label>Settlement <select data-site>' +
    mapSites +
    '</select></label><label>Scale <select data-zoom><option value="1">World</option><option value="2">2×</option><option value="4">4×</option></select></label></div>' +
    '<div class="atlas-years"><label>Year <output data-year-label></output> <input aria-label="Political map year" data-year type="range" min="' +
    model.min +
    '" max="' +
    model.max +
    '" value="' +
    year +
    '"></label><label data-species-wrap hidden>Population <select data-species><option value="">All recorded species</option>' +
    speciesNames.map((n) => option(n, pretty(n))).join("") +
    "</select></label></div>" +
    '<div class="atlas-spread"><figure><svg data-map viewBox="0 0 600 430" aria-label="Map of recorded settlements"></svg><figcaption data-caption></figcaption></figure><div data-detail class="atlas-detail"></div></div><div data-legend></div><section data-ranking></section>';
  const get = (key) => root.querySelector("[data-" + key + "]");
  get("site").value = site.id;
  const ownerName = (id) =>
    model.entities.get(id)?.name
      ? pretty(model.entities.get(id).name)
      : id && id !== "-1"
        ? "Civilization " + id
        : "Unknown allegiance";
  const ownerLink = (id) =>
    model.entities.has(id)
      ? link("entities", id, ownerName(id))
      : escape(ownerName(id));
  const count = (s, c = census) => population(c?.sites[s.id], species);
  function selectSite(id) {
    if (!model.sites.get(id)?.xy) return;
    site = model.sites.get(id);
    get("site").value = id;
    draw();
  }
  function draw(updateUrl = true) {
    const pop = layer === "population",
      at = pop ? censusYear : year,
      counts = new Map();
    get("year-label").textContent = at;
    get("year").disabled = pop;
    get("year").value = at;
    get("species-wrap").hidden = !pop || !census;
    const w = 600,
      h = 430,
      margin = 27;
    const scale =
      Math.min((w - 2 * margin) / extent[0], (h - 2 * margin) / extent[1]) *
      zoom;
    const center = zoom === 1 ? [extent[0] / 2, extent[1] / 2] : site.xy;
    const project = ([x, y]) => [
      w / 2 + (x - center[0]) * scale,
      h / 2 + (y - center[1]) * scale,
    ];
    const largest = pop
      ? sites.reduce((n, s) => Math.max(n, count(s) || 0), 1)
      : 1;
    let dots = "",
      selected = "";
    const step = Math.max(1, Math.pow(2, Math.round(Math.log2(58 / scale))));
    let grid = "";
    for (let axis = 0; axis < 2; axis++) {
      const len = axis === 0 ? w : h;
      for (
        let t = Math.max(
          0,
          Math.ceil((center[axis] - len / (2 * scale)) / step) * step,
        );
        t <= extent[axis];
        t += step
      ) {
        const v = len / 2 + (t - center[axis]) * scale;
        if (v > len - 8) break;
        grid +=
          axis === 0
            ? '<path d="M' +
              v +
              ' 0v430"/><text x="' +
              (v + 3) +
              '" y="13">' +
              t +
              "</text>"
            : '<path d="M0 ' +
              v +
              'h600"/><text x="4" y="' +
              (v - 3) +
              '">' +
              t +
              "</text>";
      }
    }
    for (const s of sites) {
      const state = politicalState(s, at),
        n = pop ? count(s) : null;
      if (!pop && state.status === "Before founding") continue;
      if (!pop && state.owner && state.owner !== "-1")
        counts.set(state.owner, (counts.get(state.owner) || 0) + 1);
      const [x, y] = project(s.xy);
      if (x < 0 || y < 0 || x > w || y > h) continue;
      const r = pop && n != null ? 2 + 11 * Math.sqrt(n / largest) : 3.7;
      const fill = pop
        ? n == null
          ? "#989fa3"
          : "#326f89"
        : color(state.owner);
      const tooltip = escape(
        pretty(s.name) +
          " · " +
          (pop
            ? fmt(n)
            : state.status === "Recorded"
              ? ownerName(state.owner)
              : state.status),
      );
      const entry =
        '<g data-marker="' +
        escape(s.id) +
        '"><title>' +
        tooltip +
        '</title><circle cx="' +
        x +
        '" cy="' +
        y +
        '" r="' +
        Math.max(6, r + 2) +
        '" fill="transparent"/><circle cx="' +
        x +
        '" cy="' +
        y +
        '" r="' +
        r +
        '" fill="' +
        fill +
        '" stroke="white" stroke-width=".9"/></g>';
      if (s.id === site.id)
        selected =
          '<circle cx="' +
          x +
          '" cy="' +
          y +
          '" r="' +
          (r + 4) +
          '" fill="none" stroke="#202122" stroke-width="2"/>' +
          entry +
          '<text class="atlas-place" text-anchor="' +
          (x > w / 2 ? "end" : "start") +
          '" x="' +
          (x + (x > w / 2 ? -1 : 1) * (r + 7)) +
          '" y="' +
          (y + 4) +
          '">' +
          escape(pretty(site.name)) +
          "</text>";
      else dots += entry;
    }
    get("map").innerHTML =
      '<g class="atlas-grid">' + grid + "</g>" + dots + selected;
    get("caption").textContent = pop
      ? census
        ? "Marker size shows the selected census count in year " +
          censusYear +
          ". Gray indicates an unknown count."
        : "Site positions only. Add the matching world_sites_and_pops.txt to the export folder to show population."
      : "World-tile coordinates · North is up. Color shows the last recorded civilization at the end of year " +
        year +
        ". Gray marks unknown control or an inactive site.";
    const state = politicalState(site, at);
    const record =
      "<p>" + link("sites", site.id, "Read settlement article") + "</p>";
    let detail =
      "<h3>" +
      escape(pretty(site.name)) +
      "</h3><small>" +
      escape(pretty(site.type)) +
      " · " +
      site.xy.join(", ") +
      "</small>";
    if (pop) {
      detail +=
        "<p><b>" +
        fmt(count(site)) +
        "</b> " +
        (species ? escape(species) : "recorded individuals") +
        "</p>";
      const rows = Object.entries(census?.sites[site.id] || {}).sort(
        (a, b) => (b[1] || 0) - (a[1] || 0),
      );
      if (rows.length)
        detail +=
          '<dl class="census-list">' +
          rows
            .map(
              ([n, v]) =>
                "<dt>" + escape(pretty(n)) + "</dt><dd>" + fmt(v) + "</dd>",
            )
            .join("") +
          "</dl>";
    } else {
      detail +=
        "<p>Year " +
        year +
        "<br><strong>" +
        (state.status === "Recorded"
          ? ownerLink(state.owner)
          : escape(state.status)) +
        "</strong></p><h4>Political history</h4>";
      detail += site.history.length
        ? '<ol class="atlas-history">' +
          site.history
            .map(
              (h) =>
                '<li class="' +
                (state.source === h.event ? "current" : "") +
                '"><button data-jump="' +
                h.event.year +
                '">Year ' +
                h.event.year +
                "</button> " +
                link("events", h.event.id, h.action) +
                (h.owner && h.owner !== "-1"
                  ? " · " + ownerLink(h.owner)
                  : "") +
                "</li>",
            )
            .join("") +
          "</ol>"
        : "<p>No dated political changes recorded.</p>";
    }
    get("detail").innerHTML = detail + record;
    const ordered = [...counts].sort((a, b) => b[1] - a[1]);
    get("legend").innerHTML = pop
      ? ""
      : "<details><summary>Civilization key (" +
        ordered.length +
        ')</summary><ul class="atlas-key">' +
        ordered
          .map(
            ([id, n]) =>
              '<li><i style="background:' +
              color(id) +
              '"></i>' +
              ownerLink(id) +
              " (" +
              n +
              ")</li>",
          )
          .join("") +
        "</ul></details>";
    // Preserve the selection in shared links and browser refreshes.
    const next = new URLSearchParams({ year: String(year) });
    if (pop) {
      next.set("layer", "population");
      if (species) next.set("species", species);
    }
    if (updateUrl)
      history.replaceState(
        null,
        "",
        "#atlas/" + encodeURIComponent(site.id) + "?" + next,
      );
  }
  function rankings() {
    const box = get("ranking");
    if (layer !== "population" || !census) {
      box.innerHTML = "";
      return;
    }
    const rows = sites
      .map((s) => ({
        s,
        n: count(s),
        old:
          prior &&
          prior.names[s.id] &&
          prior.names[s.id] === census.names?.[s.id]
            ? count(s, prior)
            : null,
      }))
      .filter((r) => r.n != null)
      .sort((a, b) => b.n - a.n || a.s.name.localeCompare(b.s.name));
    box.innerHTML =
      "<h3>Largest recorded populations</h3><p>Year " +
      censusYear +
      " · " +
      (species ? escape(pretty(species)) : "All species, including animals") +
      '</p><table class="atlas-table"><thead><tr><th>Settlement</th><th>Population</th>' +
      (prior ? "<th>Change since " + escape(prior.date) + "</th>" : "") +
      "</tr></thead><tbody>" +
      rows
        .slice(0, 25)
        .map(
          ({ s, n, old }) =>
            '<tr><td><button class="atlas-link" data-pick="' +
            escape(s.id) +
            '">' +
            escape(pretty(s.name)) +
            "</button></td><td>" +
            fmt(n) +
            "</td>" +
            (prior
              ? "<td>" +
                (old == null
                  ? "Unknown"
                  : (n > old ? "+" : "") + fmt(n - old)) +
                "</td>"
              : "") +
            "</tr>",
        )
        .join("") +
      "</tbody></table>" +
      (census.date
        ? '<label>Compare an earlier census from this save <input type="file" data-prior accept=".txt"></label><p data-message role="status"></p>'
        : "");
  }
  get("year").oninput = (e) => {
    year = clampYear(Number(e.target.value));
    draw();
  };
  get("site").onchange = (e) => selectSite(e.target.value);
  get("zoom").onchange = (e) => {
    zoom = Number(e.target.value);
    draw();
  };
  get("layer").onchange = (e) => {
    layer = e.target.value;
    draw();
    rankings();
  };
  get("species").onchange = (e) => {
    species = e.target.value;
    draw();
    rankings();
  };
  root.onclick = (e) => {
    const marker = e.target.closest("[data-marker],[data-pick],[data-jump]");
    if (!marker) return;
    if (marker.hasAttribute("data-jump")) {
      year = Number(marker.dataset.jump);
      draw();
    } else selectSite(marker.dataset.marker ?? marker.dataset.pick);
  };
  root.onchange = async (e) => {
    if (!e.target.hasAttribute("data-prior") || !e.target.files.length) return;
    const file = e.target.files[0],
      date = censusDate(file.name);
    try {
      if (!date || date.save !== census.save || date.date >= census.date)
        throw Error(
          "Choose a census with the same save prefix and an earlier export date.",
        );
      const earlier = parseCensus(await file.text(), file.name);
      if (
        !Object.entries(earlier.names).some(
          ([id, name]) => name && name === census.names?.[id],
        )
      )
        throw Error(
          "The two censuses have no matching settlement IDs and names.",
        );
      prior = earlier;
      rankings();
    } catch (err) {
      if (get("message")) get("message").textContent = err.message;
    }
  };
  if (params.get("layer") === "population") {
    layer = "population";
    get("layer").value = layer;
    if (speciesNames.includes(params.get("species"))) {
      species = params.get("species");
      get("species").value = species;
    }
  }
  draw(false);
  rankings();
}
