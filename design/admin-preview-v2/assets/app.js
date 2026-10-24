/* Biên bản admin preview v2 — vanilla JS, no libraries. */
(function(){
  'use strict';
  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  var NS='http://www.w3.org/2000/svg';
  var BB=window.BB;
  var bus={};
  function on(n,f){(bus[n]=bus[n]||[]).push(f);}
  function emit(n,v){(bus[n]||[]).forEach(function(f){f(v);});}

  /* ---------- formatting ---------- */
  function nf(v,d,max){return new Intl.NumberFormat('vi-VN',{minimumFractionDigits:d||0,maximumFractionDigits:max==null?(d||0):max}).format(v);}
  function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
  function el(t,a,p){var e=document.createElementNS(NS,t);for(var k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}
  function sum(a){return a.reduce(function(s,v){return s+v;},0);}

  /* ---------- theme ---------- */
  function setTheme(t){document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('bb-theme',t);}catch(e){}$$('[data-theme-toggle]').forEach(function(b){b.setAttribute('aria-pressed',String(t==='dark'));});emit('theme');}
  function curTheme(){var t=document.documentElement.getAttribute('data-theme');if(t)return t;return matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}
  $$('[data-theme-toggle]').forEach(function(b){b.setAttribute('aria-pressed',String(curTheme()==='dark'));b.addEventListener('click',function(){setTheme(curTheme()==='dark'?'light':'dark');});});

  /* ---------- drawer ---------- */
  var menuBtns=$$('.menu-btn');
  function nav(open){document.body.classList.toggle('nav-open',open);menuBtns.forEach(function(b){b.setAttribute('aria-expanded',String(open));});}
  menuBtns.forEach(function(b){b.addEventListener('click',function(){nav(!document.body.classList.contains('nav-open'));});});
  $$('.scrim,.ws-close').forEach(function(x){x.addEventListener('click',function(){nav(false);});});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){nav(false);closeDD();}if(e.key==='/'&&!/input|textarea|select/i.test(document.activeElement.tagName)&&!document.activeElement.isContentEditable){var s=$('#q,#sbsearch');if(s){e.preventDefault();s.focus();}}});

  /* ---------- dropdowns ---------- */
  var DD={};
  function closeDD(except){$$('.dd-menu').forEach(function(m){if(m!==except&&!m.hidden){m.hidden=true;m.previousElementSibling.setAttribute('aria-expanded','false');}});}
  function ddSet(root,val,silent){
    var items=$$('[role=option]',root),sel=null;
    items.forEach(function(i){var on_=i.dataset.value===val;i.setAttribute('aria-selected',String(on_));if(on_)sel=i;});
    if(!sel)return;$('.dd-label',root).textContent=sel.textContent;
    if(!silent)emit(root.dataset.dd,val);
  }
  $$('.dd').forEach(function(root){
    var btn=$('.dd-btn',root),menu=$('.dd-menu',root),items=$$('[role=option]',menu);
    DD[root.dataset.dd]=root;
    function open(){closeDD(menu);menu.hidden=false;btn.setAttribute('aria-expanded','true');var s=$('[aria-selected=true]',menu)||items[0];s.focus();}
    function close(f){menu.hidden=true;btn.setAttribute('aria-expanded','false');if(f)btn.focus();}
    btn.addEventListener('click',function(){menu.hidden?open():close();});
    btn.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();open();}});
    items.forEach(function(it,i){
      it.tabIndex=-1;
      it.addEventListener('click',function(){ddSet(root,it.dataset.value);close(true);});
      it.addEventListener('keydown',function(e){
        if(e.key==='ArrowDown'){e.preventDefault();(items[i+1]||items[0]).focus();}
        else if(e.key==='ArrowUp'){e.preventDefault();(items[i-1]||items[items.length-1]).focus();}
        else if(e.key==='Enter'||e.key===' '){e.preventDefault();it.click();}
        else if(e.key==='Escape'||e.key==='Tab'){close(e.key==='Escape');}
      });
    });
  });
  document.addEventListener('click',function(e){if(!e.target.closest('.dd'))closeDD();});

  /* ---------- segmented ---------- */
  var SEG={};
  function segSet(root,val,silent){$$('button',root).forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.value===val));});if(!silent)emit(root.dataset.seg,val);}
  $$('[data-seg]').forEach(function(root){
    (SEG[root.dataset.seg]=SEG[root.dataset.seg]||[]).push(root);
    $$('button',root).forEach(function(b){b.addEventListener('click',function(){segSet(root,b.dataset.value);});});
  });
  function segAll(name,val){(SEG[name]||[]).forEach(function(r){segSet(r,val,true);});}

  /* ---------- tabs ---------- */
  var TABS={};
  function tabSet(root,val,silent){
    var tabs=$$('[role=tab]',root);
    tabs.forEach(function(t){var s=t.dataset.value===val;t.setAttribute('aria-selected',String(s));t.tabIndex=s?0:-1;var p=t.getAttribute('aria-controls');if(p&&document.getElementById(p)&&document.getElementById(p).hasAttribute('data-panel'))document.getElementById(p).hidden=!s;});
    if(!silent)emit(root.dataset.tabs,val);
  }
  $$('[data-tabs]').forEach(function(root){
    TABS[root.dataset.tabs]=root;
    var tabs=$$('[role=tab]',root);
    tabs.forEach(function(t,i){
      t.addEventListener('click',function(){tabSet(root,t.dataset.value);});
      t.addEventListener('keydown',function(e){var j=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:-1;if(j<0)return;e.preventDefault();var n=tabs[(j+tabs.length)%tabs.length];n.focus();tabSet(root,n.dataset.value);});
    });
    tabSet(root,$('[aria-selected=true]',root).dataset.value,true);
  });

  /* ---------- sparklines ---------- */
  function curve(pts){var d='M'+pts[0][0]+' '+pts[0][1];for(var i=0;i<pts.length-1;i++){var p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2,t=.18;d+=' C'+(p1[0]+(p2[0]-p0[0])*t).toFixed(1)+' '+(p1[1]+(p2[1]-p0[1])*t).toFixed(1)+' '+(p2[0]-(p3[0]-p1[0])*t).toFixed(1)+' '+p2[1].toFixed(1)+' '+p2[0].toFixed(1)+' '+p2[1].toFixed(1);}return d;}
  function spark(host,spec){
    var w=host.clientWidth,h=host.clientHeight-10;if(!w)return;
    host.textContent='';var svg=el('svg',{viewBox:'0 0 '+w+' '+h,width:w,height:h,'aria-hidden':'true'},host);
    var colors=[css('--d1'),css('--d4')];
    var max=Math.max.apply(null,[].concat.apply([],spec.series))||1,n=spec.series[0].length;
    if(spec.type==='bar'){
      var bw=w/n,b=Math.max(2,bw*.62);
      spec.series[0].forEach(function(v,i){var bh=v>0?Math.max(3,v/max*(h-2)):2;el('rect',{x:(i*bw+(bw-b)/2).toFixed(1),y:(h-bh).toFixed(1),width:b.toFixed(1),height:bh.toFixed(1),rx:1.5,fill:v>0?colors[0]:css('--line-2')},svg);});
      return;
    }
    spec.series.forEach(function(s,k){
      var pts=s.map(function(v,i){return [6+i*(w-12)/Math.max(1,n-1),h-4-(v/max)*(h-12)];});
      el('path',{d:curve(pts),fill:'none',stroke:colors[k],'stroke-width':1.75,'stroke-linecap':'round'},svg);
      var e=pts[pts.length-1];el('circle',{cx:e[0],cy:e[1],r:3.5,fill:css('--bg'),stroke:colors[k],'stroke-width':1.75},svg);
    });
  }
  var sparkSpecs=[];
  function drawSparks(){sparkSpecs.forEach(function(s){spark(s.host,s.spec);});}
  function addSpark(host,spec){var f=sparkSpecs.filter(function(s){return s.host===host;})[0];if(f)f.spec=spec;else sparkSpecs.push({host:host,spec:spec});spark(host,spec);}

  /* ---------- metrics over atoms ---------- */
  var RANGES={'7':[15,22],'10':[12,22],'month':[0,22]};
  var RANGE_LABEL={'7':'16/10 – 22/10','10':'13/10 – 22/10','month':'01/10 – 22/10'};
  var PREV_LABEL={'7':'09/10 – 15/10','10':'03/10 – 12/10','month':'01/09 – 22/09'};
  function slice(a,r){return a.slice(r[0],r[1]);}
  function dayVals(atoms,m,r){return slice(BB.DAYS?Array.apply(null,Array(BB.DAYS)).map(function(_,i){return atoms.reduce(function(s,a){return s+a.day[m][i];},0);}):[],r);}
  function total(atoms,m,r){return sum(dayVals(atoms,m,r));}
  function prevRange(rk){var r=RANGES[rk];if(rk==='month')return null;var n=r[1]-r[0];return [r[0]-n,r[0]];}
  var METRICS={
    cost:{name:'Chi phí',fmt:function(v){return '$'+nf(v,2);},axis:function(v){return '$'+nf(v,0,2);},get:function(a,r){return dayVals(a,'cost',r);},prev:'cost'},
    sec:{name:'Giây chép lời',fmt:function(v){return nf(v)+' giây';},axis:function(v){return v>=1000?nf(v/1000,0,1)+'k':nf(v);},get:function(a,r){return dayVals(a,'sec',r);},prev:'sec'},
    tok:{name:'Token',fmt:function(v){return v>=1e6?nf(v/1e6,2)+' tr':nf(v/1e3,0)+' k';},axis:function(v){return v>=1e6?nf(v/1e6,0,2)+' tr':nf(v/1e3,0)+'k';},get:function(a,r){var x=dayVals(a,'tin',r),y=dayVals(a,'tout',r);return x.map(function(v,i){return v+y[i];});},prev:'tok'},
    calls:{name:'Lượt gọi',fmt:function(v){return nf(Math.round(v));},axis:function(v){return nf(v);},get:function(a,r){return dayVals(a,'calls',r);},prev:'calls'}
  };
  function prevTotal(mk,rk){
    if(rk==='month')return BB.PREV[METRICS[mk].prev];
    var pr=prevRange(rk);return sum(METRICS[mk].get(BB.ATOMS,pr));
  }
  function deltaHTML(cur,prev,rk){
    var p=(cur-prev)/prev*100,up=p>=0;
    return '<span class="delta"><svg class="ico" viewBox="0 0 24 24"><path d="'+(up?'M7 17L17 7M9 7h8v8':'M7 7l10 10M17 9v8H9')+'"/></svg>'+nf(Math.abs(p),1)+'%</span> so với '+PREV_LABEL[rk];
  }
  var WD=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  function dayLabel(i){var d=new Date(2026,9,i+1);return WD[d.getDay()]+', '+('0'+(i+1)).slice(-2)+'/10';}

  /* ---------- stacked bar chart ---------- */
  function niceMax(v){if(v<=0)return 1;var p=Math.pow(10,Math.floor(Math.log(v)/Math.LN10)),f=v/p,n=[1,2,2.5,4,5,8,10].filter(function(x){return x>=f;})[0];return n*p;}
  function barChart(host,o){
    host.textContent='';
    var W=host.clientWidth;if(!W)return;
    var H=o.height||288,ml=o.ml||48,mb=26,mt=8,pw=W-ml,ph=H-mt-mb,n=o.labels.length;
    var tots=o.labels.map(function(_,i){return sum(o.series.map(function(s){return s.data[i];}));});
    var top=niceMax(Math.max.apply(null,tots)*1.04),ticks=4;
    var svg=el('svg',{viewBox:'0 0 '+W+' '+H,width:W,height:H,'aria-hidden':'true'},host);
    var defs=el('defs',{},svg);
    for(var t=0;t<=ticks;t++){var y=mt+ph-ph*t/ticks;el('line',{x1:ml,x2:W,y1:y,y2:y,'class':t?'grid':'base'},svg);var tx=el('text',{x:ml-10,y:y+4,'text-anchor':'end'},svg);tx.textContent=o.axis(top*t/ticks);}
    var band=pw/n,bw=Math.min(36,Math.max(4,band*.6)),every=Math.ceil(46/band),groups=[];
    o.labels.forEach(function(lab,i){
      var g=el('g',{'data-i':i},svg),x=ml+i*band;groups.push(g);
      el('rect',{x:x+1,y:mt,width:band-2,height:ph,rx:6,'class':'band'},g);
      var bx=x+(band-bw)/2,yc=mt+ph,cid='c'+o.id+'_'+i;
      if(tots[i]>0){
        var th=Math.max(2,tots[i]/top*ph),cp=el('clipPath',{id:cid},defs);el('rect',{x:bx,y:yc-th,width:bw,height:th,rx:Math.min(3,bw/2)},cp);
        var gg=el('g',{'clip-path':'url(#'+cid+')'},g);
        o.series.forEach(function(s){var v=s.data[i];if(v<=0)return;var sh=v/top*ph;el('rect',{x:bx,y:yc-sh,width:bw,height:sh,fill:s.color,'class':'seg-r'},gg);yc-=sh;});
      }
      if(i%every===0||i===n-1&&(n-1)%every>=every-1&&false){var lx=el('text',{x:x+band/2,y:H-6,'text-anchor':'middle'},g);lx.textContent=lab;}
      el('rect',{x:x,y:0,width:band,height:H-mb+6,'class':'hit'},g);
    });
    var tip=document.createElement('div');tip.className='tip';host.appendChild(tip);
    var live=host.nextElementSibling&&host.nextElementSibling.classList.contains('sr-only')?host.nextElementSibling:null;
    var cur=-1;
    function show(i){
      groups.forEach(function(g,k){g.classList.toggle('on',k===i);});cur=i;
      var html='<b>'+dayLabel(o.idx[i])+'</b>';
      if(tots[i]<=0)html+='<div class="row"><span>Không có dữ liệu</span></div>';
      else{o.series.slice().reverse().forEach(function(s){if(s.data[i]>0)html+='<div class="row"><i style="background:'+s.color+'"></i><span>'+s.name+'</span><em>'+o.fmt(s.data[i])+'</em></div>';});
        if(o.series.length>1)html+='<div class="row tot"><span>Tổng</span><em>'+o.fmt(tots[i])+'</em></div>';}
      tip.innerHTML=html;tip.classList.add('show');
      var cx=ml+i*band+band/2,tw=tip.offsetWidth,th2=tip.offsetHeight,left=cx+16;if(left+tw>W)left=cx-tw-16;if(left<0)left=0;
      var ty=Math.max(0,mt+ph-(tots[i]/top*ph)-th2/2);ty=Math.min(ty,H-mb-th2);
      tip.style.left=left+'px';tip.style.top=ty+'px';
      if(live)live.textContent=dayLabel(o.idx[i])+': '+(tots[i]>0?o.fmt(tots[i]):'không có dữ liệu');
    }
    function hide(){groups.forEach(function(g){g.classList.remove('on');});tip.classList.remove('show');cur=-1;}
    groups.forEach(function(g,i){g.addEventListener('mouseenter',function(){show(i);});});
    host.addEventListener('mouseleave',hide);
    host.onkeydown=function(e){var k=e.key;if(k!=='ArrowLeft'&&k!=='ArrowRight'&&k!=='Escape')return;e.preventDefault();if(k==='Escape')return hide();show(cur<0?(k==='ArrowRight'?0:n-1):Math.max(0,Math.min(n-1,cur+(k==='ArrowRight'?1:-1))));};
    host.onblur=hide;
    if(o.initial!=null&&!o.noInitial)show(o.initial);
  }

  /* ---------- usage page ---------- */
  function initUsage(){
    var host=$('#chart');if(!host)return;
    var S={metric:'cost',range:'month',group:'vendor'};
    var A=BB.ATOMS;
    var GROUPS={
      vendor:function(){return ['Deepgram','OpenAI','Gemini'].map(function(v){return {name:v,atoms:A.filter(function(a){return a.vendor===v;}),sub:BB.DESC.vendor[v]};});},
      model:function(){return A.map(function(a){return {name:a.model,atoms:[a],sub:a.vendor+' · '+a.note};});},
      service:function(){var m={};A.forEach(function(a){(m[a.service]=m[a.service]||{name:a.service,atoms:[],ven:[]});m[a.service].atoms.push(a);if(m[a.service].ven.indexOf(a.vendor)<0)m[a.service].ven.push(a.vendor);});return Object.keys(m).map(function(k){var g=m[k];return {name:k,atoms:g.atoms,sub:g.ven.join(' + ')};});}
    };
    var GNAME={vendor:'nhà cung cấp',model:'mô hình',service:'dịch vụ'};
    var COL=['--d1','--d2','--d3','--d4','--d5'];
    function render(){
      var r=RANGES[S.range],M=METRICS[S.metric],idx=[];for(var i=r[0];i<r[1];i++)idx.push(i);
      var groups=GROUPS[S.group]().map(function(g){g.vals=M.get(g.atoms,r);g.tot=sum(g.vals);return g;}).filter(function(g){return g.tot>0;});
      groups.sort(function(a,b){return b.tot-a.tot;});
      groups.forEach(function(g,k){g.color=css(COL[k]);});
      var tot=total(A,S.metric==='tok'?'tin':S.metric==='sec'?'sec':S.metric,r);
      var totM=sum(M.get(A,r));tot=totM;
      // headline
      var h=$('#headline'),sub=$('#headsub'),prev=prevTotal(S.metric,S.range);
      var main;
      if(S.metric==='cost')main='$'+nf(tot,2);
      else if(S.metric==='sec')main=nf(tot)+'<small>giây</small>';
      else if(S.metric==='tok')main=nf(tot/1e6,2)+'<small>triệu token</small>';
      else main=nf(Math.round(tot))+'<small>lượt</small>';
      h.innerHTML=main;
      var extra='';
      if(S.metric==='cost')extra='<span>≈ '+nf(tot*BB.RATE,0)+' ₫ (ước tính)</span>';
      if(S.metric==='sec')extra='<span>'+nf(tot/3600,1)+' giờ · '+nf(tot/60)+' phút kênh</span>';
      if(S.metric==='tok'){var ti=total(A,'tin',r),to=total(A,'tout',r);extra='<span>vào '+nf(ti/1e6,2)+' tr · ra '+nf(to/1e6,2)+' tr</span>';}
      sub.innerHTML='<span>'+deltaHTML(tot,prev,S.range)+'</span>'+extra;
      // legend
      $('#legend').innerHTML=groups.map(function(g){return '<span><i style="background:'+g.color+'"></i>'+g.name+' <b>'+M.fmt(g.tot).replace(' giây','')+'</b></span>';}).join('');
      $('#chart-title').textContent=M.name+' theo ngày · '+RANGE_LABEL[S.range]+'/2026';
      host.setAttribute('aria-label',M.name+' theo ngày, nhóm theo '+GNAME[S.group]+', '+RANGE_LABEL[S.range]+'/2026. Dùng phím mũi tên trái phải để xem từng ngày.');
      var series=groups.map(function(g){return {name:g.name,color:g.color,data:g.vals};});
      barChart(host,{id:'u',idx:idx,labels:idx.map(function(i){return ('0'+(i+1)).slice(-2)+'/10';}),series:series,axis:M.axis,fmt:function(v){return S.metric==='cost'?M.fmt(v):M.fmt(v);},ml:S.metric==='tok'?52:48,noInitial:true});
      renderTable(r);renderTiles(r);
    }
    function renderTable(r){
      var gs=GROUPS[S.group]().map(function(g){var x={name:g.name,sub:g.sub};['cost','sec','tin','tout','calls'].forEach(function(m){x[m]=total(g.atoms,m,r);});return x;}).filter(function(g){return g.cost>0;}).sort(function(a,b){return b.cost-a.cost;});
      var T={cost:0,sec:0,tin:0,tout:0,calls:0};gs.forEach(function(g){for(var k in T)T[k]+=g[k];});
      var dash='<td class="r dash">—</td>';
      function mil(v){return v>0?'<td class="r">'+nf(v/1e6,2)+' tr</td>':dash;}
      $('#detail-head').textContent='Theo '+GNAME[S.group];
      $('#detail-name').textContent=S.group==='vendor'?'Nhà cung cấp':S.group==='model'?'Mô hình':'Dịch vụ';
      $('#detail-body').innerHTML=gs.map(function(g){
        var sec=g.sec>0?'<td class="r">'+nf(g.sec)+'<span class="sub">'+nf(g.sec/60)+' phút kênh</span></td>':dash;
        return '<tr><td class="t">'+g.name+'<span class="sub">'+g.sub+'</span></td>'+sec+mil(g.tin)+mil(g.tout)+'<td class="r">'+nf(Math.round(g.calls))+'</td><td class="r">$'+nf(g.cost,2)+'</td><td class="r"><span class="share"><span class="meter"><i style="width:'+(g.cost/T.cost*100).toFixed(1)+'%"></i></span>'+nf(g.cost/T.cost*100,1)+'%</span></td></tr>';
      }).join('');
      $('#detail-foot').innerHTML='<tr><td>Tổng</td><td class="r">'+nf(T.sec)+'</td><td class="r">'+nf(T.tin/1e6,2)+' tr</td><td class="r">'+nf(T.tout/1e6,2)+' tr</td><td class="r">'+nf(Math.round(T.calls))+'</td><td class="r">$'+nf(T.cost,2)+'</td><td class="r">100,0%</td></tr>';
    }
    function renderTiles(r){
      function tile(id,mk,val,sub,spec){var t=$('#t-'+id);if(!t)return;$('.tile-v',t).innerHTML=val;$('.tile-d',t).innerHTML=sub;addSpark($('.spark',t),spec);t.classList.toggle('on',S.metric===mk);}
      var c=METRICS.cost.get(A,r),s=METRICS.sec.get(A,r),ti=dayVals(A,'tin',r),to=dayVals(A,'tout',r),k=METRICS.calls.get(A,r);
      tile('cost','cost','$'+nf(sum(c),2),deltaHTML(sum(c),prevTotal('cost',S.range),S.range),{series:[c]});
      tile('sec','sec',nf(sum(s)/3600,1)+'<small>giờ kênh</small>',nf(sum(s))+' giây',{series:[s]});
      tile('tok','tok',nf((sum(ti)+sum(to))/1e6,2)+'<small>triệu</small>','vào '+nf(sum(ti)/1e6,2)+' · ra '+nf(sum(to)/1e6,2),{series:[ti,to]});
      tile('calls','calls',nf(Math.round(sum(k))),'Gemini 95% · OpenAI 4% · Deepgram 1%',{series:[k],type:'bar'});
    }
    on('metric',function(v){S.metric=v;render();});
    on('range',function(v){S.range=v;segAll('range',v);render();});
    on('group',function(v){S.group=v;ddSet(DD.group,v,true);segAll('group',v);render();});
    $$('.tile-l[data-go]').forEach(function(b){b.addEventListener('click',function(){S.metric=b.dataset.go;tabSet(TABS.metric,S.metric,true);render();$('#chart-card').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});});});
    var rt;function rr(){clearTimeout(rt);rt=setTimeout(function(){render();},80);}
    window.addEventListener('resize',rr);on('theme',render);
    render();
    window.__usage={set:function(k,v){if(k==='metric'){tabSet(TABS.metric,v);}else if(k==='range'){emit('range',v);}else{emit('group',v);}} ,hover:function(i){var g=$$('#chart g[data-i]')[i];g&&g.dispatchEvent(new MouseEvent('mouseenter'));}};
  }

  /* ---------- dashboard tiles ---------- */
  function initDashboard(){
    if(!$('#dash-tiles'))return;
    var rk='month';
    function render(){
      var r=RANGES[rk],A=BB.ATOMS,m=slice(BB.MEET,r),c=METRICS.cost.get(A,r),s=METRICS.sec.get(A,r),ti=dayVals(A,'tin',r),to=dayVals(A,'tout',r);
      var prevM=rk==='month'?BB.PREV.meet:sum(slice(BB.MEET,prevRange(rk)));
      function set(id,val,sub,spec){var t=$('#d-'+id);$('.tile-v',t).innerHTML=val;$('.tile-d',t).innerHTML=sub;addSpark($('.spark',t),spec);}
      set('meet',nf(sum(m)),deltaHTML(sum(m),prevM,rk),{series:[m],type:'bar'});
      set('sec',nf(sum(s)/3600,1)+'<small>giờ kênh</small>',deltaHTML(sum(s),prevTotal('sec',rk),rk),{series:[s]});
      set('tok',nf((sum(ti)+sum(to))/1e6,2)+'<small>triệu</small>','vào '+nf(sum(ti)/1e6,2)+' · ra '+nf(sum(to)/1e6,2),{series:[ti,to]});
      set('cost','$'+nf(sum(c),2),deltaHTML(sum(c),prevTotal('cost',rk),rk),{series:[c]});
    }
    on('range',function(v){rk=v;segAll('range',v);render();});
    var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(render,80);});on('theme',render);
    render();
    var x=$('.notice .x');if(x)x.addEventListener('click',function(){$('.notice').hidden=true;});
  }

  /* ---------- meetings ---------- */
  function initMeetings(){
    var body=$('#m-body');if(!body)return;
    var S={status:'all',q:'',minutes:'all',lang:'all',page:0},PS=10,L=BB.MEETINGS;
    var ST={rec:['rec','Đang ghi'],done:['ok','Đã kết thúc'],err:['err','Dịch lỗi']};
    function hay(m){return (m.title+' '+m.snip.replace(/<\/?m>/g,'')).toLowerCase();}
    function filtered(){return L.filter(function(m){
      if(S.status!=='all'&&m.status!==S.status)return false;
      if(S.minutes==='vi'&&!m.vi)return false;if(S.minutes==='en'&&!m.en)return false;if(S.minutes==='none'&&(m.vi||m.en))return false;
      if(S.lang!=='all'&&m.lang!==S.lang)return false;
      if(S.q&&hay(m).indexOf(S.q.toLowerCase())<0)return false;return true;});}
    function hl(t,q){if(!q)return t;var i=t.toLowerCase().indexOf(q.toLowerCase());return i<0?t:t.slice(0,i)+'<mark>'+t.slice(i,i+q.length)+'</mark>'+t.slice(i+q.length);}
    function render(){
      var f=filtered(),pages=Math.max(1,Math.ceil(f.length/PS));if(S.page>=pages)S.page=pages-1;
      var rows=f.slice(S.page*PS,S.page*PS+PS);
      body.innerHTML=rows.map(function(m){
        var st=ST[m.status],snip=S.q&&m.snip&&m.snip.toLowerCase().indexOf(S.q.toLowerCase())>=0?'<span class="sub">'+m.snip.replace(/<m>/g,'<mark>').replace(/<\/m>/g,'</mark>')+'</span>':'';
        var chips=(m.vi||m.en)?(m.vi?'<span class="tag mono">VI</span> ':'')+(m.en?'<span class="tag mono">EN</span>':''):'<span class="muted">Chưa có</span>';
        return '<tr><td class="t"><a href="minutes.html">'+hl(m.title,S.q)+'</a>'+snip+'</td><td class="r">'+m.day+'/10 '+m.time+'</td><td class="r hide-s">'+m.dur+'</td><td class="hide-s">'+m.lang+'</td><td><span class="status"><i class="dot '+st[0]+'"></i>'+st[1]+'</span></td><td class="hide-s">'+chips+'</td></tr>';
      }).join('');
      $('#m-empty').hidden=rows.length>0;$('#m-table').hidden=rows.length===0;
      $('#m-count').textContent=f.length?'Hiển thị '+(S.page*PS+1)+'–'+(S.page*PS+rows.length)+' trong '+f.length+' cuộc họp':'0 cuộc họp';
      $('#m-prev').disabled=S.page===0;$('#m-next').disabled=S.page>=pages-1;
      $('#m-empty-q').textContent=S.q?'khớp “'+S.q+'”':'với bộ lọc này';
    }
    on('mstatus',function(v){S.status=v;S.page=0;render();});
    on('mmin',function(v){S.minutes=v;S.page=0;render();});
    on('mlang',function(v){S.lang=v;S.page=0;render();});
    $('#q').addEventListener('input',function(e){S.q=e.target.value.trim();S.page=0;render();});
    $('#m-prev').addEventListener('click',function(){S.page--;render();});$('#m-next').addEventListener('click',function(){S.page++;render();});
    $('#m-reset').addEventListener('click',function(){S.q='';$('#q').value='';S.status='all';S.minutes='all';S.lang='all';tabSet(TABS.mstatus,'all',true);ddSet(DD.mmin,'all',true);ddSet(DD.mlang,'all',true);render();});
    render();
  }

  /* ---------- minutes ---------- */
  function initMinutes(){
    var save=$('#save');if(!save)return;
    var un=$('#unsaved'),dirty=false;
    function mark(d){dirty=d;un.hidden=!d;save.disabled=!d;}
    mark(false);
    $$('[contenteditable]').forEach(function(e){e.addEventListener('input',function(){mark(true);});});
    save.addEventListener('click',function(){mark(false);});
    var ap=$('#approve');
    ap.addEventListener('click',function(){var done=ap.getAttribute('aria-pressed')!=='true';ap.setAttribute('aria-pressed',String(done));ap.textContent=done?'Đã duyệt · hoàn tác':'Đánh dấu đã duyệt';ap.classList.toggle('btn-primary',!done);$('#appr-dot').className='dot '+(done?'ok':'warn');$('#appr-txt').textContent=done?'Đã duyệt':'Chưa duyệt';$('#appr-note').textContent=done?'Biên bản được khoá khỏi việc tạo lại tự động.':'Bản do AI tạo, đã sửa 1 chỗ trong phiên này. Duyệt xong, biên bản được khoá khỏi việc tạo lại tự động.';});
    $$('.tasks input').forEach(function(c){c.addEventListener('change',function(){c.closest('li').style.opacity=c.checked?.55:1;});});
  }

  /* ---------- settings ---------- */
  function initSettings(){
    $$('[data-swap]').forEach(function(b){b.addEventListener('click',function(){var f=document.getElementById(b.dataset.swap);f.hidden=!f.hidden;b.setAttribute('aria-expanded',String(!f.hidden));if(!f.hidden)$('input',f).focus();});});
    $$('[data-cancel]').forEach(function(b){b.addEventListener('click',function(){var f=document.getElementById(b.dataset.cancel);f.hidden=true;});});
    $$('[data-savekey]').forEach(function(b){b.addEventListener('click',function(){var f=b.closest('.prov-form');$('input',f).value='';f.hidden=true;var t=$('#toast-keys');if(t)t.textContent='Đã lưu khoá mới (ví dụ giao diện). Khoá hiển thị dạng che.';});});
    $$('[data-check]').forEach(function(b){b.addEventListener('click',function(){var o=b.textContent;b.textContent='Đang kiểm tra…';b.disabled=true;setTimeout(function(){b.textContent='Kết nối ổn';setTimeout(function(){b.textContent=o;b.disabled=false;},1400);},600);});});
    var pr=$$('.price-in input');
    if(pr.length){var sv=$('#price-save'),und=$('#price-undo'),init=pr.map(function(i){return i.value;});
      function chk(){var d=pr.some(function(i,k){return i.value!==init[k];});sv.disabled=!d;und.disabled=!d;}
      pr.forEach(function(i){i.addEventListener('input',chk);});chk();
      und.addEventListener('click',function(){pr.forEach(function(i,k){i.value=init[k];});chk();});
      sv.addEventListener('click',function(){init=pr.map(function(i){return i.value;});chk();$('#price-toast').textContent='Đã lưu (ví dụ giao diện).';});}
    var bud=$('#budget');if(bud){var bt=$('#budget-fill'),bv=$('#budget-ratio');function ub(){var v=parseFloat(bud.value.replace(',','.'))||0;var p=Math.min(100,41.87/Math.max(v,1)*100);bt.style.width=p+'%';bv.textContent=nf(p,0)+'% đã dùng';$$('[data-th]').forEach(function(t){t.textContent='US$ '+nf(v*t.dataset.th/100,2);});}bud.addEventListener('input',ub);ub();}
    var tabsHash=location.hash.replace('#','');if(tabsHash&&TABS.settings&&$('[data-value="'+tabsHash+'"]',TABS.settings))tabSet(TABS.settings,tabsHash);
    on('settings',function(v){try{history.replaceState(null,'','#'+v);}catch(e){}});
  }

  /* ---------- glossary ---------- */
  function initGlossary(){
    var body=$('#g-body');if(!body)return;
    var S={lang:'all',q:''},L=BB.GLOSSARY.slice();
    function render(){
      var f=L.filter(function(g){return (S.lang==='all'||g[1]===S.lang)&&(!S.q||(g[0]+' '+g[2]).toLowerCase().indexOf(S.q.toLowerCase())>=0);});
      body.innerHTML=f.map(function(g){return '<tr><td class="t">'+g[0]+'</td><td><span class="tag mono">'+g[1]+'</span></td><td>'+(g[3]?'<span class="muted">Không dịch ·</span> ':'')+g[2]+'</td><td class="r hide-s">'+g[4]+'</td></tr>';}).join('');
      $('#g-empty').hidden=f.length>0;$('#g-count').textContent=L.length+' thuật ngữ';
      $('#g-n').textContent=L.length;
    }
    on('glang',function(v){S.lang=v;render();});
    $('#q').addEventListener('input',function(e){S.q=e.target.value.trim();render();});
    $('#g-add').addEventListener('submit',function(e){e.preventDefault();var t=$('#g-term').value.trim();if(!t)return;var nd=$('#g-nodo').checked;L.unshift([t,$('#g-lang').value,nd?'giữ nguyên':($('#g-tr').value.trim()||'—'),nd,'22/10']);$('#g-term').value='';$('#g-tr').value='';$('#g-nodo').checked=false;render();});
    render();
  }

  /* ---------- login ---------- */
  function initLogin(){
    var f=$('#login-form');if(!f)return;
    $('#toggle-err').addEventListener('click',function(){var e=f.classList.toggle('has-err');this.setAttribute('aria-pressed',String(e));$('#login-err').setAttribute('role',e?'alert':'');});
    $('#pw-eye').addEventListener('click',function(){var i=$('#pw');var show=i.type==='password';i.type=show?'text':'password';this.setAttribute('aria-pressed',String(show));this.setAttribute('aria-label',show?'Ẩn mật khẩu':'Hiện mật khẩu');});
    f.addEventListener('submit',function(e){e.preventDefault();f.classList.add('has-err');});
  }

  initUsage();initDashboard();initMeetings();initMinutes();initSettings();initGlossary();initLogin();
  window.addEventListener('load',function(){drawSparks();});
  window.__bb={emit:emit,tabSet:function(n,v){tabSet(TABS[n],v);},ddSet:function(n,v){ddSet(DD[n],v);}};
})();
