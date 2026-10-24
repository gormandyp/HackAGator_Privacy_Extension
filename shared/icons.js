// Small line icons and Apple-style colored icon tiles (a white glyph on a rounded colored square, like the
// rows in System Settings). Colors come from shared/ui.css (.tile-blue, .tile-red ...). Decoration only:
// every tile sits next to a text label, so color never carries meaning on its own.
(function () {
  const S = (d, extra) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ""}>${d}</svg>`;
  const GLYPHS = {
    bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3.2a6 6 0 0 0-3.7 10.7c.7.6 1.1 1.4 1.2 2.3h5c.1-.9.5-1.7 1.2-2.3A6 6 0 0 0 12 3.2Z"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>',
    eye: '<path d="M2.8 12s3.4-6.3 9.2-6.3 9.2 6.3 9.2 6.3-3.4 6.3-9.2 6.3S2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    cookie: '<path d="M20.6 12.6a8.6 8.6 0 1 1-9.2-9.2 3 3 0 0 0 3.4 3.4 3 3 0 0 0 3.4 3.4 3 3 0 0 0 2.4 2.4Z"/><circle cx="9" cy="10" r=".9" fill="currentColor"/><circle cx="14" cy="15" r=".9" fill="currentColor"/><circle cx="8.6" cy="15.4" r=".9" fill="currentColor"/>',
    globe: '<circle cx="12" cy="12" r="8.8"/><path d="M3.4 12h17.2M12 3.2c2.4 2.4 3.6 5.3 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.3-3.6-8.8S9.6 5.6 12 3.2Z"/>',
    people: '<circle cx="9" cy="8.2" r="3"/><path d="M3.6 19c.5-3 2.7-5 5.4-5s4.9 2 5.4 5"/><circle cx="16.8" cy="9.4" r="2.3"/><path d="M15.6 14.3c2.5.2 4.3 1.9 4.8 4.7"/>',
    chart: '<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/>',
    shield: '<path d="M12 3.2 19 6v5.6c0 4.2-2.9 7.8-7 9.2-4.1-1.4-7-5-7-9.2V6l7-2.8Z"/><path d="m9 12 2.2 2.2L15.2 10"/>',
    check: '<path d="m5 12.6 4.4 4.4L19 7.4"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.6" cy="12" r=".9" fill="currentColor"/><circle cx="4.6" cy="17.5" r=".9" fill="currentColor"/>',
    radar: '<circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 18.6a9.3 9.3 0 0 1 0-13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>',
    alert: '<path d="M12 3.6 21 19.4H3L12 3.6Z"/><path d="M12 10v4"/><circle cx="12" cy="16.9" r=".9" fill="currentColor"/>',
    grade: '<path d="M4 19.5h16"/><path d="m6.5 16 3-9 3 9M7.5 13.2h4"/><path d="M16.5 9v6M13.5 12h6"/>',
    c: '<path d="M16.6 7.3a6.6 6.6 0 1 0 0 9.4" stroke-width="3"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
    gear: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6Z" stroke-width="1.7"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
    server: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>',
    sparkle: '<path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z"/><path d="M18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.2-2.2.9-2.5 2.5-.3-1.6-1-2.3-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z"/>',
    arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
    news: '<rect x="3.5" y="5" width="13" height="14.5" rx="2"/><path d="M16.5 9h2.5a1.5 1.5 0 0 1 1.5 1.5V17a2.5 2.5 0 0 1-5 0"/><path d="M7 9h6M7 12.5h6M7 16h4"/>',
    breach: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.3-1.5"/><path d="M12 14v2.6"/>'
  };

  // icon("eye") -> a bare glyph; tile("eye", "purple") -> the glyph on a colored rounded square.
  function icon(name, size) {
    const g = GLYPHS[name] || GLYPHS.list;
    return size ? S(g).replace('width="16" height="16"', `width="${size}" height="${size}"`) : S(g);
  }
  function tile(name, color, size) {
    return `<span class="icon-tile tile-${color || "gray"}${size ? " tile-" + size : ""}" aria-hidden="true">${icon(name)}</span>`;
  }

  const root = typeof window !== "undefined" ? window : self;
  root.PrivaCIcons = { icon, tile, GLYPHS };
})();
