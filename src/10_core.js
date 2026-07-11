'use strict';
/* ==================== CORE: UTILITIES & STORAGE ==================== */

function $(sel){ return document.querySelector(sel); }
function $$(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }

function esc(s){
  if(s===null||s===undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,9); }
function pad2(n){ return (n<10?'0':'')+n; }
function todayStr(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function dayOffset(off){ var d=new Date(); d.setDate(d.getDate()+off); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function nowISO(){ return new Date().toISOString(); }
function round2(n){ return Math.round((+n + Number.EPSILON)*100)/100; }
function round3(n){ return Math.round((+n + Number.EPSILON)*1000)/1000; }
function parseNum(v){
  if(typeof v==='number') return isFinite(v)?v:0;
  if(v===null||v===undefined) return 0;
  var s=String(v).trim().replace(/\s/g,'');
  if(!s) return 0;
  // "1.234.567" hoặc "1,234,567" (phân tách nghìn) / "1234,5" (thập phân kiểu VN)
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s=s.replace(/,/g,'');
  else s=s.replace(',','.');
  var n=parseFloat(s);
  return isFinite(n)?n:0;
}
function fmtMoney(n){ n=Math.round(+n||0); return n.toLocaleString('vi-VN'); }
function fmtQty(n){ n=+n||0; return n.toLocaleString('vi-VN',{maximumFractionDigits:3}); }
function fmtDate(d){ if(!d) return '—'; var p=String(d).slice(0,10).split('-'); return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : d; }
function fmtDateTime(iso){
  if(!iso) return '—';
  var d=new Date(iso);
  return pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad2(d.getHours())+':'+pad2(d.getMinutes());
}
function normStr(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/g,'d').trim(); }

/* ---------- SHA-256 (thuần JS, chạy được cả khi không có crypto.subtle) ---------- */
function sha256(ascii){
  function rightRotate(value, amount){ return (value>>>amount) | (value<<(32-amount)); }
  var mathPow=Math.pow, maxWord=mathPow(2,32), i, j, result='';
  var words=[], asciiBitLength=ascii.length*8;
  var hash=sha256.h=sha256.h||[], k=sha256.k=sha256.k||[];
  var primeCounter=k.length;
  var isComposite={};
  for(var candidate=2; primeCounter<64; candidate++){
    if(!isComposite[candidate]){
      for(i=0;i<313;i+=candidate){ isComposite[i]=candidate; }
      hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii+='\x80';
  while(ascii.length%64-56) ascii+='\x00';
  for(i=0;i<ascii.length;i++){
    j=ascii.charCodeAt(i);
    if(j>>8) return null;
    words[i>>2] |= j << ((3-i)%4)*8;
  }
  words[words.length]=((asciiBitLength/maxWord)|0);
  words[words.length]=(asciiBitLength);
  for(j=0;j<words.length;){
    var w=words.slice(j,j+=16);
    var oldHash=hash;
    hash=hash.slice(0,8);
    for(i=0;i<64;i++){
      var w15=w[i-15], w2=w[i-2];
      var a=hash[0], e=hash[4];
      var temp1=hash[7]
        + (rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))
        + ((e&hash[5])^((~e)&hash[6]))
        + k[i]
        + (w[i]=(i<16)?w[i]:( w[i-16] + (rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3)) + w[i-7] + (rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10)) )|0);
      var temp2=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22)) + ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(temp1+temp2)|0].concat(hash);
      hash[4]=(hash[4]+temp1)|0;
    }
    for(i=0;i<8;i++){ hash[i]=(hash[i]+oldHash[i])|0; }
  }
  for(i=0;i<8;i++){
    for(j=3;j+1;j--){
      var b=(hash[i]>>(j*8))&255;
      result += ((b<16)?0:'') + b.toString(16);
    }
  }
  return result;
}
function hashPass(pass){ return sha256(unescape(encodeURIComponent('qlk::'+String(pass)))); }

/* ---------- Đọc số tiền bằng chữ ---------- */
function docSoTien(so){
  var neg = so<0;
  so=Math.round(Math.abs(+so||0));
  if(so===0) return 'Không đồng';
  var chuSo=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
  var donVi=['',' nghìn',' triệu',' tỷ',' nghìn tỷ',' triệu tỷ'];
  function doc3(n, full){
    var tram=Math.floor(n/100), chuc=Math.floor((n%100)/10), dv=n%10, s='';
    if(full || tram>0) s+=chuSo[tram]+' trăm';
    if(chuc>1){
      s+=' '+chuSo[chuc]+' mươi';
      if(dv===1) s+=' mốt'; else if(dv===4) s+=' tư'; else if(dv===5) s+=' lăm'; else if(dv>0) s+=' '+chuSo[dv];
    } else if(chuc===1){
      s+=' mười';
      if(dv===5) s+=' lăm'; else if(dv>0) s+=' '+chuSo[dv];
    } else if(dv>0){
      if(s) s+=' lẻ';
      s+=' '+chuSo[dv];
    }
    return s.trim();
  }
  var groups=[];
  while(so>0){ groups.push(so%1000); so=Math.floor(so/1000); }
  var out='';
  for(var i=groups.length-1;i>=0;i--){
    var g=groups[i];
    if(g>0) out += (out?' ':'') + doc3(g, out!=='') + donVi[i];
  }
  out=(neg?'âm ':'')+out+' đồng';
  return out.charAt(0).toUpperCase()+out.slice(1);
}

