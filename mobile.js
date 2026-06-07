const MOBILE_SUTRAS = FULL_SUTRAS;
const MOBILE_STORAGE_KEY = "sutra-reader-state-v1";

const fallbackState = {
  sutraId: "heart",
  sectionIndex: 0,
  activeTab: "read",
  fontSize: 22,
  theme: "light",
  bookmarks: [],
  notes: {},
  stats: {
    totalReads: 0,
    streak: 0,
    lastReadDate: ""
  },
  mobileQuery: "",
  mobileFilter: "all",
  sheet: ""
};

const state = loadMobileState();

const els = {
  body: document.body,
  headerTitle: document.querySelector("#headerTitle"),
  titleSelect: document.querySelector("#titleSelect"),
  searchButton: document.querySelector("#searchButton"),
  fontButton: document.querySelector("#fontButton"),
  themeButton: document.querySelector("#themeButton"),
  bookmarkButton: document.querySelector("#bookmarkButton"),
  view: document.querySelector("#mobileView"),
  nav: document.querySelector(".bottom-nav")
};

function loadMobileState() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOBILE_STORAGE_KEY) || "{}");
    return {
      ...fallbackState,
      ...saved,
      stats: { ...fallbackState.stats, ...(saved.stats || {}) },
      activeTab: saved.activeTab || fallbackState.activeTab,
      mobileQuery: saved.mobileQuery || "",
      mobileFilter: saved.mobileFilter || "all",
      sheet: ""
    };
  } catch {
    return { ...fallbackState };
  }
}

function saveMobileState() {
  localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify({ ...state, sheet: "" }));
}

function currentSutra() {
  return MOBILE_SUTRAS.find((sutra) => sutra.id === state.sutraId) || MOBILE_SUTRAS[0];
}

