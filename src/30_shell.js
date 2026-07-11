'use strict';
/* ==================== SHELL: NAV, MODAL, TOAST, AUTH ==================== */

/* ---------- Toast ---------- */
function toast(msg, type){
  var root=$('#toast-root'); if(!root) return;
  var el=document.createElement('div');
  el.className='toast '+(type||'info');
  var ic = type==='success'?'✅': type==='error'?'⛔': type==='warn'?'⚠️':'ℹ️';
  el.innerHTML='<span>'+ic+'</span><span>'+esc(msg)+'</span>';
  root.appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(function(){ el.remove(); },320); }, type==='error'?5200:3400);
}

/* ---------- Modal ---------- */
function openModal(opt){
  var root=$('#modal-root'), box=$('#modal-box');
  box.innerHTML=
    '<div class="modal '+(opt.size||'md')+'">'+
      '<div class="modal-head"><b>'+esc(opt.title||'')+'</b><button class="modal-x" onclick="closeModal()">✕</button></div>'+
      '<div class="modal-body">'+(opt.body||'')+'</div>'+
      (opt.footer!==false ? '<div class="modal-foot" id="modal-foot">'+(opt.footer||'<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>')+'</div>' : '')+
    '</div>';
  root.classList.add('open');
  if(opt.onOpen) opt.onOpen();
}
function closeModal(){ $('#modal-root').classList.remove('open'); $('#modal-box').innerHTML=''; }
var _confirmCb=null;
function confirmDlg(title, msg, okLabel, cb, danger){
  _confirmCb=cb;
  openModal({
    title:title, size:'sm',
    body:'<div style="font-size:14px;line-height:1.7">'+msg+'</div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Không</button>'+
           '<button class="btn '+(danger?'btn-danger':'btn-primary')+'" onclick="runConfirm()">'+esc(okLabel||'Đồng ý')+'</button>'
  });
}
function runConfirm(){ var cb=_confirmCb; _confirmCb=null; closeModal(); if(cb) cb(); }

/* ---------- Trang & điều hướng ---------- */
var RENDERERS={};
var CURRENT_PAGE='dashboard';
var PAGES=[
  {group:'TỔNG QUAN'},
  {id:'dashboard',  icon:'📊', title:'Bảng điều khiển'},
  {group:'DANH MỤC'},
  {id:'products',   icon:'📦', title:'Sản phẩm'},
  {id:'partners',   icon:'🤝', title:'Đối tác'},
  {id:'warehouses', icon:'🏬', title:'Kho hàng', roles:['admin','manager']},
  {group:'NGHIỆP VỤ'},
  {id:'stockin',    icon:'📥', title:'Nhập kho'},
  {id:'stockout',   icon:'📤', title:'Xuất kho'},
  {id:'transfer',   icon:'🔁', title:'Chuyển kho'},
  {id:'returns',    icon:'↩️', title:'Trả hàng'},
  {id:'finance',    icon:'💳', title:'Thu chi & Công nợ'},
  {id:'stocktake',  icon:'📋', title:'Kiểm kê', roles:['admin','manager']},
  {group:'THEO DÕI'},
  {id:'inventory',  icon:'🗃️', title:'Tồn kho'},
  {id:'history',    icon:'🕘', title:'Lịch sử phiếu'},
  {id:'reports',    icon:'📈', title:'Báo cáo', roles:['admin','manager']},
  {group:'HỆ THỐNG'},
  {id:'users',      icon:'👥', title:'Người dùng', roles:['admin']},
  {id:'auditlog',   icon:'📜', title:'Nhật ký thao tác', roles:['admin','manager']},
  {id:'system',     icon:'💾', title:'Sao lưu & Cài đặt', roles:['admin']}
];
function can(pageId){
  var pg=PAGES.find(function(p){return p.id===pageId;});
  if(!pg) return false;
  if(!pg.roles) return true;
  return !!SESSION && pg.roles.indexOf(SESSION.role)>=0;
}
function buildNav(){
  var html='';
  PAGES.forEach(function(p){
    if(p.group){ html+='<div class="nav-group">'+p.group+'</div>'; return; }
    if(!can(p.id)) return;
    html+='<div class="nav-item" id="nav-'+p.id+'" onclick="showPage(\''+p.id+'\')"><span class="ic">'+p.icon+'</span><span class="tx">'+p.title+'</span></div>';
  });
  $('#nav').innerHTML=html;
}
function showPage(id, arg){
  if(!can(id)){ toast('Bạn không có quyền truy cập mục này','warn'); return; }
  CURRENT_PAGE=id;
  var pg=PAGES.find(function(p){return p.id===id;});
  $('#page-title').textContent=pg?pg.title:'';
  $$('#nav .nav-item').forEach(function(el){ el.classList.toggle('active', el.id==='nav-'+id); });
  var fn=RENDERERS[id];
  var c=$('#content');
  c.scrollTop=0;
  if(fn) fn(c, arg);
  else c.innerHTML='<div class="card">Đang xây dựng…</div>';
}
function refreshPage(){ showPage(CURRENT_PAGE); }

