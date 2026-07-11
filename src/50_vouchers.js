'use strict';
/* ==================== PHIẾU: NHẬP / XUẤT / CHUYỂN / TRẢ / KIỂM KÊ ==================== */

var VF=null; // trạng thái form phiếu đang soạn

function typePage(t){ return t==='in'?'stockin':t==='out'?'stockout':t==='transfer'?'transfer':(t==='return_sup'||t==='return_cus')?'returns':'history'; }
function vfNeedsStock(t){ return t==='out'||t==='transfer'||t==='return_sup'; }
function vfHasPrice(t){ return t!=='transfer'; }
function vfPartnerType(t){ return (t==='in'||t==='return_sup')?'supplier':(t==='out'||t==='return_cus')?'customer':null; }

/* ---------- Danh sách phiếu theo loại ---------- */
function partnerColLabel(types){
  if(types.length===1){
    var pt=vfPartnerType(types[0]);
    if(pt==='supplier') return 'Nhà cung cấp';
    if(pt==='customer') return 'Khách hàng';
  }
  return 'Đối tác';
}
function voucherTable(types, limit){
  var list=DB.vouchers.filter(function(v){ return types.indexOf(v.type)>=0; }).slice(0,limit||30);
  var rows=list.map(function(v){
    var vt=VTYPES[v.type];
    var isVoid=v.status==='void';
    return '<tr class="click" onclick="voucherDetail(\''+v.id+'\')">'+
      '<td><span class="badge" style="background:'+vt.color+'1a;color:'+vt.color+'">'+vt.icon+' '+esc(v.code)+'</span></td>'+
      '<td>'+fmtDate(v.date)+'</td>'+
      '<td>'+esc(whName(v.warehouseId))+(v.type==='transfer'?' → '+esc(whName(v.toWarehouseId)):'')+'</td>'+
      '<td>'+(v.partnerId?esc(partnerName(v.partnerId)):'<span class="muted">—</span>')+'</td>'+
      '<td class="r">'+v.lines.length+'</td>'+
      '<td class="r"'+(isVoid?' style="text-decoration:line-through"':'')+'><b>'+fmtMoney(v.total)+'</b></td>'+
      '<td class="muted">'+esc(v.createdBy)+'</td>'+
      '<td class="c">'+(isVoid?'<span class="tag tag-red">Đã hủy</span>':'<span class="tag tag-green">Đã ghi sổ</span>')+'</td>'+
    '</tr>';
  }).join('');
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr>'+
    '<th>Số phiếu</th><th>Ngày</th><th>Kho</th><th>'+partnerColLabel(types)+'</th><th class="r">Dòng</th><th class="r">Tổng tiền (đ)</th><th>Người lập</th><th class="c">Trạng thái</th>'+
    '</tr></thead><tbody>'+(rows||'<tr><td colspan="8"><div class="empty">Chưa có phiếu nào</div></td></tr>')+'</tbody></table></div>'+
    '<div class="pagin">Hiển thị '+Math.min(list.length,limit||30)+' phiếu gần nhất — xem tất cả trong mục <a href="javascript:showPage(\'history\')">Lịch sử phiếu</a></div>';
}
function bizPage(c, type, introHTML){
  var vt=VTYPES[type];
  c.innerHTML=
    '<div class="toolbar">'+
      '<div class="grow" style="font-size:13px;color:var(--muted)">'+(introHTML||'')+'</div>'+
      '<div class="toolbar-right"><button class="btn btn-primary" onclick="openVoucherForm(\''+type+'\')">＋ Tạo '+vt.name.toLowerCase()+'</button></div>'+
    '</div>'+voucherTable([type]);
}
RENDERERS.stockin=function(c){ bizPage(c,'in','Ghi nhận hàng hóa nhập vào kho từ nhà cung cấp. Giá vốn được cập nhật tự động theo bình quân gia quyền.'); };
RENDERERS.stockout=function(c){ bizPage(c,'out','Ghi nhận hàng xuất bán / xuất sử dụng. Hệ thống tự kiểm tra tồn kho và chốt giá vốn để tính lợi nhuận.'); };
RENDERERS.transfer=function(c){ bizPage(c,'transfer','Chuyển hàng giữa hai kho nội bộ — tổng tồn toàn công ty không đổi.'); };

