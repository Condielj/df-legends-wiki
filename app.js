import { exampleWorld } from "./demo.js";
import { groupExports, importWorld } from "./importer.js";
import { icon } from "./icons.js";

const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const pretty = (str) =>
  String(str || "")
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
const number = (n) => n.toLocaleString();
const names = {
  overview: "World overview",
  figures: "Historical figures",
  entities: "Entities",
  sites: "Sites",
  artifacts: "Artifacts",
  events: "Timeline",
  stats: "Statistics",
  collections: "Event collections",
  regions: "Regions",
  eras: "Eras",
};
const mainKinds = ["figures", "entities", "sites", "artifacts"];
const path = (kind, id) =>
  "#" +
  encodeURIComponent(kind) +
  (id === undefined ? "" : "/" + encodeURIComponent(id));
const link = (kind, id, label) =>
  '<a href="' + path(kind, id) + '">' + escape(label) + "</a>";
const label = (k) => names[k] || pretty(k.replace(/^other:/, ""));
const badge = (kind) =>
  '<span class="symbol ' + kind + '">' + icon(kind, 19) + "</span>";
const dialog = $("#dialog");
const content = $("#content");
let world,
  tables,
  indices,
  timeline,
  years,
  category,
  page,
  query,
  articleLimit,
  binCount = 24;
let busy = false,
  hydration = 0;
