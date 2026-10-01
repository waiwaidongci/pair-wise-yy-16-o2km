/**
 * chrome.js — shared header/footer + connectivity pill for every page.
 * The catalog data itself comes from store.js; this file only renders chrome.
 */
import { getState, subscribe } from "../app/store.js";

const NAV = [
  { href: "index.html", key: "home", label: "Home" },
  { href: "works.html", key: "works", label: "Works" },
  { href: "series.html", key: "series", label: "Series" },
  { href: "about.html", key: "about", label: "About" },
  { href: "contact.html", key: "contact", label: "Contact" },
];

export function mountChrome(activeKey) {
  const headerHost = document.querySelector("[data-header]");
  const footerHost = document.querySelector("[data-footer]");
  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header">
        <div class="wrap">
          <a class="brand" href="index.html">Lin Ye Studio
            <small>Touring Exhibition · Offline Edit</small>
          </a>
          <span class="net-pill" data-net-pill aria-live="polite">
            <span class="dot"></span><span data-net-label>…</span>
          </span>
          <nav class="nav" aria-label="Primary">
            ${NAV.map(
              (n) =>
                `<a href="${n.href}" ${n.key === activeKey ? 'aria-current="page"' : ""}>${n.label}</a>`
            ).join("")}
          </nav>
        </div>
      </header>`;
  }
  if (footerHost) {
    footerHost.innerHTML = `
      <footer class="site-footer">
        <div class="wrap">
          Lin Ye Studio — touring exhibition draft, edited offline and merged by photo baseline.<br>
          All imagery and typefaces are served locally; the site runs with the network unplugged.
        </div>
      </footer>`;
  }

  const pill = document.querySelector("[data-net-pill]");
  const label = document.querySelector("[data-net-label]");
  const paint = () => {
    const s = getState();
    if (!pill || !s) return;
    const offline = s.simOffline || !s.online;
    pill.classList.toggle("is-online", !offline);
    pill.classList.toggle("is-offline", offline);
    label.textContent = offline ? "Offline · venue" : "Online · station link";
  };
  subscribe(paint);
  paint();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline-first still works via direct fetches when SW is blocked */
      });
    });
  }
}