var RETF={tab:'return_sup'};
RENDERERS.returns=function(c){
  var t=RETF.tab;
  c.innerHTML=
    '<div class="tabs">'+
      '<div class="tab '+(t==='return_sup'?'active':'')+'" onclick="RETF.tab=\'return_sup\';refreshPage()">↩️ Trả hàng nhà cung cấp</div>'+
      '<div class="tab '+(t==='return_cus'?'active':'')+'" onclick="RETF.tab=\'return_cus\';refreshPage()">♻️ Khách trả hàng</div>'+
    '</div>'+
    '<div class="toolbar">'+
      '<div class="grow" style="font-size:13px;color:var(--muted)">'+(t==='return_sup'?'Xuất trả hàng lỗi/thừa cho nhà cung cấp — giảm tồn kho.':'Nhận lại hàng khách trả — tăng tồn kho, trừ doanh thu trong báo cáo lợi nhuận.')+'</div>'+
      '<div class="toolbar-right"><button class="btn btn-primary" onclick="openVoucherForm(\''+t+'\')">＋ Tạo phiếu '+(t==='return_sup'?'trả NCC':'khách trả')+'</button></div>'+
    '</div>'+voucherTable([t]);
};

/* ---------- FORM LẬP PHIẾU ---------- */
function openVoucherForm(type, editId){
  var vt=VTYPES[type]; if(!vt) return;
  var editV=editId ? DB.vouchers.find(function(x){return x.id===editId;}) : null;
  if(editId && !editV) return toast('Không tìm thấy phiếu cần sửa','error');
  if(editV){
    if(!isMgr()) return toast('Chỉ Quản lý / Quản trị mới được sửa phiếu','warn');
    if(editV.status==='void') return toast('Phiếu đã hủy — không thể sửa','warn');
    if(editV.type==='adjust') return toast('Phiếu điều chỉnh kiểm kê không sửa được — hãy hủy/xóa phiếu rồi kiểm kê lại','warn');
    type=editV.type; vt=VTYPES[type];
  }
  if(!activeWarehouses().length){ toast('Chưa có kho nào — hãy tạo kho trong mục "Kho hàng" trước','warn'); if(can('warehouses')) showPage('warehouses'); return; }
  if(type==='transfer' && !editV && activeWarehouses().length<2){ toast('Cần ít nhất 2 kho để chuyển kho','warn'); return; }
  if(!activeProducts().length && !editV){ toast('Chưa có sản phẩm nào — hãy thêm sản phẩm trước','warn'); showPage('products'); return; }

  var preLines=[];
  if(editV){
    var dropped=0;
    editV.lines.forEach(function(l){
      if(prodById(l.productId)) preLines.push({productId:l.productId, qty:l.qty, price:l.price});
      else dropped++;
    });
    if(dropped) toast(dropped+' dòng hàng bị bỏ qua do sản phẩm đã bị xóa khỏi danh mục','warn');
  }
  VF={type:type, lines:preLines, editId:editV?editV.id:null};

  var whs=activeWarehouses().slice();
  if(editV && !whs.some(function(w){return w.id===editV.warehouseId;}) && whById(editV.warehouseId)) whs.unshift(whById(editV.warehouseId));
  if(editV && editV.toWarehouseId && !whs.some(function(w){return w.id===editV.toWarehouseId;}) && whById(editV.toWarehouseId)) whs.push(whById(editV.toWarehouseId));
  var pt=vfPartnerType(type);
  var partners=pt?activePartners(pt).slice():[];
  if(editV && editV.partnerId && pt && !partners.some(function(p){return p.id===editV.partnerId;}) && partnerById(editV.partnerId)) partners.unshift(partnerById(editV.partnerId));
  var selWh=editV?editV.warehouseId:whs[0].id;
  var selToWh=editV?editV.toWarehouseId:(whs[1]?whs[1].id:null);
  var whLabel=type==='in'||type==='return_cus'?'Kho nhập':type==='transfer'?'Kho xuất (nguồn)':'Kho xuất';
  var c=$('#content');
  $('#page-title').textContent=(editV?'Sửa ':'Tạo ')+vt.name.toLowerCase();
  $$('#nav .nav-item').forEach(function(el){ el.classList.toggle('active', el.id==='nav-'+typePage(type)); });
  CURRENT_PAGE=typePage(type);
  c.scrollTop=0;
  c.innerHTML=
  '<div class="card">'+
    '<div class="card-title"><span>'+(editV?'✏️ Sửa phiếu <b>'+esc(editV.code)+'</b>':vt.icon+' '+vt.name)+' <span class="muted small" style="font-weight:400">'+(editV?'— số phiếu giữ nguyên, tồn kho sẽ được tính lại theo nội dung mới':'— số phiếu cấp tự động khi lưu')+'</span></span>'+
    '<button class="btn btn-sm btn-ghost" onclick="showPage(\''+typePage(type)+'\')">← Quay lại</button></div>'+
    (editV&&type==='in'?'<div class="banner banner-warn" style="margin-bottom:12px">💡 Sửa phiếu nhập sẽ tính lại giá vốn bình quân tại thời điểm lưu (không hồi tố các phiếu xuất đã lập trước đó).</div>':'')+
    '<div class="form-grid">'+
      '<div class="field"><label>Ngày chứng từ <span class="req">*</span></label><input type="date" id="vf-date" value="'+(editV?editV.date:todayStr())+'"></div>'+
      '<div class="field"><label>'+whLabel+' <span class="req">*</span></label><select id="vf-wh" onchange="renderVFLines()">'+whs.map(function(w){return '<option value="'+w.id+'" '+(w.id===selWh?'selected':'')+'>'+esc(w.name)+'</option>';}).join('')+'</select></div>'+
      (type==='transfer'?'<div class="field"><label>Kho nhận (đích) <span class="req">*</span></label><select id="vf-towh">'+whs.map(function(w){return '<option value="'+w.id+'" '+(w.id===selToWh?'selected':'')+'>'+esc(w.name)+'</option>';}).join('')+'</select></div>':'')+
      (pt?'<div class="field"><label>'+(pt==='supplier'?'Nhà cung cấp':'Khách hàng')+'</label><select id="vf-partner"><option value="">— Không chọn —</option>'+partners.map(function(p){return '<option value="'+p.id+'" '+(editV&&editV.partnerId===p.id?'selected':'')+'>'+esc(p.name)+'</option>';}).join('')+'</select></div>':'')+
      '<div class="field"><label>Ghi chú</label><input id="vf-note" placeholder="Diễn giải…" value="'+esc(editV?editV.note:'')+'"></div>'+
    '</div>'+
  '</div>'+
  '<div class="card">'+
    '<div class="card-title">Danh sách hàng hóa</div>'+
    '<div class="prod-search" style="margin-bottom:12px;max-width:520px">'+
      '<input id="vf-search" placeholder="🔍 Gõ tên hoặc mã sản phẩm để thêm vào phiếu…" autocomplete="off">'+
      '<div id="vf-search-dd" class="dropdown hidden"></div>'+
    '</div>'+
    '<div id="vf-lines"></div>'+
  '</div>'+
  '<div style="display:flex;gap:10px;justify-content:flex-end">'+
    '<button class="btn btn-ghost" onclick="showPage(\''+typePage(type)+'\')">Hủy bỏ</button>'+
    '<button class="btn btn-ghost" onclick="saveVoucher(true)">💾 Lưu &amp; In phiếu</button>'+
    '<button class="btn btn-primary" onclick="saveVoucher(false)">'+(editV?'💾 Lưu thay đổi':'💾 Lưu phiếu')+'</button>'+
  '</div>';
  vfBindSearch();
  renderVFLines();
  $('#vf-search').focus();
}
function vfBindSearch(){
  var inp=$('#vf-search'), dd=$('#vf-search-dd');
  inp.addEventListener('input', function(){
    var q=normStr(inp.value);
    if(!q){ dd.classList.add('hidden'); return; }
    var whId=$('#vf-wh').value;
    var list=activeProducts().filter(function(p){
      return normStr(p.name).indexOf(q)>=0 || normStr(p.sku).indexOf(q)>=0 || normStr(p.brand).indexOf(q)>=0;
    }).slice(0,8);
    dd.innerHTML=list.length?list.map(function(p){
      var st=vfNeedsStock(VF.type)?getStock(whId,p.id):totalStock(p.id);
      return '<div class="dd-item" onmousedown="vfPick(\''+p.id+'\')"><div><b>'+esc(p.name)+'</b> <span class="muted small">· '+esc(p.sku)+(p.brand?' · '+esc(p.brand):'')+'</span></div><div class="muted small">Tồn: '+fmtQty(st)+' '+esc(p.unit)+'</div></div>';
    }).join(''):'<div class="dd-empty">Không tìm thấy sản phẩm phù hợp</div>';
    dd.classList.remove('hidden');
  });
  inp.addEventListener('keydown', function(e){
    if(e.key==='Enter'){ e.preventDefault(); var first=dd.querySelector('.dd-item'); if(first) first.click(); }
    if(e.key==='Escape') dd.classList.add('hidden');
  });
  inp.addEventListener('blur', function(){ setTimeout(function(){ dd.classList.add('hidden'); },200); });
}
function vfDefaultPrice(p){
  var t=VF.type;
  if(t==='in'||t==='return_sup') return p.costPrice||0;
  if(t==='out'||t==='return_cus') return p.salePrice||0;
  return 0;
}
function vfPick(pid){
  var p=prodById(pid); if(!p) return;
  var ex=VF.lines.find(function(l){return l.productId===pid;});
  if(ex) ex.qty=round3(ex.qty+1);
  else VF.lines.push({productId:pid, qty:1, price:vfDefaultPrice(p)});
  $('#vf-search').value='';
  $('#vf-search-dd').classList.add('hidden');
  renderVFLines();
  $('#vf-search').focus();
}
function vfSetQty(i,val){ if(VF.lines[i]){ VF.lines[i].qty=parseNum(val); vfUpdateCalc(); } }
function vfSetPrice(i,val){ if(VF.lines[i]){ VF.lines[i].price=parseNum(val); vfUpdateCalc(); } }
function vfRemove(i){ VF.lines.splice(i,1); renderVFLines(); }
function vfUpdateCalc(){
  var whId=$('#vf-wh').value, hasPrice=vfHasPrice(VF.type), total=0;
  VF.lines.forEach(function(l,i){
    var amt=l.qty*(hasPrice?l.price:0); total+=amt;
    var amtEl=$('#vfl-amt-'+i); if(amtEl) amtEl.textContent=fmtMoney(amt);
    if(vfNeedsStock(VF.type)){
      var st=getStock(whId,l.productId);
      var qEl=$('#vfl-qty-'+i);
      if(qEl) qEl.style.borderColor = l.qty>st ? 'var(--red)' : '';
      var stEl=$('#vfl-st-'+i);
      if(stEl) stEl.className='r '+(l.qty>st?'num-neg':'muted');
    }
  });
  var tEl=$('#vf-total'); if(tEl) tEl.textContent=fmtMoney(total);
}
function renderVFLines(){
  var box=$('#vf-lines'); if(!box||!VF) return;
  var t=VF.type, whId=$('#vf-wh').value;
  var needSt=vfNeedsStock(t), hasPrice=vfHasPrice(t);
  if(!VF.lines.length){
    box.innerHTML='<div class="empty">Chưa có dòng hàng nào — tìm sản phẩm ở ô phía trên để thêm vào phiếu</div>';
    return;
  }
  var total=0;
  var rows=VF.lines.map(function(l,i){
    var p=prodById(l.productId);
    var st=getStock(whId,l.productId);
    var amt=l.qty*(hasPrice?l.price:0); total+=amt;
    var over=needSt && l.qty>st;
    return '<tr>'+
      '<td class="c muted">'+(i+1)+'</td>'+
      '<td><b>'+esc(p.name)+'</b><div class="small muted">'+esc(p.sku)+'</div></td>'+
      '<td class="c">'+esc(p.unit)+'</td>'+
      (needSt?'<td id="vfl-st-'+i+'" class="r '+(over?'num-neg':'muted')+'">'+fmtQty(st)+'</td>':'')+
      '<td style="width:110px"><input type="number" step="any" min="0" id="vfl-qty-'+i+'" value="'+l.qty+'" style="text-align:right'+(over?';border-color:var(--red)':'')+'" oninput="vfSetQty('+i+',this.value)"></td>'+
      (hasPrice?'<td style="width:140px"><input type="number" step="any" min="0" value="'+l.price+'" style="text-align:right" oninput="vfSetPrice('+i+',this.value)"></td>':'')+
      (hasPrice?'<td class="r" id="vfl-amt-'+i+'"><b>'+fmtMoney(amt)+'</b></td>':'')+
      '<td class="c"><button class="btn btn-xs btn-danger" onclick="vfRemove('+i+')">✕</button></td>'+
    '</tr>';
  }).join('');
  box.innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr>'+
    '<th class="c" style="width:36px">#</th><th>Sản phẩm</th><th class="c">ĐVT</th>'+
    (needSt?'<th class="r">Tồn tại kho</th>':'')+
    '<th class="r">Số lượng</th>'+
    (hasPrice?'<th class="r">Đơn giá (đ)</th><th class="r">Thành tiền (đ)</th>':'')+
    '<th class="c" style="width:50px"></th>'+
    '</tr></thead><tbody>'+rows+'</tbody>'+
    (hasPrice?'<tfoot><tr><td colspan="'+(needSt?6:5)+'" class="r">TỔNG CỘNG</td><td class="r" id="vf-total" style="font-size:15px;color:var(--primary)">'+fmtMoney(total)+'</td><td></td></tr></tfoot>':'')+
    '</table></div>';
}
function saveVoucher(doPrint){
  if(!VF) return;
  var inp={
    type:VF.type,
    date:$('#vf-date').value,
    warehouseId:$('#vf-wh').value,
    toWarehouseId:$('#vf-towh')?$('#vf-towh').value:null,
    partnerId:$('#vf-partner')?($('#vf-partner').value||null):null,
    note:($('#vf-note').value||'').trim(),
    lines:VF.lines
  };
  if(!inp.date) return toast('Chọn ngày chứng từ','error');
  var res=VF.editId ? updateVoucher(VF.editId, inp) : postVoucher(inp);
  if(!res.ok) return toast(res.error,'error');
  toast((VF.editId?'Đã cập nhật ':'Đã lưu ')+VTYPES[inp.type].name.toLowerCase()+' số '+res.voucher.code,'success');
  var pg=typePage(inp.type);
  VF=null;
  showPage(pg);
  if(doPrint) printVoucher(res.voucher.id);
}

