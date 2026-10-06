/*
  발표형 강의 슬라이드 엔진 v2 (1280 × 720)
  deck-data.js의 DECK.slides를 그립니다. 교안(guide.js)과 모아보기도 같은 buildSlide를 씁니다.
  화면 유형(layout)과 칸은 강의슬라이드_템플릿/읽는법.md의 표를 따릅니다.
  이 파일과 css · 도구는 템플릿과 강의 폴더가 같은 내용입니다. 고치면 템플릿에도 똑같이 반영합니다.
*/
(function () {
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ── 도우미 ── */
  function el(tag, cls, kids) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    (kids || []).forEach(function (k) { if (k) n.appendChild(k); });
    return n;
  }
  /* *별표* 사이는 강조색, \n은 줄바꿈 */
  function rich(node, text) {
    String(text == null ? "" : text).split("\n").forEach(function (line, i) {
      if (i) node.appendChild(document.createElement("br"));
      line.split("*").forEach(function (part, j) {
        if (!part) return;
        if (j % 2) {
          var s = document.createElement("span");
          s.className = "hl";
          s.textContent = part;
          node.appendChild(s);
        } else node.appendChild(document.createTextNode(part));
      });
    });
    return node;
  }
  function R(tag, cls, text) { return rich(el(tag, cls), text); }
  function plain(text) { return String(text || "").replace(/\*/g, ""); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function list(arr) { return Array.isArray(arr) ? arr : []; }
  function svg(tag, attrs, kids) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (k) { if (k) n.appendChild(k); });
    return n;
  }
  function svgText(x, y, text, attrs) {
    var t = svg("text", Object.assign({ x: x, y: y }, attrs || {}));
    t.textContent = text;
    return t;
  }
  function img(src, alt, cls) {
    var i = el("img", cls);
    i.src = src || "";
    i.alt = alt || "";
    i.addEventListener("error", function () { i.classList.add("is-missing"); });
    return i;
  }
  function arrowMarker(id, color) {
    return svg("marker", { id: id, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, [
      svg("path", { d: "M0,0 L10,5 L0,10 z", fill: color })
    ]);
  }
  var uid = 0;
  function nextId(base) { uid += 1; return base + uid; }

  /* 선 아이콘(cards · files · results에서 씀) */
  var ICON = {
    bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
    book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7M8 11h7",
    brush: "M14 4l6 6-8 8-6-6zM6 12l-3 7 7-3",
    battery: "M3 8h15v8H3zM20 11v2M6 11v2M9 11v2M12 11v2",
    folder: "M3 6h6l2 2h10v11H3z",
    file: "M6 3h8l4 4v14H6zM14 3v4h4",
    chat: "M4 5h16v11H9l-5 4z",
    check: "M4 12l5 5L20 6",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3",
    spark: "M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01",
    code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
    school: "M3 10l9-6 9 6-9 6zM6 12v5c3 2 9 2 12 0v-5"
  };
  function icon(name, cls) {
    return svg("svg", { viewBox: "0 0 24 24", class: "ico " + (cls || ""), "aria-hidden": "true" }, [
      svg("path", { d: ICON[name] || ICON.spark, fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linejoin": "round", "stroke-linecap": "round" })
    ]);
  }

  /* ── 공통 틀: 꼭지 · 진행 막대 · 쪽 번호 ── */
  /* 로고는 표지·마무리에만. DECK.logo로 다른 파일을 쓰거나 false로 뺍니다. */
  function logo(sec) {
    var D = window.DECK || {};
    var own = D.logo !== undefined;
    if (own && !D.logo) return;
    sec.appendChild(img(own ? D.logo : "brand/dgtp-seic.png", D.logoAlt || (own ? "로고" : "DGTP · SEIC"), "logo"));
  }
  var NO_CHROME_KICK = { cover: 1, section: 1, end: 1 };
  function chrome(sec, slide, index) {
    if (slide.kicker && !NO_CHROME_KICK[slide.layout]) sec.appendChild(R("p", "kick", slide.kicker));
    var parts = (window.DECK && DECK.parts) || [];
    if (slide.part && parts.length) {
      var bar = el("div", "prog");
      parts.forEach(function (_, i) {
        bar.appendChild(el("span", "seg" + (i + 1 === slide.part ? " on" : i + 1 < slide.part ? " done" : "")));
      });
      bar.appendChild(R("em", "prog-label", pad(slide.part) + "  " + (parts[slide.part - 1] || "")));
      sec.appendChild(bar);
    }
    var num = el("p", "pagenum");
    num.textContent = pad(index + 1);
    sec.appendChild(num);
  }
  function title(sec, d, cls) { if (d.title) sec.appendChild(R("h1", "title " + (cls || ""), d.title)); }
  function subtitle(sec, d) { if (d.subtitle) { sec.classList.add("has-subtitle"); sec.appendChild(R("p", "subtitle", d.subtitle)); } }
  function foot(sec, d) {
    if (!d.foot) return;
    sec.classList.add("has-foot");
    sec.appendChild(R("p", "foot", d.foot));
  }
  function media(d, cls) {
    var box = el("figure", "media " + (cls || "") + (d.fit === "cover" ? " fit-cover" : "") + (d.frame ? " with-frame" : ""));
    box.appendChild(img(d.image, d.alt));
    return box;
  }

  var L = {};

  /* 표지 */
  L.cover = function (s, d) {
    logo(s);
    if (d.kicker) s.appendChild(R("p", "cv-kick", d.kicker));
    s.appendChild(el("span", "cv-bar"));
    s.appendChild(R("h1", "cv-title", d.title));
    if (d.sub) s.appendChild(R("p", "cv-sub", d.sub));
    if (d.meta) s.appendChild(R("p", "cv-meta", d.meta));
    if (d.mark) s.appendChild(el("div", "cv-mark", [R("span", "q", "?"), el("span", "line"), icon("file", "cv-file")]));
  };

  /* 자기소개: 이름 · 소속 · 한 줄 + 성과 카드 4장 + 강조 띠 */
  L.profile = function (s, d) {
    s.appendChild(el("div", "pf-left", [R("h1", "pf-name", d.name), d.role ? R("p", "pf-role", d.role) : null, d.line ? R("p", "pf-line", d.line) : null]));
    var grid = el("div", "pf-grid");
    list(d.items).forEach(function (it) { grid.appendChild(el("div", "pf-card", [R("strong", "", it.title), it.text ? R("p", "", it.text) : null])); });
    s.appendChild(grid);
    if (d.highlight) s.appendChild(el("div", "pf-hl", [R("strong", "", d.highlight.title), R("p", "", d.highlight.text)]));
  };

  /* 주제 갈피(어두운 화면) + 선택: 연표 */
  L.section = function (s, d) {
    if (d.kicker) s.appendChild(R("p", "sec-kick", d.kicker));
    s.appendChild(R("h1", "sec-title", d.title));
    if (d.lead) s.appendChild(R("p", "sec-lead", d.lead));
    if (d.timeline) {
      var tl = el("ol", "tl");
      d.timeline.forEach(function (t) { tl.appendChild(el("li", t.now ? "now" : "", [el("i"), R("b", "", t.year), R("span", "", t.text)])); });
      s.appendChild(tl);
    }
  };

  /* 큰 문장 한 줄(+ 선택: 판정 칩) */
  L.statement = function (s, d) {
    var box = el("div", "st");
    box.appendChild(R("p", "st-text", d.text));
    if (d.sub) box.appendChild(R("p", "st-sub", d.sub));
    if (d.checks) {
      var row = el("div", "st-checks");
      d.checks.forEach(function (c) { row.appendChild(el("span", "ck " + (c.ok ? "ok" : "no"), [R("b", "", c.ok ? "✓" : "✕"), R("span", "", c.t)])); });
      box.appendChild(row);
    }
    s.appendChild(box);
  };

  /* 인용(명조) + 선택: 앞말(lead) · 오른쪽 풀이(after) */
  L.quote = function (s, d) {
    var wrap = el("div", "qt" + (d.after ? " with-after" : ""));
    if (d.lead) wrap.appendChild(R("p", "qt-lead", d.lead));
    wrap.appendChild(R("span", "qmark", "“"));
    wrap.appendChild(R("blockquote", "qt-text", d.text));
    if (d.by) wrap.appendChild(R("p", "qt-by", d.by));
    s.appendChild(wrap);
    if (d.after) {
      var ul = el("ul", "qt-after");
      d.after.forEach(function (t) { ul.appendChild(R("li", "", t)); });
      s.appendChild(ul);
    }
  };

  /* 핵심과 설명(목록) */
  L.points = function (s, d) {
    title(s, d);
    subtitle(s, d);
    var numbered = d.numbered === true;
    var ul = el(numbered ? "ol" : "ul", "pt" + (numbered ? " numbered" : ""));
    ul.style.setProperty("--rows", Math.max(1, list(d.items).length));
    list(d.items).forEach(function (it, i) {
      var t = typeof it === "object" ? it : { title: it };
      ul.appendChild(el("li", t.text ? "" : "title-only", [numbered ? R("b", "pt-n", String(i + 1)) : null, R("strong", "", t.title), t.text ? R("p", "", t.text) : null]));
    });
    s.appendChild(ul);
    foot(s, d);
  };

  /* 그림과 글 */
  L.split = function (s, d) {
    title(s, d);
    subtitle(s, d);
    s.appendChild(media(d, "sp-media"));
    if (d.caption) s.appendChild(R("p", "sp-cap", d.caption));
    s.appendChild(el("div", "sp-copy", [d.message ? R("p", "sp-msg", d.message) : null, d.text ? R("p", "sp-text", d.text) : null]));
    foot(s, d);
  };

  /* 큰 그림 */
  L.figure = function (s, d) {
    title(s, d);
    subtitle(s, d);
    s.appendChild(media(d, "fg-media"));
    if (d.caption) s.appendChild(R("p", "fg-cap", d.caption));
  };

  /* 요청 입력창(시연·프롬프트 보여 주기) */
  L.prompt = function (s, d) {
    if (d.live) s.appendChild(el("p", "live", [el("i"), R("span", "", "LIVE")]));
    if (d.lead) s.appendChild(R("p", "pr-lead", d.lead));
    s.appendChild(el("div", "pr-box", [
      R("p", "pr-text", d.prompt),
      el("div", "pr-bar", [R("span", "pr-plus", "+"), d.model ? R("span", "pr-model", d.model) : null, el("span", "pr-send")])
    ]));
    if (d.caption) s.appendChild(R("p", "pr-cap", d.caption));
  };

  /* 둘·셋 비교(위에서 아래로 흐름) */
  L.compare = function (s, d) {
    title(s, d);
    var wrap = el("div", "cmp cols-" + list(d.columns).length);
    list(d.columns).forEach(function (c) {
      var col = el("div", "cmp-col" + (c.strong ? " strong" : ""));
      col.appendChild(R("p", "cmp-head", c.head));
      var ol = el("ol", "cmp-flow");
      list(c.lines).forEach(function (line) { ol.appendChild(R("li", "", line)); });
      col.appendChild(ol);
      wrap.appendChild(col);
    });
    s.appendChild(wrap);
    foot(s, d);
  };

  /* 꼬리표 몇 개 + 한 방 + 이유들 (+ 선택: 도장) */
  L.tags = function (s, d) {
    title(s, d);
    if (d.stamp) s.appendChild(R("p", "tag-stamp", d.stamp));
    var row = el("div", "chips");
    list(d.tags).forEach(function (c) { row.appendChild(R("span", "chip", c)); });
    s.appendChild(row);
    if (d.punch) s.appendChild(R("p", "punch", d.punch));
    if (d.reasons) {
      var why = el("ul", "reasons");
      d.reasons.forEach(function (r) { why.appendChild(R("li", "", r)); });
      s.appendChild(why);
    }
  };

  /* 따옴표 한 마디 → 인정 → 돌아서기 */
  L.turn = function (s, d) {
    s.appendChild(R("blockquote", "turn-q", d.quote));
    if (d.before) s.appendChild(R("p", "turn-before", d.before));
    if (d.after) s.appendChild(R("p", "turn-after", d.after));
  };

  /* 번호 단계(카드) + 꼬리표 */
  L.steps = function (s, d) {
    title(s, d);
    var ol = el("ol", "ov-steps");
    list(d.steps).forEach(function (t, i) { ol.appendChild(el("li", "", [R("b", "", String(i + 1)), R("span", "", t)])); });
    s.appendChild(ol);
    if (d.tags) {
      var mods = el("div", "ov-mods");
      d.tags.forEach(function (m) { mods.appendChild(R("span", "", m)); });
      s.appendChild(mods);
    }
    if (d.tagsNote) s.appendChild(R("p", "ov-note", d.tagsNote));
  };

  /* 두 사람·두 대상 나란히 + 깨달음 한 줄 */
  L.pair = function (s, d) {
    title(s, d);
    var row = el("div", "duo");
    list(d.items).forEach(function (p, i) {
      if (i) row.appendChild(R("span", "duo-x", "×"));
      row.appendChild(el("div", "duo-card", [R("p", "duo-name", p.name), p.role ? R("p", "duo-role", p.role) : null, R("p", "duo-text", p.text)]));
    });
    s.appendChild(row);
    if (d.lesson) s.appendChild(R("p", "duo-lesson", d.lesson));
  };

  /* 큰 낱말 ≈ 큰 낱말 + 정의 */
  L.equals = function (s, d) {
    title(s, d);
    var row = el("div", "terms");
    list(d.terms).forEach(function (t, i) {
      if (i) row.appendChild(R("span", "approx", d.sign || "≈"));
      row.appendChild(R("span", "term", t));
    });
    s.appendChild(row);
    if (d.def) s.appendChild(R("p", "def", d.def));
    if (d.sub) s.appendChild(R("p", "terms-sub", d.sub));
  };

  /* 아이콘 카드 4장 + 한 마디 */
  L.cards = function (s, d) {
    title(s, d);
    var row = el("div", "stu cols-" + list(d.cards).length);
    list(d.cards).forEach(function (c) { row.appendChild(el("div", "stu-card", [icon(c.icon, "stu-ico"), R("p", "", c.text)])); });
    s.appendChild(row);
    if (d.punch) s.appendChild(R("p", "stu-punch", d.punch));
  };

  /* 표시가 붙은 세 칸(✓ + −) + 큰 숫자 */
  L.marks = function (s, d) {
    title(s, d);
    var row = el("div", "rl");
    list(d.columns).forEach(function (c, i) {
      if (i) row.appendChild(R("span", "rl-arrow", "→"));
      var col = el("div", "rl-col " + (c.tone || "ok"), [R("p", "rl-head", c.head)]);
      var ul = el("ul");
      list(c.items).forEach(function (t) { ul.appendChild(el("li", "", [R("b", "", c.mark || "✓"), R("span", "", t)])); });
      col.appendChild(ul);
      row.appendChild(col);
    });
    s.appendChild(row);
    if (d.callout) s.appendChild(el("div", "rl-call", [R("b", "", d.callout.big), R("p", "", d.callout.text)]));
    else row.classList.add("wide");
    foot(s, d);
  };

  /* 신경망 전·후(연결 굵기) */
  function netSvg(trained) {
    var layers = [4, 5, 3], X = [56, 230, 404], H = 300, edges = [], nodes = [];
    var pos = layers.map(function (n, li) {
      var out = [];
      for (var i = 0; i < n; i++) out.push([X[li], (H / (n + 1)) * (i + 1)]);
      return out;
    });
    for (var li = 0; li < layers.length - 1; li++) {
      pos[li].forEach(function (a, i) {
        pos[li + 1].forEach(function (b, j) {
          var w = Math.abs(Math.sin((li * 31 + i * 7 + j * 13) * 12.9898) * 43758.5453) % 1;
          var stroke = "#c7cdc8", width = 1.4, op = 0.9;
          if (trained) {
            if (w > 0.74) { stroke = "var(--signal)"; width = 5; }
            else if (w > 0.48) { stroke = "var(--forest)"; width = 2.6; }
            else { stroke = "#d6dbd6"; width = 0.9; op = 0.7; }
          }
          edges.push(svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: stroke, "stroke-width": width, opacity: op, "stroke-linecap": "round" }));
        });
      });
    }
    pos.forEach(function (layer) {
      layer.forEach(function (p) { nodes.push(svg("circle", { cx: p[0], cy: p[1], r: 13, fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 })); });
    });
    return svg("svg", { viewBox: "0 0 460 300", class: "net-svg" }, edges.concat(nodes));
  }
  L.net = function (s, d) {
    title(s, d);
    var states = d.states || ["전", "후"];
    var row = el("div", "net");
    states.forEach(function (label, i) {
      row.appendChild(el("figure", "net-fig" + (i ? " after" : ""), [netSvg(i === 1), R("figcaption", "", label)]));
      if (!i) row.appendChild(R("span", "net-arrow", "→"));
    });
    s.appendChild(row);
    if (d.message) s.appendChild(R("p", "net-msg", d.message));
    foot(s, d);
  };

  /* 밝은 카드 ↔ 짙은 카드 대비 */
  L.contrast = function (s, d) {
    title(s, d);
    var row = el("div", "hd");
    [d.left, d.right].forEach(function (c, i) {
      if (!c) return;
      row.appendChild(el("div", "hd-card" + (i ? " is-desk" : " is-head"), [R("p", "hd-head", c.head), R("p", "hd-big", c.big), R("p", "hd-text", c.text)]));
    });
    s.appendChild(row);
  };

  /* 빈칸 채우기 놀이 */
  L.blank = function (s, d) {
    s.appendChild(el("p", "blank", [R("span", "", d.text + " "), el("span", "blank-gap", [el("i", "caret")])]));
  };

  /* 확률 막대 + 옆 카드 */
  L.bars = function (s, d) {
    title(s, d);
    var left = el("div", "bars");
    if (d.phrase) left.appendChild(R("p", "bars-phrase", d.phrase + " …"));
    var max = Math.max.apply(null, list(d.bars).map(function (b) { return b.p; }).concat([0.0001]));
    list(d.bars).forEach(function (b, i) {
      var fill = el("i");
      fill.style.width = Math.max(0.6, (b.p / max) * 100) + "%";
      left.appendChild(el("div", "bar-row" + (i === 0 ? " top" : "") + (b.p < 0.01 ? " zero" : ""), [
        R("span", "bar-word", b.word), el("span", "bar-track", [fill]), R("span", "bar-p", b.p < 0.01 ? "≈ 0" : Math.round(b.p * 100) + "%")
      ]));
    });
    if (d.caption) left.appendChild(R("p", "bars-note", d.caption));
    s.appendChild(left);
    var side = d.side;
    if (side) {
      s.appendChild(el("div", "bars-side", [
        side.often ? el("p", "bs-line yes", [R("span", "", side.often), R("b", "", side.oftenTag || "자주")]) : null,
        side.rare ? el("p", "bs-line no", [R("span", "", side.rare), R("b", "", side.rareTag || "≈ 0")]) : null,
        side.quote ? R("p", "bs-quote", side.quote) : null,
        side.by ? R("p", "bs-by", side.by) : null
      ]));
    }
  };

  /* 길찾기(낱말이 이어지는 길) + 옆 인용 */
  L.route = function (s, d) {
    title(s, d);
    var card = el("div", "nv");
    if (d.dest) card.appendChild(el("div", "nv-dest", [el("span", "nv-pin"), R("span", "", d.dest)]));
    var ol = el("ol", "nv-route");
    list(d.route).forEach(function (w, i) { ol.appendChild(R("li", i === list(d.route).length - 1 ? "end" : "", w)); });
    card.appendChild(ol);
    s.appendChild(card);
    if (d.quote) s.appendChild(el("div", "nv-quote", [R("p", "", d.quote), d.by ? R("span", "", d.by) : null]));
  };

  /* 토큰 조각. 한 글자가 여러 토큰으로 나뉘면 { t, half: 몇째, of: 몇 조각(기본 2) } */
  L.tokens = function (s, d) {
    title(s, d);
    var wrap = el("div", "tk");
    list(d.rows).forEach(function (row, ri) {
      var chips = el("div", "tk-chips");
      list(row.pieces).forEach(function (p, i) {
        var t = typeof p === "string" ? p : p.t;
        var c = el("span", "tk-chip c" + (i % 4) + (p && p.half ? " half h" + p.half : ""));
        if (t.charAt(0) === " ") c.appendChild(R("i", "sp", "␣"));
        c.appendChild(document.createTextNode(t.replace(/^ /, "")));
        if (p && p.half) c.appendChild(R("sup", "", p.half + "/" + (p.of || 2)));
        chips.appendChild(c);
      });
      wrap.appendChild(el("div", "tk-row" + (ri === 0 ? " first" : ""), [R("p", "tk-src", row.text), chips, R("p", "tk-count", row.unit || "")]));
    });
    s.appendChild(wrap);
    if (d.foot) s.appendChild(R("p", "tk-foot", d.foot));
  };

  /* 문장 속 관계선(어텐션) */
  L.attention = function (s, d) {
    title(s, d);
    var words = list(d.words), fs = 42, gap = 30, W = 1104, baseY = 252;
    var widths = words.map(function (w) {
      var n = 0;
      for (var i = 0; i < w.length; i++) n += /[,.!?]/.test(w[i]) ? 0.32 : /[A-Za-z0-9 ]/.test(w[i]) ? 0.58 : 0.94;
      return n * fs;
    });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + gap * (words.length - 1);
    var x = (W - total) / 2, centers = [];
    widths.forEach(function (w) { centers.push(x + w / 2); x += w + gap; });
    var kids = [];
    var fx = centers[d.from];
    list(d.links).slice().sort(function (a, b) { return a.w - b.w; }).forEach(function (lk) {
      var tx = centers[lk.to], h = 54 + Math.abs(fx - tx) * 0.2;
      var color = lk.w >= 0.9 ? "var(--signal)" : lk.w >= 0.5 ? "var(--forest)" : "#9aa49d";
      kids.push(svg("path", {
        d: "M" + fx + " " + (baseY - 52) + " Q " + (fx + tx) / 2 + " " + (baseY - 52 - h) + " " + tx + " " + (baseY - 52),
        fill: "none", stroke: color, "stroke-width": 2 + 9 * lk.w, opacity: 0.35 + 0.65 * lk.w, "stroke-linecap": "round"
      }));
    });
    words.forEach(function (w, i) {
      var strong = list(d.links).some(function (lk) { return lk.to === i && lk.w >= 0.9; });
      if (i === d.from || strong) {
        kids.push(svg("rect", { x: centers[i] - widths[i] / 2 - 12, y: baseY - 46, width: widths[i] + 24, height: 62, rx: 12, class: i === d.from ? "att-from" : "att-to" }));
      }
      kids.push(svgText(centers[i], baseY, w, { "text-anchor": "middle", class: "att-word" + (i === d.from ? " from" : strong ? " to" : "") }));
    });
    s.appendChild(svg("svg", { viewBox: "0 0 1104 290", class: "att" }, kids));
    if (d.message) s.appendChild(R("p", "att-msg", d.message));
    if (d.caption) s.appendChild(R("p", "att-note", d.caption));
    foot(s, d);
  };

  /* 머리글자 풀이(G · P · T) */
  L.letters = function (s, d) {
    if (d.title) s.appendChild(R("p", "gpt-title", d.title));
    var row = el("div", "gpt cols-" + list(d.letters).length);
    list(d.letters).forEach(function (g) {
      row.appendChild(el("div", "gpt-col", [R("span", "gl", g.l), g.en ? R("p", "gen", g.en) : null, R("p", "gko", g.ko), g.text ? R("p", "gtx", g.text) : null]));
    });
    s.appendChild(row);
  };

  /* 시험지(답안 + 빨간 표시) + 오른쪽 풀이 */
  L.paper = function (s, d) {
    title(s, d);
    s.appendChild(el("div", "ex-paper", [
      R("p", "ex-q", d.question),
      el("div", "ex-ans", [R("span", "", d.answer)]),
      el("span", "ex-mark"),
      R("span", "ex-score", d.score || "✕")
    ]));
    var ul = el("ul", "ex-lines");
    list(d.lines).forEach(function (t) { ul.appendChild(R("li", "", t)); });
    s.appendChild(ul);
  };

  /* 큰 질문 + 경우 두 칸 + 덧말 */
  L.question = function (s, d) {
    s.appendChild(R("p", "ck-text", d.text));
    var row = el("div", "ck-cases");
    list(d.cases).forEach(function (c) { row.appendChild(el("div", "ck-case", [R("p", "ck-head", c.head), R("p", "ck-body", c.text)])); });
    s.appendChild(row);
    if (d.aside) s.appendChild(R("p", "ck-aside", d.aside));
  };

  /* 책상(맥락 창) · overflow: 넘치는 책상 */
  L.desk = function (s, d) {
    title(s, d);
    var desk = el("div", "desk" + (d.overflow ? " over" : ""));
    var spots = d.overflow
      ? [[-150, 30, -9], [-60, 150, 6], [30, 40, -4], [250, 60, 3], [470, 40, -5], [600, 160, 4]]
      : [[40, 46, -4], [270, 30, 3], [480, 52, -2], [180, 176, 2]];
    list(d.papers).forEach(function (p, i) {
      var sp = spots[i % spots.length];
      var squash = d.overflow && i < 3;
      var paper = el("div", "paper" + (squash ? " squash" : "") + (i === list(d.papers).length - 1 ? " last" : ""), [R("span", "", p)]);
      paper.style.left = sp[0] + "px";
      paper.style.top = sp[1] + "px";
      paper.style.transform = "rotate(" + sp[2] + "deg)" + (squash ? " scale(.72,.5)" : "");
      desk.appendChild(paper);
    });
    if (d.overflow && d.squashed) desk.appendChild(el("div", "squash-label", d.squashed.map(function (t) { return R("span", "", t); })));
    if (d.edge) desk.appendChild(R("p", "desk-edge", d.edge));
    s.appendChild(desk);
    if (d.legend) {
      var lg = el("div", "desk-legend");
      d.legend.forEach(function (g, i) { lg.appendChild(el("p", i ? "desk-on" : "head-in", [R("b", "", g.head), R("span", "", g.text)])); });
      s.appendChild(lg);
    }
    if (d.result) s.appendChild(R("p", "desk-result", d.result));
  };

  /* 인용 카드 + 2 × 2 칸 */
  L.quotegrid = function (s, d) {
    title(s, d);
    s.appendChild(el("div", "br-quote", [R("p", "", d.quote), d.by ? R("span", "", d.by) : null]));
    var grid = el("div", "br-grid");
    list(d.items).forEach(function (it, i) {
      grid.appendChild(el("div", "br-item", [R("b", "", String(i + 1)), R("p", "br-head", it.head), R("p", "br-text", it.text)]));
    });
    s.appendChild(grid);
  };

  /* 앱(학교)과 모델(학생), 생각 강도 막대 */
  L.models = function (s, d) {
    title(s, d);
    var apps = el("div", "md-apps", [R("p", "md-head", d.appsHead || "앱 · 서비스")]);
    var chips = el("div", "md-chips");
    list(d.apps).forEach(function (a) { chips.appendChild(R("span", a === d.highlight ? "me" : "", a)); });
    apps.appendChild(chips);
    s.appendChild(apps);
    var st = el("div", "md-students", [R("p", "md-head", d.modelsHead || "모델")]);
    var cards = el("div", "md-cards");
    list(d.models).forEach(function (m) { cards.appendChild(el("div", "md-card", [R("b", "", m.name), R("span", "", m.text)])); });
    st.appendChild(cards);
    s.appendChild(st);
    if (d.effort) {
      var eff = el("div", "md-effort", [R("p", "md-head", d.effortHead || "추론 설정")]);
      var track = el("div", "md-track");
      d.effort.forEach(function (e) { track.appendChild(R("span", "", e)); });
      eff.appendChild(track);
      if (d.effortNote) eff.appendChild(R("p", "md-note", d.effortNote));
      s.appendChild(eff);
    }
  };

  /* 같은 부탁, 두 결과 */
  L.askcompare = function (s, d) {
    title(s, d);
    if (d.ask) s.appendChild(R("p", "tt-ask", d.ask));
    var row = el("div", "tt");
    [d.left, d.right].forEach(function (c, i) {
      if (!c) return;
      var col = el("div", "tt-col" + (i ? " agent" : ""), [R("p", "tt-head", c.head)]);
      var ol = el("ol");
      list(c.lines).forEach(function (t) { ol.appendChild(R("li", "", t)); });
      col.appendChild(ol);
      row.appendChild(col);
    });
    s.appendChild(row);
    foot(s, d);
  };

  /* 비유: 꼬리표 → 앞 것에서 뒤 것으로 → 인용 */
  L.analogy = function (s, d) {
    title(s, d);
    if (d.tags) {
      var words = el("div", "ag-words");
      d.tags.forEach(function (w) { words.appendChild(R("span", "", w)); });
      s.appendChild(words);
    }
    if (d.from && d.to) {
      s.appendChild(el("div", "ag-meal", [
        el("div", "ag-dish", [R("b", "", d.from.title), R("p", "", d.from.text)]),
        R("span", "ag-arrow", "→"),
        el("div", "ag-dish main", [R("b", "", d.to.title), R("p", "", d.to.text)])
      ]));
    }
    if (d.quote) s.appendChild(el("div", "ag-office", [R("p", "", d.quote), d.by ? R("span", "", d.by) : null]));
  };

  /* 네 단계가 도는 고리 */
  L.cycle = function (s, d) {
    title(s, d);
    var cx = 300, cy = 236, r = 172, mid = nextId("cyc");
    var spots = [[300, 66], [474, 236], [300, 406], [126, 236]];
    var arcs = [[-54, -22], [22, 54], [126, 158], [202, 234]];
    var kids = [svg("defs", {}, [arrowMarker(mid, "var(--forest)")])];
    kids.push(svg("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: "#e4e8e3", "stroke-width": 2, "stroke-dasharray": "2 8" }));
    arcs.forEach(function (a) {
      var a1 = a[0] * Math.PI / 180, a2 = a[1] * Math.PI / 180;
      kids.push(svg("path", {
        d: "M" + (cx + r * Math.cos(a1)) + " " + (cy + r * Math.sin(a1)) + " A " + r + " " + r + " 0 0 1 " + (cx + r * Math.cos(a2)) + " " + (cy + r * Math.sin(a2)),
        fill: "none", stroke: "var(--forest)", "stroke-width": 4, "marker-end": "url(#" + mid + ")", "stroke-linecap": "round"
      }));
    });
    kids.push(svg("circle", { cx: cx, cy: cy, r: 64, fill: "var(--forest)" }));
    kids.push(svgText(cx, cy + 11, d.center || "목표", { "text-anchor": "middle", class: "lp-center" }));
    var fig = el("div", "lp");
    fig.appendChild(svg("svg", { viewBox: "0 0 600 470", class: "lp-svg" }, kids));
    list(d.steps).slice(0, 4).forEach(function (st, i) {
      var node = el("div", "lp-node n" + (i + 1), [R("b", "", st.n || String(i + 1)), R("p", "lp-head", st.head), st.text ? R("p", "lp-text", st.text) : null]);
      node.style.left = spots[i][0] + "px";
      node.style.top = spots[i][1] + "px";
      fig.appendChild(node);
    });
    s.appendChild(fig);
    var side = el("div", "lp-side");
    list(d.side).forEach(function (c) { side.appendChild(el("div", "lp-card", [R("p", "", c.head), R("span", "", c.text)])); });
    if (d.example) side.appendChild(R("p", "lp-ex", d.example));
    s.appendChild(side);
  };

  /* 파일 목록(어두운 판) + 고친 파일에서 돌아가는 화살표 */
  L.files = function (s, d) {
    title(s, d);
    var files = list(d.files), mid = nextId("fl");
    var panel = el("div", "fl");
    panel.appendChild(el("div", "fl-row folder", [icon("folder", "fl-ico"), R("span", "", d.folder || "폴더")]));
    files.forEach(function (f, i) {
      panel.appendChild(el("div", "fl-row file" + (i === d.edited ? " edited" : ""), [icon("file", "fl-ico"), R("span", "", f), i === d.edited ? R("em", "", d.editedTag || "고침") : null]));
    });
    if (typeof d.edited === "number") {
      var rowH = 64, top = rowH, kids = [svg("defs", {}, [arrowMarker(mid, "var(--signal)")])];
      var ey = top + d.edited * rowH + rowH / 2, X = 560;
      files.forEach(function (_, i) {
        if (i === d.edited) return;
        var y = top + i * rowH + rowH / 2, bulge = 40 + Math.abs(d.edited - i) * 22;
        kids.push(svg("path", { d: "M" + X + " " + ey + " C " + (X + bulge) + " " + ey + ", " + (X + bulge) + " " + y + ", " + (X + 6) + " " + y, fill: "none", stroke: "var(--signal)", "stroke-width": 2.4, "marker-end": "url(#" + mid + ")", opacity: 0.85 }));
      });
      panel.appendChild(svg("svg", { viewBox: "0 0 680 " + (rowH * (files.length + 1)), class: "fl-svg" }, kids));
      panel.appendChild(R("p", "fl-tag", d.fileTag || "다시 열어 맞춰 보기"));
    }
    s.appendChild(panel);
    var side = el("div", "fl-side", [d.sideTitle ? R("p", "fl-side-title", d.sideTitle) : null]);
    list(d.compare).forEach(function (c, i) { side.appendChild(el("div", "fl-cmp" + (i ? " agent" : ""), [R("b", "", c.head), R("p", "", c.text)])); });
    s.appendChild(side);
  };

  /* 세 시기(전 · 중 · 후) */
  L.phases = function (s, d) {
    title(s, d);
    var row = el("div", "day");
    list(d.cols).forEach(function (c) {
      var col = el("div", "day-col" + (c.strong ? " strong" : ""), [el("i", "day-dot"), R("p", "day-when", c.when), c.who ? R("p", "day-who", c.who) : null]);
      var ul = el("ul");
      list(c.lines).forEach(function (t) { ul.appendChild(R("li", "", t)); });
      col.appendChild(ul);
      row.appendChild(col);
    });
    s.appendChild(row);
    foot(s, d);
  };

  /* 아래로 이어지는 세 줄(마지막 줄이 밝게) */
  L.cascade = function (s, d) {
    var ol = el("ol", "hr");
    list(d.steps).forEach(function (t) { ol.appendChild(R("li", "", t)); });
    s.appendChild(ol);
    if (d.by) s.appendChild(R("p", "hr-by", d.by));
  };

  /* 절정: 큰 명조 한 줄 + 입력창 한 줄 */
  L.climax = function (s, d) {
    s.appendChild(R("p", "gn-verse", d.verse));
    if (d.ref) s.appendChild(R("p", "gn-ref", d.ref));
    if (d.prompt) s.appendChild(el("div", "gn-box", [R("span", "", d.prompt), el("i", "caret"), el("span", "pr-send")]));
    if (d.line) s.appendChild(R("p", "gn-line", d.line));
  };

  /* 화면 모음(2 × 2, focus로 보여 줄 부분 지정) */
  L.gallery = function (s, d) {
    title(s, d);
    if (d.sub) s.appendChild(R("p", "apps-sub", d.sub));
    var grid = el("div", "apps");
    list(d.items).forEach(function (a) {
      var pic = img(a.image, (a.name || "") + " 화면");
      if (a.focus) pic.style.objectPosition = a.focus;
      if (a.fit) pic.style.objectFit = a.fit;
      grid.appendChild(el("figure", "app", [pic, el("figcaption", "", [R("b", "", a.name), a.maker ? R("span", "", a.maker) : null])]));
    });
    s.appendChild(grid);
    foot(s, d);
  };

  /* 같은 요청의 결과 줄 + 결과 화면 */
  L.results = function (s, d) {
    title(s, d);
    if (d.ask) s.appendChild(el("div", "sm-ask", [R("span", "sm-ask-label", d.askLabel || "요청"), R("p", "", d.ask)]));
    var rows = el("div", "sm-rows");
    list(d.rows).forEach(function (r) {
      rows.appendChild(el("div", "sm-row", [
        R("b", "sm-tool", r.tool),
        el("span", "sm-file", [icon("file", "sm-ico"), R("span", "", r.file), r.diff ? R("em", "", r.diff) : null]),
        R("p", "sm-said", "“" + r.said + "”")
      ]));
    });
    s.appendChild(rows);
    if (d.rowsNote) s.appendChild(R("p", "sm-note", d.rowsNote));
    if (d.result) s.appendChild(el("figure", "sm-result", [img(d.result.image, d.result.label), R("figcaption", "", d.result.label)]));
    foot(s, d);
  };

  /* 에이전트 앱 배치도(파일 · 결과 · 대화 · 요청 칸) + 번호 풀이 */
  var WINDOW = {
    app: "에이전트 앱",
    filesCap: "파일", files: [{ t: "자료", icon: "folder" }, { t: "결과", icon: "folder" }, { t: "보고서.hwpx", sub: true }, { t: "안내.html", sub: true }],
    centerCap: "결과 보기", docTitle: "보고서.hwpx",
    chatCap: "AI 대화창", chat: [{ type: "me", t: "날짜만 바꿔 줘" }, { type: "log", t: "읽음  보고서.hwpx" }, { type: "log", t: "고침  보고서.hwpx  +1 −1" }, { type: "ai", t: "날짜만 바꿨습니다. 열어서 확인해 보세요." }],
    input: "요청 쓰는 칸"
  };
  L.anatomy = function (s, d) {
    title(s, d);
    var w = Object.assign({}, WINDOW, d.window || {});
    function badge(n, cls) { return R("b", "an-badge " + cls, n); }
    var files = el("div", "an-files", [badge("1", "b1"), R("p", "an-cap", w.filesCap)]);
    list(w.files).forEach(function (f) { files.appendChild(el("p", "an-f" + (f.sub ? " sub" : ""), [icon(f.icon || (f.sub ? "file" : "folder"), "an-ico"), R("span", "", f.t)])); });
    var chat = el("div", "an-chat", [badge("3", "b3"), R("p", "an-cap", w.chatCap)]);
    list(w.chat).forEach(function (m) { chat.appendChild(R("p", m.type === "log" ? "an-log" : "an-msg " + (m.type || "ai"), m.t)); });
    chat.appendChild(el("div", "an-input", [badge("2", "b2"), R("span", "", w.input)]));
    s.appendChild(el("div", "an-win", [
      el("div", "an-top", [el("i"), el("i"), el("i"), R("span", "", w.app)]),
      el("div", "an-body", [
        files,
        el("div", "an-center", [badge("4", "b4"), R("p", "an-cap", w.centerCap), el("div", "an-doc", [R("p", "an-doc-title", w.docTitle), el("i", "w60"), el("i", "w90"), el("i", "w80"), el("i", "w40"), el("i", "w70")])]),
        chat
      ])
    ]));
    var ol = el("ol", "an-parts");
    list(d.parts).forEach(function (p) { ol.appendChild(el("li", "", [R("b", "", p.n), el("div", "", [R("p", "an-head", p.head), R("p", "an-text", p.text)])])); });
    s.appendChild(ol);
    foot(s, d);
  };

  /* 마무리(steps: 다음 행동 세 칸 · lines: 첫 줄 강조 + 나머지) */
  L.end = function (s, d) {
    logo(s);
    if (d.kicker) s.appendChild(R("p", "end-kick", d.kicker));
    s.appendChild(R("h1", "end-title", d.title));
    if (d.steps) {
      var ol = el("ol", "end-steps");
      d.steps.forEach(function (t, i) { ol.appendChild(el("li", "", [R("b", "", String(i + 1)), R("span", "", t)])); });
      s.appendChild(ol);
    } else if (d.lines) {
      if (d.lines[0]) s.appendChild(R("p", "end-lead", d.lines[0]));
      if (d.lines.length > 1) s.appendChild(R("p", "end-meta", d.lines.slice(1).join("\n")));
    }
  };

  /* ── 한 장 만들기 ── */
  function slideLabel(slide) {
    return plain(slide.label || slide.title || slide.text || slide.quote || slide.verse || "제목 없음").split("\n")[0];
  }
  function buildSlide(slide, index) {
    var sec = document.createElement("section");
    sec.className = "slide layout-" + slide.layout + (slide.tone === "dark" ? " is-dark" : "") + (slide.overflow ? " is-over" : "");
    sec.setAttribute("role", "group");
    sec.setAttribute("aria-roledescription", "슬라이드");
    sec.setAttribute("aria-label", (index + 1) + ". " + slideLabel(slide));
    sec.setAttribute("aria-hidden", "true");
    var make = L[slide.layout];
    if (make) make(sec, slide);
    else sec.appendChild(R("p", "unknown", "모르는 layout입니다: " + slide.layout + " (읽는법.md의 화면 유형 표를 보세요)"));
    if (slide.layout !== "cover" && slide.layout !== "end") chrome(sec, slide, index);
    return sec;
  }

  window.LectureSlides = { buildSlide: buildSlide, slideLabel: slideLabel, layouts: Object.keys(L) };

  /* ── 청중 화면 ── */
  if (!document.body.classList.contains("deck")) return;
  if (!window.DECK || !Array.isArray(DECK.slides) || !DECK.slides.length) {
    document.body.textContent = "js/deck-data.js를 읽지 못했습니다.";
    return;
  }
  var shot = /[?&]shot\b/.test(location.search);
  var tv = new URLSearchParams(location.search).get("tv") === "1";
  if (tv) document.body.dataset.remoteControlled = "true";
  if (shot) document.body.classList.add("shot");

  var frame = document.getElementById("frame");
  var viewport = document.getElementById("viewport");
  var live = document.getElementById("live");
  var index = -1;

  function fit() {
    var chromeH = document.fullscreenElement || shot || tv ? 0 : 72;
    var scale = shot ? 1 : Math.min(window.innerWidth / 1280, (window.innerHeight - chromeH) / 720);
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
    var m = /^#(\d+)$/.exec(location.hash);
    return m ? Number(m[1]) - 1 : 0;
  }
  function paint() {
    Array.prototype.forEach.call(frame.children, function (node, i) {
      var on = i === index;
      node.classList.toggle("is-on", on);
      node.setAttribute("aria-hidden", on ? "false" : "true");
    });
    document.title = DECK.title + " · " + (index + 1);
    live.textContent = (index + 1) + "장. " + slideLabel(DECK.slides[index]);
  }
  function go(n, opts) {
    opts = opts || {};
    if (document.body.dataset.remoteControlled === "true" && !opts.silent) return;
    var next = clamp(n), changed = next !== index;
    index = next;
    LectureSync.setIndex(index);
    if (changed || opts.force) paint();
    var hash = "#" + (index + 1);
    if (!opts.fromHash && location.hash !== hash) history.replaceState(null, "", location.pathname + location.search + hash);
    if (!opts.silent) LectureSync.emit(index);
  }

  document.getElementById("open-guide").addEventListener("click", function () { LectureSync.open("guide", index); });
  document.getElementById("full").addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
  frame.addEventListener("click", function (e) {
    if (e.target.closest("button, a")) return;
    var rect = frame.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width;
    if (x >= 0.72) go(index + 1);
    else if (x <= 0.28) go(index - 1);
  });
  var touchX = 0;
  frame.addEventListener("touchstart", function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
  frame.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) >= 48) go(index + (dx < 0 ? 1 : -1));
  });
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target && e.target.closest("input, textarea, select, button, a, [contenteditable=true], dialog")) return;
    if (document.querySelector("dialog[open]")) return;
    if (document.body.dataset.remoteControlled === "true" && !["f", "F"].includes(e.key)) return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " " || e.key === "Enter") { e.preventDefault(); go(index + 1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "Backspace") { e.preventDefault(); go(index - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(DECK.slides.length - 1); }
    else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } else if (e.key === "g" || e.key === "G") { e.preventDefault(); LectureSync.open("guide", index); }
  });
  window.addEventListener("hashchange", function () { go(readHash(), { fromHash: true }); });
  window.addEventListener("resize", fit);
  document.addEventListener("fullscreenchange", fit);

  DECK.slides.forEach(function (slide, i) { frame.appendChild(buildSlide(slide, i)); });
  fit();
  LectureSync.on(function (n) { if (Number.isInteger(n)) go(n, { silent: true }); });
  if (LectureSync.onReload) LectureSync.onReload(function () { location.reload(); }); // 교안에서 편집을 저장하면
  go(readHash(), { silent: true, force: true });
  LectureSync.hello();
})();