function currentSection() {
  const sutra = currentSutra();
  return sutra.sections[state.sectionIndex] || sutra.sections[0];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSearchText(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function getLineText(line) {
  return typeof line === "string" ? line : line.text;
}

function getLineSearchText(line) {
  return typeof line === "string" ? line : `${line.text}${line.pinyin}`;
}

function renderLine(line) {
  if (typeof line === "string") return `<p>${escapeHtml(line)}</p>`;
  return `
    <p class="mantra-line">
      <span class="mantra-text">${escapeHtml(line.text)}</span>
      <span class="pinyin">${escapeHtml(line.pinyin)}</span>
    </p>
  `;
}

function renderDetailBlocks(detail) {
  if (!Array.isArray(detail) || !detail.length) {
    return `<p class="empty-text">这里会显示当前内容的详细解释。</p>`;
  }

  return detail
    .map((block) => {
      if (typeof block === "string") return `<p>${escapeHtml(block)}</p>`;
      const points = Array.isArray(block.points) && block.points.length
        ? `<ul>${block.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`
        : "";
      return `
        <section class="detail-section">
          <h3>${escapeHtml(block.heading || "")}</h3>
          <p>${escapeHtml(block.body || "")}</p>
          ${points}
        </section>
      `;
    })
    .join("");
}

function detailSearchText(detail) {
  if (!Array.isArray(detail)) return "";
  return detail
    .map((block) => {
      if (typeof block === "string") return block;
      return `${block.heading || ""}${block.body || ""}${Array.isArray(block.points) ? block.points.join("") : ""}`;
    })
    .join("");
}

function firstUsefulLine(sutra) {
  const first = sutra.sections?.[0]?.lines?.[0];
  return first ? getLineText(first) : "";
}

function sectionProgress(sutra) {
  return Math.round(((state.sectionIndex + 1) / sutra.sections.length) * 100);
}

function hasBookmark(sutraId, sectionIndex) {
  return state.bookmarks.some((item) => item.sutraId === sutraId && item.sectionIndex === sectionIndex);
}

function filteredSutras() {
  const query = state.mobileQuery.trim();
  const normalizedQuery = normalizeSearchText(query);

  return MOBILE_SUTRAS.filter((sutra) => {
    if (state.mobileFilter === "sutra" && sutra.category === "咒语") return false;
    if (state.mobileFilter === "mantra" && sutra.category !== "咒语") return false;

    const haystack = [
      sutra.title,
      sutra.shortTitle,
      sutra.category,
      sutra.keywords || "",
      sutra.purposeTitle || "",
      sutra.purpose || "",
      sutra.explanation || "",
      sutra.detailTitle || "",
      detailSearchText(sutra.detail),
      sutra.sections.map((section) => section.lines.map(getLineSearchText).join("")).join("")
    ].join("");

    return !query || haystack.includes(query) || normalizeSearchText(haystack).includes(normalizedQuery);
  });
}

function setTab(tab) {
  state.activeTab = tab;
  state.sheet = "";
  render();
  saveMobileState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectSutra(sutraId, sectionIndex = 0, tab = "read") {
  state.sutraId = sutraId;
  state.sectionIndex = sectionIndex;
  state.activeTab = tab;
  state.sheet = "";
  render();
  saveMobileState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function changeSection(delta) {
  const sutra = currentSutra();
  state.sectionIndex = Math.min(Math.max(state.sectionIndex + delta, 0), sutra.sections.length - 1);
  render();
  saveMobileState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleBookmark() {
  const sutraId = state.sutraId;
  const sectionIndex = state.sectionIndex;

  if (hasBookmark(sutraId, sectionIndex)) {
    state.bookmarks = state.bookmarks.filter((item) => item.sutraId !== sutraId || item.sectionIndex !== sectionIndex);
  } else {
    state.bookmarks.push({ sutraId, sectionIndex, createdAt: Date.now() });
  }

  render();
  saveMobileState();
}

function completeReading() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (state.stats.lastReadDate !== today) {
    state.stats.streak = state.stats.lastReadDate === yesterday ? state.stats.streak + 1 : 1;
    state.stats.lastReadDate = today;
  }

  state.stats.totalReads += 1;
  render();
  saveMobileState();
}

function renderHeader() {
  const sutra = currentSutra();
  els.headerTitle.textContent = sutra.shortTitle;
  els.themeButton.classList.toggle("active", state.theme === "dark");
  els.bookmarkButton.classList.toggle("active", hasBookmark(sutra.id, state.sectionIndex));
  document.documentElement.style.setProperty("--mobile-reader-size", `${state.fontSize}px`);
  els.body.classList.toggle("dark", state.theme === "dark");
}

function renderBottomNav() {
  els.nav.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.activeTab);
  });
}

function renderReadView() {
  const sutra = currentSutra();
  const section = currentSection();
  const progress = sectionProgress(sutra);
  const canPrev = state.sectionIndex > 0;
  const canNext = state.sectionIndex < sutra.sections.length - 1;

  return `
    <div class="view-stack">
      <section class="read-status" aria-label="阅读进度">
        <div class="read-status-main">
          <div class="read-status-row">
            <span class="section-label">${escapeHtml(section.title)}</span>
            <span class="progress-label">${state.sectionIndex + 1}/${sutra.sections.length}</span>
          </div>
          <div class="progress-track" aria-hidden="true"><span style="width: ${progress}%"></span></div>
        </div>
        <button class="ghost-button" type="button" data-action="catalog">目录</button>
      </section>

      <article class="reader-card">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="sutra-lines">${section.lines.map(renderLine).join("")}</div>
      </article>

      <div class="read-controls" aria-label="段落切换">
        <button class="ghost-button" type="button" data-action="prev" ${canPrev ? "" : "disabled"}>上一段</button>
        <button class="ghost-button" type="button" data-action="next" ${canNext ? "" : "disabled"}>下一段</button>
      </div>

      <section class="info-card">
        <div class="info-card-head">
          <h2>${escapeHtml(sutra.purposeTitle || "传统用途")}</h2>
          <button class="plain-button" type="button" data-tab="detail">看详解</button>
        </div>
        <p>${escapeHtml(sutra.purpose || "这里会显示当前内容的传统用途。")}</p>
        <h3>${escapeHtml(sutra.explanationTitle || "内容简释")}</h3>
        <p>${escapeHtml(sutra.explanation || "这里会显示当前内容的简要解释。")}</p>
      </section>

      <button class="primary-button" type="button" data-action="complete">诵读完成</button>
    </div>
    ${renderSheet()}
  `;
}

function renderLibraryView() {
  const items = filteredSutras();

  return `
    <div class="view-stack">
      <label class="search-field" for="mobileSearch">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" /></svg>
        <input id="mobileSearch" type="search" value="${escapeHtml(state.mobileQuery)}" placeholder="搜索经名、咒语、拼音或关键词" autocomplete="off" />
      </label>

      <div class="filter-row" aria-label="分类筛选">
        ${renderFilter("all", "全部")}
        ${renderFilter("sutra", "经文")}
        ${renderFilter("mantra", "咒语")}
      </div>

      <div class="section-heading">
        <span>经库</span>
        <span>${items.length} 部</span>
      </div>

      <div class="library-list">
        ${items.length ? items.map(renderLibraryCard).join("") : `<p class="empty-text">没有找到相关内容。</p>`}
      </div>
    </div>
  `;
}

function renderFilter(value, label) {
  const active = state.mobileFilter === value ? " active" : "";
  return `<button class="filter-chip${active}" type="button" data-filter="${value}">${label}</button>`;
}

function renderLibraryCard(sutra) {
  const active = sutra.id === state.sutraId ? " active" : "";
  const summary = sutra.purpose || sutra.explanation || firstUsefulLine(sutra);
  return `
    <button class="library-card${active}" type="button" data-sutra="${sutra.id}">
      <strong>${escapeHtml(sutra.shortTitle)}</strong>
      <span>${escapeHtml(sutra.category)} · ${escapeHtml(sutra.time)} · ${sutra.sections.length} 段</span>
      <p>${escapeHtml(summary)}</p>
    </button>
  `;
}

function renderDetailView() {
  const sutra = currentSutra();

  return `
    <div class="view-stack">
      <section class="detail-card detail-hero">
        <h2>${escapeHtml(sutra.detailTitle || `${sutra.shortTitle}详解`)}</h2>
        <p>${escapeHtml(sutra.explanation || "这里会显示当前内容的系统说明。")}</p>
      </section>

      <section class="info-card">
        <div class="info-card-head">
          <h2>${escapeHtml(sutra.purposeTitle || "传统用途")}</h2>
          <button class="plain-button" type="button" data-tab="read">读原文</button>
        </div>
        <p>${escapeHtml(sutra.purpose || "这里会显示当前内容的传统用途。")}</p>
      </section>

      <article class="detail-card detail-article">
        ${renderDetailBlocks(sutra.detail)}
      </article>
    </div>
  `;
}

function renderMineView() {
  const sutra = currentSutra();
  const noteKey = `${sutra.id}:${state.sectionIndex}`;
  const bookmarks = state.bookmarks
    .slice()
    .reverse()
    .map((item) => {
      const itemSutra = MOBILE_SUTRAS.find((entry) => entry.id === item.sutraId);
      const itemSection = itemSutra?.sections[item.sectionIndex];
      if (!itemSutra || !itemSection) return "";
      return `
        <button class="bookmark-item" type="button" data-sutra="${itemSutra.id}" data-section="${item.sectionIndex}">
          <strong>${escapeHtml(itemSutra.shortTitle)}</strong>
          <span>${escapeHtml(itemSection.title)}</span>
        </button>
      `;
    })
    .join("");

  return `
    <div class="view-stack">
      <section class="mine-card">
        <div class="info-card-head">
          <h2>我的诵读</h2>
          <button class="primary-button" type="button" data-action="complete">诵读完成</button>
        </div>
        <div class="stats-grid">
          <div class="stat-tile">
            <strong>${state.stats.streak}</strong>
            <span>连续天数</span>
          </div>
          <div class="stat-tile">
            <strong>${state.stats.totalReads}</strong>
            <span>完成次数</span>
          </div>
        </div>
      </section>

      <section class="mine-card">
        <div class="info-card-head">
          <h2>收藏段落</h2>
          <button class="plain-button" type="button" data-action="bookmark">${hasBookmark(sutra.id, state.sectionIndex) ? "取消收藏" : "收藏当前"}</button>
        </div>
        <div class="bookmark-list">
          ${bookmarks || `<p class="empty-text">还没有收藏。读到想反复看的段落，可以点右上角书签。</p>`}
        </div>
      </section>

      <section class="mine-card">
        <div class="info-card-head">
          <h2>今日札记</h2>
          <span class="detail-meta">${escapeHtml(sutra.shortTitle)} · ${escapeHtml(currentSection().title)}</span>
        </div>
        <textarea id="mobileNote" class="note-field" placeholder="可写下今天读到的一句、一个念头。">${escapeHtml(state.notes[noteKey] || "")}</textarea>
        <div id="saveState" class="save-state">自动保存</div>
      </section>
    </div>
  `;
}

function renderSheet() {
  if (state.sheet === "catalog") return renderCatalogSheet();
  if (state.sheet === "font") return renderFontSheet();
  return "";
}

function renderCatalogSheet() {
  const sutra = currentSutra();
  return `
    <div class="sheet-backdrop" data-action="close-sheet">
      <section class="sheet-panel" role="dialog" aria-modal="true" aria-label="章节目录" data-sheet-panel>
        <div class="sheet-head">
          <h2>${escapeHtml(sutra.shortTitle)}目录</h2>
          <button class="sheet-close" type="button" data-action="close-sheet" aria-label="关闭">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="section-list">
          ${sutra.sections
            .map((section, index) => `
              <button class="section-item${index === state.sectionIndex ? " active" : ""}" type="button" data-section="${index}">
                <span>${escapeHtml(section.title)}</span>
                <span>${index + 1}</span>
              </button>
            `)
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function renderFontSheet() {
  return `
    <div class="sheet-backdrop" data-action="close-sheet">
      <section class="sheet-panel" role="dialog" aria-modal="true" aria-label="字号设置" data-sheet-panel>
        <div class="sheet-head">
          <h2>字号</h2>
          <button class="sheet-close" type="button" data-action="close-sheet" aria-label="关闭">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="font-controls">
          <button class="icon-button" type="button" data-action="font-minus" aria-label="减小字号">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <div class="font-size-readout">${state.fontSize}px</div>
          <button class="icon-button" type="button" data-action="font-plus" aria-label="增大字号">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </section>
    </div>
  `;
}

function render() {
  const sutra = currentSutra();
  if (!sutra.sections[state.sectionIndex]) state.sectionIndex = 0;
  renderHeader();
  renderBottomNav();

  if (state.activeTab === "library") {
    els.view.innerHTML = renderLibraryView();
  } else if (state.activeTab === "detail") {
    els.view.innerHTML = renderDetailView();
  } else if (state.activeTab === "mine") {
    els.view.innerHTML = renderMineView();
  } else {
    state.activeTab = "read";
    els.view.innerHTML = renderReadView();
  }
}

els.titleSelect.addEventListener("click", () => setTab("library"));
els.searchButton.addEventListener("click", () => {
  setTab("library");
  window.setTimeout(() => document.querySelector("#mobileSearch")?.focus(), 40);
});
els.fontButton.addEventListener("click", () => {
  state.sheet = "font";
  render();
});
els.themeButton.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  render();
  saveMobileState();
});
els.bookmarkButton.addEventListener("click", toggleBookmark);

els.nav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  setTab(button.dataset.tab);
});

els.view.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton?.dataset.action === "close-sheet") {
    state.sheet = "";
    render();
    return;
  }

  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    setTab(tabButton.dataset.tab);
    return;
  }

  const sutraButton = event.target.closest("[data-sutra]");
  if (sutraButton) {
    const sectionIndex = sutraButton.dataset.section ? Number(sutraButton.dataset.section) : 0;
    selectSutra(sutraButton.dataset.sutra, sectionIndex, "read");
    return;
  }

  const sectionButton = event.target.closest("[data-section]");
  if (sectionButton) {
    state.sectionIndex = Number(sectionButton.dataset.section);
    state.sheet = "";
    state.activeTab = "read";
    render();
    saveMobileState();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    state.mobileFilter = filterButton.dataset.filter;
    render();
    saveMobileState();
    return;
  }

  if (!actionButton) return;
  const action = actionButton.dataset.action;

  if (action === "catalog") {
    state.sheet = "catalog";
    render();
  }
  if (action === "prev") changeSection(-1);
  if (action === "next") changeSection(1);
  if (action === "bookmark") toggleBookmark();
  if (action === "complete") completeReading();
  if (action === "font-minus") {
    state.fontSize = Math.max(18, state.fontSize - 1);
    render();
    saveMobileState();
  }
  if (action === "font-plus") {
    state.fontSize = Math.min(30, state.fontSize + 1);
    render();
    saveMobileState();
  }
});

els.view.addEventListener("input", (event) => {
  if (event.target.id === "mobileSearch") {
    state.mobileQuery = event.target.value;
    render();
    window.setTimeout(() => document.querySelector("#mobileSearch")?.focus(), 0);
    saveMobileState();
  }

  if (event.target.id === "mobileNote") {
    const noteKey = `${state.sutraId}:${state.sectionIndex}`;
    state.notes[noteKey] = event.target.value;
    saveMobileState();
    const saveState = document.querySelector("#saveState");
    if (saveState) saveState.textContent = "已保存";
    window.clearTimeout(window.mobileNoteTimer);
    window.mobileNoteTimer = window.setTimeout(() => {
      const nextSaveState = document.querySelector("#saveState");
      if (nextSaveState) nextSaveState.textContent = "自动保存";
    }, 900);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, textarea")) return;
  if (event.key === "ArrowLeft") changeSection(-1);
  if (event.key === "ArrowRight") changeSection(1);
  if (event.key === "Escape" && state.sheet) {
    state.sheet = "";
    render();
  }
});

render();
