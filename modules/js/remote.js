/* 기기 간 발표 연결. 공개 PeerJS 신호 서버는 연결할 때만 사용합니다.
   전송 값은 강의 식별자와 장 번호뿐입니다. 교안 내용은 전송하지 않습니다. */
(function () {
  "use strict";
  if (!window.DECK || !DECK.slides || !DECK.slides.length || !window.LectureSync) return;
  var guide = document.body.classList.contains("guide");
  var params = new URLSearchParams(location.search);
  var tv = !guide && params.get("tv") === "1";
  if (!guide && !tv) return;

  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var PREFIX = "living-lecture-v1-";
  var fingerprint = String(DECK.title || "") + "\n" + DECK.slides.length;
  var hash = 2166136261;
  for (var i = 0; i < fingerprint.length; i++) hash = Math.imul(hash ^ fingerprint.charCodeAt(i), 16777619) >>> 0;
  var deck = "deck-" + hash.toString(36) + "-" + DECK.slides.length;
  var role = guide ? "presenter" : "viewer";
  var room = "", peer = null, viewer = null, guests = new Set();
  var active = false, connected = false, hasConnected = false, signalReady = false;
  var generation = 0, sequence = 0, receivedSequence = -1, lastReceived = 0;
  var retryTimer = 0, deadline = 0, heartbeat = 0, controlTimer = 0, attempts = 0;
  var loading = null, previousFocus = null, suspended = false;
  var statusText = guide ? "연결 방식을 선택해 주세요." : "강사 화면의 연결 코드를 입력해 주세요.";
  var fallback = "연결되지 않으면 두 기기의 인터넷과 강사 화면을 확인해 주세요. 학교 네트워크에서 제한될 때는 노트북에 TV를 연결하고 확장 화면을 사용하세요.";

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
  function clearRetry() { clearTimeout(retryTimer); retryTimer = 0; }
  function clearDeadline() { clearTimeout(deadline); deadline = 0; }
  function getStatus() { return { connected: connected, text: statusText, role: role, room: room }; }

  var dialog = node("dialog", "remote-dialog");
  dialog.id = "remote-dialog";
  dialog.setAttribute("aria-labelledby", "remote-title");
  var heading = node("div", "remote-heading");
  var title = node("h2", "", guide ? "TV에 슬라이드 연결" : "TV 슬라이드 화면");
  title.id = "remote-title";
  var closeButton = button("remote-close", "닫기", closePanel);
  heading.append(title, closeButton);
  dialog.appendChild(heading);
  var description = node("p", "remote-description", guide ? "내 화면에서는 교안을 크게 읽고, TV에는 현재 슬라이드만 보여 줍니다." : "이 화면에는 강사가 넘기는 슬라이드만 나옵니다. TV에 연결된 노트북에서 열어 주세요.");
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
    remoteSection.append(node("h3", "", "태블릿 + TV에 연결한 노트북"), node("p", "", "태블릿에서 연결 코드를 만들고, TV에 연결한 노트북에서 아래 TV 주소를 여세요. 이 강사 화면을 열어 둔 채 장을 넘기면 TV도 따라갑니다."));
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
    dialog.appendChild(node("p", "remote-fine", "강사와 같은 강의(1부 또는 2부)를 열어야 합니다. TV에는 교안과 대본이 나오지 않습니다."));
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

  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      var timeout = setTimeout(function () { script.remove(); loading = null; reject(new Error("library-timeout")); }, 12000);
      script.src = "js/vendor/peerjs.min.js";
      script.onload = function () { clearTimeout(timeout); if (window.Peer) resolve(); else { loading = null; reject(new Error("library-missing")); } };
      script.onerror = function () { clearTimeout(timeout); script.remove(); loading = null; reject(new Error("library-load")); };
      document.head.appendChild(script);
    });
    return loading;
  }
  function closeTransport() {
    generation++;
    clearRetry();
    clearDeadline();
    clearInterval(heartbeat);
    heartbeat = 0;
    var old = peer;
    peer = null;
    viewer = null;
    guests.clear();
    signalReady = false;
    if (old) { try { old.destroy(); } catch (err) { /* 이미 닫힌 연결 */ } }
  }
  function end() {
    active = false;
    suspended = false;
    closeTransport();
    hasConnected = false;
    room = "";
    if (guide) { startButton.hidden = false; codeSection.hidden = true; }
    setStatus(false, "연결을 종료했습니다. 새로 연결하려면 코드를 만들거나 입력해 주세요.", false);
    if (tv) {
      try { var url = new URL(location.href); url.searchParams.delete("room"); history.replaceState(null, "", url.href); } catch (err) { /* file 주소 */ }
      openPanel();
    }
  }
  function startPresenter() {
    if (active) return;
    try { room = randomCode(); } catch (err) { setStatus(false, "이 브라우저에서 연결 코드를 만들 수 없습니다. 최신 브라우저를 사용하거나 슬라이드 창을 TV로 옮겨 주세요.", true); return; }
    active = true;
    hasConnected = false;
    sequence = 0;
    attempts = 0;
    codeNode.textContent = room.slice(0, 5) + "-" + room.slice(5);
    urlInput.value = receiverUrl();
    codeSection.hidden = false;
    startButton.hidden = true;
    setStatus(false, "TV 연결 코드를 준비하고 있습니다…", false);
    buildPeer();
  }
  function join(value) {
    var code = normalizeCode(value);
    if (!validCode(code)) {
      setStatus(false, "연결 코드는 영문과 숫자 10자리입니다. 강사 화면의 코드를 다시 확인해 주세요.", false);
      roomInput.setAttribute("aria-invalid", "true");
      roomInput.focus();
      return;
    }
    roomInput.removeAttribute("aria-invalid");
    active = false;
    closeTransport();
    active = true;
    room = code;
    attempts = 0;
    hasConnected = false;
    receivedSequence = -1;
    roomInput.value = code.slice(0, 5) + "-" + code.slice(5);
    try { var url = new URL(location.href); url.searchParams.set("room", code); history.replaceState(null, "", url.href); } catch (err) { /* file 주소 */ }
    setStatus(false, "강사 화면에 연결하고 있습니다…", false);
    buildPeer();
  }
  function fail(text) {
    if (!active) return;
    clearDeadline();
    setStatus(false, text + " " + fallback, true);
    scheduleRetry();
  }
  function scheduleRetry() {
    if (!active || retryTimer || attempts >= 6) return;
    var delay = Math.min(1500 * Math.pow(2, attempts), 15000);
    attempts++;
    retryTimer = setTimeout(function () { retryTimer = 0; reconnect(); }, delay);
  }
  function retryNow() {
    if (!active) return;
    attempts = 0;
    clearRetry();
    reconnect();
  }
  function watchConnection() {
    clearDeadline();
    deadline = setTimeout(function () {
      if (!active) return;
      if (guide && Array.from(guests).some(function (conn) { return conn.open; })) { updateHostStatus(); scheduleRetry(); return; }
      if (viewer && !connected) { var old = viewer; viewer = null; try { old.close(); } catch (err) {} }
      fail("연결 응답이 없습니다.");
    }, 16000);
  }
  function reconnect() {
    if (!active) return;
    if (!peer || peer.destroyed) { buildPeer(); return; }
    if (peer.disconnected) {
      try { peer.reconnect(); watchConnection(); } catch (err) { buildPeer(); }
      return;
    }
    if (!signalReady) { buildPeer(); return; }
    if (guide) { publish(); updateHostStatus(); }
    else if (!viewer || !viewer.open || !connected) connectViewer();
  }
  function buildPeer() {
    closeTransport();
    if (!active) return;
    var token = generation;
    watchConnection();
    loadPeer().then(function () {
      if (!active || token !== generation) return;
      try { peer = guide ? new Peer(PREFIX + room, { debug: 0 }) : new Peer({ debug: 0 }); }
      catch (err) { fail("이 브라우저에서 기기 간 연결을 시작할 수 없습니다."); return; }
      var p = peer;
      p.on("open", function () {
        if (p !== peer || !active) return;
        signalReady = true;
        clearDeadline();
        clearRetry();
        if (guide) { attempts = 0; updateHostStatus(); publish(); }
        else connectViewer();
      });
      p.on("connection", function (conn) {
        if (p !== peer || !active || !guide) { conn.close(); return; }
        acceptViewer(conn);
      });
      p.on("disconnected", function () {
        if (p !== peer || !active) return;
        signalReady = false;
        if (connected) setStatus(true, "현재 TV 연결은 유지 중입니다. 새 기기 연결을 다시 준비하고 있습니다.", false);
        else setStatus(false, "연결 서버에 다시 접속하고 있습니다. " + fallback, true);
        scheduleRetry();
      });
      p.on("close", function () { if (p === peer && active) fail("연결이 종료되었습니다."); });
      p.on("error", function (err) {
        if (p !== peer || !active) return;
        if (err && err.type === "unavailable-id" && guide) {
          active = false;
          closeTransport();
          codeSection.hidden = true;
          startButton.hidden = false;
          setStatus(false, "이 연결 코드를 사용할 수 없습니다. 새 코드를 만들어 주세요.", true);
          return;
        }
        if (connected && err && ["network", "socket-error", "socket-closed"].indexOf(err.type) !== -1) { scheduleRetry(); return; }
        fail(err && err.type === "peer-unavailable" ? "강사 화면을 찾지 못했습니다. 코드와 같은 강의인지 확인해 주세요." : "기기 간 연결을 완료하지 못했습니다.");
      });
      heartbeat = setInterval(function () {
        if (!active) return;
        if (guide) publish();
        else if (connected && Date.now() - lastReceived > 22000 && !document.hidden) {
          var old = viewer;
          viewer = null;
          if (old) { try { old.close(); } catch (err) {} }
          fail("강사 화면의 응답이 잠시 멈췄습니다.");
        }
      }, 5000);
    }).catch(function () { if (token === generation && active) fail("연결 기능을 불러오지 못했습니다. 페이지를 새로 고쳐 주세요."); });
  }
  function updateHostStatus() {
    var count = Array.from(guests).filter(function (conn) { return conn.open; }).length;
    if (count) { hasConnected = true; setStatus(true, "TV " + count + "대 연결됨 · 교안에서 장을 넘겨 보세요.", false); }
    else if (hasConnected) setStatus(false, "TV 연결이 끊겼습니다. TV 화면에서 다시 연결할 수 있습니다.", true);
    else setStatus(false, "코드 준비 완료 · TV에서 주소를 열거나 코드를 입력해 주세요.", false);
  }
  function acceptViewer(conn) {
    var metadata = conn.metadata;
    if (metadata && metadata.v === 1 && metadata.role === "viewer" && metadata.deck !== deck) {
      var rejectTimeout = setTimeout(function () { try { conn.close(); } catch (err) {} }, 16000);
      conn.on("error", function () { clearTimeout(rejectTimeout); });
      conn.on("close", function () { clearTimeout(rejectTimeout); });
      conn.on("open", function () {
        clearTimeout(rejectTimeout);
        try { conn.send({ v: 1, type: "reject", reason: "deck" }); } catch (err) {}
        setTimeout(function () { try { conn.close(); } catch (err) {} }, 500);
      });
      return;
    }
    if (!metadata || metadata.v !== 1 || metadata.role !== "viewer" || guests.size >= 8) {
      conn.on("open", function () { conn.close(); });
      conn.close();
      return;
    }
    guests.add(conn);
    var pendingTimeout = setTimeout(function () { if (!conn.open) { gone(); try { conn.close(); } catch (err) {} } }, 16000);
    conn.on("open", function () {
      clearTimeout(pendingTimeout);
      if (!active || !guests.has(conn)) { conn.close(); return; }
      publish();
      updateHostStatus();
    });
    function gone() {
      clearTimeout(pendingTimeout);
      if (!guests.delete(conn) || !active) return;
      updateHostStatus();
    }
    conn.on("close", gone);
    conn.on("error", function () { gone(); try { conn.close(); } catch (err) {} });
    // 수신 기기는 장 이동 명령을 보낼 수 없습니다. 모든 수신 데이터는 무시합니다.
    conn.on("data", function () {});
  }
  function publish(index) {
    if (!active || !guide) return;
    if (!validIndex(index)) index = currentIndex();
    var packet = { v: 1, type: "state", deck: deck, index: index, seq: ++sequence };
    guests.forEach(function (conn) {
      if (!conn.open) return;
      try { conn.send(packet); } catch (err) { guests.delete(conn); try { conn.close(); } catch (ignored) {} updateHostStatus(); }
    });
  }
  function connectViewer() {
    if (!active || !peer || !signalReady) return;
    if (viewer) { var old = viewer; viewer = null; try { old.close(); } catch (err) {} }
    receivedSequence = -1;
    var conn;
    try { conn = peer.connect(PREFIX + room, { reliable: true, serialization: "json", metadata: { v: 1, role: "viewer", deck: deck } }); }
    catch (err) { fail("강사 화면에 연결하지 못했습니다."); return; }
    viewer = conn;
    watchConnection();
    conn.on("data", function (packet) {
      if (!active || viewer !== conn || !packet || packet.v !== 1) return;
      if ((packet.type === "reject" && packet.reason === "deck") || (packet.type === "state" && packet.deck !== deck)) {
        active = false;
        closeTransport();
        setStatus(false, "강사와 다른 강의가 열려 있습니다. 강사 화면의 TV 주소로 다시 열어 주세요.", true);
        openPanel();
        return;
      }
      if (packet.type !== "state") return;
      if (!validIndex(packet.index) || !Number.isSafeInteger(packet.seq) || packet.seq <= receivedSequence) return;
      receivedSequence = packet.seq;
      lastReceived = Date.now();
      clearDeadline();
      clearRetry();
      attempts = 0;
      if (currentIndex() !== packet.index || !hasConnected) LectureSync.receive(packet.index);
      var first = !connected;
      hasConnected = true;
      setStatus(true, "강사 화면에 연결됨 · 슬라이드가 자동으로 넘어갑니다.", false);
      if (first) { closePanel(); revealControls(); }
    });
    function gone() {
      if (viewer !== conn || !active) return;
      viewer = null;
      fail("TV 연결이 끊겼습니다. 강사와 같은 강의와 코드인지 확인해 주세요.");
    }
    conn.on("close", gone);
    conn.on("error", function () { gone(); try { conn.close(); } catch (err) {} });
  }

  if (guide) {
    LectureSync.onEmit(function (index) { if (validIndex(index)) publish(index); });
    LectureSync.on(function (index) { if (validIndex(index)) publish(index); });
  }
  window.addEventListener("online", function () { if (active) retryNow(); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden || !active) return;
    if (guide) publish();
    else if (connected && Date.now() - lastReceived > 10000) connected = false;
    if (!connected || (peer && peer.disconnected)) retryNow();
  });
  window.addEventListener("pagehide", function () { suspended = active; closeTransport(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted && suspended && active) { suspended = false; attempts = 0; buildPeer(); } });
  window.LectureRemote = { openPanel: openPanel, end: end, getStatus: getStatus };
  if (tv) {
    openPanel();
    var initialRoom = params.get("room");
    if (initialRoom) { roomInput.value = initialRoom; join(initialRoom); }
  }
})();
