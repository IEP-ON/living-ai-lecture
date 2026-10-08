(function () {
  if (!window.DECK || !Array.isArray(DECK.slides) || !DECK.slides.length) {
    document.body.textContent = "js/deck-data.js를 읽지 못했습니다.";
    return;
  }

  const list = document.getElementById("list");
  const sheets = document.getElementById("sheets");
  const preview = document.getElementById("preview-frame");
  const link = document.getElementById("link");
  const clock = document.getElementById("clock");
  const timerButton = document.getElementById("timer");
  const painted = []; // 장이 바뀌거나 다시 그려질 때 알릴 곳(편집 모드)
  let index = -1;
  let elapsed = 0;
  let ticking = 0;

  document.getElementById("course").textContent = DECK.course || "";
  document.getElementById("doc-title").textContent = DECK.title;
  document.title = DECK.title + " · 교안";

  // 선택: 기다릴 때 카드(DECK.waits)가 있는 강의만 카드 페이지 링크를 보입니다.
  if (Array.isArray(DECK.waits) && DECK.waits.length && link && link.parentNode) {
    const waitsLink = document.createElement("p");
    waitsLink.className = "link";
    const a = document.createElement("a");
    a.href = window.LectureCompose ? LectureCompose.href("기다릴때.html") : "기다릴때.html";
    a.target = "_blank";
    a.textContent = "기다릴 때 꺼내는 이야기 카드 " + DECK.waits.length + "개 열기";
    waitsLink.appendChild(a);
    link.parentNode.insertBefore(waitsLink, link.nextSibling);
  }

  function minutesOf(slide) {
    return Number(slide.note && slide.note.minutes) || 0;
  }

  function showPlan() {
    const planned = DECK.slides.reduce(function (sum, slide) { return sum + minutesOf(slide); }, 0);
    document.getElementById("plan").textContent = planned ? "예정 약 " + Math.round(planned) + "분" : "";
  }
  showPlan();

  function fmtMin(m) {
    if (m < 1) return Math.round(m * 60) + "초";
    return (m % 1 ? m.toFixed(1) : String(m)) + "분";
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

  function paragraphs(text) {
    return String(text || "").split(/\n\n+/).map(function (part) {
      return part.trim();
    }).filter(Boolean);
  }

  /* 왼쪽 장 목록(구간 머리 포함) */
  function buildList() {
    list.replaceChildren();
    DECK.slides.forEach(function (slide, i) {
      if (slide.group) {
        const head = document.createElement("li");
        head.className = "group";
        head.textContent = slide.group;
        list.appendChild(head);
      }
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const num = document.createElement("span");
      num.className = "n";
      num.textContent = String(i + 1).padStart(2, "0");
      const label = document.createElement("span");
      label.textContent = LectureSlides.slideLabel(slide);
      button.append(num, label);
      const minutes = minutesOf(slide);
      if (minutes) {
        const small = document.createElement("small");
        small.textContent = "약 " + fmtMin(minutes);
        button.appendChild(small);
      }
      button.addEventListener("click", function () { go(i); });
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  /* 오른쪽 교안 한 장(말할 것 · 짚을 것 · 막힐 때 · 근거) */
  function makeSheet(slide, i) {
    const minutes = minutesOf(slide);
    const sheet = document.createElement("article");
    sheet.className = "sheet";
    const h = document.createElement("h2");
    h.textContent = LectureSlides.slideLabel(slide);
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = (i + 1) + " / " + DECK.slides.length + (minutes ? " · 이 장 약 " + fmtMin(minutes) : "");
    sheet.append(h, meta);

    const sayBlock = document.createElement("section");
    sayBlock.className = "block";
    const sayTitle = document.createElement("h3");
    sayTitle.textContent = "말할 것";
    const say = document.createElement("div");
    say.className = "say";
    const parts = paragraphs(slide.note && slide.note.say);
    if (!parts.length) {
      const p = document.createElement("p");
      p.textContent = "이 장에서 할 말을 note.say에 적습니다.";
      say.appendChild(p);
    } else {
      parts.forEach(function (part) {
        const p = document.createElement("p");
        part.split("\n").forEach(function (line, lineIndex) {
          if (lineIndex) p.appendChild(document.createElement("br"));
          p.appendChild(document.createTextNode(line));
        });
        say.appendChild(p);
      });
    }
    sayBlock.append(sayTitle, say);
    sheet.appendChild(sayBlock);

    if (slide.note && slide.note.point) {
      const pointBlock = document.createElement("section");
      pointBlock.className = "block";
      const pointTitle = document.createElement("h3");
      pointTitle.textContent = "화면에서 짚을 것";
      const point = document.createElement("p");
      point.className = "point";
      point.textContent = slide.note.point;
      pointBlock.append(pointTitle, point);
      sheet.appendChild(pointBlock);
    }
    [["alt", "막히거나 시간이 모자랄 때", "point alt"], ["source", "강사용 근거 (읽지 않음)", "point source"]].forEach(function (spec) {
      var text = slide.note && slide.note[spec[0]];
      if (!text) return;
      var block = document.createElement("section");
      block.className = "block";
      var h3 = document.createElement("h3");
      h3.textContent = spec[1];
      block.appendChild(h3);
      String(text).split(/\n\n+/).forEach(function (part) {
        var p = document.createElement("p");
        p.className = spec[2];
        p.textContent = part.trim();
        block.appendChild(p);
      });
      sheet.appendChild(block);
    });
    return sheet;
  }

  buildList();
  DECK.slides.forEach(function (slide, i) { sheets.appendChild(makeSheet(slide, i)); });

  function fitPreview() {
    const box = document.querySelector(".preview");
    const scale = box.clientWidth / 1280;
    preview.style.transform = "scale(" + scale + ")";
  }

  function paint() {
    const buttons = list.querySelectorAll("button");
    buttons.forEach(function (button, i) {
      const on = i === index;
      button.classList.toggle("is-on", on);
      if (on) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    if (buttons[index]) buttons[index].scrollIntoView({ block: "nearest" });
    sheets.querySelectorAll(".sheet").forEach(function (sheet, i) {
      sheet.classList.toggle("is-on", i === index);
    });
    preview.replaceChildren(LectureSlides.buildSlide(DECK.slides[index], index));
    const shown = preview.firstChild;
    shown.classList.add("is-on");
    shown.setAttribute("aria-hidden", "false");
    fitPreview();
    document.getElementById("prev").disabled = index === 0;
    document.getElementById("next").disabled = index === DECK.slides.length - 1;
    const upcoming = DECK.slides[index + 1];
    document.getElementById("next-name").textContent = upcoming
      ? "다음  " + LectureSlides.slideLabel(upcoming)
      : "마지막 장입니다";
    painted.forEach(function (fn) { fn(index); });
  }

  /* 편집 모드: 고친 장의 목록 · 교안 · 미리보기를 다시 그립니다. */
  function refresh(i) {
    const n = clamp(i);
    const fresh = makeSheet(DECK.slides[n], n);
    const old = sheets.children[n];
    if (old) sheets.replaceChild(fresh, old);
    else sheets.appendChild(fresh);
    buildList();
    showPlan();
    paint();
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

  function markLinked() {
    link.textContent = "슬라이드와 같은 장을 보고 있습니다";
  }

  function fmt(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = function (n) { return String(n).padStart(2, "0"); };
    return h ? h + ":" + pad(m) + ":" + pad(s) : pad(m) + ":" + pad(s);
  }

  document.getElementById("prev").addEventListener("click", function () { go(index - 1); });
  document.getElementById("next").addEventListener("click", function () { go(index + 1); });
  document.getElementById("open-slides").addEventListener("click", function () {
    const win = LectureSync.open("slides", index);
    if (win) markLinked();
  });
  timerButton.addEventListener("click", function () {
    if (ticking) {
      clearInterval(ticking);
      ticking = 0;
      timerButton.textContent = "시간 재기";
      return;
    }
    ticking = setInterval(function () {
      elapsed += 1;
      clock.textContent = fmt(elapsed);
    }, 1000);
    timerButton.textContent = "일시정지";
  });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (document.querySelector("dialog[open]")) return;
    if (e.target && e.target.tagName === "SELECT") return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) return;
    const selected = String(window.getSelection() || "");
    if (selected && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(DECK.slides.length - 1);
    }
  });

  window.addEventListener("hashchange", function () { go(readHash(), { fromHash: true }); });
  window.addEventListener("resize", fitPreview);
  if (window.ResizeObserver) new ResizeObserver(fitPreview).observe(document.querySelector(".preview"));

  LectureSync.on(function (n) {
    if (n == null) {
      markLinked();
      return;
    }
    if (!Number.isInteger(n)) return;
    markLinked();
    go(n, { silent: true });
  });

  window.LectureGuide = {
    get index() { return index; },
    go: go,
    refresh: refresh,
    onPaint: function (fn) { painted.push(fn); }
  };

  go(readHash(), { silent: true, force: true });
  LectureSync.hello();
})();
