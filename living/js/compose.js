/* 조각 이어 붙이기
   조각/*.js가 window.PIECES에 조각(개론 · 1회기 · 2회기 · 마무리 · 돌아보기)을 하나씩 넣고,
   이 파일이 주소의 ?set=intro,s2,end 순서대로 이어 붙여 window.DECK 하나를 만듭니다.
   그다음 엔진(slides · guide · prompter · remote …)은 예전처럼 DECK만 읽습니다.

   조각 안에서 쓰는 칸(엔진은 모르는 칸이라 화면에 영향이 없습니다)
   - slide.if   : 이 조건이 맞을 때만 이 장을 넣습니다.
   - slide.vary : [{조건…, 바꿀 칸…}] 조건이 맞으면 그 칸으로 바꿉니다(note는 칸별로 덮어씀). 여럿이 맞으면 차례로 덮어씁니다.
   - slide.module : 모듈 갈피 장. "모듈 N · 이름"의 N을 오늘 순서로 다시 셉니다.
   - note.say 안의 {모듈차례} : 첫 번째 · 두 번째 … 로 바뀝니다.
   조건: first · last(true/false), next · prev(조각 id 하나나 목록), has · lacks(모두 있음 · 하나도 없음),
         after · notAfter(앞에 모두 있음 · 앞에 하나도 없음), before · notBefore(뒤에 모두 있음 · 뒤에 하나도 없음)

   조각 하나만 열면(?set=s2) 조건과 바꿈을 적용하지 않고 그 조각을 그대로 보여 줍니다.
   교안의 [편집]은 이때만 켜지고, 저장은 그 조각 파일(조각/2회기.js)에 합니다. */
(function () {
  var list = window.PIECES || [];
  var byId = {};
  list.forEach(function (p) { byId[p.id] = p; });
  var ORDER = list.map(function (p) { return p.id; });
  var DEFAULT = "intro,s1";

  // 조각 id 목록을 정리합니다: 없는 것 · 겹친 것은 빼고, 돌아보기는 맨 앞 · 마무리는 맨 뒤로.
  function normalize(raw) {
    var seen = {};
    var ids = (Array.isArray(raw) ? raw : String(raw || "").split(",")).map(function (s) { return String(s).trim(); }).filter(function (id) {
      if (!byId[id] || seen[id]) return false;
      seen[id] = 1;
      return true;
    });
    var lead = ids.filter(function (id) { return byId[id].place === "first"; });
    var tail = ids.filter(function (id) { return byId[id].place === "last"; });
    var mid = ids.filter(function (id) { return !byId[id].place; });
    return lead.concat(mid, tail);
  }
  function readSet() {
    var raw = "";
    try { raw = new URLSearchParams(location.search).get("set") || ""; } catch (err) { raw = ""; }
    var ids = normalize(raw || DEFAULT);
    return ids.length ? ids : normalize(DEFAULT);
  }

  var ORD = ["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째", "여섯 번째"];
  var COND = ["first", "last", "next", "prev", "has", "lacks", "after", "notAfter", "before", "notBefore"];
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function many(v) { return v === undefined ? null : Array.isArray(v) ? v : [v]; }

  // 정리된 조합(set)으로 DECK 하나를 만듭니다. 조각 하나면 그 조각을 그대로 돌려줍니다(편집 · 리허설용).
  function build(set) {
    if (!set.length) return null;
    if (set.length === 1) {
      var only = byId[set[0]];
      only.setKey = set[0];
      return only;
    }
    function matches(cond, at) {
      if (!cond) return true;
      var before = set.slice(0, at), after = set.slice(at + 1);
      function all(arr, ids) { return ids.every(function (id) { return arr.indexOf(id) >= 0; }); }
      function none(arr, ids) { return ids.every(function (id) { return arr.indexOf(id) < 0; }); }
      if (cond.first !== undefined && cond.first !== (at === 0)) return false;
      if (cond.last !== undefined && cond.last !== (at === set.length - 1)) return false;
      var v;
      if ((v = many(cond.next)) && v.indexOf(set[at + 1]) < 0) return false;
      if ((v = many(cond.prev)) && v.indexOf(set[at - 1]) < 0) return false;
      if ((v = many(cond.has)) && !all(set, v)) return false;
      if ((v = many(cond.lacks)) && !none(set, v)) return false;
      if ((v = many(cond.after)) && !all(before, v)) return false;
      if ((v = many(cond.notAfter)) && !none(before, v)) return false;
      if ((v = many(cond.before)) && !all(after, v)) return false;
      if ((v = many(cond.notBefore)) && !none(after, v)) return false;
      return true;
    }

    var deck = {
      title: "질문에서 결과물까지 · " + set.map(function (id) { return byId[id].name; }).join(" → "),
      course: (byId[set[0]].course || "교사를 위한 에이전트 AI 실습 연수"),
      parts: [],
      slides: [],
      waits: [],
      composed: true,
      setKey: set.join(",")
    };
    var waitSeen = {};
    var moduleNo = 0;

    set.forEach(function (id, at) {
      var piece = byId[id];
      var offset = deck.parts.length;
      (piece.parts || []).forEach(function (name) { deck.parts.push(name); });
      var shift = function (n) { return n > 0 ? n + offset : n; };
      var firstOfPiece = true;

      piece.slides.forEach(function (orig) {
        if (orig.if && !matches(orig.if, at)) return;
        var s = clone(orig);
        (s.vary || []).forEach(function (v) {
          if (!matches(v, at)) return;
          Object.keys(v).forEach(function (k) {
            if (COND.indexOf(k) >= 0) return;
            if (k === "note") s.note = Object.assign({}, s.note || {}, v.note);
            else s[k] = v[k];
          });
        });
        delete s.if;
        delete s.vary;
        if (s.part) s.part = shift(s.part);
        if (s.waitPart) s.waitPart = shift(s.waitPart);
        if (s.module) {
          moduleNo++;
          var name = "모듈 " + moduleNo + " · " + s.module;
          if (/^모듈 \d+ · /.test(s.label || "")) s.label = name;
          if (/^모듈 \d+ · /.test(s.kicker || "")) s.kicker = name;
          delete s.module;
        }
        if (s.note && s.note.say && s.note.say.indexOf("{모듈차례}") >= 0) {
          s.note.say = s.note.say.split("{모듈차례}").join(ORD[Math.max(0, moduleNo - 1)] || "다음");
        }
        // 조각이 바뀌는 첫 장에는 교안 장 목록의 구간 머리를 꼭 둡니다.
        if (firstOfPiece && !s.group) s.group = piece.name;
        firstOfPiece = false;
        deck.slides.push(s);
      });

      (piece.waits || []).forEach(function (w) {
        if (waitSeen[w.id]) return;
        waitSeen[w.id] = 1;
        var c = clone(w);
        c.part = shift(c.part || 0);
        deck.waits.push(c);
      });
    });
    return deck;
  }

  var set = readSet();
  var query = "?set=" + set.join(",");
  window.LectureCompose = {
    set: set,
    pieces: list,
    order: ORDER,
    query: query,
    // 같은 조합으로 다른 화면(교안 · 슬라이드 · 카드)을 엽니다.
    href: function (file) { return file + query; },
    // 첫 화면에서 장 수 · 시간을 미리 셀 때 씁니다. 조각 하나를 줄 때는 원본을 돌려주므로 고치지 않습니다.
    normalize: normalize,
    build: function (ids) { return build(normalize(ids)); }
  };
  var made = build(set);
  if (made) window.DECK = made;
})();
