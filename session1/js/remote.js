/* 기기 간 발표 연결. HTTPS로 현재 장 번호만 나누므로 두 기기의 망이 달라도 됩니다.
   강사 쓰기 권한은 임의 토큰으로 구분하며 교안 내용은 전송하지 않습니다. */
(function () {
  "use strict";
  if (!window.DECK || !DECK.slides || !DECK.slides.length || !window.LectureSync) return;
  var guide = document.body.classList.contains("guide");
  var params = new URLSearchParams(location.search);
  var tv = !guide && params.get("tv") === "1";
  if (!guide && !tv) return;

  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const RELAY_URL = "https://living-lecture-relay.sonny2841.chatgpt.site";
  var fingerprint = String(DECK.title || "") + "\n" + DECK.slides.length;
  var hash = 2166136261;
  for (var i = 0; i < fingerprint.length; i++) hash = Math.imul(hash ^ fingerprint.charCodeAt(i), 16777619) >>> 0;
  var deck = "deck-" + hash.toString(36) + "-" + DECK.slides.length;
  var role = guide ? "presenter" : "viewer";
  var room = "", hostToken = "";
  var active = false, connected = false, hasConnected = false, created = false;
  var generation = 0, sequence = 0, receivedSequence = -1, acknowledgedSequence = 0;
  var desiredIndex = 0, initialIndex = 0;
  var loopTimer = 0, controlTimer = 0, attempts = 0, inFlight = false;
  var requestController = null, previousFocus = null, suspended = false;
  var statusText = guide ? "연결 방식을 선택해 주세요." : "강사 화면의 연결 코드를 입력해 주세요.";
  var fallback = "두 기기의 인터넷과 강사 화면을 확인해 주세요. 연결이 계속 제한되면 노트북에 TV를 연결하고 확장 화면을 사용할 수 있습니다.";

  function node(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
  }
  function button(id, text, fn, primary) {
    var b = node("button", "remote-button" + (primary ? " remote-primary" : ""), text);
    b.type = "button";
    b.id = id;
    b.addEventListener("click", fn);
    return b;
  }
  function normalizeCode(value) { return String(value || "").trim().toUpperCase().replace(/[\s-]/g, ""); }
  function validCode(value) { return /^[A-HJ-NP-Z2-9]{10}$/.test(value); }
  function randomCode() {
    var bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (b) { return ALPHABET[b & 31]; }).join("");
  }
  function randomToken() {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function validIndex(n) { return Number.isInteger(n) && n >= 0 && n < DECK.slides.length; }
  function currentIndex() {
    var n = LectureSync.getIndex ? LectureSync.getIndex() : window.__lectureIndex;
    return validIndex(n) ? n : 0;
  }
  function receiverUrl() {
    var url = new URL("index.html", location.href);
    url.searchParams.set("tv", "1");
    if (room) url.searchParams.set("room", room);
    url.hash = "";
    return url.href;
  }
  function clearLoop() { clearTimeout(loopTimer); loopTimer = 0; }
  function getStatus() { return { connected: connected, text: statusText, role: role, room: room, transport: "https" }; }

  var dialog = node("dialog", "remote-dialog");
  dialog.id = "remote-dialog";
  dialog.setAttribute("aria-labelledby", "remote-title");
  var heading = node("div", "remote-heading");
  var title = node("h2", "", guide ? "TV에 슬라이드 연결" : "TV 슬라이드 화면");
  title.id = "remote-title";
  var closeButton = button("remote-close", "닫기", closePanel);
  heading.append(title, closeButton);
  dialog.appendChild(heading);
  var description = node("p", "remote-description", guide ? "내 화면에서는 교안을 크게 읽고, TV에는 현재 슬라이드만 보여 줍니다." : "이 화면에는 강사가 넘기는 슬라이드만 나옵니다. TV에 연결한 컴퓨터에서 열어 주세요.");
  dialog.appendChild(description);
  var localSection, codeSection, codeNode, urlInput, roomInput, startButton, joinButton;
  if (guide) {
    localSection = node("section", "remote-section");
    localSection.append(node("h3", "", "노트북 한 대 + TV"), node("p", "", "노트북과 TV를 HDMI 등으로 연결한 뒤 디스플레이를 ‘확장’으로 설정하세요. 슬라이드 창을 TV로 옮기고 전체 화면을 누르세요. 노트북에는 교안을 둡니다."));
    localSection.appendChild(button("remote-local", "슬라이드 창 열기", function () {
      var win = LectureSync.open("slides", currentIndex());
      if (win) closePanel();
      else setStatus(connected, "팝업이 차단되었습니다. 브라우저에서 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.", true);
    }));
    dialog.appendChild(localSection);
    var remoteSection = node("section", "remote-section");
    remoteSection.append(node("h3", "", "태블릿 + TV에 연결한 컴퓨터"), node("p", "", "태블릿에서 연결 코드를 만들고, TV에 연결한 노트북이나 데스크톱에서 아래 TV 주소를 여세요. 이 강사 화면을 열어 둔 채 장을 넘기면 TV도 따라갑니다."));
    startButton = button("remote-start", "연결 코드 만들기", startPresenter, true);
    remoteSection.appendChild(startButton);
    codeSection = node("div", "remote-code-section");
    codeSection.hidden = true;
    codeSection.appendChild(node("p", "remote-label", "연결 코드"));
    codeNode = node("p", "remote-code");
    codeNode.id = "remote-room-code";
    codeSection.appendChild(codeNode);
    var urlLabel = node("label", "remote-label", "TV에서 열 주소");
    urlLabel.htmlFor = "remote-url";
    urlInput = node("input", "remote-url");
    urlInput.id = "remote-url";
    urlInput.type = "url";
    urlInput.readOnly = true;
    urlInput.addEventListener("click", function () { urlInput.select(); });
    codeSection.append(urlLabel, urlInput, button("remote-copy", "TV 주소 복사", copyUrl));
    codeSection.appendChild(node("p", "remote-fine", "같은 강의의 ‘TV 화면’에서 이 코드를 입력해도 됩니다. 코드가 있는 기기는 슬라이드를 볼 수 있습니다. 연결 종료 후에는 이 코드가 더 이상 작동하지 않습니다."));
    remoteSection.appendChild(codeSection);
    remoteSection.appendChild(node("p", "remote-fine", "기기 간 연결에는 인터넷이 필요합니다. 학교 네트워크에 따라 연결이 제한될 수 있습니다. 노트북 한 대의 확장 화면은 인터넷 없이도 사용할 수 있습니다."));
    dialog.appendChild(remoteSection);
  } else {
    var form = node("form", "remote-join-form");
    var label = node("label", "remote-label", "강사 화면의 연결 코드");
    label.htmlFor = "remote-room-input";
    roomInput = node("input", "remote-room-input");
    roomInput.id = "remote-room-input";
    roomInput.type = "text";
    roomInput.autocomplete = "off";
    roomInput.spellcheck = false;
    roomInput.maxLength = 24;
    roomInput.setAttribute("autocapitalize", "characters");
    roomInput.placeholder = "ABCDE-F2345";
    roomInput.setAttribute("aria-describedby", "remote-status");
    joinButton = button("remote-join", "강사 화면에 연결", function () { join(roomInput.value); }, true);
    form.append(label, roomInput, joinButton);
    form.addEventListener("submit", function (e) { e.preventDefault(); join(roomInput.value); });
    dialog.appendChild(form);
    dialog.appendChild(node("p", "remote-fine", "강사와 같은 회차의 강의를 열어 주세요. TV에는 교안과 대본이 나오지 않습니다."));
  }
  var status = node("p", "remote-status", statusText);
  status.id = "remote-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  var actionRow = node("div", "remote-actions");
  var retryButton = button("remote-retry", "다시 연결", retryNow);
  retryButton.hidden = true;
  var endButton = button("remote-end", "연결 종료", end);
  endButton.hidden = true;
  actionRow.append(retryButton, endButton);
  dialog.append(status, actionRow);
  document.body.appendChild(dialog);

  var badge = button("remote-alert", "", openPanel);
  badge.className = "remote-alert";
  badge.hidden = true;
  document.body.appendChild(badge);
  var tvControls;
  if (guide) {
    var actions = document.querySelector(".top-actions");
    if (actions) {
      var open = button("remote-open", "TV 연결", openPanel);
      open.className = "quiet";
      actions.appendChild(open);
    }
  } else {
    document.body.dataset.remoteControlled = "true";
    document.body.classList.add("remote-tv");
    tvControls = node("div", "remote-tv-controls");
    tvControls.append(button("remote-fullscreen", "전체 화면", fullscreen), button("remote-settings", "연결 설정", openPanel));
    document.body.appendChild(tvControls);
    document.addEventListener("pointermove", revealControls);
    document.addEventListener("touchstart", revealControls, { passive: true });
    document.addEventListener("keydown", function (e) { if (e.key === "Tab" && !dialog.open) revealControls(); }, true);
  }

  function openPanel() {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    if (dialog.showModal) dialog.showModal();
    else { dialog.setAttribute("open", ""); dialog.setAttribute("aria-modal", "true"); }
    if (roomInput && !connected) roomInput.focus();
    else closeButton.focus();
  }
  function closePanel() {
    if (dialog.close) dialog.close();
    else dialog.removeAttribute("open");
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    revealControls();
  }
  dialog.addEventListener("cancel", function (e) { e.preventDefault(); closePanel(); });
  dialog.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); closePanel(); }
    if (e.key === "Tab" && !dialog.showModal) {
      var focusable = Array.from(dialog.querySelectorAll("button, input")).filter(function (n) { return !n.disabled && n.getClientRects().length; });
      if (!focusable.length) return;
      if (e.shiftKey && document.activeElement === focusable[0]) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
      if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) { e.preventDefault(); focusable[0].focus(); }
    }
  });
  dialog.addEventListener("click", function (e) { e.stopPropagation(); });

  function setStatus(ok, text, error) {
    var changed = connected !== ok || statusText !== text;
    connected = ok;
    statusText = text;
    status.textContent = text;
    status.classList.toggle("is-error", !!error);
    status.classList.toggle("is-connected", ok);
    retryButton.hidden = !active || (!error && ok);
    endButton.hidden = !active;
    if (guide) {
      var openButton = document.getElementById("remote-open");
      if (openButton) {
        openButton.textContent = ok ? "TV 연결됨" : active ? (error ? "TV 연결 끊김" : "TV 연결 대기") : "TV 연결";
        openButton.title = text;
      }
    }
    if (tv) {
      badge.hidden = !error;
      badge.textContent = error ? "TV 연결 끊김 · 다시 연결" : "";
      document.body.classList.toggle("remote-is-connected", ok);
    }
    if (changed) window.dispatchEvent(new CustomEvent("lecture-remote-status", { detail: getStatus() }));
  }
  function revealControls() {
    if (!tvControls) return;
    clearTimeout(controlTimer);
    tvControls.classList.add("is-visible");
    controlTimer = setTimeout(function () { tvControls.classList.remove("is-visible"); }, 3500);
  }
  function fullscreen() {
    try {
      var result = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      if (!result) { openPanel(); setStatus(connected, "이 브라우저는 전체 화면 버튼을 지원하지 않습니다. 브라우저의 전체 화면 기능을 사용해 주세요.", false); return; }
      Promise.resolve(result).catch(function () { openPanel(); setStatus(connected, "전체 화면을 열지 못했습니다. 브라우저의 전체 화면 기능을 사용해 주세요.", false); });
    } catch (err) { openPanel(); setStatus(connected, "전체 화면을 열지 못했습니다. 브라우저의 전체 화면 기능을 사용해 주세요.", false); }
  }
  function copyUrl() {
    if (!urlInput) return;
    urlInput.focus();
    urlInput.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(urlInput.value).then(function () {
        document.getElementById("remote-copy").textContent = "주소 복사됨";
        setTimeout(function () { document.getElementById("remote-copy").textContent = "TV 주소 복사"; }, 2000);
      }).catch(function () { setStatus(connected, "주소가 선택되었습니다. 길게 누르거나 Ctrl+C로 복사해 주세요.", false); });
    } else setStatus(connected, "주소가 선택되었습니다. 길게 누르거나 Ctrl+C로 복사해 주세요.", false);
  }

  function relayBase() {
    var url;
    try { url = new URL(RELAY_URL); } catch (err) { throw problem("configuration"); }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname))) throw problem("configuration");
    return url.href.replace(/\/$/, "");
  }
  function problem(kind, httpStatus) {
    var err = new Error(kind);
    err.kind = kind;
    err.httpStatus = httpStatus || 0;
    return err;
  }
  function timestamp(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") return Date.parse(value);
    return NaN;
  }
  function age(value) { return Math.max(0, Date.now() - timestamp(value)); }
  function validState(state) {
    return state && typeof state === "object" && !Array.isArray(state) &&
      state.room === room && state.deck === deck && state.count === DECK.slides.length &&
      validIndex(state.index) && Number.isSafeInteger(state.seq) && state.seq >= 1 &&
      Number.isFinite(timestamp(state.updatedAt)) && Number.isFinite(timestamp(state.expiresAt)) &&
      (state.viewerSeenAt == null || Number.isFinite(timestamp(state.viewerSeenAt)));
  }
  async function readSmallJson(response) {
    var maxBytes = 16384;
    if (Number(response.headers.get("content-length")) > maxBytes) {
      if (response.body) await response.body.cancel();
      throw problem("response");
    }
    if (!response.body || !response.body.getReader) throw problem("response");
    var reader = response.body.getReader(), chunks = [], size = 0;
    try {
      while (true) {
        var part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw problem("response"); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    var bytes = new Uint8Array(size), offset = 0;
    chunks.forEach(function (chunk) { bytes.set(chunk, offset); offset += chunk.byteLength; });
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch (err) { throw problem("response"); }
  }
  async function request(method, path, payload, token, detached) {
    var base = relayBase();
    var body = payload == null ? undefined : JSON.stringify(payload);
    if (body && body.length > 1024) throw problem("request");
    var controller = new AbortController();
    if (!detached) requestController = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 8000);
    var headers = { Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = "Bearer " + token;
    try {
      var response = await fetch(base + path, {
        method: method, headers: headers, body: body, signal: controller.signal,
        cache: "no-store", credentials: "omit", mode: "cors", redirect: "error", referrerPolicy: "no-referrer"
      });
      if (method === "DELETE" && (response.ok || response.status === 404)) {
        if (response.body) await response.body.cancel();
        return null;
      }
      var data;
      try { data = await readSmallJson(response); }
      catch (err) {
        if (!response.ok) throw problem("http", response.status);
        throw err;
      }
      if (!response.ok) {
        var kind = data && typeof data.error === "string" ? data.error : "http";
        throw problem(kind, response.status);
      }
      return data;
    } finally {
      clearTimeout(timeout);
      if (requestController === controller) requestController = null;
    }
  }
  function closeTransport() {
    generation++;
    clearLoop();
    if (requestController) { requestController.abort(); requestController = null; }
    inFlight = false;
  }
  function resetPresenterUi() {
    if (guide) { startButton.hidden = false; codeSection.hidden = true; }
  }
  function end() {
    var oldRoom = room, oldToken = hostToken, shouldDelete = guide && active && oldRoom && oldToken;
    active = false;
    suspended = false;
    closeTransport();
    hasConnected = false;
    created = false;
    room = "";
    hostToken = "";
    resetPresenterUi();
    setStatus(false, shouldDelete ? "TV 연결을 종료하고 있습니다…" : "연결을 종료했습니다. 새로 연결하려면 코드를 만들거나 입력해 주세요.", false);
    if (shouldDelete) {
      var endGeneration = generation;
      request("DELETE", "/api/rooms/" + encodeURIComponent(oldRoom), null, oldToken, true).then(function () {
        if (!active && generation === endGeneration) setStatus(false, "연결을 종료했습니다. 이 코드는 더 이상 사용할 수 없습니다.", false);
      }).catch(function () {
        if (!active && generation === endGeneration) setStatus(false, "이 화면의 연결을 종료했습니다. 인터넷 문제로 TV에 종료를 알리지 못했으며, TV에는 마지막 장이 남습니다.", true);
      });
    }
    if (tv) {
      try { var url = new URL(location.href); url.searchParams.delete("room"); history.replaceState(null, "", url.href); } catch (err) { /* file 주소 */ }
      openPanel();
    }
  }
  function startPresenter() {
    if (active) return;
    try { relayBase(); room = randomCode(); hostToken = randomToken(); }
    catch (err) {
      setStatus(false, err.kind === "configuration" ? "TV 연결 설정을 읽지 못했습니다. 페이지를 새로 고치거나 슬라이드 창을 TV로 옮겨 주세요." : "이 브라우저에서 연결 코드를 만들 수 없습니다. 최신 브라우저를 사용하거나 슬라이드 창을 TV로 옮겨 주세요.", true);
      return;
    }
    closeTransport();
    active = true;
    suspended = false;
    created = false;
    hasConnected = false;
    sequence = 1;
    acknowledgedSequence = 0;
    desiredIndex = initialIndex = currentIndex();
    attempts = 0;
    codeNode.textContent = room.slice(0, 5) + "-" + room.slice(5);
    urlInput.value = receiverUrl();
    codeSection.hidden = true;
    startButton.hidden = true;
    setStatus(false, "TV 연결 코드를 준비하고 있습니다…", false);
    tick();
  }
  function join(value) {
    var code = normalizeCode(value);
    if (!validCode(code)) {
      setStatus(connected, "연결 코드는 영문과 숫자 10자리입니다. 강사 화면의 코드를 다시 확인해 주세요.", false);
      roomInput.setAttribute("aria-invalid", "true");
      roomInput.focus();
      return;
    }
    roomInput.removeAttribute("aria-invalid");
    closeTransport();
    active = true;
    suspended = false;
    room = code;
    attempts = 0;
    hasConnected = false;
    receivedSequence = -1;
    roomInput.value = code.slice(0, 5) + "-" + code.slice(5);
    try { var url = new URL(location.href); url.searchParams.set("room", code); history.replaceState(null, "", url.href); } catch (err) { /* file 주소 */ }
    setStatus(false, "강사 화면에 연결하고 있습니다…", false);
    tick();
  }
  function schedule(delay) {
    clearLoop();
    if (!active || suspended) return;
    loopTimer = setTimeout(function () { loopTimer = 0; tick(); }, delay);
  }
  function terminal(text) {
    active = false;
    closeTransport();
    created = false;
    hostToken = "";
    resetPresenterUi();
    setStatus(false, text, true);
    openPanel();
  }
  function handleFailure(err) {
    if (!active) return;
    if (err.kind === "wrong_deck" || (!guide && err.httpStatus === 409)) {
      terminal("강사와 다른 강의가 열려 있습니다. 강사 화면의 TV 주소로 다시 열어 주세요.");
      return;
    }
    if (err.httpStatus === 404 || err.httpStatus === 410) {
      terminal(guide ? "연결 코드가 종료되었거나 만료되었습니다. 새 코드를 만들어 주세요." : "연결 코드가 종료되었거나 만료되었습니다. 코드를 확인하거나 강사 화면에서 새로 만들어 주세요.");
      return;
    }
    if (err.httpStatus === 401 || err.httpStatus === 403) {
      terminal(guide ? "이 코드의 강사 권한을 확인할 수 없습니다. 새 코드를 만들어 주세요." : "TV 연결 서버에 접근할 수 없습니다. 페이지를 새로 고치거나 강사에게 알려 주세요.");
      return;
    }
    if (err.httpStatus === 409 && guide) {
      terminal("이 연결 코드는 이미 사용 중입니다. 새 코드를 만들어 주세요.");
      return;
    }
    if (err.kind === "configuration") {
      terminal("TV 연결 설정을 읽지 못했습니다. 페이지를 새로 고치거나 슬라이드 창을 TV로 옮겨 주세요.");
      return;
    }
    setStatus(false, (err.kind === "response" ? "연결 서버의 응답을 확인하지 못했습니다. " : "연결 서버에 닿지 못했습니다. 인터넷이 돌아오면 자동으로 다시 연결합니다. ") + fallback, true);
    var delay = Math.min(1500 * Math.pow(2, Math.min(attempts, 4)), 15000);
    attempts++;
    schedule(delay);
  }
  function retryNow() {
    if (!active) return;
    attempts = 0;
    if (guide) publish(currentIndex());
    clearLoop();
    tick();
  }
  function updateHostStatus(state) {
    if (state.viewerSeenAt != null && age(state.viewerSeenAt) < 15000) {
      hasConnected = true;
      setStatus(true, "TV 연결됨 · 교안에서 장을 넘겨 보세요.", false);
    } else if (hasConnected) setStatus(false, "TV 화면의 응답이 없습니다. TV의 인터넷과 열린 창을 확인해 주세요.", true);
    else setStatus(false, "코드 준비 완료 · TV에서 주소를 열거나 코드를 입력해 주세요.", false);
  }
  function acceptState(state) {
    if (!validState(state)) throw problem("response");
    if (timestamp(state.expiresAt) <= Date.now()) throw problem("expired", 410);
    if (guide) {
      created = true;
      codeSection.hidden = false;
      acknowledgedSequence = Math.max(acknowledgedSequence, state.seq);
      sequence = Math.max(sequence, state.seq);
      // 응답을 기다리는 사이 넘긴 장은 다음 요청으로 보냅니다.
      if (desiredIndex !== state.index && sequence <= acknowledgedSequence) sequence = acknowledgedSequence + 1;
      updateHostStatus(state);
    } else {
      if (state.seq < receivedSequence) throw problem("response");
      if (age(state.updatedAt) > 20000) {
        setStatus(false, "강사 화면의 응답이 멈췄습니다. 강사 화면을 다시 열고 인터넷을 확인해 주세요. 마지막 슬라이드를 유지하고 있습니다.", true);
        return;
      }
      if (state.seq > receivedSequence && (currentIndex() !== state.index || !hasConnected)) LectureSync.receive(state.index);
      receivedSequence = state.seq;
      var first = !connected;
      hasConnected = true;
      setStatus(true, "강사 화면에 연결됨 · 슬라이드가 자동으로 넘어갑니다.", false);
      if (first) { closePanel(); revealControls(); }
    }
  }
  async function tick() {
    if (!active || suspended || inFlight) return;
    clearLoop();
    inFlight = true;
    var token = generation, state;
    try {
      if (guide && !created) {
        // 재시도 때도 같은 코드와 토큰·최초 값을 보내 중복 생성하지 않습니다.
        state = await request("POST", "/api/rooms", { room: room, token: hostToken, deck: deck, count: DECK.slides.length, index: initialIndex, seq: 1 });
      } else if (guide) {
        if (sequence <= acknowledgedSequence) sequence = acknowledgedSequence + 1;
        state = await request("PUT", "/api/rooms/" + encodeURIComponent(room), { index: desiredIndex, seq: sequence }, hostToken);
      } else {
        state = await request("GET", "/api/rooms/" + encodeURIComponent(room) + "?deck=" + encodeURIComponent(deck));
      }
      if (token !== generation || !active || suspended) return;
      acceptState(state);
      attempts = 0;
      schedule(guide ? (sequence > acknowledgedSequence ? 0 : 5000) : 700);
    } catch (err) {
      if (token === generation && active && !suspended) handleFailure(err);
    } finally {
      if (token === generation) inFlight = false;
    }
  }
  function publish(index) {
    if (!active || !guide) return;
    if (!validIndex(index)) index = currentIndex();
    if (index !== desiredIndex) {
      desiredIndex = index;
      sequence++;
      // 진행 중인 요청은 그대로 마친 뒤 최신 장 하나만 보냅니다.
      if (!inFlight && !attempts) schedule(0);
    }
  }

  if (guide) {
    LectureSync.onEmit(function (index) { if (validIndex(index)) publish(index); });
    LectureSync.on(function (index) { if (validIndex(index)) publish(index); });
  }
  window.addEventListener("online", function () { if (active) retryNow(); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden || !active) return;
    if (guide) publish(currentIndex());
    retryNow();
  });
  window.addEventListener("pagehide", function () { suspended = active; closeTransport(); });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && suspended && active) { suspended = false; attempts = 0; if (guide) publish(currentIndex()); tick(); }
  });
  window.LectureRemote = { openPanel: openPanel, end: end, getStatus: getStatus };
  if (tv) {
    openPanel();
    var initialRoom = params.get("room");
    if (initialRoom) { roomInput.value = initialRoom; join(initialRoom); }
  }
})();
