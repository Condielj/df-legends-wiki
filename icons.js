const paths = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  events: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  figures:
    '<circle cx="10" cy="8" r="3"/><path d="M3 20v-2a7 7 0 0 1 14 0v2m-1-15a3 3 0 0 1 0 6m3 2a6 6 0 0 1 3 5"/>',
  sites: '<path d="m2 20 7-16 5 10 3-7 5 13zM6 11l3 2 2-3"/>',
  entities:
    '<path d="M4 21V4h3v3h3V4h4v3h3V4h3v17zM10 21v-6a2 2 0 0 1 4 0v6"/>',
  artifacts: '<path d="m3 9 5-6h8l5 6-9 12zm0 0h18m-9 12L8 9l4-6 4 6z"/>',
  stats: '<path d="M3 3v18h18M7 16v-5m5 5V6m5 10v-8"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  book: '<path d="M3 4q5-1 9 2 4-3 9-2v15q-5-1-9 2-4-3-9-2zM12 6v15"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  library: '<path d="M3 5h4v15H3zM10 5h4v15h-4zm6 1 3-1 3 14-3 1z"/>',
};
export const icon = (k, n = 18) =>
  '<svg aria-hidden="true" width="' +
  n +
  '" height="' +
  n +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  (paths[k] || paths.book) +
  "</svg>";