/* ---------- CHI TIẾT PHIẾU ---------- */
function voucherDetail(id){
  var v=DB.vouchers.find(function(x){return x.id===id;}); if(!v) return;
  var vt=VTYPES[v.type];
  var hasPrice=vfHasPrice(v.type) && v.type!=='adjust';
  var isAdj=v.type==='adjust';
  var rows=v.lines.map(function(l,i){
    return '<tr>'+
      '<td class="c muted">'+(i+1)+'</td>'+
      '<td>'+esc(l.name)+'<div class="small muted">'+esc(l.sku)+'</div></td>'+
      '<td class="c">'+esc(l.unit)+'</td>'+
      '<td class="r '+(isAdj?(l.qty>=0?'num-pos':'num-neg'):'')+'">'+(isAdj&&l.qty>0?'+':'')+fmtQty(l.qty)+'</td>'+
      (hasPrice?'<td class="r">'+fmtMoney(l.price)+'</td><td class="r"><b>'+fmtMoney(l.qty*l.price)+'</b></td>':'')+
      (v.type==='out'?'<td class="r muted">'+fmtMoney(l.cost)+'</td><td class="r '+((l.price-l.cost)>=0?'num-pos':'num-neg')+'">'+fmtMoney((l.price-l.cost)*l.qty)+'</td>':'')+
    '</tr>';
  }).join('');
  var info=
    '<div class="form-grid" style="margin-bottom:14px">'+
      '<div><div class="small muted">Ngày chứng từ</div><b>'+fmtDate(v.date)+'</b></div>'+
      '<div><div class="small muted">'+(v.type==='transfer'?'Kho xuất → Kho nhận':'Kho')+'</div><b>'+esc(whName(v.warehouseId))+(v.type==='transfer'?' → '+esc(whName(v.toWarehouseId)):'')+'</b></div>'+
      (v.partnerId?'<div><div class="small muted">'+(vfPartnerType(v.type)==='supplier'?'Nhà cung cấp':'Khách hàng')+'</div><b>'+esc(partnerName(v.partnerId))+'</b></div>':'')+
      '<div><div class="small muted">Người lập</div><b>'+esc(v.createdBy)+'</b> <span class="small muted">'+fmtDateTime(v.createdAt)+'</span></div>'+
      (v.editedAt?'<div><div class="small muted">Sửa lần cuối</div><b>'+esc(v.editedBy||'')+'</b> <span class="small muted">'+fmtDateTime(v.editedAt)+'</span></div>':'')+
    '</div>'+
    (v.note?'<div style="margin-bottom:12px" class="small">📝 '+esc(v.note)+'</div>':'')+
    (v.status==='void'?'<div class="banner banner-warn" style="margin-bottom:12px">⛔ Phiếu này đã bị hủy bởi <b>'+esc(v.voidedBy||'')+'</b> lúc '+fmtDateTime(v.voidedAt)+' — không còn tác động lên tồn kho.</div>':'');
  var profit=0;
  if(v.type==='out'){ v.lines.forEach(function(l){ profit+=(l.price-l.cost)*l.qty; }); }
  openModal({
    title:vt.icon+' '+vt.name+' — '+v.code, size:'lg',
    body: info+
      '<div class="tbl-wrap"><table class="tbl"><thead><tr>'+
      '<th class="c">#</th><th>Sản phẩm</th><th class="c">ĐVT</th><th class="r">'+(isAdj?'Chênh lệch':'Số lượng')+'</th>'+
      (hasPrice?'<th class="r">Đơn giá</th><th class="r">Thành tiền</th>':'')+
      (v.type==='out'?'<th class="r">Giá vốn</th><th class="r">Lợi nhuận</th>':'')+
      '</tr></thead><tbody>'+rows+'</tbody>'+
      (hasPrice?'<tfoot><tr><td colspan="4" class="r">TỔNG CỘNG</td><td></td><td class="r" style="color:var(--primary)">'+fmtMoney(v.total)+'</td>'+(v.type==='out'?'<td></td><td class="r '+(profit>=0?'num-pos':'num-neg')+'">'+fmtMoney(profit)+'</td>':'')+'</tr></tfoot>':'')+
      '</table></div>',
    footer:
      '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'+
      (isAdmin()?'<button class="btn btn-danger" onclick="askDeleteVoucher(\''+v.id+'\')">🗑️ Xóa phiếu</button>':'')+
      (v.status!=='void' && isMgr()?'<button class="btn btn-danger" onclick="askVoidVoucher(\''+v.id+'\')">⛔ Hủy phiếu</button>':'')+
      (v.status!=='void' && isMgr() && v.type!=='adjust'?'<button class="btn btn-ghost" onclick="closeModal();openVoucherForm(\''+v.type+'\',\''+v.id+'\')">✏️ Sửa phiếu</button>':'')+
      (v.status!=='void'?'<button class="btn btn-primary" onclick="printVoucher(\''+v.id+'\')">🖨️ In phiếu</button>':'')
  });
}
function askVoidVoucher(id){
  var v=DB.vouchers.find(function(x){return x.id===id;}); if(!v) return;
  confirmDlg('Hủy phiếu '+v.code,'Hủy phiếu sẽ <b>hoàn tác toàn bộ tác động tồn kho</b> của phiếu này (giá vốn bình quân hiện tại giữ nguyên). Phiếu vẫn được giữ trong lịch sử với trạng thái "Đã hủy" để tra cứu.<br><br>Bạn chắc chắn muốn hủy?','Hủy phiếu',function(){
    var res=voidVoucher(id);
    if(!res.ok) return toast(res.error,'error');
    toast('Đã hủy phiếu '+v.code,'success');
    refreshPage();
  }, true);
}
function askDeleteVoucher(id){
  if(!isAdmin()) return toast('Chỉ Quản trị viên mới được xóa phiếu','warn');
  var v=DB.vouchers.find(function(x){return x.id===id;}); if(!v) return;
  var msg = v.status==='void'
    ? 'Phiếu <b>'+esc(v.code)+'</b> đã hủy trước đó (tồn kho đã hoàn tác). Xóa sẽ <b>gỡ vĩnh viễn phiếu khỏi lịch sử</b> — không thể khôi phục.<br><br>Bạn chắc chắn muốn xóa?'
    : 'Xóa phiếu <b>'+esc(v.code)+'</b> sẽ <b>hoàn tác toàn bộ tác động tồn kho</b> rồi <b>gỡ vĩnh viễn phiếu khỏi lịch sử</b> — không thể khôi phục và số phiếu này sẽ bị khuyết.<br><br>💡 Nếu chỉ cần vô hiệu phiếu, nên dùng <b>Hủy phiếu</b> để giữ dấu vết sổ sách. Chỉ xóa với phiếu tạo nhầm / phiếu rác.<br><br>Bạn chắc chắn muốn xóa vĩnh viễn?';
  confirmDlg('🗑️ Xóa phiếu '+v.code, msg, 'Xóa vĩnh viễn', function(){
    var res=deleteVoucher(id);
    if(!res.ok) return toast(res.error,'error');
    toast('Đã xóa phiếu '+v.code+(v.status!=='void'?' và hoàn tác tồn kho':''),'success');
    refreshPage();
  }, true);
}

