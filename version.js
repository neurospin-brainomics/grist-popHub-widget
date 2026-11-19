// =====================================================
// ONE place that states the release version of all the widgets (dashboard, admin, compute).
// To release: change the number below, nothing else (see the "?v=" note at the end).
//
// What this file does by itself, in every widget page that loads it:
//   1. exposes  window.APP_VERSION  (read by dashboard.js / admin.js / compute.js: `const VERSION = window.APP_VERSION`)
//   2. shows "Version x.y.z" at the bottom of the LEFT pane (the one with the cards), never on a card
//   3. hides the old version stamp of the right pane (.version-stamp)
//   4. writes the version in the browser console
// Load it BEFORE the widget script:  <script src="version.js?v=0.1.0"></script>
// =====================================================
window.APP_VERSION = "0.1.0";

(function () {
    const text = "Version " + window.APP_VERSION;

    const style = document.createElement("style");
    style.textContent =
        ".version-stamp { display: none !important; }" +                       // old stamp inside the right pane
        ".app-version { margin-top: 14px; font-size: 11px; color: rgba(0,0,0,.45); text-align: right; }" +
        ".app-version.floating { position: fixed; left: 10px; bottom: 6px; margin: 0; }";
    document.head.appendChild(style);

    const note = document.createElement("div");
    note.className = "app-version";
    note.textContent = text;
    note.title = document.title + " - " + text;

    // Put the note at the end of the left pane; if the page has no pane, float it in the bottom-left corner.
    function place() {
        const pane = document.querySelector(".pane-list");
        if (pane) {
            note.classList.remove("floating");
            if (note.parentNode !== pane || pane.lastElementChild !== note) pane.appendChild(note);
        } else if (document.readyState === "complete" && !note.parentNode) {
            note.classList.add("floating");
            document.body.appendChild(note);
        }
    }
    // The widgets build their panes after grist.ready / the first records: watch the DOM, cheaply.
    new MutationObserver(place).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", place);
    window.addEventListener("load", function () { place(); setTimeout(place, 1500); });

    console.log("Widgets " + text);

    // Consistency check: the "?v=" of this script's own URL (cache key) should equal APP_VERSION.
    // A mismatch means one of the two was forgotten at the last release: warn in the console and,
    // in the left pane note, show it with "(?v=...)" so it is visible without opening F12.
    const own = document.currentScript ? document.currentScript.src : "";
    const asked = own ? new URL(own, location.href).searchParams.get("v") : null;
    if (asked !== null && asked !== window.APP_VERSION) {
        console.warn("version.js: APP_VERSION is " + window.APP_VERSION + " but the script URL says ?v=" + asked +
                     ". Update the ?v= in the html files (or version.js) so they match.");
        note.textContent = text + " (?v=" + asked + " in the html)";
        note.style.color = "#b3261e";
    }
})();
