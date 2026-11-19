// =====================================================
// Navigation bar shared by the widget pages (home, dashboard, admin, compute).
// Load it AFTER version.js and BEFORE the widget script:  <script src="nav.js?v=0.1.0"></script>
// The widget scripts themselves do not change: this file inserts the bar at the top of the page.
//
// ---- TO CONFIGURE ONCE (the 3 lines below) ----
//   GRIST_DOC_URL : address of the Grist document, up to and NOT including "/p/<page>"
//                   (open the document in Grist and copy the URL of a page, cut it before "/p/")
//   URL_SUFFIX    : "?style=singlePage" for the PI view; "" if you want the normal Grist interface
//   OPEN_IN       : "top" = replace the current Grist page (automatic switching); "tab" = new browser tab
// pageId = number after "/p/" in the Grist URL of that page.
// =====================================================
(function () {
    const GRIST_DOC_URL = "http://localhost:8484/o/docs/8bDyvVQdziJm/PopulationCohorts";                    // e.g. "https://grist.myinstitute.fr/o/docs/AbCdEf123/Hub"
    const URL_SUFFIX = "?style=singlePage";
    const OPEN_IN = "top";

    const PAGES = [
        { key: "home",      label: "Accueil",            file: "home.html",      pageId: 0,  color: "#6b6b6b" },   // fill pageId once the home page exists
        { key: "dashboard", label: "Dashboard",          file: "dashboard.html", pageId: 14, color: "#a8713a" },   // PI-Dashboard
        { key: "admin",     label: "Institutions",       file: "admin.html",     pageId: 16, color: "#2f6fdb" },   // PI-Institution
        { key: "compute",   label: "Stockage & calcul",  file: "compute.html",   pageId: 19, color: "#3b8a4a" }    // PI-StorageCompute
    ];

    function pageUrl(p) { return GRIST_DOC_URL + "/p/" + p.pageId + URL_SUFFIX; }
    const usable = p => GRIST_DOC_URL && p.pageId;
    const current = (PAGES.find(p => location.pathname.split("/").pop() === p.file) || {}).key;
    window.APP_NAV = { pages: PAGES, pageUrl: pageUrl, usable: usable, current: current, go: null };

    const style = document.createElement("style");
    style.textContent = `
.app-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; align-items: center; }
.app-nav a { text-decoration: none; font-size: 13px; padding: 5px 12px; border-radius: 16px; color: var(--nav-color);
    background: rgba(255,255,255,.7); box-shadow: inset 0 0 0 1px var(--nav-color); cursor: pointer; }
.app-nav a:hover { background: #fff; }
.app-nav a.current { background: var(--nav-color); color: #fff; cursor: default; }
.app-nav a.disabled { opacity: .45; pointer-events: none; }
.app-nav .nav-notice { font-size: 12px; color: #7a1020; }`;
    document.head.appendChild(style);

    function go(p, ev) {
        ev.preventDefault();
        const url = pageUrl(p);
        if (OPEN_IN === "tab") { window.open(url, "_blank", "noopener"); return; }
        try { window.top.location.href = url; } catch (e) { /* blocked: see the timer below */ }
        // if the browser blocked the navigation, this page is still alive 1.2 s later: offer a new tab
        setTimeout(function () {
            const bar = document.querySelector(".app-nav");
            if (!bar || bar.querySelector(".nav-notice")) return;
            const note = document.createElement("span");
            note.className = "nav-notice";
            note.textContent = "Le navigateur bloque le changement direct de page. ";
            const link = document.createElement("a");
            link.href = url; link.target = "_blank"; link.rel = "noopener"; link.textContent = "Ouvrir dans un nouvel onglet";
            note.appendChild(link);
            bar.appendChild(note);
        }, 1200);
    }

    window.APP_NAV.go = go;

    function build() {
        if (document.querySelector(".app-nav")) return;
        const bar = document.createElement("nav");
        bar.className = "app-nav";
        PAGES.forEach(function (p) {
            const a = document.createElement("a");
            a.textContent = p.label;
            a.style.setProperty("--nav-color", p.color);
            if (p.key === current) a.className = "current";
            else if (!usable(p)) { a.className = "disabled"; a.title = "Adresse non configurée dans nav.js"; }
            else { a.href = pageUrl(p); a.addEventListener("click", ev => go(p, ev)); }
            bar.appendChild(a);
        });
        document.body.insertBefore(bar, document.body.firstChild);
    }
    if (!GRIST_DOC_URL) console.warn("nav.js: GRIST_DOC_URL is empty, the navigation buttons are disabled. Edit the top of nav.js.");
    if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
})();
