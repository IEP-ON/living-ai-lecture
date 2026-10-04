(function () {
  const SOURCE = "living-ai-intro-20261004";
  const listeners = new Set();

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
      const channel = window.__lectureChannel || new BroadcastChannel(SOURCE);
      window.__lectureChannel = channel;
      channel.postMessage(msg);
    } catch (err) { /* 파일로 바로 연 경우에는 창을 열어 연결합니다. */ }
  }

  function emit(index) {
    send({ source: SOURCE, type: "go", index: index });
  }

  function ack() {
    send({ source: SOURCE, type: "ack" });
  }

  window.addEventListener("message", function (e) {
    const data = e.data;
    if (!data || data.source !== SOURCE) return;
    if (e.source && e.source !== window) window.__lecturePeer = e.source;
    if (data.type === "hello") {
      post(e.source, { source: SOURCE, type: "go", index: window.__lectureIndex || 0 });
      return;
    }
    if (data.type === "ack") {
      listeners.forEach(function (fn) { fn(null); });
      return;
    }
    if (data.type === "go" && Number.isInteger(data.index)) {
      listeners.forEach(function (fn) { fn(data.index); });
      ack();
    }
  });

  try {
    const channel = new BroadcastChannel(SOURCE);
    window.__lectureChannel = channel;
    channel.onmessage = function (e) {
      const data = e.data;
      if (!data) return;
      if (data.type === "ack") {
        listeners.forEach(function (fn) { fn(null); });
        return;
      }
      if (data.type === "go" && Number.isInteger(data.index)) {
        listeners.forEach(function (fn) { fn(data.index); });
        ack();
      }
    };
  } catch (err) { /* BroadcastChannel이 없어도 연 창끼리 연결됩니다. */ }

  window.LectureSync = {
    setIndex: function (index) { window.__lectureIndex = index; },
    on: function (fn) { listeners.add(fn); },
    emit: emit,
    hello: function () {
      const msg = { source: SOURCE, type: "hello" };
      post(window.opener, msg);
      if (window.parent && window.parent !== window) post(window.parent, msg);
    },
    open: function (kind, index) {
      const file = kind === "guide" ? "교안.html" : "index.html";
      const name = kind === "guide" ? SOURCE + "-guide" : SOURCE + "-slides";
      const win = window.open(file + "#" + (index + 1), name);
      window.__lectureChild = win;
      if (win) win.focus();
      return win;
    }
  };
})();
