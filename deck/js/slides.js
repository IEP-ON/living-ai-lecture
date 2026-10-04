(function () {
  function fill(el, text) {
    el.replaceChildren();
    String(text || "").split("\n").forEach(function (line, i) {
      if (i) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(line));
    });
  }

  function slideLabel(slide) {
    const raw = slide.title || slide.text || "제목 없음";
    return String(raw).split("\n")[0];
  }

  function block(tag, className, text) {
    const node = document.createElement(tag);
    node.className = "copy " + className;
    fill(node, text);
    return node;
  }

  function logo(parent, large) {
    const img = document.createElement("img");
    img.className = large ? "logo logo-lg" : "logo";
    img.alt = "DGTP · SEIC";
    img.src = "brand/dgtp-seic.png";
    parent.appendChild(img);
  }

  function pageNum(parent, index) {
    const num = document.createElement("p");
    num.className = "pagenum";
    num.textContent = String(index + 1).padStart(2, "0");
    parent.appendChild(num);
  }

  function footer(parent, index) {
    logo(parent, false);
    pageNum(parent, index);
  }

  function media(parent, slide) {
    const box = document.createElement("div");
    box.className = "media" + (slide.fit === "cover" ? " fit-cover" : "") + (slide.frame ? " with-frame" : "");
    if (!slide.image) {
      box.classList.add("is-missing");
      const missing = document.createElement("p");
      missing.className = "missing";
      missing.textContent = "image 경로가 비어 있습니다.";
      box.appendChild(missing);
    } else {
      const img = document.createElement("img");
      img.alt = slide.alt || "";
      img.src = slide.image;
      img.addEventListener("error", function () {
        box.classList.add("is-missing");
        const missing = document.createElement("p");
        missing.className = "missing";
        missing.textContent = "그림 파일을 찾지 못했습니다. " + slide.image;
        box.appendChild(missing);
      });
      box.appendChild(img);
    }
    parent.appendChild(box);
  }

  function group(parent, className) {
    const el = document.createElement("div");
    el.className = className;
    parent.appendChild(el);
    return el;
  }

  function heading(parent, slide) {
    const head = group(parent, "slide-head");
    head.appendChild(block("h1", "", slide.title));
    if (slide.subtitle) {
      parent.classList.add("has-subtitle");
      head.appendChild(block("p", "subtitle", slide.subtitle));
    }
  }

  function buildSlide(slide, index) {
    const el = document.createElement("section");
    el.className = "slide layout-" + (slide.layout || "unknown");
    if (slide.design) el.classList.add("design-" + slide.design);
    el.setAttribute("role", "group");
    el.setAttribute("aria-roledescription", "슬라이드");
    el.setAttribute("aria-label", (index + 1) + ". " + slideLabel(slide));
    el.setAttribute("aria-hidden", "true");

    if (window.EditorialSlides && EditorialSlides.build(el, slide, index, {heading: heading, footer: footer})) return el;

    if (slide.layout === "cover") {
      logo(el, true);
      if (DECK.course) el.appendChild(block("p", "eyebrow", DECK.course));
      const content = group(el, "cover-copy");
      content.appendChild(block("h1", "", slide.title));
      if (slide.sub) content.appendChild(block("p", "sub", slide.sub));
      el.appendChild(block("p", "meta", slide.meta || "DGTP  ×  SEIC"));
    } else if (slide.layout === "section") {
      if (slide.kicker) el.appendChild(block("p", "kicker", slide.kicker));
      const content = group(el, "section-copy");
      content.appendChild(block("h1", "", slide.title));
      if (slide.lead) content.appendChild(block("p", "lead", slide.lead));
      if (DECK.course) el.appendChild(block("p", "section-context", DECK.course));
      pageNum(el, index);
    } else if (slide.layout === "points") {
      heading(el, slide);
      const numbered = slide.numbered === true;
      const list = document.createElement(numbered ? "ol" : "ul");
      list.className = "rows" + (numbered ? " numbered" : "");
      list.style.setProperty("--row-count", Math.max(1, (slide.items || []).length));
      (slide.items || []).forEach(function (item, i) {
        const row = document.createElement("li");
        if (numbered) {
          const idx = document.createElement("span");
          idx.className = "idx";
          idx.textContent = String(i + 1).padStart(2, "0");
          idx.setAttribute("aria-hidden", "true");
          row.appendChild(idx);
        }
        const title = document.createElement("strong");
        const body = document.createElement("p");
        if (item && typeof item === "object") {
          title.textContent = item.title || "";
          if (item.text) body.textContent = item.text;
        } else {
          title.textContent = String(item || "");
        }
        row.appendChild(title);
        if (body.textContent) row.appendChild(body);
        else row.classList.add("title-only");
        list.appendChild(row);
      });
      el.appendChild(list);
      footer(el, index);
    } else if (slide.layout === "split") {
      heading(el, slide);
      media(el, slide);
      if (slide.caption) el.appendChild(block("p", "cap", slide.caption));
      const content = group(el, "split-copy");
      if (slide.message) content.appendChild(block("p", "message", slide.message));
      if (slide.text) content.appendChild(block("p", "detail", slide.text));
      footer(el, index);
    } else if (slide.layout === "figure") {
      heading(el, slide);
      media(el, slide);
      if (Array.isArray(slide.labels) && slide.labels.length) {
        el.classList.add("has-labels");
        const labels = group(el, "figure-labels");
        labels.style.setProperty("--label-count", slide.labels.length);
        slide.labels.forEach(function (label) {
          labels.appendChild(block("p", "", label));
        });
      }
      if (slide.caption) el.appendChild(block("p", "cap", slide.caption));
      footer(el, index);
    } else if (slide.layout === "quote") {
      const content = group(el, "quote-copy");
      const qmark = block("p", "qmark", "“");
      qmark.setAttribute("aria-hidden", "true");
      content.appendChild(qmark);
      content.appendChild(block("blockquote", "", slide.text));
      if (slide.by) content.appendChild(block("p", "by", slide.by));
      footer(el, index);
    } else if (slide.layout === "end") {
      logo(el, true);
      if (slide.kicker || DECK.course) el.appendChild(block("p", "eyebrow", slide.kicker || DECK.course));
      const content = group(el, "end-copy");
      content.appendChild(block("h1", "", slide.title));
      const lines = slide.lines || [];
      if (lines[0]) content.appendChild(block("p", "lead", lines[0]));
      if (lines.length > 1) content.appendChild(block("p", "meta", lines.slice(1).join("\n")));
    } else {
      const p = document.createElement("p");
      p.className = "copy";
      p.textContent = "모르는 layout 입니다. deck-data.js를 확인해 주세요. " + (slide.layout || "");
      el.appendChild(p);
    }
    return el;
  }

  window.LectureSlides = { buildSlide: buildSlide, slideLabel: slideLabel };

  if (!document.body.classList.contains("deck")) return;
  if (!window.DECK || !Array.isArray(DECK.slides) || !DECK.slides.length) {
    document.body.textContent = "js/deck-data.js를 읽지 못했습니다.";
    return;
  }

  const frame = document.getElementById("frame");
  const viewport = document.getElementById("viewport");
  const live = document.getElementById("live");
  let index = -1;

  function fit() {
    const chrome = document.fullscreenElement ? 0 : 72;
    const scale = Math.min(window.innerWidth / 1280, (window.innerHeight - chrome) / 720);
    viewport.style.width = Math.floor(1280 * scale) + "px";
    viewport.style.height = Math.floor(720 * scale) + "px";
    frame.style.transform = "scale(" + scale + ")";
  }

  function clamp(n) {
    n = Number(n);
    if (!Number.isFinite(n)) n = 0;
    return Math.max(0, Math.min(DECK.slides.length - 1, n));
  }

  function readHash() {
    const matched = /^#(\d+)$/.exec(location.hash);
    return matched ? Number(matched[1]) - 1 : 0;
  }

  function paint() {
    Array.prototype.forEach.call(frame.children, function (el, i) {
      const on = i === index;
      el.classList.toggle("is-on", on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
    document.title = DECK.title + " · " + (index + 1);
    live.textContent = (index + 1) + "장. " + slideLabel(DECK.slides[index]);
  }

  function go(n, opts) {
    opts = opts || {};
    const next = clamp(n);
    const changed = next !== index;
    index = next;
    LectureSync.setIndex(index);
    if (changed || opts.force) paint();
    const hash = "#" + (index + 1);
    if (!opts.fromHash && location.hash !== hash) history.replaceState(null, "", hash);
    if (!opts.silent) LectureSync.emit(index);
  }

  document.getElementById("open-guide").addEventListener("click", function () {
    LectureSync.open("guide", index);
  });
  document.getElementById("full").addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });

  frame.addEventListener("click", function (e) {
    if (e.target.closest("button, a")) return;
    const rect = frame.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x >= 0.72) go(index + 1);
    else if (x <= 0.28) go(index - 1);
  });

  let touchX = 0;
  frame.addEventListener("touchstart", function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  frame.addEventListener("touchend", function (e) {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) < 48) return;
    go(index + (dx < 0 ? 1 : -1));
  });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " " || e.key === "Enter") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "Backspace") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(DECK.slides.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } else if (e.key === "g" || e.key === "G") {
      e.preventDefault();
      LectureSync.open("guide", index);
    }
  });

  window.addEventListener("hashchange", function () {
    go(readHash(), { fromHash: true });
  });
  window.addEventListener("resize", fit);
  document.addEventListener("fullscreenchange", fit);

  DECK.slides.forEach(function (slide, i) {
    frame.appendChild(buildSlide(slide, i));
  });
  fit();
  LectureSync.on(function (n) {
    if (!Number.isInteger(n)) return;
    go(n, { silent: true });
  });
  go(readHash(), { silent: true, force: true });
  LectureSync.hello();
})();
