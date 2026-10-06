/* 강사용 큰 대본. 교안의 장 선택과 동기화하며 강의 내용은 바꾸지 않습니다. */
(function () {
  "use strict";
  if (!window.LectureGuide || !window.DECK || !Array.isArray(DECK.slides)) return;
  const actions = document.querySelector(".top-actions");
  if (!actions) return;

  const STORE = "lecture-prompter-v1";
  const clamp = function (n, min, max, fallback) {
    n = Number(n);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (_) { /* 저장이 막혀 있어도 사용할 수 있습니다. */ }
  let fontSize = clamp(prefs.fontSize, 24, 64, 40);
  let speed = clamp(prefs.speed, 6, 72, 22);
  let showPreview = prefs.preview === true;
  let active = false;
  let running = false;
  let frame = 0;
  let lastTime = null;
  let scrollPosition = 0;
  let renderedIndex = -1;
  let priorFocus = null;
  let priorScroll = 0;
  let wakeLock = null;
  let wakePending = false;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, cls, action, label) {
    const node = el("button", cls, text);
    node.type = "button";
    if (label) node.setAttribute("aria-label", label);
    node.addEventListener("click", action);
    return node;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ fontSize: fontSize, speed: speed, preview: showPreview })); } catch (_) { /* 선택한 값은 이번 창에서 유지합니다. */ }
  }

  const toggle = button("프롬프터", "quiet", function () { setActive(true); });
  toggle.id = "prompter-toggle";
  toggle.setAttribute("aria-controls", "lecture-prompter");
  toggle.setAttribute("aria-expanded", "false");
  actions.appendChild(toggle);

  const root = el("section", "prompter");
  root.id = "lecture-prompter";
  root.hidden = true;
  root.setAttribute("aria-label", "발표자 프롬프터");
  const header = el("header", "prompter-head");
  const identity = el("div", "prompter-identity");
  const eyebrow = el("div", "prompter-eyebrow");
  const tvStatus = el("span", "prompter-tv-status", "TV 원격 연결 안 됨");
  tvStatus.setAttribute("role", "status");
  eyebrow.append(el("span", "", "발표자 화면"), tvStatus);
  const title = el("h2", "prompter-title");
  title.id = "prompter-slide-title";
  const count = el("span", "prompter-count");
  count.setAttribute("aria-live", "polite");
  const heading = el("div", "prompter-heading");
  heading.append(count, title);
  identity.append(eyebrow, heading);
  const navigation = el("nav", "prompter-nav");
  navigation.setAttribute("aria-label", "발표 장 이동");
  const prev = button("← 이전", "prompter-button", function () { LectureGuide.go(LectureGuide.index - 1); }, "이전 장");
  const next = button("다음 →", "prompter-button prompter-primary", function () { LectureGuide.go(LectureGuide.index + 1); }, "다음 장");
  navigation.append(prev, next);
  header.append(identity, navigation);

  const toolbar = el("div", "prompter-toolbar");
  const fontControls = el("div", "prompter-font");
  fontControls.setAttribute("role", "group");
  fontControls.setAttribute("aria-label", "대본 글자 크기");
  const smaller = button("가−", "prompter-button prompter-font-button", function () { changeFont(-2); }, "글자 작게");
  const fontValue = el("output", "prompter-font-value");
  fontValue.setAttribute("aria-label", "현재 글자 크기");
  const larger = button("가+", "prompter-button prompter-font-button", function () { changeFont(2); }, "글자 크게");
  fontControls.append(smaller, fontValue, larger);
  const previewToggle = button("화면 미리보기", "prompter-button", function () {
    pause();
    showPreview = !showPreview;
    applyPreferences();
    fitPreview();
    save();
  });
  previewToggle.setAttribute("aria-controls", "prompter-preview");
  const tv = button("TV 연결", "prompter-button", function () {
    pause();
    if (window.LectureRemote && typeof LectureRemote.openPanel === "function") LectureRemote.openPanel();
    else status.textContent = "TV 연결 기능을 불러오지 못했습니다. 교안을 새로 열어 주세요.";
  });
  const exit = button("교안으로", "prompter-button prompter-exit", function () { setActive(false); }, "프롬프터를 닫고 교안으로 돌아가기");
  toolbar.append(fontControls, previewToggle, tv, exit);

  const viewport = el("div", "prompter-viewport");
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", "지금 장의 대본, 위아래로 스크롤");
  const reading = el("div", "prompter-reading");
  const speech = el("article", "prompter-speech");
  speech.setAttribute("aria-labelledby", title.id);
  const script = el("div", "prompter-script");
  const reminders = el("details", "prompter-reminders");
  const summary = el("summary", "", "짚을 것 · 막힐 때");
  const reminderBody = el("div", "prompter-reminder-body");
  reminders.append(summary, reminderBody);
  speech.append(script, reminders);
  const preview = el("aside", "prompter-preview");
  preview.id = "prompter-preview";
  preview.setAttribute("aria-hidden", "true");
  const previewBox = el("div", "prompter-preview-box");
  const previewCanvas = el("div", "prompter-preview-canvas");
  previewBox.appendChild(previewCanvas);
  preview.append(el("p", "prompter-preview-label", "청중 화면"), previewBox);
  reading.append(speech, preview);
  viewport.appendChild(reading);

  const footer = el("footer", "prompter-footer");
  const scrollButton = button("자동 스크롤", "prompter-button prompter-scroll-button", function () {
    if (running) pause(); else start();
  });
  scrollButton.setAttribute("aria-pressed", "false");
  const speedControl = el("label", "prompter-speed");
  const speedLabel = el("span", "", "속도");
  const speedInput = el("input");
  speedInput.type = "range";
  speedInput.min = "6";
  speedInput.max = "72";
  speedInput.step = "2";
  speedInput.setAttribute("aria-label", "자동 스크롤 속도");
  speedInput.addEventListener("input", function () {
    speed = Number(speedInput.value);
    speedInput.setAttribute("aria-valuetext", speed + " 픽셀/초");
    save();
  });
  speedControl.append(speedLabel, speedInput);
  const status = el("p", "prompter-status", "다음 장은 직접 넘겨 주세요");
  status.setAttribute("role", "status");
  footer.append(scrollButton, speedControl, status);
  root.append(header, toolbar, viewport, footer);
  document.body.appendChild(root);

  function applyPreferences() {
    root.style.setProperty("--prompter-font-size", fontSize + "px");
    fontValue.textContent = fontSize + "px";
    smaller.disabled = fontSize <= 24;
    larger.disabled = fontSize >= 64;
    preview.hidden = !showPreview;
    root.classList.toggle("has-preview", showPreview);
    previewToggle.setAttribute("aria-pressed", String(showPreview));
    speedInput.value = String(speed);
    speedInput.setAttribute("aria-valuetext", speed + " 픽셀/초");
  }
  function changeFont(delta) {
    pause();
    fontSize = clamp(fontSize + delta, 24, 64, 40);
    applyPreferences();
    save();
  }
  function fitPreview() {
    if (!active || !showPreview) return;
    previewCanvas.style.transform = "scale(" + previewBox.clientWidth / 1280 + ")";
  }
  function render() {
    if (!active) return;
    const index = LectureGuide.index;
    const slide = DECK.slides[index];
    if (!slide) return;
    const changed = renderedIndex !== index;
    pause(changed ? "새 장입니다. 준비되면 자동 스크롤을 켜세요" : undefined);
    renderedIndex = index;
    title.textContent = LectureSlides.slideLabel(slide);
    count.textContent = (index + 1) + " / " + DECK.slides.length;
    prev.disabled = index === 0;
    next.disabled = index === DECK.slides.length - 1;
    script.replaceChildren();
    const note = slide.note || {};
    const paragraphs = String(note.say || "").split(/\n\n+/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!paragraphs.length) paragraphs.push("이 장에는 준비된 대본이 없습니다.");
    paragraphs.forEach(function (text) { script.appendChild(el("p", "", text)); });
    reminderBody.replaceChildren();
    [["point", "짚을 것"], ["alt", "막히거나 시간이 모자랄 때"]].forEach(function (item) {
      if (!note[item[0]]) return;
      const section = el("section");
      section.append(el("h3", "", item[1]), el("p", "", String(note[item[0]])));
      reminderBody.appendChild(section);
    });
    reminders.hidden = !reminderBody.children.length;
    if (changed) reminders.open = false;
    previewCanvas.replaceChildren(LectureSlides.buildSlide(slide, index));
    if (previewCanvas.firstElementChild) previewCanvas.firstElementChild.classList.add("is-on");
    if (changed) viewport.scrollTop = 0;
    fitPreview();
  }
  function setActive(on) {
    if (active === on) return;
    pause();
    active = on;
    root.hidden = !on;
    toggle.setAttribute("aria-expanded", String(on));
    if (on) {
      priorFocus = document.activeElement;
      priorScroll = window.scrollY;
      document.body.classList.add("prompter-on");
      renderedIndex = -1;
      render();
      viewport.focus({ preventScroll: true });
      requestWakeLock();
    } else {
      releaseWakeLock();
      document.body.classList.remove("prompter-on");
      window.dispatchEvent(new Event("resize"));
      window.scrollTo(0, priorScroll);
      (priorFocus && priorFocus.isConnected ? priorFocus : toggle).focus({ preventScroll: true });
    }
  }
  async function requestWakeLock() {
    if (!active || document.hidden || wakeLock || wakePending || !navigator.wakeLock) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (!active || document.hidden) { await lock.release(); return; }
      wakeLock = lock;
      lock.addEventListener("release", function () { if (wakeLock === lock) wakeLock = null; });
    } catch (_) { /* 지원하지 않거나 절전 설정으로 거절해도 대본은 그대로 사용할 수 있습니다. */ }
    finally { wakePending = false; }
  }
  function releaseWakeLock() {
    const lock = wakeLock;
    wakeLock = null;
    if (lock) lock.release().catch(function () {});
  }
  function pause(message) {
    const wasRunning = running;
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    scrollButton.textContent = "자동 스크롤";
    scrollButton.setAttribute("aria-pressed", "false");
    if (message) status.textContent = message;
    else if (wasRunning) status.textContent = "일시정지 · 읽던 곳에서 다시 시작할 수 있습니다";
  }
  function start() {
    if (!active || document.hidden || running) return;
    if (viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 1) {
      status.textContent = "이 장의 끝입니다. 다음 장은 직접 넘겨 주세요";
      return;
    }
    running = true;
    lastTime = null;
    scrollPosition = viewport.scrollTop;
    scrollButton.textContent = "일시정지";
    scrollButton.setAttribute("aria-pressed", "true");
    status.textContent = "자동 스크롤 중 · 직접 움직이면 멈춥니다";
    frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!running) return;
    if (lastTime !== null) {
      scrollPosition += speed * Math.min(now - lastTime, 80) / 1000;
      viewport.scrollTop = scrollPosition;
    }
    lastTime = now;
    if (viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 1) {
      pause("이 장의 끝입니다. 다음 장은 직접 넘겨 주세요");
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  ["wheel", "touchstart", "pointerdown"].forEach(function (type) {
    viewport.addEventListener(type, function () { if (running) pause(); }, { passive: true });
  });
  viewport.addEventListener("scroll", function () {
    if (running && Math.abs(viewport.scrollTop - scrollPosition) > 3) pause();
  }, { passive: true });
  viewport.addEventListener("keydown", function (event) {
    if (["ArrowUp", "ArrowDown", " "].includes(event.key) && running) pause();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      pause("다른 화면으로 이동해 자동 스크롤을 멈췄습니다");
      releaseWakeLock();
    } else if (active) requestWakeLock();
  });
  window.addEventListener("pagehide", releaseWakeLock);
  window.addEventListener("lecture-remote-status", function (event) {
    const connected = Boolean(event.detail && event.detail.connected);
    tvStatus.textContent = connected ? "TV 원격 연결됨" : "TV 원격 연결 안 됨";
    tvStatus.classList.toggle("is-connected", connected);
  });
  document.addEventListener("keydown", function (event) {
    if (!active || event.key !== "Escape" || event.defaultPrevented) return;
    if (document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])')) return;
    event.preventDefault();
    setActive(false);
  });
  window.addEventListener("resize", function () { if (active) { pause(); fitPreview(); } });
  if (window.ResizeObserver) new ResizeObserver(fitPreview).observe(previewBox);
  LectureGuide.onPaint(render);
  applyPreferences();
  window.LecturePrompter = {
    get active() { return active; },
    open: function () { setActive(true); },
    close: function () { setActive(false); },
    pause: pause
  };
  if (new URLSearchParams(location.search).get("prompter") === "1") setActive(true);
})();
