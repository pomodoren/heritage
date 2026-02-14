(function () {
  const DEFAULT_LANG = "sq";

  function escHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function badgeHtml(label) {
    const safe = escHtml(label);
    const cls = label === "UNESCO" ? "ib-badge ib-badge--unesco" : "ib-badge";
    return `<span class="${cls}">${safe}</span>`;
  }

  async function fetchWikiSummary(lang, title) {
    // REST summary endpoint
    const url =
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
      encodeURIComponent(title);

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      // fallback to English if sq fails
      if (lang !== "en") {
        return fetchWikiSummary("en", title);
      }
      throw new Error(`Wikipedia fetch failed for ${title}`);
    }

    const data = await res.json();
    return {
      title: data.title || title,
      extract: data.extract || "",
      pageUrl: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || "",
      thumbnail: (data.thumbnail && data.thumbnail.source) || "",
      langUsed: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page)
        ? (new URL(data.content_urls.desktop.page)).hostname.split(".")[0]
        : lang,
    };
  }

  function renderSliderShell(container) {
    container.innerHTML = `
      <div class="swiper">
        <div class="swiper-wrapper"></div>
      </div>
      <div class="swiper-pagination"></div>
      <div class="swiper-button-prev"></div>
      <div class="swiper-button-next"></div>
    `;
  }

  function renderSlide({ title, extract, pageUrl, thumbnail }, badges) {
    const safeTitle = escHtml(title);
    const safeExtract = escHtml(extract).slice(0, 220); // keep short
    const safeUrl = pageUrl ? escHtml(pageUrl) : "#";

    const badgeRow =
      badges && badges.length
        ? `<div class="ib-badges">${badges.map(badgeHtml).join("")}</div>`
        : "";

    const img =
      thumbnail
        ? `<img src="${escHtml(thumbnail)}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:12px;margin:0 0 .65rem;">`
        : "";

    return `
      <div class="swiper-slide">
        <div class="ib-wiki-card">
          ${img}
          ${badgeRow}
          <h4><a href="${safeUrl}" target="_blank" rel="noopener">${safeTitle}</a></h4>
          <p>${safeExtract}${extract.length > 220 ? "…" : ""}</p>
          <p><a href="${safeUrl}" target="_blank" rel="noopener">Lexo në Wikipedia →</a></p>
        </div>
      </div>
    `;
  }

  async function initOne(container) {
    if (container.dataset.initialized === "true") return;

    const lang = container.dataset.wikiLang || DEFAULT_LANG;

    let pages;
    try {
      pages = JSON.parse(container.dataset.wikiPages || "[]");
    } catch (e) {
      container.innerHTML = `<p><em>Gabim në data-wiki-pages.</em></p>`;
      container.dataset.initialized = "true";
      return;
    }

    const baseBadges = (container.dataset.wikiBadges || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    renderSliderShell(container);

    const wrapper = container.querySelector(".swiper-wrapper");
    wrapper.innerHTML = `<div class="swiper-slide"><div class="ib-wiki-card"><p>Po ngarkohet…</p></div></div>`;

    // Fetch in parallel, keep order
    const results = [];
    for (const item of pages) {
      const title = item.title;
      const badges = [...baseBadges, ...(item.badges || [])];

      try {
        const summary = await fetchWikiSummary(lang, title);
        results.push({ summary, badges });
      } catch (err) {
        results.push({
          summary: {
            title,
            extract: "Nuk u gjet përmbledhja. Hap lidhjen për kërkim.",
            pageUrl: `https://${lang}.wikipedia.org/wiki/Special:Search?search=` + encodeURIComponent(title),
            thumbnail: "",
          },
          badges,
        });
      }
    }

    wrapper.innerHTML = results
      .map(({ summary, badges }) => renderSlide(summary, badges))
      .join("");

    // Init Swiper
    new Swiper(container.querySelector(".swiper"), {
      slidesPerView: 1.1,
      spaceBetween: 12,
      watchOverflow: true,
      navigation: {
        nextEl: container.querySelector(".swiper-button-next"),
        prevEl: container.querySelector(".swiper-button-prev"),
      },
      pagination: {
        el: container.querySelector(".swiper-pagination"),
        clickable: true,
      },breakpoints: {
        600: { slidesPerView: 1.6, spaceBetween: 16 },
        900: { slidesPerView: 2.2, spaceBetween: 18 },
      },

    });

    container.dataset.initialized = "true";
  }

  function initAll() {
    document.querySelectorAll(".ib-wiki-slider").forEach(initOne);
  }

  // MkDocs Material: handle instant navigation
  document.addEventListener("DOMContentLoaded", initAll);
  document.addEventListener("navigation:complete", initAll);
})();
