/* 점검 규칙과 모아보기.
   - 점검 규칙(LectureCheck.inspect): 한 장을 1280 × 720으로 그린 상태에서 글자끼리 겹침, 글자가 다른 칸에 걸침,
     칸끼리 겹침, 글자가 화면 밖, 그림 파일 없음, 모르는 layout을 찾습니다. 교안의 편집 모드도 이 규칙을 씁니다.
   - 모아보기: 모든 장을 한 화면에 그립니다. ?check를 붙이면 실제 크기로 그린 뒤 점검하고
     결과를 #report에 적습니다(도구/점검.cjs가 이 내용을 읽습니다). */
(function () {
  var IGNORE = ["ex-score", "an-badge"];       // 일부러 겹쳐 둔 표시
  var SKIP_INSIDE = ".paper.squash, .cv-mark"; // 일부러 겹치게 그린 묶음

  /* 글자가 실제로 차지하는 줄 상자. 큰 글자는 글꼴 여백 때문에 상자가 커지므로 줄 높이만큼만 봅니다. */
  function textRects(node) {
    var isSvgText = node instanceof SVGElement && node.tagName.toLowerCase() === "text";
    if (node instanceof SVGElement && !isSvgText) return [];
    var lh = parseFloat(getComputedStyle(node).lineHeight);
    var scale = node.getBoundingClientRect().width && node.offsetWidth ? node.getBoundingClientRect().width / node.offsetWidth : 1;
    var rects = [];
    node.childNodes.forEach(function (n) {
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      var range = document.createRange();
      range.selectNodeContents(n);
      Array.prototype.forEach.call(range.getClientRects(), function (r) {
        if (r.width <= 0.5 || r.height <= 0.5) return;
        var h = lh > 0 ? Math.min(r.height, lh * scale) : r.height;
        var top = r.top + (r.height - h) / 2;
        rects.push({ left: r.left, right: r.right, top: top, bottom: top + h });
      });
    });
    if (!rects.length && isSvgText) {
      var b = node.getBoundingClientRect();
      rects.push({ left: b.left, right: b.right, top: b.top, bottom: b.bottom });
    }
    return rects;
  }
  /* 배경색·배경그림이 있거나 네 변 모두 테두리가 있는 칸(카드·칩·띠). 종이 묶음처럼 일부러 겹친 것은 뺍니다. */
  var NOT_BOX = ".paper, .an-badge, .ex-mark, .caret, .slide";
  function boxRect(node) {
    if (node instanceof SVGElement || node.matches(NOT_BOX)) return null;
    var cs = getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return null;
    var bg = cs.backgroundColor;
    var hasBg = (bg && bg !== "transparent" && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg)) || (cs.backgroundImage && cs.backgroundImage !== "none");
    var border = ["Top", "Right", "Bottom", "Left"].every(function (side) {
      return parseFloat(cs["border" + side + "Width"]) > 0 && cs["border" + side + "Style"] !== "none";
    });
    if (!hasBg && !border) return null;
    var r = node.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4 ? r : null;
  }
  function overlap(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function name(node) {
    var cls = (node.getAttribute("class") || node.tagName.toLowerCase()).split(/\s+/)[0];
    var text = (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 18);
    return cls + " “" + text + "”";
  }

  /* 한 장 점검: 문제 문장 목록(중복 없음). 문제가 된 글자 · 칸에는 flag-text를 붙입니다. */
  function inspect(sec, slide) {
    var issues = [];
    if (!window.LectureSlides || !LectureSlides.layouts || LectureSlides.layouts.indexOf(slide.layout) < 0) issues.push("모르는 layout: " + slide.layout);
    var box = sec.getBoundingClientRect();
    var items = [], boxes = [];
    sec.querySelectorAll("*").forEach(function (node) {
      if (node.closest(SKIP_INSIDE)) return;
      var cls = node.getAttribute("class") || "";
      if (IGNORE.some(function (k) { return cls.split(/\s+/).indexOf(k) >= 0; })) return;
      var rects = textRects(node);
      if (rects.length) items.push({ node: node, rects: rects });
      var br = boxRect(node);
      if (br) boxes.push({ node: node, rect: br });
    });
    items.forEach(function (t) {
      boxes.forEach(function (b) {
        if (b.node.contains(t.node) || t.node.contains(b.node)) return;
        if (t.rects.some(function (r) { return overlap(r, b.rect) > 24; })) {
          issues.push("글자가 다른 칸에 걸침: " + name(t.node) + " ↔ " + name(b.node));
          t.node.classList.add("flag-text");
        }
      });
    });
    for (var p = 0; p < boxes.length; p++) {
      for (var q = p + 1; q < boxes.length; q++) {
        var P = boxes[p], Q = boxes[q];
        if (P.node.contains(Q.node) || Q.node.contains(P.node)) continue;
        if (overlap(P.rect, Q.rect) > 120) {
          issues.push("칸끼리 겹침: " + name(P.node) + " ↔ " + name(Q.node));
          P.node.classList.add("flag-text");
          Q.node.classList.add("flag-text");
        }
      }
    }
    sec.querySelectorAll("img").forEach(function (im) {
      if (im.classList.contains("is-missing") || (im.complete && im.naturalWidth === 0)) issues.push("그림 없음: " + im.getAttribute("src"));
    });
    items.forEach(function (it) {
      it.rects.forEach(function (r) {
        if (r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.top < box.top - 1) {
          issues.push("화면 밖: " + name(it.node));
          it.node.classList.add("flag-text");
        }
      });
    });
    for (var a = 0; a < items.length; a++) {
      for (var b = a + 1; b < items.length; b++) {
        var A = items[a], B = items[b];
        if (A.node.contains(B.node) || B.node.contains(A.node)) continue;
        var hit = A.rects.some(function (ra) { return B.rects.some(function (rb) { return overlap(ra, rb) > 24; }); });
        if (hit) {
          issues.push("겹침: " + name(A.node) + " ↔ " + name(B.node));
          A.node.classList.add("flag-text");
          B.node.classList.add("flag-text");
        }
      }
    }
    var seen = {};
    return issues.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
  }

  window.LectureCheck = { inspect: inspect, textRects: textRects, name: name };

  /* ── 모아보기 ── */
  var grid = document.getElementById("grid");
  var report = document.getElementById("report");
  if (!grid || !report) return; // 교안 등에서는 점검 규칙만 씁니다.
  if (!window.DECK || !Array.isArray(DECK.slides)) {
    report.textContent = "js/deck-data.js를 읽지 못했습니다.";
    return;
  }
  var check = /[?&]check\b/.test(location.search);
  if (check) document.body.classList.add("check");
  var total = DECK.slides.reduce(function (a, s) { return a + ((s.note && Number(s.note.minutes)) || 0); }, 0);
  document.getElementById("deck-title").textContent = DECK.title || "모아보기";
  document.getElementById("deck-sum").textContent = DECK.slides.length + "장 · 예정 약 " + Math.round(total) + "분";

  var cells = DECK.slides.map(function (slide, i) {
    var canvas = document.createElement("div");
    canvas.className = "canvas";
    var sec = LectureSlides.buildSlide(slide, i);
    sec.classList.add("is-on");
    canvas.appendChild(sec);
    var thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.appendChild(canvas);
    var cap = document.createElement("figcaption");
    var n = document.createElement("b");
    n.textContent = String(i + 1).padStart(2, "0");
    var t = document.createElement("span");
    t.textContent = LectureSlides.slideLabel(slide) + " · " + slide.layout;
    cap.append(n, t);
    var fig = document.createElement("figure");
    fig.className = "cell";
    fig.append(thumb, cap);
    grid.appendChild(fig);
    return { fig: fig, thumb: thumb, canvas: canvas, sec: sec, slide: slide };
  });

  function fit() {
    cells.forEach(function (c) { c.canvas.style.transform = "scale(" + (c.thumb.clientWidth / 1280) + ")"; });
  }
  fit();
  window.addEventListener("resize", fit);
  if (!check) return;

  function run() {
    var lines = [], problems = 0;
    cells.forEach(function (c, i) {
      var issues = inspect(c.sec, c.slide);
      if (issues.length) {
        problems += issues.length;
        c.fig.classList.add("bad");
        lines.push(String(i + 1).padStart(2, "0") + "장 (" + c.slide.layout + ")");
        issues.forEach(function (x) { lines.push("  - " + x); });
      }
    });
    var head = "점검: " + cells.length + "장 · 문제 " + problems + "건";
    var dbg = /[?&]debug=(\d+)/.exec(location.search);
    if (dbg) {
      var c = cells[Number(dbg[1]) - 1];
      if (c) {
        lines.push("— debug " + dbg[1]);
        c.sec.querySelectorAll("*").forEach(function (node) {
          textRects(node).forEach(function (r) { lines.push(name(node) + " " + [r.left, r.top, r.right, r.bottom].map(Math.round).join(",")); });
        });
      }
    }
    report.textContent = head + (lines.length ? "\n" + lines.join("\n") : "");
    report.className = problems ? "bad" : "ok";
    report.setAttribute("data-done", "1");
    document.title = head;
  }

  function safeRun() {
    try { run(); } catch (err) {
      report.textContent = "점검 중 오류: " + (err && err.stack || err);
      report.className = "bad";
      report.setAttribute("data-done", "1");
    }
  }
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { setTimeout(safeRun, 60); });
})();