/* ---------- Menu người dùng ---------- */
function toggleUserMenu(e){
  e.stopPropagation();
  $('#user-menu').classList.toggle('hidden');
}
document.addEventListener('click', function(e){
  var m=$('#user-menu');
  if(m && !m.classList.contains('hidden') && !e.target.closest('.user-chip') && !e.target.closest('#user-menu')) m.classList.add('hidden');
});

/* ---------- Đăng nhập / Đăng xuất ---------- */
function doLogin(){
  var un=($('#login-user').value||'').trim().toLowerCase();
  var pw=$('#login-pass').value||'';
  var err=$('#login-err');
  var u=DB.users.find(function(x){ return x.username.toLowerCase()===un; });
  if(!u || u.passHash!==hashPass(pw)){
    err.textContent='Sai tên đăng nhập hoặc mật khẩu.'; err.classList.remove('hidden');
    audit('Đăng nhập thất bại','Tài khoản: '+un); saveDB();
    return;
  }
  if(u.active===false){
    err.textContent='Tài khoản này đã bị khóa. Liên hệ quản trị viên.'; err.classList.remove('hidden');
    return;
  }
  err.classList.add('hidden');
  SESSION=u;
  try{ sessionStorage.setItem('qlk_session', u.id); }catch(e){}
  audit('Đăng nhập',''); saveDB();
  enterApp();
}
function doLogout(msg){
  if(SESSION){ audit('Đăng xuất',''); saveDB(); }
  SESSION=null;
  try{ sessionStorage.removeItem('qlk_session'); }catch(e){}
  $('#user-menu').classList.add('hidden');
  $('#app').classList.add('hidden');
  $('#login-screen').classList.remove('hidden');
  $('#login-pass').value='';
  if(typeof msg==='string' && msg){ var er=$('#login-err'); er.textContent=msg; er.classList.remove('hidden'); }
}
function enterApp(){
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  var name=SESSION.fullName||SESSION.username;
  $('#user-name').textContent=name;
  $('#user-role').textContent=ROLES[SESSION.role]||SESSION.role;
  $('#user-avatar').textContent=name.trim().charAt(0).toUpperCase();
  buildNav();
  showPage('dashboard');
}
function changePassModal(){
  $('#user-menu').classList.add('hidden');
  openModal({
    title:'Đổi mật khẩu', size:'sm',
    body:
      '<div class="field"><label>Mật khẩu hiện tại</label><input type="password" id="cp-old"></div>'+
      '<div class="field"><label>Mật khẩu mới (tối thiểu 4 ký tự)</label><input type="password" id="cp-new"></div>'+
      '<div class="field"><label>Nhập lại mật khẩu mới</label><input type="password" id="cp-new2"></div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-primary" onclick="doChangePass()">Lưu mật khẩu</button>'
  });
}
function doChangePass(){
  var o=$('#cp-old').value, n=$('#cp-new').value, n2=$('#cp-new2').value;
  if(SESSION.passHash!==hashPass(o)) return toast('Mật khẩu hiện tại không đúng','error');
  if(n.length<4) return toast('Mật khẩu mới phải có ít nhất 4 ký tự','error');
  if(n!==n2) return toast('Mật khẩu nhập lại không khớp','error');
  SESSION.passHash=hashPass(n);
  audit('Đổi mật khẩu',''); saveDB();
  closeModal(); toast('Đã đổi mật khẩu thành công','success');
}

/* ---------- Cập nhật tên công ty trên giao diện ---------- */
function applySettingsUI(){
  var name=(DB.settings.companyName||'').trim();
  $('#brand-company').textContent=name||'Nội bộ';
  $('#login-company').textContent=name||'Phần mềm quản lý kho nội bộ';
}

/* ---------- Khởi động ---------- */
function boot(){
  storageOK=storageAvailable();
  if(!storageOK){
    $('#storage-warn').classList.remove('hidden');
    $('#login-storage-warn').classList.remove('hidden');
  }
  DB=loadDB();
  if(!DB){
    DB=defaultDB();
    seedDemo();
    saveDB();
  }
  applySettingsUI();
  // Gợi ý tài khoản: chỉ hiện khi admin còn dùng mật khẩu mặc định
  var admin=DB.users.find(function(u){return u.username==='admin';});
  if(admin && admin.passHash===hashPass('admin123')) $('#login-demo').classList.remove('hidden');
  // Enter để đăng nhập
  ['#login-user','#login-pass'].forEach(function(s){
    $(s).addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  });
  // Khôi phục phiên
  var sid=null;
  try{ sid=sessionStorage.getItem('qlk_session'); }catch(e){}
  var u=sid ? DB.users.find(function(x){return x.id===sid && x.active!==false;}) : null;
  if(u){ SESSION=u; enterApp(); }
}
document.addEventListener('DOMContentLoaded', boot);
