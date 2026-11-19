// =====================================================
// Colour themes shared by the widgets (dashboard.html, admin.html, ...).
// Choose one with ?theme=warm | blue | green in the widget URL, e.g.
//   .../dashboard.html?theme=warm      .../admin.html?theme=blue
// Without the parameter, a page uses the theme named in <body data-theme="...">, else "warm".
// A theme only sets CSS variables on <html>; the widgets read them with fallbacks, so a missing
// themes.js leaves the default look.
//   page   = page background          list / detail = the two background panes
//   card   = default card tint (a widget may override it, e.g. per category)
//   accent = card left edge, selection, links      ink = dark text on badges      title = h1
// =====================================================
(function () {
    const THEMES = {
        warm:  { page: "#f7f0e6", list: "#ecdcc6", detail: "#e2cdb0", card: "#fbf4ea", accent: "#a8713a", ink: "#5c3a17", title: "#5c3a17" },
        blue:  { page: "#eef3f9", list: "#dce8f5", detail: "#cddbf0", card: "#f4f8fd", accent: "#2f6fdb", ink: "#16376b", title: "#16376b" },
        green: { page: "#eff5ee", list: "#dcebd9", detail: "#cbe1c6", card: "#f4faf2", accent: "#3b8a4a", ink: "#1d4a27", title: "#1d4a27" }
    };
    const fromUrl = new URLSearchParams(location.search).get("theme");
    const fromBody = document.body && document.body.getAttribute("data-theme");
    const name = [fromUrl, fromBody, "warm"].map(v => String(v || "").toLowerCase()).find(v => THEMES[v]);
    const t = THEMES[name];
    const root = document.documentElement.style;
    root.setProperty("--page-bg", t.page);
    root.setProperty("--pane-list-bg", t.list);
    root.setProperty("--pane-detail-bg", t.detail);
    root.setProperty("--theme-card", t.card);
    root.setProperty("--theme-accent", t.accent);
    root.setProperty("--theme-ink", t.ink);
    root.setProperty("--theme-title", t.title);
    document.documentElement.setAttribute("data-theme", name);
    window.WIDGET_THEME = { name: name, colors: t };
})();
