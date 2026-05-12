// naradia-patch.js
// Pridaj do index.html pred </body>: <script src="naradia-patch.js"></script>
// Zmeny: 1) autocomplete pre "Názov náradia"  2) detekcia duplikátov pri ukladaní

(function(){
'use strict';

window._pendingNaradiaData = null;

// ── Autocomplete pre pole Názov náradia ──────────────────────
function initNaradiaNameAutocomplete(){
  var inp  = document.getElementById('n-name');
  var drop = document.getElementById('n-name-drop');
  if(!inp || !drop) return;

  function getNames(){
    var S = window.S || {};
    var all = Object.values(S.naradia || {}).map(function(n){ return n.name; });
    return all.filter(function(v,i,a){ return a.indexOf(v)===i; }).sort();
  }
  function hl(text,q){
    if(!q) return text;
    var i=text.toLowerCase().indexOf(q.toLowerCase());
    if(i<0) return text;
    return text.slice(0,i)+'<strong style="color:var(--accent)">'+text.slice(i,i+q.length)+'</strong>'+text.slice(i+q.length);
  }
  function showDrop(q){
    var list=getNames();
    var f=q?list.filter(function(n){return n.toLowerCase().includes(q.toLowerCase());}):list;
    if(!f.length){drop.style.display='none';return;}
    drop.innerHTML=f.map(function(n){
      return '<div class="ns-item" data-name="'+n.replace(/"/g,'&quot;')+'">'+hl(n,q)+'</div>';
    }).join('');
    drop.style.display='block';
    drop.querySelectorAll('.ns-item').forEach(function(el){
      el.addEventListener('mousedown',function(e){
        e.preventDefault();
        inp.value=this.dataset.name;
        drop.style.display='none';
      });
    });
  }
  inp.addEventListener('input',  function(){ showDrop(this.value); });
  inp.addEventListener('focus',  function(){ if(this.value) showDrop(this.value); });
  inp.addEventListener('blur',   function(){ setTimeout(function(){drop.style.display='none';},150); });
  inp.addEventListener('keydown',function(e){
    var vis=drop.querySelectorAll('.ns-item');
    var act=drop.querySelector('.ns-item.ns-active');
    if(e.key==='ArrowDown'){
      e.preventDefault();
      if(!vis.length) return;
      if(!act){ vis[0].classList.add('ns-active'); }
      else{ var i=Array.from(vis).indexOf(act); act.classList.remove('ns-active'); if(i+1<vis.length) vis[i+1].classList.add('ns-active'); }
    } else if(e.key==='ArrowUp'){
      e.preventDefault();
      if(!act) return;
      var i=Array.from(vis).indexOf(act); act.classList.remove('ns-active'); if(i>0) vis[i-1].classList.add('ns-active');
    } else if(e.key==='Enter' && drop.style.display!=='none'){
      var a=drop.querySelector('.ns-item.ns-active');
      if(a){ e.preventDefault(); inp.value=a.dataset.name; drop.style.display='none'; }
    } else if(e.key==='Escape'){ drop.style.display='none'; }
  });
}
window.initNaradiaNameAutocomplete = initNaradiaNameAutocomplete;

// ── Helper: uloženie náradia do Firebase ─────────────────────
async function doSaveNaradia(key, obj){
  obj.id = key;
  try{
    await window.dbSet('naradia/'+key, obj);
    window.S.naradia[key] = obj;
    window.closeModal('modal-add-naradia');
    window.renderNaradiaMgmt();
    window.renderSklad();
    window.toast('Náradie uložené','ok');
  } catch(e){ window.toast('Chyba: '+e.message,'err'); }
}

// ── Zobraz modal pre duplicity ────────────────────────────────
function showDuplicateModal(matches, addQty, unit){
  var html = matches.map(function(n){
    var vs = window.vSklade(n.id);
    var ns = window.naStavbe(n.id);
    return '<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px;background:var(--surface2)">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div><strong>'+n.name+'</strong>'
      +(n.model ? '<span style="color:var(--text3);font-size:12px"> · '+n.model+'</span>' : '')
      +(n.sn    ? '<span style="color:var(--text3);font-size:12px"> · S/N: '+n.sn+'</span>' : '')
      +'<div style="font-size:11px;color:var(--text3);margin-top:3px">'
      +'Celkom: '+n.total+' '+n.unit+' · V sklade: '+vs+' · Na stavbách: '+ns
      +'</div></div>'
      +'<button class="btn btn-primary btn-sm" onclick="navysiPocet(\''+n.id+'\')">+'+addQty+' '+unit+'</button>'
      +'</div></div>';
  }).join('');
  document.getElementById('dup-list').innerHTML = html;
  document.getElementById('dup-qty').textContent = addQty+' '+unit;
  window.closeModal('modal-add-naradia');
  window.openModal('modal-duplicate-naradia');
}

// ── Override saveNaradia – s detekciou duplikátov ─────────────
async function saveNaradia(){
  var id    = document.getElementById('edit-naradia-id').value;
  var name  = document.getElementById('n-name').value.trim();
  var model = document.getElementById('n-model').value.trim();
  var sn    = document.getElementById('n-sn').value.trim();
  var unit  = document.getElementById('n-unit').value;
  var total = parseInt(document.getElementById('n-total').value)||0;
  var kat   = document.getElementById('n-kat').value;
  var pozn  = document.getElementById('n-pozn').value.trim();
  if(!name){ window.toast('Zadajte názov náradia','err'); return; }
  var obj = {name:name,model:model,sn:sn,unit:unit,total:total,kat:kat,pozn:pozn};

  // Editácia existujúceho – ulož priamo
  if(id){
    obj.id = id;
    try{
      await window.dbSet('naradia/'+id, obj);
      window.S.naradia[id] = obj;
      window.closeModal('modal-add-naradia');
      window.renderNaradiaMgmt();
      window.renderSklad();
      window.toast('Náradie uložené','ok');
    } catch(e){ window.toast('Chyba: '+e.message,'err'); }
    return;
  }

  // Nové náradie – hľadaj zhodu v databáze
  var matches = Object.values(window.S.naradia||{}).filter(function(n){
    return n.name.toLowerCase() === name.toLowerCase();
  });
  if(matches.length > 0){
    window._pendingNaradiaData = obj;
    showDuplicateModal(matches, total, unit);
  } else {
    await doSaveNaradia(Date.now().toString(36), obj);
  }
}
window.saveNaradia = saveNaradia;

// ── Navýši počet existujúceho náradia ────────────────────────
async function navysiPocet(existingId){
  var n = window.S.naradia[existingId];
  if(!n) return;
  var addQty = window._pendingNaradiaData ? (window._pendingNaradiaData.total||1) : 1;
  var updated = Object.assign({}, n, {total: n.total + addQty});
  try{
    await window.dbSet('naradia/'+existingId, updated);
    window.S.naradia[existingId] = updated;
    window.closeModal('modal-duplicate-naradia');
    window._pendingNaradiaData = null;
    window.renderNaradiaMgmt();
    window.renderSklad();
    window.toast('Počet navýšený: '+n.name+' → '+updated.total+' '+n.unit,'ok');
  } catch(e){ window.toast('Chyba: '+e.message,'err'); }
}
window.navysiPocet = navysiPocet;

// ── Uloží ako nové náradie napriek zhode ─────────────────────
async function saveNaradiaForced(){
  if(!window._pendingNaradiaData) return;
  var obj = Object.assign({}, window._pendingNaradiaData);
  window._pendingNaradiaData = null;
  window.closeModal('modal-duplicate-naradia');
  await doSaveNaradia(Date.now().toString(36), obj);
}
window.saveNaradiaForced = saveNaradiaForced;

// ── Patch openModal – spusti autocomplete pri otvorení modalu ─
var _origOpenModal = window.openModal;
window.openModal = function(id){
  _origOpenModal(id);
  if(id === 'modal-add-naradia'){
    setTimeout(initNaradiaNameAutocomplete, 60);
  }
};

// ── DOM patches po načítaní stránky ──────────────────────────
document.addEventListener('DOMContentLoaded', function(){

  // 1) Nahraď n-name plain input → ns-wrap s autocomplete dropdownom
  var nameInput = document.getElementById('n-name');
  if(nameInput){
    var parent = nameInput.parentElement;
    var wrap = document.createElement('div');
    wrap.className = 'ns-wrap';
    wrap.style.marginBottom = '0';
    var newInp = document.createElement('input');
    newInp.type = 'text';
    newInp.id = 'n-name';
    newInp.className = 'ns-input';
    newInp.placeholder = 'napr. Vŕtačka';
    newInp.autocomplete = 'off';
    var dropDiv = document.createElement('div');
    dropDiv.className = 'ns-drop';
    dropDiv.id = 'n-name-drop';
    wrap.appendChild(newInp);
    wrap.appendChild(dropDiv);
    parent.replaceChild(wrap, nameInput);
  }

  // 2) Vlož modal pre duplicity do DOM
  var dupModal = document.createElement('div');
  dupModal.className = 'modal-backdrop';
  dupModal.id = 'modal-duplicate-naradia';
  dupModal.innerHTML =
    '<div class="modal" style="width:520px;max-width:98vw">'
    +'<h3>Náradie s rovnakým názvom existuje</h3>'
    +'<p>Náradie s týmto názvom už je v databáze. Vyberte, ktorému navýšiť počet o <strong id="dup-qty"></strong>, alebo pridajte ako novú kartu.</p>'
    +'<div id="dup-list" style="max-height:50vh;overflow-y:auto;margin-bottom:4px"></div>'
    +'<div class="modal-actions">'
    +'<button class="btn" onclick="closeModal(\'modal-duplicate-naradia\');window._pendingNaradiaData=null;">Zrušiť</button>'
    +'<button class="btn btn-warn" onclick="saveNaradiaForced()">+ Pridať ako nové náradie</button>'
    +'</div></div>';
  dupModal.addEventListener('click', function(e){
    if(e.target === dupModal){ dupModal.classList.remove('open'); window._pendingNaradiaData=null; }
  });
  document.body.appendChild(dupModal);
});

})();
