/* 청중 화면(index.html)과 교안(교안.html)이 같은 장을 보게 합니다.
   채널 이름은 이 폴더 경로로 만들어, 다른 강의 폴더를 함께 열어도 섞이지 않습니다. */
(function () {
  var dir = decodeURIComponent(location.pathname).replace(/[^\/\\]*$/, "");
  var hash = 5381;
  for (var i = 0; i < dir.length; i++) hash = ((hash << 5) + hash + dir.charCodeAt(i)) >>> 0;
  var KEY = hash.toString(36);
  var SOURCE = "lecture-deck-" + KEY;
  var listeners = [];
  var emitters = []; // 기기 간 발표 연결은 장 번호만 구독합니다.
  var reloaders = []; // 교안 편집 모드에서 저장하면 청중 화면을 다시 읽습니다.

  function post(win, msg) {
    try {
      if (win && win !== window && !win.closed) win.postMessage(msg, "*");
    } catch (err) { /* 닫힌 창은 건너뜁니다. */ }
  }
  function send(msg) {
    post(window.opener, msg);
    post(window.__lectureChild, msg);
    post(window.__lecturePeer, msg);
    try {
      var channel = window.__lectureChannel || new BroadcastChannel(SOURCE);
      window.__lectureChannel = channel;
      channel.postMessage(msg);
    } catch (err) { /* 파일로 바로 연 경우에는 창을 열어 연결합니다. */ }
  }
  function fire(n) { listeners.forEach(function (fn) { fn(n); }); }
  function handle(data, from) {
    if (!data || data.source !== SOURCE) return;
    if (document.body.dataset.remoteControlled === "true" && data.type === "go") return;
    if (from && from !== window) window.__lecturePeer = from;
    if (data.type === "hello") {
      post(from, { source: SOURCE, type: "go", index: window.__lectureIndex || 0 });
      return;
    }
    if (data.type === "ack") { fire(null); return; }
    if (data.type === "reload") { reloaders.forEach(function (fn) { fn(); }); return; }
    if (data.type === "go" && Number.isInteger(data.index)) {
      fire(data.index);
      send({ source: SOURCE, type: "ack" });
    }
  }

  window.addEventListener("message", function (e) { handle(e.data, e.source); });
  try {
    var channel = new BroadcastChannel(SOURCE);
    window.__lectureChannel = channel;
    channel.onmessage = function (e) { handle(e.data, null); };
  } catch (err) { /* BroadcastChannel이 없어도 연 창끼리 연결됩니다. */ }

  window.LectureSync = {
    setIndex: function (index) { window.__lectureIndex = index; },
    getIndex: function () { return window.__lectureIndex || 0; },
    onEmit: function (fn) { emitters.push(fn); },
    receive: function (index) {
      if (!Number.isInteger(index) || index < 0 || !window.DECK || index >= DECK.slides.length) return;
      fire(index);
    },
    on: function (fn) { listeners.push(fn); },
    emit: function (index) {
      send({ source: SOURCE, type: "go", index: index });
      emitters.forEach(function (fn) { fn(index); });
    },
    onReload: function (fn) { reloaders.push(fn); },
    reload: function () { send({ source: SOURCE, type: "reload" }); },
    hello: function () {
      var msg = { source: SOURCE, type: "hello" };
      post(window.opener, msg);
      if (window.parent && window.parent !== window) post(window.parent, msg);
    },
    open: function (kind, index) {
      var file = kind === "guide" ? "교안.html" : "index.html";
      var win = window.open(file + "#" + (index + 1), (kind === "guide" ? "guide-" : "slides-") + KEY);
      window.__lectureChild = win;
      if (win) win.focus();
      return win;
    }
  };
})();