/* ---------- IN PHIẾU ---------- */
function printVoucher(id){
  var v=typeof id==='string'?DB.vouchers.find(function(x){return x.id===id;}):id;
  if(!v) return;
  var s=DB.settings||{};
  var titles={in:'PHIẾU NHẬP KHO', out:'PHIẾU XUẤT KHO', transfer:'PHIẾU CHUYỂN KHO', return_sup:'PHIẾU XUẤT TRẢ HÀNG NCC', return_cus:'PHIẾU NHẬP HÀNG KHÁCH TRẢ', adjust:'PHIẾU ĐIỀU CHỈNH KIỂM KÊ'};
  var hasPrice=vfHasPrice(v.type)&&v.type!=='adjust';
  var d=v.date.split('-');
  var rows=v.lines.map(function(l,i){
    return '<tr><td class="c">'+(i+1)+'</td><td class="c">'+esc(l.sku)+'</td><td>'+esc(l.name)+'</td><td class="c">'+esc(l.unit)+'</td>'+
      '<td class="r">'+(v.type==='adjust'&&l.qty>0?'+':'')+fmtQty(l.qty)+'</td>'+
      (hasPrice?'<td class="r">'+fmtMoney(l.price)+'</td><td class="r">'+fmtMoney(l.qty*l.price)+'</td>':'')+
      '</tr>';
  }).join('');
  var pt=vfPartnerType(v.type);
  var info='';
  if(pt) info+='<div>'+(pt==='supplier'?'Nhà cung cấp':'Khách hàng')+': <b>'+esc(v.partnerId?partnerName(v.partnerId):'.................................................')+'</b></div>';
  if(v.type==='transfer') info+='<div>Kho xuất: <b>'+esc(whName(v.warehouseId))+'</b> &nbsp;&nbsp;—&nbsp;&nbsp; Kho nhận: <b>'+esc(whName(v.toWarehouseId))+'</b></div>';
  else info+='<div>'+(VTYPES[v.type].flow==='+'?'Nhập tại kho':'Xuất tại kho')+': <b>'+esc(whName(v.warehouseId))+'</b>'+(whById(v.warehouseId)&&whById(v.warehouseId).address?' — '+esc(whById(v.warehouseId).address):'')+'</div>';
  if(v.note) info+='<div>Diễn giải: '+esc(v.note)+'</div>';
  var signs = v.type==='transfer'
    ? ['Người lập phiếu','Thủ kho xuất','Người vận chuyển','Thủ kho nhận']
    : v.type==='adjust'
    ? ['Người lập phiếu','Thủ kho','Kế toán','Giám đốc']
    : ['Người lập phiếu', (VTYPES[v.type].flow==='+'?'Người giao hàng':'Người nhận hàng'),'Thủ kho','Kế toán'];
  $('#print-area').innerHTML=
  '<div class="pv">'+
    '<div class="pv-head">'+
      '<div class="co"><b>'+esc(s.companyName||'CÔNG TY')+'</b><br>'+esc(s.companyAddress||'')+(s.companyPhone?'<br>ĐT: '+esc(s.companyPhone):'')+(s.companyTax?'<br>MST: '+esc(s.companyTax):'')+'</div>'+
      '<div style="text-align:right">Số: <b>'+esc(v.code)+'</b><br><i>Ngày '+d[2]+' tháng '+d[1]+' năm '+d[0]+'</i></div>'+
    '</div>'+
    '<h1>'+titles[v.type]+'</h1>'+
    '<div class="pv-code">Người lập: '+esc(v.createdBy)+(v.status==='void'?' — <b>PHIẾU ĐÃ HỦY</b>':'')+'</div>'+
    '<div class="pv-info">'+info+'</div>'+
    '<table><thead><tr><th style="width:36px">STT</th><th style="width:80px">Mã hàng</th><th>Tên hàng hóa</th><th style="width:56px">ĐVT</th><th style="width:90px">'+(v.type==='adjust'?'Chênh lệch':'Số lượng')+'</th>'+
    (hasPrice?'<th style="width:100px">Đơn giá (đ)</th><th style="width:120px">Thành tiền (đ)</th>':'')+
    '</tr></thead><tbody>'+rows+
    (hasPrice?'<tr><td colspan="6" class="r"><b>TỔNG CỘNG</b></td><td class="r"><b>'+fmtMoney(v.total)+'</b></td></tr>':'')+
    '</tbody></table>'+
    (hasPrice?'<div class="pv-words">Bằng chữ: <b>'+docSoTien(v.total)+'</b></div>':'<div style="height:12px"></div>')+
    '<div class="pv-sign">'+signs.map(function(sg){return '<div><b>'+sg+'</b><i>(Ký, họ tên)</i><div class="sp"></div></div>';}).join('')+'</div>'+
  '</div>';
  window.print();
}