/* ---------- Cấu hình ---------- */
var ROLES={ admin:'Quản trị', manager:'Quản lý', staff:'Nhân viên' };
var VTYPES={
  in:        { code:'PN', name:'Nhập kho',            icon:'📥', color:'#16a34a', flow:'+' },
  out:       { code:'PX', name:'Xuất kho',            icon:'📤', color:'#ea580c', flow:'-' },
  transfer:  { code:'CK', name:'Chuyển kho',          icon:'🔁', color:'#2563eb', flow:'~' },
  return_sup:{ code:'TN', name:'Trả hàng NCC',        icon:'↩️', color:'#dc2626', flow:'-' },
  return_cus:{ code:'KT', name:'Khách trả hàng',      icon:'♻️', color:'#7c3aed', flow:'+' },
  adjust:    { code:'KK', name:'Điều chỉnh kiểm kê',  icon:'📋', color:'#0891b2', flow:'~' }
};
/* Phiếu thu / chi (quản lý công nợ) */
var PTYPES={
  receipt: { code:'PT', name:'Phiếu thu', icon:'💰', color:'#16a34a' },
  payment: { code:'PC', name:'Phiếu chi', icon:'💸', color:'#dc2626' }
};

/* ---------- Trạng thái toàn cục ---------- */
var DB=null;
var SESSION=null;
var storageOK=true;
var DB_KEY='qlk_data_v1';

function storageAvailable(){
  try{ localStorage.setItem('__qlk_test','1'); localStorage.removeItem('__qlk_test'); return true; }
  catch(e){ return false; }
}
function loadDB(){
  if(!storageOK) return null;
  try{
    var raw=localStorage.getItem(DB_KEY);
    if(!raw) return null;
    var obj=JSON.parse(raw);
    if(!obj || !obj.users || !obj.products) return null;
    return migrateDB(obj);
  }catch(e){ return null; }
}
function saveDB(){
  if(!DB) return;
  DB.meta.updatedAt=nowISO();
  if(!storageOK) return;
  try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }
  catch(e){
    if(typeof toast==='function') toast('Không lưu được dữ liệu: '+e.message,'error');
  }
}
function defaultDB(){
  return migrateDB({
    meta:{ app:'qlk', version:1, createdAt:nowISO(), updatedAt:nowISO(), demo:false, lastBackupAt:null },
    settings:{ companyName:'', companyAddress:'', companyPhone:'', companyTax:'' },
    users:[{ id:uid(), username:'admin', passHash:hashPass('admin123'), fullName:'Quản trị hệ thống', role:'admin', active:true, createdAt:nowISO() }],
    categories:[], products:[], partners:[], warehouses:[],
    stocks:{}, vouchers:[], payments:[], auditLog:[], counters:{}
  });
}
function migrateDB(obj){
  obj.meta=obj.meta||{app:'qlk',version:1,createdAt:nowISO()};
  obj.settings=obj.settings||{};
  obj.users=obj.users||[]; obj.categories=obj.categories||[]; obj.products=obj.products||[];
  obj.partners=obj.partners||[]; obj.warehouses=obj.warehouses||[];
  obj.stocks=obj.stocks||{}; obj.vouchers=obj.vouchers||[]; obj.payments=obj.payments||[]; obj.auditLog=obj.auditLog||[]; obj.counters=obj.counters||{};
  // Di trú công nợ: phiếu có tiền lập trước khi có tính năng thanh toán (thiếu trường paid)
  // được coi là ĐÃ THANH TOÁN ĐỦ để công nợ khởi điểm bằng 0 (không hồi tố nợ cũ).
  obj.vouchers.forEach(function(v){
    if(v.paid===undefined) v.paid=(v.type==='in'||v.type==='out'||v.type==='return_sup'||v.type==='return_cus') ? (v.total||0) : 0;
  });
  return obj;
}

/* ---------- Nhật ký thao tác ---------- */
function audit(action, detail){
  if(!DB) return;
  DB.auditLog.unshift({ id:uid(), time:nowISO(), username:SESSION?SESSION.username:'hệ thống', action:action, detail:detail||'' });
  if(DB.auditLog.length>3000) DB.auditLog.length=3000;
}

/* ---------- Phân quyền ---------- */
function isAdmin(){ return !!SESSION && SESSION.role==='admin'; }
function isMgr(){ return !!SESSION && (SESSION.role==='admin'||SESSION.role==='manager'); }

/* ---------- Tra cứu nhanh ---------- */
function prodById(id){ return DB.products.find(function(p){return p.id===id;}); }
function whById(id){ return DB.warehouses.find(function(w){return w.id===id;}); }
function partnerById(id){ return DB.partners.find(function(p){return p.id===id;}); }
function catById(id){ return DB.categories.find(function(c){return c.id===id;}); }
function whName(id){ var w=whById(id); return w?w.name:'—'; }
function partnerName(id){ var p=partnerById(id); return p?p.name:'—'; }
function catName(id){ var c=catById(id); return c?c.name:''; }
function activeProducts(){ return DB.products.filter(function(p){return p.active!==false;}); }
function activeWarehouses(){ return DB.warehouses.filter(function(w){return w.active!==false;}); }
function activePartners(type){ return DB.partners.filter(function(p){return p.active!==false && (!type||p.type===type);}); }
