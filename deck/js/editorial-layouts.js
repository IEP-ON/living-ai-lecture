(function () {
  function fillText(el, text) {
    String(text || '').split('\n').forEach(function (line, i) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
  }
  function add(parent, tag, cls, text) {
    const el = document.createElement(tag);
    el.className = cls;
    if (text) fillText(el, text);
    parent.appendChild(el);
    return el;
  }
  window.EditorialSlides = {
    build: function (el, s, index, helpers) {
      const supported=['profile','columns','definitions','document','evidence','statement','context','comparison','sequence','transcript','request'];
      if (!supported.includes(s.layout)) return false;
      const {heading,footer}=helpers;
      if (s.layout==='profile') {
        const intro=add(el,'div','profile-intro');
        add(intro,'h1','copy',s.title);
        add(intro,'p','profile-role copy',s.subtitle);
        add(intro,'p','profile-message copy',s.message);
        const list=add(el,'dl','profile-details');
        (s.items||[]).forEach(function(item){
          const entry=add(list,'div','profile-entry');
          add(entry,'dt','copy',item.title);
          add(entry,'dd','copy',item.text);
        });
      } else if (s.layout==='statement') {
        const main=add(el,'div','statement-copy');
        if(s.eyebrow)add(main,'p','statement-label copy',s.eyebrow);
        add(main,'h1','copy',s.text);
        if(s.by)add(main,'p','statement-support copy',s.by);
      } else {
        heading(el,s);
        if (s.layout==='columns'||s.layout==='comparison') {
          const cols=add(el,'div','editor-columns');
          cols.style.setProperty('--columns',(s.items||[]).length);
          (s.items||[]).forEach(function(item,i){
            const column=add(cols,'section','editor-column');
            add(column,'h2','copy',item.title);
            const p=add(column,'p','copy');
            if(item.emphasis&&item.text.includes(item.emphasis)) {
              const parts=item.text.split(item.emphasis);
              fillText(p,parts[0]);add(p,'strong','meaning-emphasis',item.emphasis);fillText(p,parts.slice(1).join(item.emphasis));
            } else fillText(p,item.text);
          });
        } else if (s.layout==='definitions') {
          const dl=add(el,'dl','definitions');
          (s.items||[]).forEach(function(item){const row=add(dl,'div','definition');add(row,'dt','copy',item.title);add(row,'dd','copy',item.text);});
        } else if (s.layout==='document') {
          const doc=add(el,'div','document-sample');
          add(doc,'p','document-label copy',s.eyebrow);
          add(doc,'p','document-text copy',s.text);
        } else if (s.layout==='evidence') {
          const box=add(el,'div','evidence-content');
          if(s.eyebrow)add(box,'p','evidence-label copy',s.eyebrow);
          const table=add(box,'table','evidence-table');
          const thead=add(table,'thead','');const header=add(thead,'tr','');
          (s.headers||[]).forEach(function(text){const cell=add(header,'th','',text);cell.scope='col';});
          const body=add(table,'tbody','');
          (s.rows||[]).forEach(function(row){const tr=add(body,'tr','');row.forEach(function(text){add(tr,'td','',text);});});
        } else {
          const list=add(el,'ol','editor-lines');
          (s.items||[]).forEach(function(item,i){
            const li=add(list,'li','editor-line');
            if(s.layout==='sequence')add(li,'span','sequence-num',String(i+1).padStart(2,'0'));
            add(li,'h2','copy',item.title);add(li,'p','copy',item.text);
          });
        }
        if(s.closing)add(el,'p','editor-closing copy',s.closing);
        if(s.after)add(el,'p','editor-after copy',s.after);
      }
      footer(el,index);
      return true;
    }
  };
})();
