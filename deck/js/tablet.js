(function(){
 const nav=document.createElement('nav');nav.className='quick-nav';nav.setAttribute('aria-label','교안 장 이동');
 const prev=document.createElement('button');prev.type='button';prev.textContent='이전';
 const select=document.createElement('select');select.setAttribute('aria-label','볼 슬라이드 선택');
 DECK.slides.forEach(function(s,i){const o=document.createElement('option');o.value=i;o.textContent=(i+1)+' / '+DECK.slides.length+' · '+LectureSlides.slideLabel(s);select.appendChild(o);});
 const next=document.createElement('button');next.type='button';next.textContent='다음';
 nav.append(prev,select,next);document.querySelector('.top').after(nav);
 let shown=-1;
 function update(){
   const sheets=[...document.querySelectorAll('.sheet')];const i=sheets.findIndex(s=>s.classList.contains('is-on'));
   if(i<0)return;
   select.value=String(i);prev.disabled=i===0;next.disabled=i===sheets.length-1;
   if(shown!==i){document.getElementById('sheets').scrollTop=0;shown=i;}
 }
 prev.addEventListener('click',()=>document.getElementById('prev').click());
 next.addEventListener('click',()=>document.getElementById('next').click());
 select.addEventListener('change',()=>document.querySelectorAll('#list button')[Number(select.value)].click());
 new MutationObserver(update).observe(document.getElementById('sheets'),{subtree:true,attributes:true,attributeFilter:['class']});
 update();
})();