/* ---------- KIỂM KÊ ---------- */
var ST={whId:null, counts:{}, q:'', onlyStock:true};
RENDERERS.stocktake=function(c){
  var whs=activeWarehouses();
  if(!whs.length){ c.innerHTML='<div class="card"><div class="empty">Chưa có kho nào — hãy tạo kho trước khi kiểm kê</div></div>'; return; }
  if(!ST.whId || !whById(ST.whId)) ST.whId=whs[0].id;
  c.innerHTML=
  '<div class="card" style="padding:12px 16px;font-size:13px">📋 <b>Kiểm kê kho:</b> nhập số lượng <b>thực đếm</b> cho các mặt hàng có chênh lệch so với sổ sách, sau đó bấm <b>Tạo phiếu điều chỉnh</b>. Tồn kho sẽ được điều chỉnh đúng bằng số thực đếm, có lưu vết đầy đủ.</div>'+
  '<div class="toolbar">'+
    '<div class="field"><label>Kho kiểm kê</label><select id="st-wh" onchange="stWhChange()">'+whs.map(function(w){return '<option value="'+w.id+'" '+(ST.whId===w.id?'selected':'')+'>'+esc(w.name)+'</option>';}).join('')+'</select></div>'+
    '<div class="field grow"><label>Tìm kiếm</label><input id="st-q" placeholder="Tên hoặc mã sản phẩm…" value="'+esc(ST.q)+'"></div>'+
    '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-weight:500;margin:0;padding:8px 0"><input type="checkbox" id="st-only" '+(ST.onlyStock?'checked':'')+' onchange="ST.onlyStock=this.checked;stRows()"> Chỉ hàng có tồn</label></div>'+
    '<div class="toolbar-right"><button class="btn btn-primary" onclick="stCreateAdjust()" id="st-btn">📋 Tạo phiếu điều chỉnh (0)</button></div>'+
  '</div>'+
  '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr><th>Mã</th><th>Tên sản phẩm</th><th class="c">ĐVT</th><th class="r">Tồn sổ sách</th><th class="r" style="width:130px">Thực đếm</th><th class="r">Chênh lệch</th></tr></thead><tbody id="st-tbody"></tbody></table></div>';
  $('#st-q').addEventListener('input', function(){ ST.q=this.value; stRows(); });
  stRows();
};
function stWhChange(){
  var nv=$('#st-wh').value;
  if(Object.keys(ST.counts).length){
    if(!confirm('Đổi kho sẽ xóa các số liệu thực đếm đang nhập. Tiếp tục?')){ $('#st-wh').value=ST.whId; return; }
  }
  ST.whId=nv; ST.counts={}; stRows(); stUpdateBtn();
}
function stRows(){
  var q=normStr(ST.q);
  var list=activeProducts().filter(function(p){
    if(ST.onlyStock && getStock(ST.whId,p.id)<=0 && ST.counts[p.id]===undefined) return false;
    if(q && normStr(p.name).indexOf(q)<0 && normStr(p.sku).indexOf(q)<0 && normStr(p.brand).indexOf(q)<0) return false;
    return true;
  }).sort(function(a,b){return a.sku.localeCompare(b.sku,'vi');}).slice(0,400);
  var html=list.map(function(p){
    var book=getStock(ST.whId,p.id);
    var entered=ST.counts[p.id];
    var actual=entered===undefined?book:parseNum(entered);
    var delta=round3(actual-book);
    return '<tr>'+
      '<td><b>'+esc(p.sku)+'</b></td><td>'+esc(p.name)+'</td><td class="c">'+esc(p.unit)+'</td>'+
      '<td class="r">'+fmtQty(book)+'</td>'+
      '<td><input type="number" step="any" min="0" style="text-align:right" value="'+(entered===undefined?book:entered)+'" oninput="stSetCount(\''+p.id+'\',this.value)"></td>'+
      '<td class="r" id="st-delta-'+p.id+'">'+stDeltaHTML(delta)+'</td>'+
    '</tr>';
  }).join('');
  $('#st-tbody').innerHTML=html||'<tr><td colspan="6"><div class="empty">Không có sản phẩm phù hợp</div></td></tr>';
  stUpdateBtn();
}
function stDeltaHTML(delta){
  if(Math.abs(delta)<1e-9) return '<span class="muted">0</span>';
  return '<b class="'+(delta>0?'num-pos':'num-neg')+'">'+(delta>0?'+':'')+fmtQty(delta)+'</b>';
}
function stSetCount(pid,val){
  var book=getStock(ST.whId,pid);
  if(String(val).trim()===''){ delete ST.counts[pid]; }
  else {
    ST.counts[pid]=val;
    if(Math.abs(parseNum(val)-book)<1e-9) delete ST.counts[pid];
  }
  var delta=(ST.counts[pid]===undefined)?0:round3(parseNum(val)-book);
  var el=$('#st-delta-'+pid); if(el) el.innerHTML=stDeltaHTML(delta);
  stUpdateBtn();
}
function stDiffLines(){
  var lines=[];
  for(var pid in ST.counts){
    var book=getStock(ST.whId,pid);
    var delta=round3(parseNum(ST.counts[pid])-book);
    if(Math.abs(delta)>1e-9) lines.push({productId:pid, qty:delta, book:book, actual:parseNum(ST.counts[pid])});
  }
  return lines;
}
function stUpdateBtn(){
  var btn=$('#st-btn'); if(btn) btn.textContent='📋 Tạo phiếu điều chỉnh ('+stDiffLines().length+')';
}
function stCreateAdjust(){
  var lines=stDiffLines();
  if(!lines.length) return toast('Chưa có mặt hàng nào chênh lệch so với sổ sách','warn');
  var rows=lines.map(function(l){
    var p=prodById(l.productId);
    return '<tr><td>'+esc(p.name)+'</td><td class="r">'+fmtQty(l.book)+'</td><td class="r">'+fmtQty(l.actual)+'</td><td class="r">'+stDeltaHTML(l.qty)+'</td></tr>';
  }).join('');
  openModal({
    title:'Xác nhận điều chỉnh kiểm kê — '+whName(ST.whId), size:'md',
    body:'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sản phẩm</th><th class="r">Sổ sách</th><th class="r">Thực đếm</th><th class="r">Chênh lệch</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<div class="field" style="margin-top:12px"><label>Ghi chú kiểm kê</label><input id="st-note" value="Kiểm kê định kỳ ngày '+fmtDate(todayStr())+'"></div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-primary" onclick="stConfirmAdjust()">Xác nhận điều chỉnh</button>'
  });
}
function stConfirmAdjust(){
  var lines=stDiffLines();
  var res=postVoucher({type:'adjust', date:todayStr(), warehouseId:ST.whId, note:($('#st-note').value||'').trim(), lines:lines});
  closeModal();
  if(!res.ok) return toast(res.error,'error');
  ST.counts={};
  toast('Đã tạo phiếu điều chỉnh '+res.voucher.code+' — tồn kho đã cập nhật theo thực đếm','success');
  refreshPage();
}
