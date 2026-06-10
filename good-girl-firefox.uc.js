// ==UserScript==
// @name           Good Girl Firefox
// @description    Adds "Good girl" / "Good boy" to the default browser banner in Preferences
// ==/UserScript==

(function GoodPup() {
  "use strict";

  const PREF_KEY = "extensions.goodpup.gender";
  const HTML_NS  = "http://www.w3.org/1999/xhtml";

  const PHRASES = {
	// you can change the phrases here
    girl:   "Firefox is your default browser. Good girl.",
    boy:    "Firefox is your default browser. Good boy.",
    choice: "Firefox is your default browser. Good choice.",
  };

  function getGender() {
    try   { return Services.prefs.getStringPref(PREF_KEY, "choice"); }
    catch { return "choice"; }
  }
  function setGender(g) {
    Services.prefs.setStringPref(PREF_KEY, g);
  }

  function waitFor(doc, selector) {
    return new Promise(resolve => {
      const found = doc.querySelector(selector);
      if (found) return resolve(found);
      const obs = new doc.defaultView.MutationObserver((_, o) => {
        const el = doc.querySelector(selector);
        if (el) { o.disconnect(); resolve(el); }
      });
      obs.observe(doc.documentElement, { childList: true, subtree: true });
    });
  }

  function h(doc, tag, props = {}) {
    const node = doc.createElementNS(HTML_NS, tag);
    for (const [k, v] of Object.entries(props)) {
      switch (k) {
        case "textContent": node.textContent = v; break;
        case "className":   node.className   = v; break;
        case "type":        node.type        = v; break;
        case "name":        node.name        = v; break;
        case "value":       node.value       = v; break;
        case "checked":     node.checked     = v; break;
        default:            node.setAttribute(k, v);
      }
    }
    return node;
  }

  async function applyMessage(doc, gender) {
    const promo = await waitFor(doc, "#isDefaultPane");
    promo.removeAttribute("data-l10n-id");
    promo.removeAttribute("data-l10n-attrs");
    promo.setAttribute("message", PHRASES[gender] ?? PHRASES.choice);
  }

  // gender picker injection stuff
  async function injectPicker(doc, gender) {
    if (doc.getElementById("good-pup-section")) return;

    const anchor = await waitFor(doc, '[data-l10n-id="home-default-browser-title"]');
    if (doc.getElementById("good-pup-section")) return; // prevents double runs

    const section = h(doc, "div", { id: "good-pup-section" });

    const style = h(doc, "style");
    style.textContent = `
      #good-pup-section {
        padding: 16px 24px;
        border-top: 1px solid var(--in-content-border-color, ButtonBorder);
      }
      #good-pup-section .gp-title {
        font-size: 13px; font-weight: 600;
        color: var(--in-content-text-color, CanvasText);
        margin: 0 0 3px 0;
      }
      #good-pup-section .gp-sub {
        font-size: 12px;
        color: var(--in-content-deemphasized-text, GrayText);
        margin: 0 0 10px 0;
      }
      #good-pup-section .gp-options {
        display: flex; gap: 24px; flex-wrap: wrap; align-items: center;
      }
      #good-pup-section label {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 13px; cursor: pointer;
        color: var(--in-content-text-color, CanvasText);
        user-select: none;
      }
      #good-pup-section .gp-muted {
        font-size: 11px;
        color: var(--in-content-deemphasized-text, GrayText);
      }
    `;
    section.appendChild(style);

    section.appendChild(h(doc, "p", { className: "gp-title", textContent: "Browser Personality" }));
    section.appendChild(h(doc, "p", { className: "gp-sub",   textContent: "Choose how Firefox greets you" }));

    const optRow = h(doc, "div", { className: "gp-options" });
    section.appendChild(optRow);

    for (const { value, emoji, label, muted } of [
      { value: "choice", emoji: "", label: "Good choice", muted: "(original)" },
      { value: "girl",   emoji: "", label: "Good girl",   muted: "" },
      { value: "boy",    emoji: "", label: "Good boy",    muted: "" },
    ]) {
      const lbl   = h(doc, "label");
      const radio = h(doc, "input", { type: "radio", name: "gp", value, checked: gender === value });

      lbl.appendChild(radio);
      lbl.appendChild(doc.createTextNode(` ${emoji} ${label} `));
      if (muted) lbl.appendChild(h(doc, "span", { className: "gp-muted", textContent: muted }));
      optRow.appendChild(lbl);
    }

    anchor.insertAdjacentElement("afterend", section);

    optRow.querySelectorAll("input[name='gp']").forEach(radio => {
      radio.addEventListener("change", e => {
        const chosen = e.target.value;
        setGender(chosen);
        const promo = doc.getElementById("isDefaultPane");
        if (promo) promo.setAttribute("message", PHRASES[chosen] ?? PHRASES.choice);
      });
    });
  }

  // main run function
  async function run(doc) {
    if (!doc?.location?.href?.startsWith("about:preferences")) return;
    const gender = getGender();
    await Promise.all([ applyMessage(doc, gender), injectPicker(doc, gender) ]);
  }

  // tab nav hook
  gBrowser.addTabsProgressListener({
    onLocationChange(browser, progress, request, location) {
      if (!progress.isTopLevel) return;
      if (!location?.spec?.startsWith("about:preferences")) return;
      browser.addEventListener("DOMContentLoaded", function handler(e) {
        if (!e.target?.location?.href?.startsWith("about:preferences")) return;
        browser.removeEventListener("DOMContentLoaded", handler, true);
        run(e.target);
      }, true);
    }
  });

  // handles any existing tabs for it
  for (const tab of gBrowser.tabs) {
    const b = gBrowser.getBrowserForTab(tab);
    if (b?.currentURI?.spec?.startsWith("about:preferences")) run(b.contentDocument);
  }

})();