let eventLinks;
function install(data) {
  eventLinks = null;
  world = data;
  tables = new Map(
    [...mainKinds, "events", "collections", "regions", "eras"].map((k) => [
      k,
      data[k] || [],
    ]),
  );
  for (const [k, list] of Object.entries(data.other || {}))
    tables.set("other:" + k, list);
  indices = new Map();
  timeline = [...world.events].sort(
    (a, b) =>
      (b.year ?? -Infinity) - (a.year ?? -Infinity) ||
      Number(b.id) - Number(a.id),
  );
  years = timeline.filter((x) => Number.isFinite(x.year)).map((x) => x.year);
  $("#worldfoot").innerHTML =
    icon("globe", 23) +
    "<div>" +
    escape(world.name) +
    "<small>" +
    (world.demo ? "Example world" : "Imported world") +
    "</small></div>";
}
function lookup(k, id) {
  if (!tables.has(k)) return;
  if (!indices.has(k))
    indices.set(k, new Map(tables.get(k).map((r) => [r.id, r])));
  return indices.get(k).get(id);
}
function title(k, r) {
  if (k === "events" && r.name === r.type) {
    const first = (r.refs || [])
      .map((ref) => lookup(ref.kind, ref.id))
      .find(Boolean);
    return pretty(r.type) + (first ? " · " + pretty(first.name) : "");
  }
  return pretty(r.name);
}
function navigation(active) {
  const group = (heading, keys) =>
    '<div class="navgroup">' +
    heading +
    "</div>" +
    keys
      .map(
        (k) =>
          '<a href="' +
          path(k) +
          '" ' +
          (active === k ? 'class="active" aria-current="page"' : "") +
          ">" +
          icon(k) +
          " " +
          escape(label(k)) +
          "</a>",
      )
      .join("");
  const extra = [...tables]
    .filter(([k, v]) => v.length && !mainKinds.includes(k) && k !== "events")
    .map(([k]) => k);
  $("#nav").innerHTML =
    group("World atlas", ["overview", "events", "stats"]) +
    group("Encyclopedia", mainKinds) +
    (extra.length ? group("More records", extra) : "");
  $("#crumb").textContent = label(active);
}
function pagehead(k, heading, sub = "") {
  return (
    '<div class="pagehead"><div class="eyebrow">' +
    icon(k, 15) +
    " World encyclopedia</div><h1>" +
    escape(heading) +
    "</h1>" +
    (sub ? '<p class="muted">' + escape(sub) + "</p>" : "") +
    "</div>"
  );
}
function metrics() {
  return (
    '<div class="metrics">' +
    ["figures", "entities", "sites", "events"]
      .map(
        (k) =>
          '<a class="metric" href="' +
          path(k) +
          '">' +
          badge(k) +
          "<strong>" +
          number(world[k].length) +
          "</strong><label>" +
          (k === "events" ? "Recorded events" : label(k)) +
          "</label></a>",
      )
      .join("") +
    "</div>"
  );
}
function chart() {
  if (!years.length)
    return '<p class="muted">This world has no dated events.</p>';
  const lo = years.at(-1),
    hi = years[0],
    size = Math.max(1, Math.ceil((hi - lo + 1) / binCount));
  const bins = Array(Math.ceil((hi - lo + 1) / size)).fill(0);
  for (const y of years) bins[Math.floor((y - lo) / size)]++;
  const max = Math.max(...bins, 1),
    left = 36,
    right = 484,
    top = 12,
    bottom = 149;
  const x = (i) => left + ((i + 0.5) * (right - left)) / bins.length;
  const y = (v) => bottom - (v / max) * (bottom - top);
  const points = bins
    .map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1))
    .join(" ");
  const ticks = [0, 0.5, 1]
    .map(
      (t) =>
        '<path d="M' +
        left +
        " " +
        y(t * max) +
        " H" +
        right +
        '" stroke="#dfe5dc" stroke-dasharray="3 3"/><text x="29" y="' +
        (y(t * max) + 4) +
        '" text-anchor="end">' +
        number(Math.round(max * t)) +
        "</text>",
    )
    .join("");
  const axis = [
    ...new Set([0, Math.floor((bins.length - 1) / 2), bins.length - 1]),
  ]
    .map(
      (i) =>
        '<text x="' +
        x(i) +
        '" y="170" text-anchor="middle">' +
        (lo + i * size) +
        "</text>",
    )
    .join("");
  return (
    '<svg class="chart" role="img" aria-label="Distribution of ' +
    number(years.length) +
    " dated events between years " +
    lo +
    " and " +
    hi +
    '" viewBox="0 0 500 178"><defs><linearGradient id="fill" x2="0" y2="1"><stop stop-color="#99b58f" stop-opacity=".65"/><stop offset="1" stop-color="#cbd9bd" stop-opacity=".18"/></linearGradient></defs>' +
    ticks +
    '<polygon fill="url(#fill)" points="' +
    x(0) +
    "," +
    bottom +
    " " +
    points +
    " " +
    x(bins.length - 1) +
    "," +
    bottom +
    '"/><polyline points="' +
    points +
    '" fill="none" stroke="#517652" stroke-width="2.7" stroke-linejoin="round"/>' +
    bins
      .map(
        (v, i) =>
          '<circle cx="' +
          x(i) +
          '" cy="' +
          y(v) +
          '" r="3" fill="#517652"><title>Years ' +
          (lo + i * size) +
          "–" +
          Math.min(hi, lo + (i + 1) * size - 1) +
          ": " +
          number(v) +
          " events</title></circle>",
      )
      .join("") +
    axis +
    '</svg><div class="legend">Events per ' +
    (size === 1 ? "year" : size + " years") +
    "</div>"
  );
}
function historyPanel() {
  return (
    '<section class="panel"><div class="paneltop"><h2>Historical activity</h2><select id="bins" aria-label="Chart detail">' +
    [
      [12, "Coarse"],
      [24, "Standard"],
      [48, "Detailed"],
    ]
      .map(
        ([v, t]) =>
          '<option value="' +
          v +
          '" ' +
          (v === binCount ? "selected" : "") +
          ">" +
          t +
          "</option>",
      )
      .join("") +
    '</select></div><p class="sub">Recorded events across the years</p><div id="chart">' +
    chart() +
    "</div></section>"
  );
}
function overview() {
  const meta =
    "<span>" +
    icon("calendar", 15) +
    (years.length
      ? "Years " + years.at(-1) + "–" + years[0]
      : "Undated world") +
    "</span><span>" +
    icon("book", 15) +
    (world.demo
      ? "Example world"
      : world.files.length +
        " source file" +
        (world.files.length === 1 ? "" : "s")) +
    "</span>";
  const latest = timeline
    .slice(0, 3)
    .map(
      (e) =>
        '<div class="story"><div><small>' +
        (e.year == null ? "Undated" : "Year " + e.year) +
        "</small>" +
        link("events", e.id, title("events", e)) +
        "</div></div>",
    )
    .join("");
  return (
    '<section class="hero"><img src="assets/fortress.svg" alt=""><div class="heroCopy"><div class="eyebrow">' +
    icon("globe", 15) +
    " World atlas</div><h1>" +
    escape(pretty(world.name)) +
    "</h1><p>" +
    escape(world.alternateName || "A Dwarf Fortress world") +
    '</p><div class="meta">' +
    meta +
    '</div></div></section><div class="sectionhead"><h2>World at a glance</h2><a class="textlink" href="#stats">View statistics</a></div>' +
    metrics() +
    '<div class="panels">' +
    historyPanel() +
    '<section class="panel"><div class="paneltop"><h2>Recent chronicles</h2><a class="textlink" href="#events">Timeline</a></div><p class="sub">The latest entries in world history</p>' +
    (latest || "<p>No events recorded.</p>") +
    "</section></div>"
  );
}
function breakdown(kind) {
  const counts = new Map();
  for (const r of tables.get(kind))
    counts.set(r.type, (counts.get(r.type) || 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    '<section class="panel"><h2>' +
    escape(label(kind)) +
    ' by type</h2><p class="sub">Most frequent types in this world</p>' +
    (top
      .map(
        ([type, n]) =>
          '<div class="smallhead"><span>' +
          escape(pretty(type)) +
          "</span><b>" +
          number(n) +
          '</b></div><div class="bar"><i style="width:' +
          (100 * n) / top[0][1] +
          '%"></i></div>',
      )
      .join("") || "<p>No records.</p>") +
    "</section>"
  );
}
function row(k, r) {
  return (
    '<div class="row">' +
    badge(k) +
    "<div>" +
    link(k, r.id, title(k, r)) +
    "<small>" +
    escape(pretty(r.type)) +
    (r.year == null ? "" : " · Year " + r.year) +
    "</small></div></div>"
  );
}
function listRows() {
  const list = category === "events" ? timeline : tables.get(category);
  const q = query.trim().toLowerCase();
  const found = q
    ? list.filter((r) =>
        (r.name + " " + r.type + " " + r.id + " " + (r.year ?? ""))
          .toLowerCase()
          .includes(q),
      )
    : list;
  const per = 30,
    pages = Math.max(1, Math.ceil(found.length / per));
  page = Math.min(page, pages - 1);
  $("#rows").innerHTML =
    found
      .slice(page * per, (page + 1) * per)
      .map((r) => row(category, r))
      .join("") || "<p>No matching records.</p>";
  $("#pager").innerHTML =
    '<button data-page="-1" ' +
    (page === 0 ? "disabled" : "") +
    ">Previous</button><small>" +
    number(found.length) +
    " records · Page " +
    number(page + 1) +
    " of " +
    number(pages) +
    '</small><button data-page="1" ' +
    (page === pages - 1 ? "disabled" : "") +
    ">Next</button>";
}
function formatField(v) {
  if (Array.isArray(v))
    return (
      v.slice(0, 50).map(formatField).join(", ") + (v.length > 50 ? " …" : "")
    );
  if (v && typeof v === "object")
    return Object.entries(v)
      .slice(0, 50)
      .map(([k, val]) => escape(pretty(k)) + " — " + formatField(val))
      .join("<br>");
  return escape(v);
}
function linkedEvents(k, id) {
  if (k === "events") return [];
  if (!eventLinks) {
    eventLinks = new Map();
    for (const event of timeline) {
      const keys = new Set(
        (event.refs || []).map((ref) => ref.kind + "/" + ref.id),
      );
      for (const key of keys) {
        if (!eventLinks.has(key)) eventLinks.set(key, []);
        eventLinks.get(key).push(event);
      }
    }
  }
  return eventLinks.get(k + "/" + id) || [];
}
function article(k, r) {
  const refs = (r.refs || []).filter((ref) => lookup(ref.kind, ref.id));
  const related = linkedEvents(k, r.id);
  const fields = Object.entries(r.fields || {});
  const head = title(k, r);
  const type = pretty(r.type);
  const facts = [
    ["Category", label(k)],
    ["Type", type],
    ["Record ID", r.id],
  ];
  if (k === "figures" && r.fields.birth_year != null)
    facts.push(["Born", "Year " + r.fields.birth_year]);
  else if (r.year != null) facts.push(["Year", r.year]);
  if (k === "figures" && r.fields.death_year && r.fields.death_year !== "-1")
    facts.push(["Died", "Year " + r.fields.death_year]);
  const factList = facts
    .map(([key, v]) => "<dt>" + escape(key) + "</dt><dd>" + escape(v) + "</dd>")
    .join("");
  const uniqueRefs = [
    ...new Map(refs.map((ref) => [ref.kind + "/" + ref.id, ref])).values(),
  ];
  const refLink = (ref) =>
    link(ref.kind, ref.id, title(ref.kind, lookup(ref.kind, ref.id)));
  let lead = "<strong>" + escape(head) + "</strong>";
  if (k === "events") {
    lead +=
      " is recorded in " +
      escape(pretty(world.name)) +
      (r.year == null ? "" : " in year " + r.year) +
      ".";
    if (uniqueRefs.length)
      lead +=
        " The entry mentions " +
        uniqueRefs.slice(0, 4).map(refLink).join(", ") +
        ".";
  } else {
    const singular =
      {
        figures: "historical figure",
        sites: "site",
        entities: "group",
        artifacts: "artifact",
        regions: "region",
        eras: "era",
        collections: "collection of events",
      }[k] || "record";
    lead +=
      " is " +
      (/^[aeiou]/.test(singular) ? "an " : "a ") +
      singular +
      " in " +
      escape(pretty(world.name)) +
      ".";
    if (related.length) {
      const oldest = related.at(-1);
      lead +=
        " The world chronicle mentions " +
        escape(pretty(r.name)) +
        " in " +
        number(related.length) +
        " " +
        (related.length === 1 ? "event" : "events") +
        ".";
      if (oldest.year != null)
        lead +=
          " The earliest is " +
          link("events", oldest.id, title("events", oldest)) +
          " in year " +
          oldest.year +
          ".";
    }
  }
  const linked = uniqueRefs
    .slice(0, articleLimit)
    .map(
      (ref) =>
        "<li>" +
        refLink(ref) +
        " <small>" +
        escape(pretty(ref.role)) +
        "</small></li>",
    )
    .join("");
  const sourceFields = fields
    .map(
      ([key, v]) =>
        "<dt>" + escape(pretty(key)) + "</dt><dd>" + formatField(v) + "</dd>",
    )
    .join("");
  return (
    '<a class="textlink" href="' +
    path(k) +
    '">' +
    escape(label(k)) +
    "</a>" +
    pagehead(k, head) +
    '<section class="article wiki"><div class="infobox">' +
    badge(k) +
    "<h2>" +
    escape(pretty(r.name)) +
    '</h2><dl class="facts">' +
    factList +
    '</dl></div><p class="lead">' +
    lead +
    "</p>" +
    (related.length
      ? "<h2>Recorded history</h2>" +
        related
          .slice(0, articleLimit)
          .map((e) => row("events", e))
          .join("")
      : "") +
    (linked ? "<h2>Linked articles</h2><ul>" + linked + "</ul>" : "") +
    (Math.max(uniqueRefs.length, related.length) > articleLimit
      ? '<button id="more">Show more entries</button>'
      : "") +
    (fields.length
      ? '<details><summary>Source fields</summary><dl class="facts">' +
        sourceFields +
        "</dl></details>"
      : "") +
    "</section>"
  );
}
function render(reset = true) {
  let route;
  try {
    route = location.hash.slice(1).split("/").map(decodeURIComponent);
  } catch {
    route = [];
  }
  let [k, id] = route;
  if (!tables.has(k) && !["overview", "stats"].includes(k)) k = "overview";
  if (reset) {
    page = 0;
    query = "";
    articleLimit = 30;
  }
  category = k;
  navigation(k);
  if (id !== undefined && tables.has(k)) {
    const r = lookup(k, id);
    content.innerHTML = r
      ? article(k, r)
      : pagehead(
          k,
          "Article unavailable",
          "This record does not exist in the loaded world.",
        );
  } else if (k === "overview") content.innerHTML = overview();
  else if (k === "stats")
    content.innerHTML =
      pagehead(k, "World statistics", pretty(world.name)) +
      metrics() +
      '<div class="panels">' +
      historyPanel() +
      breakdown("events") +
      breakdown("figures") +
      breakdown("sites") +
      "</div>";
  else {
    content.innerHTML =
      pagehead(
        k,
        label(k),
        number(tables.get(k).length) + " records in " + pretty(world.name),
      ) +
      '<section class="article"><input type="search" class="filter" aria-label="Filter records" placeholder="Filter by name, type or ID"><div id="rows"></div><div class="pagebar" id="pager"></div></section>';
    listRows();
  }
  document.title =
    (id !== undefined && lookup(k, id) ? title(k, lookup(k, id)) : label(k)) +
    " · Legends Wiki";
  document.body.classList.remove("open");
  if (reset) window.scrollTo(0, 0);
}
function modal(titleText, html) {
  $("#dialogbody").innerHTML =
    '<div class="paneltop"><h2>' +
    escape(titleText) +
    '</h2><button class="close" aria-label="Close dialog">×</button></div>' +
    html;
  if (!dialog.open) dialog.showModal();
}
function search() {
  if (busy) return;
  modal(
    "Search this world",
    '<input id="search" type="search" placeholder="Search figures, sites, events…" aria-label="Search this world"><div id="results"></div>',
  );
  $("#search").focus();
  $("#results").innerHTML =
    '<p class="muted">Search by article name, type, or record ID.</p>';
}
function searchResults(q) {
  const result = [];
  q = q.trim().toLowerCase();
  if (q)
    for (const [k, list] of tables) {
      for (const r of list) {
        if ((r.name + " " + r.type).toLowerCase().includes(q) || r.id === q)
          result.push(row(k, r));
        if (result.length >= 30) break;
      }
      if (result.length >= 30) break;
    }
  $("#results").innerHTML =
    result.join("") +
    '<p class="muted">' +
    (result.length === 30
      ? "Showing the first 30 matches."
      : q && !result.length
        ? "No matching articles."
        : "") +
    "</p>";
}
function importDialog() {
  if (busy) return;
  modal(
    "Import a world",
    '<p>Choose an export folder, then select a snapshot to import. The viewer lists snapshots using filenames.</p><div class="options"><button class="primary" id="folder">Choose export folder</button><button id="files">Choose XML files</button></div><input hidden type="file" id="dirInput" webkitdirectory multiple><input hidden type="file" id="fileInput" accept=".xml" multiple><div id="choices"></div><p id="status" role="status" class="muted">Your files are processed on this device.</p>',
  );
}
let groups = [],
  single;
function snapshotButton(group, index) {
  const slash = group.label.lastIndexOf("/");
  const directory = group.label.slice(0, slash);
  const prefix = group.label.slice(slash + 1);
  const dated = /^(.+)-(\d+)-(\d{2})-(\d{2})$/.exec(prefix);
  const save = dated ? dated[1] : prefix;
  const date = dated ? dated.slice(2).join("-") : "";
  const formats = group.files
    .map((file) =>
      /_plus\.xml$/i.test(file.name) ? "Legends Plus" : "Legends",
    )
    .join(" + ");
  const detail = [date, formats, directory].filter(Boolean).join(" · ");
  return (
    '<button class="snapshot" data-group="' +
    index +
    '"><strong>' +
    escape(save) +
    "</strong><small>" +
    escape(detail) +
    "</small></button>"
  );
}
function choose(files, folder = false) {
  const candidates = groupExports(files);
  const findingCompanions = folder && single;
  if (findingCompanions) {
    const match = candidates.filter((g) =>
      g.files.some((f) => f.name === single.name && f.size === single.size),
    );
    if (!match.length) {
      $("#status").textContent =
        "That folder did not contain the selected XML. Choose its export folder or open the file alone.";
      return;
    }
    groups = match;
    single = null;
  } else groups = candidates;
  $("#choices").replaceChildren();
  $("#status").textContent = "";
  if (!groups.length) {
    single = null;
    $("#status").textContent = "No Legends XML exports were found.";
    return;
  }
  if (!folder && files.length === 1) {
    single = files[0];
    $("#choices").innerHTML =
      "<p>Choose the containing folder to look for companion XML files for <strong>" +
      escape(single.name) +
      '</strong>.</p><button id="alone">Open this file alone</button>';
    return;
  }
  single = null;
  if (groups.length === 1 && (!folder || findingCompanions))
    return loadFiles(groups[0].files);
  $("#choices").innerHTML =
    "<h3>Choose a snapshot to import</h3>" +
    groups.map(snapshotButton).join("");
  $("#status").textContent = "Select a snapshot to read its XML files.";
}
async function database() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("legends-wiki", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("library");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function cached(mode, data) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("library", mode),
        store = tx.objectStore("library");
      const request =
        mode === "readonly" ? store.get("world") : store.put(data, "world");
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
async function loadFiles(files) {
  if (busy) return;
  busy = true;
  groups = [];
  single = null;
  hydration++;
  modal(
    "Reading world history",
    '<progress max="100" value="0"></progress><p id="status" role="status">Opening export…</p>',
  );
  $(".close").disabled = true;
  try {
    const data = await importWorld(files, ({ percent, file }) => {
      $("progress").value = percent;
      $("#status").textContent = file + " · " + percent + "%";
    });
    install(data);
    location.hash = "overview";
    render();
    try {
      await cached("readwrite", data);
      dialog.close();
    } catch {
      modal(
        "World imported",
        "<p>The world is ready to explore. Your browser could not keep a copy for your next visit.</p>",
      );
    }
  } catch (error) {
    modal(
      "Import failed",
      '<p id="status" role="alert">' +
        escape(error.message) +
        '</p><button id="retry">Choose another export</button>',
    );
  } finally {
    busy = false;
    single = null;
  }
}
$("#find").innerHTML =
  icon("search", 16) + "<span>Search this world</span><kbd>/</kbd>";
$("#import").innerHTML = icon("upload", 16) + " Import world";
$(".skip").onclick = (event) => {
  event.preventDefault();
  content.focus();
};
$("#find").onclick = search;
$("#import").onclick = () => {
  single = null;
  importDialog();
};
$("#menu").onclick = () => document.body.classList.toggle("open");
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !dialog.open &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
  ) {
    e.preventDefault();
    search();
  }
  if (e.key === "Escape") document.body.classList.remove("open");
});
dialog.addEventListener("close", () => {
  groups = [];
  single = null;
  $("#dialogbody").replaceChildren();
});
dialog.addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
document.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (e.target.closest("#dialog a")) dialog.close();
  if (!button) return;
  if (button.matches(".close")) dialog.close();
  if (button.id === "retry") importDialog();
  if (button.id === "folder") $("#dirInput").click();
  if (button.id === "files") $("#fileInput").click();
  if (button.id === "alone" && single) loadFiles([single]);
  if (button.hasAttribute("data-group"))
    loadFiles(groups[Number(button.dataset.group)].files);
  if (button.hasAttribute("data-page")) {
    page += Number(button.dataset.page);
    listRows();
    $(".filter").scrollIntoView();
  }
  if (button.id === "more") {
    articleLimit += 50;
    render(false);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.matches(".filter")) {
    query = e.target.value;
    page = 0;
    listRows();
  }
  if (e.target.id === "search") searchResults(e.target.value);
});
document.addEventListener("change", (e) => {
  if (["dirInput", "fileInput"].includes(e.target.id))
    choose([...e.target.files], e.target.id === "dirInput");
  if (e.target.id === "bins") {
    binCount = Number(e.target.value);
    $("#chart").innerHTML = chart();
  }
});
window.addEventListener("hashchange", () => render());
install(exampleWorld());
render();
async function start() {
  if (new URLSearchParams(location.search).has("open")) {
    try {
      const manifest = await (
        await fetch(
          "./_export?key=" +
            encodeURIComponent(
              new URLSearchParams(location.search).get("open"),
            ),
        )
      ).json();
      const files = await Promise.all(
        manifest.map(async (name, i) => {
          const res = await fetch(
            "./_export/" +
              i +
              "?key=" +
              encodeURIComponent(
                new URLSearchParams(location.search).get("open"),
              ),
          );
          if (!res.ok) throw new Error("Could not open " + name);
          return new File([await res.blob()], name);
        }),
      );
      await loadFiles(files);
      history.replaceState(null, "", location.pathname + location.hash);
    } catch (error) {
      modal("Could not open export", "<p>" + escape(error.message) + "</p>");
    }
  } else {
    const current = hydration;
    try {
      const data = await cached("readonly");
      if (data && current === hydration) {
        install(data);
        render();
      }
    } catch {}
  }
}
start();
