(function(){
  var d=document,b=d.body,root=d.documentElement;
  try{var t=localStorage.getItem('rc-theme');if(t)root.setAttribute('data-theme',t)}catch(e){}
  var mobile=function(){return window.matchMedia('(max-width:900px)').matches};
  d.querySelectorAll('[data-toggle-nav]').forEach(function(x){x.addEventListener('click',function(){
    if(mobile()){b.classList.toggle('nav-open')}else{b.classList.toggle('nav-collapsed')}
  })});
  var s=d.querySelector('.scrim');if(s)s.addEventListener('click',function(){b.classList.remove('nav-open')});
  d.querySelectorAll('[data-toggle-theme]').forEach(function(x){x.addEventListener('click',function(){
    var n=root.getAttribute('data-theme')==='dark'?'light':'dark';root.setAttribute('data-theme',n);
    try{localStorage.setItem('rc-theme',n)}catch(e){}
  })});
  d.querySelectorAll('.seg').forEach(function(g){g.addEventListener('click',function(e){
    var bt=e.target.closest('button');if(!bt)return;
    g.querySelectorAll('button').forEach(function(o){o.setAttribute('aria-pressed',o===bt?'true':'false')});
  })});
})();
(function(){
  var g=document.querySelector('[data-filter]');if(!g)return;
  g.addEventListener('click',function(e){var bt=e.target.closest('button');if(!bt)return;
    var f=bt.getAttribute('data-f');
    document.querySelectorAll('tbody tr[data-status]').forEach(function(r){r.hidden=!(f==='all'||r.getAttribute('data-status')===f)});
  });
})();
