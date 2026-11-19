// =====================================================
// Home page: three big buttons towards the three boards. No data is read: access level "none".
// (the buttons and their addresses come from nav.js)
// =====================================================
grist.ready({ requiredAccess: "none" });

const TILES = {
    dashboard: { title: "Dashboard",         text: "Campagnes, étapes, échéances et avancement." },
    admin:     { title: "Institutions",      text: "Acteurs administratifs, data holders et procédures." },
    compute:   { title: "Stockage & calcul", text: "Plateformes, accès et mises en œuvre par ressource." }
};

(function () {
    const host = document.getElementById("home");
    const style = document.createElement("style");
    style.textContent = `
body { background: var(--page-bg, #f5f6f8); } h1 { color: var(--theme-title, inherit); }
#home { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.tile { display: block; text-decoration: none; padding: 22px; border-radius: 14px; background: #fff; cursor: pointer;
        border-left: 8px solid var(--nav-color); box-shadow: 0 2px 8px rgba(0,0,0,.1); color: #333; }
.tile:hover { box-shadow: 0 4px 14px rgba(0,0,0,.18); }
.tile.disabled { opacity: .5; pointer-events: none; }
.tile h2 { margin: 0 0 8px; color: var(--nav-color); font-size: 20px; }
.tile p { margin: 0; color: #555; line-height: 1.4; }
.app-nav > a { display: none; }`;                              // big tiles instead of the bar (the bar only shows the 'blocked' notice)
    document.head.appendChild(style);
    const nav = window.APP_NAV;
    if (!nav) { host.textContent = "nav.js n'est pas chargé."; return; }
    nav.pages.filter(p => TILES[p.key]).forEach(function (p) {
        const a = document.createElement("a");
        a.className = "tile" + (nav.usable(p) ? "" : " disabled");
        a.style.setProperty("--nav-color", p.color);
        const h = document.createElement("h2"); h.textContent = TILES[p.key].title;
        const t = document.createElement("p"); t.textContent = TILES[p.key].text;
        a.append(h, t);
        if (nav.usable(p)) {
            a.href = nav.pageUrl(p);
            a.addEventListener("click", ev => nav.go(p, ev));
        } else a.title = "Adresse non configurée dans nav.js";
        host.appendChild(a);
    });
})();
