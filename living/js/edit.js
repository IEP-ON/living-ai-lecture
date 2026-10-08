/* 교안 편집 모드
   교안 머리의 [편집]을 누르면, 지금 장의 화면 글과 교안(말할 것 · 짚을 것 · 막힐 때 · 근거 · 예정 시간)을
   칸에서 고칠 수 있습니다. 고치는 대로 미리보기가 바뀌고, 글자가 넘치거나 겹치면 바로 알려 줍니다.
   [저장]을 누르면 이 강의 폴더의 js/deck-data.js에서 고친 글자만 바꿔 씁니다(주석 · 줄 맞춤 · 나머지는 그대로).

   - 글자와 시간만 고칩니다. 화면 유형(layout) · 그림 파일 · 장 순서 · 장 더하기는 deck-data.js에서 하거나 에이전트에게 맡깁니다.
   - 저장은 Edge · Chrome에서 됩니다. 처음 저장할 때 이 강의 폴더의 js/deck-data.js를 한 번 골라 주고, 수정 허락을 누릅니다.
     저장할 수 없는 브라우저에서는 [바꾼 곳 복사]로 바꾼 내용을 글로 복사해 에이전트에게 줄 수 있습니다.
   - 저장 뒤 대본.md는 node 대본_다시만들기.cjs로 다시 만듭니다. 슬라이드 창은 저장하면 저절로 다시 읽습니다. */
(function () {
  if (!window.DECK || !Array.isArray(DECK.slides) || !window.LectureGuide || !window.LectureSlides) return;
  // 편집은 내 컴퓨터에서 연 교안에서만 보입니다. 웹에 올린 사본(GitHub Pages 등)에는 [편집]이 나오지 않습니다.
  var local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (!local) return;
  // 조각 강의: 여러 조각을 이어 붙인 화면에서는 고치지 않습니다. 조각 하나만 열면(?set=s2) 그 조각 파일에 저장합니다.
  if (DECK.composed) return;
  var FILE = DECK.file || "deck-data.js";
  var FILE_PATH = DECK.file ? "조각/" + DECK.file : "js/deck-data.js";

  /* ── deck-data.js 읽기: 값마다 파일 속 자리(시작 · 끝)를 찾습니다 ── */
  function locate(src) {
    var at = src.indexOf("window.DECK");
    if (at < 0) throw new Error("window.DECK를 찾지 못했습니다.");
    var i = src.indexOf("=", at) + 1;
    var map = {};
    function fail(what) {
      var line = src.slice(0, i).split("\n").length;
      throw new Error("deck-data.js " + line + "번째 줄을 읽지 못했습니다(" + what + ").");
    }
    function ws() {
      for (;;) {
        var c = src[i];
        if (c === " " || c === "\n" || c === "\r" || c === "\t" || c === "﻿") { i++; continue; }
        if (c === "/" && src[i + 1] === "/") { var nl = src.indexOf("\n", i); i = nl < 0 ? src.length : nl + 1; continue; }
        if (c === "/" && src[i + 1] === "*") { var end = src.indexOf("*/", i + 2); if (end < 0) fail("닫히지 않은 주석"); i = end + 2; continue; }
        return;
      }
    }
    var ESC = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": "\0" };
    function str() {
      var q = src[i], out = "", j = i + 1;
      for (;;) {
        var c = src[j];
        if (c === undefined || c === "\n") fail("닫히지 않은 글자");
        if (c === q) break;
        if (c === "\\") {
          var n = src[j + 1];
          if (n === "u") { out += String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)); j += 6; continue; }
          if (n === "\r" || n === "\n") { j += n === "\r" && src[j + 2] === "\n" ? 3 : 2; continue; }
          out += ESC[n] !== undefined ? ESC[n] : n;
          j += 2;
          continue;
        }
        out += c;
        j++;
      }
      i = j + 1;
      return out;
    }
    function key() {
      if (src[i] === "\"" || src[i] === "'") return str();
      var m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 80));
      if (!m) fail("칸 이름");
      i += m[0].length;
      return m[0];
    }
    function value(path) {
      ws();
      var c = src[i], s = i;
      if (c === "{") {
        i++;
        for (;;) {
          ws();
          if (src[i] === "}") { i++; break; }
          var k = key();
          ws();
          if (src[i] !== ":") fail("':' 빠짐");
          i++;
          value(path ? path + "." + k : k);
          ws();
          if (src[i] === ",") { i++; continue; }
          if (src[i] === "}") { i++; break; }
          fail("',' 또는 '}' 빠짐");
        }
        return;
      }
      if (c === "[") {
        i++;
        for (var n = 0; ; n++) {
          ws();
          if (src[i] === "]") { i++; break; }
          value(path + "." + n);
          ws();
          if (src[i] === ",") { i++; continue; }
          if (src[i] === "]") { i++; break; }
          fail("',' 또는 ']' 빠짐");
        }
        return;
      }
      if (c === "\"" || c === "'") { var v = str(); map[path] = { s: s, e: i, value: v }; return; }
      var m = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(src.slice(i, i + 40));
      if (!m) fail("알 수 없는 값");
      i += m[0].length;
      map[path] = { s: s, e: i, value: m[0] === "true" ? true : m[0] === "false" ? false : m[0] === "null" ? null : Number(m[0]) };
    }
    value("");
    return map;
  }

  /* 고친 곳만 바꿔 쓴 새 파일 글. 파일이 그사이 바뀌었으면 멈춥니다. */
  function applyChanges(text, changes) {
    var map = locate(text);
    var edits = changes.map(function (c) {
      var k = ["slides", c.slide].concat(c.path).join(".");
      var at = map[k];
      if (!at) throw new Error((c.slide + 1) + "장의 ‘" + c.name + "’ 자리를 파일에서 찾지 못했습니다.");
      if (at.value !== c.orig) throw new Error("파일이 그사이 바뀌었습니다(" + (c.slide + 1) + "장 ‘" + c.name + "’). 교안을 새로 고친 뒤 다시 고쳐 주세요.");
      return { s: at.s, e: at.e, lit: typeof c.value === "number" ? String(c.value) : JSON.stringify(c.value) };
    }).sort(function (a, b) { return b.s - a.s; });
    var out = text;
    edits.forEach(function (e) { out = out.slice(0, e.s) + e.lit + out.slice(e.e); });
    var again = locate(out);
    changes.forEach(function (c) {
      var k = ["slides", c.slide].concat(c.path).join(".");
      if (!again[k] || again[k].value !== c.value) throw new Error("바꿔 쓴 뒤 확인에서 어긋났습니다(" + (c.slide + 1) + "장 ‘" + c.name + "’). 저장하지 않았습니다.");
    });
    return out;
  }

  /* ── 고칠 칸 고르기와 이름 ── */
  var SKIP = { "if": 1, vary: 1, module: 1, layout: 1, tone: 1, image: 1, icon: 1, focus: 1, fit: 1, mark: 1, overflow: 1, frame: 1, href: 1, src: 1, part: 1, edited: 1 };
  var NAMES = {
    label: "교안 목록 이름", group: "구간 이름(이 장부터)", kicker: "작은 글(왼쪽 위)", title: "제목", subtitle: "부제", sub: "아랫글",
    text: "본문", lead: "앞말", foot: "아래 결론 줄", caption: "그림 설명", alt: "그림 대신 읽는 글", by: "말한 사람 · 출처", quote: "인용",
    message: "큰 글", line: "한 줄", punch: "한 방", verse: "구절", ref: "출처", prompt: "요청 칸 글", lesson: "깨달음 한 줄", def: "뜻풀이",
    question: "문제", answer: "답", edge: "덧말", result: "결론", aside: "곁말", name: "이름", role: "소속", head: "머리", big: "큰 글",
    maker: "만든 곳", file: "파일", diff: "바뀐 줄", said: "보고 문장", tool: "도구", askLabel: "요청 이름", ask: "요청", rowsNote: "표 아래 글",
    when: "때", who: "누가", center: "가운데 글", example: "예", sideTitle: "옆 제목", fileTag: "꼬리표", editedTag: "고침 꼬리표",
    folder: "폴더 이름", meta: "아랫줄", phrase: "말머리", dest: "목적지", appsHead: "앱 머리", modelsHead: "모델 머리", effortHead: "강도 머리",
    effortNote: "강도 풀이", app: "앱 이름", filesCap: "파일 칸 이름", centerCap: "가운데 칸 이름", chatCap: "대화 칸 이름", docTitle: "문서 이름",
    input: "입력 칸 글", t: "글", word: "낱말", of: "조각", stamp: "도장",
    items: "항목", cards: "카드", columns: "칸", lines: "줄", steps: "단계", tags: "꼬리표", rows: "줄", parts: "부분", papers: "종이",
    squashed: "접힌 말", route: "길", bars: "막대", models: "모델", apps: "앱", effort: "강도", cases: "경우", after: "오른쪽 풀이",
    files: "파일", compare: "견줌", cols: "시기", terms: "낱말", letters: "글자", chat: "대화", reasons: "까닭", checks: "판정", timeline: "연표",
    links: "연결", side: "옆", left: "왼쪽", right: "오른쪽", from: "앞", to: "뒤", window: "배치도", highlight: "강조 띠",
    say: "말할 것", point: "화면에서 짚을 것", minutes: "예정 시간(분)", source: "강사용 근거(읽지 않음)"
  };
  var NOTE_NAMES = { say: "말할 것", point: "화면에서 짚을 것", alt: "막히거나 시간이 모자랄 때", source: "강사용 근거(읽지 않음)", minutes: "예정 시간(분, 0.5 = 30초)" };
  var NOTE_ORDER = ["say", "point", "alt", "source", "minutes"];

  function looksLikeFile(v) { return /^(images|brand|fonts)\//.test(v) || /\.(png|jpe?g|svg|webp|gif)$/i.test(v); }
  function fieldName(path) {
    var out = [];
    path.forEach(function (p) {
      if (typeof p === "number") { if (out.length) out[out.length - 1] += " " + (p + 1); else out.push(String(p + 1)); }
      else out.push(NAMES[p] || p);
    });
    return out.join(" · ");
  }
  function collect(slide) {
    var screen = [], note = [];
    (function walk(obj, path) {
      Object.keys(obj).forEach(function (k) {
        var v = obj[k], p = path.concat(Array.isArray(obj) ? Number(k) : k);
        if (!path.length && k === "note") return;
        if (!Array.isArray(obj) && SKIP[k]) return;
        if (typeof v === "string") {
          if (k === "highlight" || looksLikeFile(v)) return;
          screen.push({ path: p, name: fieldName(p), value: v });
        } else if (v && typeof v === "object") walk(v, p);
      });
    })(slide, []);
    var n = slide.note || {};
    NOTE_ORDER.forEach(function (k) {
      if (k === "minutes") {
        if (typeof n.minutes === "number") note.push({ path: ["note", "minutes"], name: NOTE_NAMES.minutes, value: n.minutes, number: true });
        return;
      }
      if (typeof n[k] === "string") note.push({ path: ["note", k], name: NOTE_NAMES[k], value: n[k], long: true });
    });
    return { screen: screen, note: note };
  }
  function getAt(obj, path) { return path.reduce(function (o, p) { return o == null ? o : o[p]; }, obj); }
  function setAt(obj, path, value) {
    var parent = getAt(obj, path.slice(0, -1));
    if (parent) parent[path[path.length - 1]] = value;
  }

  /* ── 상태 ── */
  var changes = new Map(); // "장|경로" → { slide, path, name, orig, value }
  var on = false, formIndex = -1, timer = 0;
  var handle = null;

  /* ── 화면 ── */
  var actions = document.querySelector(".top-actions");
  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "quiet";
  toggle.id = "edit-toggle";
  toggle.textContent = "편집";
  actions.insertBefore(toggle, document.getElementById("timer"));

  var panel = document.createElement("section");
  panel.className = "edit-panel";
  panel.setAttribute("aria-label", "편집");
  var sheets = document.getElementById("sheets");
  sheets.parentNode.insertBefore(panel, sheets.nextSibling);

  var bar = document.createElement("div");
  bar.className = "edit-bar";
  var saveBtn = button("저장", "primary", save);
  var undoBtn = button("되돌리기", "quiet", undoAll);
  var copyBtn = button("바꾼 곳 복사", "quiet", copyChanges);
  var status = document.createElement("p");
  status.className = "edit-status";
  status.setAttribute("role", "status");
  bar.append(saveBtn, undoBtn, copyBtn, status);

  var form = document.createElement("div");
  form.className = "edit-form";
  var check = document.createElement("p");
  check.className = "edit-check";
  panel.append(bar, check, form);

  var probe = document.createElement("div");
  probe.className = "edit-probe";
  probe.setAttribute("aria-hidden", "true");
  var probeCanvas = document.createElement("div");
  probeCanvas.className = "canvas";
  probe.appendChild(probeCanvas);

  function button(label, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  }
  function say(text, tone) {
    status.textContent = text || "";
    status.className = "edit-status" + (tone ? " " + tone : "");
  }
  function showCount() {
    var n = changes.size;
    saveBtn.textContent = n ? "저장 (" + n + "곳)" : "저장";
    saveBtn.disabled = !n;
    undoBtn.disabled = !n;
    copyBtn.disabled = !n;
    toggle.textContent = on ? (n ? "편집 끝내기 · 저장 안 한 곳 " + n : "편집 끝내기") : (n ? "편집 · 저장 안 한 곳 " + n : "편집");
  }

  function grow(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, 520) + "px"; }

  function buildForm(i) {
    formIndex = i;
    var slide = DECK.slides[i];
    var fields = collect(slide);
    form.replaceChildren();
    var head = document.createElement("div");
    head.className = "edit-head";
    var h = document.createElement("h2");
    h.textContent = (i + 1) + "장 · " + LectureSlides.slideLabel(slide);
    var meta = document.createElement("p");
    meta.className = "edit-meta";
    meta.textContent = "화면 유형 " + slide.layout + " · *별표* 사이는 강조색, 줄을 바꾸면 화면에서도 줄이 바뀝니다. 화면 유형 · 그림 · 장 순서는 deck-data.js에서 바꿉니다.";
    head.append(h, meta);
    form.appendChild(head);
    [["화면 글", fields.screen], ["교안", fields.note]].forEach(function (sec) {
      if (!sec[1].length) return;
      var box = document.createElement("div");
      box.className = "edit-section";
      var t = document.createElement("h3");
      t.textContent = sec[0];
      box.appendChild(t);
      sec[1].forEach(function (f) { box.appendChild(fieldRow(i, f)); });
      form.appendChild(box);
    });
    runCheck(i);
  }

  function fieldRow(i, f) {
    var row = document.createElement("div");
    row.className = "edit-field";
    var id = "ed-" + i + "-" + f.path.join("-");
    var lab = document.createElement("label");
    lab.htmlFor = id;
    lab.textContent = f.name;
    var input;
    if (f.number) {
      input = document.createElement("input");
      input.type = "number";
      input.step = "0.1";
      input.min = "0";
      input.value = String(f.value);
    } else if (f.long || /\n/.test(f.value) || f.value.length > 36) {
      input = document.createElement("textarea");
      input.rows = 2;
      input.value = f.value;
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = f.value;
    }
    input.id = id;
    input.spellcheck = false;
    var key = i + "|" + f.path.join(".");
    if (changes.has(key)) row.classList.add("changed");
    input.addEventListener("input", function () {
      var value = f.number ? Number(input.value) : input.value;
      if (f.number && (input.value === "" || !Number.isFinite(value) || value < 0)) return;
      var c = changes.get(key);
      var orig = c ? c.orig : getAt(DECK.slides[i], f.path);
      setAt(DECK.slides[i], f.path, value);
      if (value === orig) changes.delete(key);
      else changes.set(key, { slide: i, path: f.path, name: f.name, orig: orig, value: value });
      row.classList.toggle("changed", changes.has(key));
      if (input.tagName === "TEXTAREA") grow(input);
      showCount();
      say("");
      clearTimeout(timer);
      timer = setTimeout(function () { LectureGuide.refresh(i); runCheck(i); }, 160);
    });
    row.append(lab, input);
    if (input.tagName === "TEXTAREA") requestAnimationFrame(function () { grow(input); });
    return row;
  }

  /* 고친 장을 실제 크기로 그려 점검 규칙(js/check.js)으로 봅니다. */
  function runCheck(i) {
    if (!window.LectureCheck) { check.textContent = ""; check.className = "edit-check"; return; }
    if (!probe.isConnected) document.body.appendChild(probe);
    var sec = LectureSlides.buildSlide(DECK.slides[i], i);
    sec.classList.add("is-on");
    probeCanvas.replaceChildren(sec);
    var issues = [];
    try { issues = LectureCheck.inspect(sec, DECK.slides[i]); } catch (err) { issues = []; }
    issues = issues.filter(function (x) { return !/^그림 없음/.test(x); }); // 그림은 아직 읽는 중일 수 있습니다
    if (issues.length) {
      check.className = "edit-check bad";
      check.textContent = "화면에서 글자가 넘치거나 겹칩니다 — 글을 줄이거나 칸 안에서 줄을 바꿔 주세요.\n" + issues.map(function (x) { return "· " + x; }).join("\n");
    } else {
      check.className = "edit-check ok";
      check.textContent = "이 장은 겹침 · 넘침 없음";
    }
  }

  function setOn(v) {
    on = v;
    document.body.classList.toggle("editing", on);
    toggle.classList.toggle("is-on", on);
    if (on) buildForm(LectureGuide.index);
    showCount();
  }
  toggle.addEventListener("click", function () { setOn(!on); });

  LectureGuide.onPaint(function (i) {
    if (!on) return;
    if (i !== formIndex) buildForm(i);
  });

  function undoAll() {
    if (!changes.size) return;
    var touched = {};
    changes.forEach(function (c) { setAt(DECK.slides[c.slide], c.path, c.orig); touched[c.slide] = 1; });
    changes.clear();
    Object.keys(touched).forEach(function (s) { LectureGuide.refresh(Number(s)); });
    LectureGuide.go(LectureGuide.index, { silent: true, force: true });
    if (on) buildForm(LectureGuide.index);
    showCount();
    say("저장하지 않은 곳을 모두 되돌렸습니다.");
  }

  function changeText() {
    var lines = [];
    Array.from(changes.values()).sort(function (a, b) { return a.slide - b.slide; }).forEach(function (c) {
      lines.push((c.slide + 1) + "장 ‘" + LectureSlides.slideLabel(DECK.slides[c.slide]) + "’ · " + c.name);
      lines.push("  전: " + JSON.stringify(c.orig));
      lines.push("  뒤: " + JSON.stringify(c.value));
    });
    return FILE_PATH + "에서 바꿀 곳 " + changes.size + "개\n" + lines.join("\n");
  }
  function copyChanges() {
    var text = changeText();
    var done = function () { say("바꾼 곳을 복사했습니다. 에이전트에게 붙여 넣으면 그대로 고쳐 줍니다."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    try { document.execCommand("copy"); } catch (e) {}
    t.remove();
  }

  /* ── 파일 손잡이: 이 강의 폴더마다 기억합니다(IndexedDB) ── */
  var DIR = decodeURIComponent(location.pathname).replace(/[^\/\\]*$/, "") + (DECK.file ? "#" + DECK.file : "");
  function idb(mode, fn) {
    return new Promise(function (resolve) {
      try {
        var open = indexedDB.open("lecture-edit", 1);
        open.onupgradeneeded = function () { open.result.createObjectStore("handles"); };
        open.onerror = function () { resolve(null); };
        open.onsuccess = function () {
          // 기억하지 못해도 저장은 끝까지 갑니다(다음 저장 때 파일을 다시 고르면 됩니다).
          try {
            var tx = open.result.transaction("handles", mode);
            var req = fn(tx.objectStore("handles"));
            tx.oncomplete = function () { resolve(req && req.result); };
            tx.onerror = tx.onabort = function () { resolve(null); };
          } catch (e) { resolve(null); }
        };
      } catch (e) { resolve(null); }
    });
  }
  function rememberHandle(h) { return idb("readwrite", function (s) { return s.put(h, DIR); }); }
  function storedHandle() { return idb("readonly", function (s) { return s.get(DIR); }); }
  function forgetHandle() { handle = null; return idb("readwrite", function (s) { return s.delete(DIR); }); }

  async function getHandle() {
    if (handle) return handle;
    var h = await storedHandle();
    if (h) return (handle = h);
    var picked = await window.showOpenFilePicker({
      id: "lecture-deck-data",
      types: [{ description: FILE, accept: { "text/javascript": [".js"] } }],
      multiple: false
    });
    return (handle = picked[0]);
  }
  async function allowed(h) {
    if (!h.queryPermission) return true;
    var opts = { mode: "readwrite" };
    if ((await h.queryPermission(opts)) === "granted") return true;
    return (await h.requestPermission(opts)) === "granted";
  }

  async function save() {
    if (!changes.size) return;
    if (!window.showOpenFilePicker && !handle) {
      say("이 브라우저에서는 바로 저장할 수 없습니다. Edge나 Chrome으로 여시거나, [바꾼 곳 복사]로 에이전트에게 맡기세요.", "warn");
      return;
    }
    saveBtn.disabled = true;
    say("저장하는 중…");
    try {
      var h = await getHandle();
      if (h.name && h.name !== FILE) { await forgetHandle(); throw new Error("고른 파일이 " + FILE + "가 아닙니다(" + h.name + "). 이 강의 폴더의 " + FILE_PATH + "를 골라 주세요."); }
      if (!(await allowed(h))) throw new Error("파일 수정 허락을 받지 못했습니다.");
      var text = await (await h.getFile()).text();
      var map = locate(text);
      var title = map.title && map.title.value;
      var count = Object.keys(map).filter(function (k) { return /^slides\.\d+\.layout$/.test(k); }).length;
      if (title !== DECK.title || count !== DECK.slides.length) {
        await forgetHandle();
        throw new Error("다른 강의의 " + FILE + "를 고르신 것 같습니다(" + (title || "제목 없음") + " · " + count + "장). 이 강의 폴더의 " + FILE_PATH + "를 다시 골라 주세요.");
      }
      var list = Array.from(changes.values());
      var out = applyChanges(text, list);
      var w = await h.createWritable();
      await w.write(out);
      await w.close();
      await rememberHandle(h);
      var n = list.length;
      changes.clear();
      showCount();
      if (on) buildForm(LectureGuide.index);
      if (window.LectureSync && LectureSync.reload) LectureSync.reload();
      say("저장했습니다(" + n + "곳). 슬라이드 창은 저절로 다시 읽습니다. 대본.md는 node 대본_다시만들기.cjs로 다시 만드세요.", "ok");
    } catch (err) {
      if (err && err.name === "AbortError") say("파일을 고르지 않아 저장하지 않았습니다.", "warn");
      else say("저장하지 못했습니다: " + (err && err.message || err), "bad");
    } finally {
      showCount();
    }
  }

  window.addEventListener("beforeunload", function (e) {
    if (!changes.size) return;
    e.preventDefault();
    e.returnValue = "";
  });

  window.LectureEdit = { locate: locate, applyChanges: applyChanges, collect: collect, _useHandle: function (h) { handle = h; } };
  showCount();
})();
