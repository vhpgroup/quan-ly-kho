'use strict';
/* ==================== DANH MỤC: SẢN PHẨM / ĐỐI TÁC / KHO / NGƯỜI DÙNG ==================== */

/* ---------- SẢN PHẨM ---------- */
var PRODF={q:'', cat:'', wh:'', showInactive:false};
function prodWhOptions(){
  if(PRODF.wh && !whById(PRODF.wh)) PRODF.wh='';
  var html='<option value="">🏢 Tổng kho — tất cả</option>';
  activeWarehouses().forEach(function(w){ html+='<option value="'+w.id+'" '+(PRODF.wh===w.id?'selected':'')+'>'+esc(w.name)+'</option>'; });
  return html;
}
/* Tồn từng kho của 1 sản phẩm, dạng "Kho chính: 25 · Chi nhánh: 5" */
function prodWhBreakdown(pid){
  var parts=[];
  activeWarehouses().forEach(function(w){
    var s=getStock(w.id, pid);
    if(s>0) parts.push(esc(w.name)+': <b>'+fmtQty(s)+'</b>');
  });
  return parts.length?'<span class="small">'+parts.join(' <span style="color:var(--muted2)">·</span> ')+'</span>':'<span style="color:var(--muted2)">—</span>';
}
RENDERERS.products=function(c){
  var mgr=isMgr();
  c.innerHTML=
  '<div class="toolbar">'+
    '<div class="field grow"><label>Tìm kiếm</label><input id="pf-q" placeholder="Tên, mã hoặc hãng…" value="'+esc(PRODF.q)+'"></div>'+
    '<div class="field"><label>Kho</label><select id="pf-wh" onchange="PRODF.wh=this.value;refreshPage()">'+prodWhOptions()+'</select></div>'+
    '<div class="field"><label>Nhóm hàng</label><select id="pf-cat" onchange="prodFilter()">'+catOptions(PRODF.cat,true)+'</select></div>'+
    '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-weight:500;margin:0;padding:8px 0"><input type="checkbox" id="pf-inactive" '+(PRODF.showInactive?'checked':'')+' onchange="prodFilter()"> Hiện hàng ngừng KD</label></div>'+
    '<div class="toolbar-right">'+
      (mgr?'<button class="btn btn-ghost btn-sm" onclick="categoriesModal()">🏷️ Nhóm hàng</button>':'')+
      (mgr?'<button class="btn btn-ghost btn-sm" onclick="importProducts()">📄 Nhập Excel</button>':'')+
      '<button class="btn btn-ghost btn-sm" onclick="exportProducts()">📊 Xuất Excel</button>'+
      (mgr?'<button class="btn btn-primary btn-sm" onclick="productForm()">＋ Thêm sản phẩm</button>':'')+
    '</div>'+
  '</div>'+
  '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr>'+
    '<th>Mã</th><th>Tên sản phẩm</th><th>Hãng</th><th>Nhóm</th><th>ĐVT</th><th class="r">Giá vốn</th><th class="r">Giá bán</th><th class="r">Tổng tồn</th><th'+(PRODF.wh?' class="r"':'')+'>'+(PRODF.wh?'Tồn tại '+esc(whName(PRODF.wh)):'Tồn theo kho')+'</th><th class="r">Tồn min</th><th class="c">Trạng thái</th>'+(mgr?'<th class="c">Thao tác</th>':'')+
  '</tr></thead><tbody id="prod-tbody"></tbody></table></div>'+
  '<div class="pagin" id="prod-count"></div>';
  $('#pf-q').addEventListener('input', prodFilter);
  prodRows();
};
function catOptions(sel, withAll){
  var html=withAll?'<option value="">— Tất cả nhóm —</option>':'<option value="">— Không nhóm —</option>';
  DB.categories.forEach(function(cg){ html+='<option value="'+cg.id+'" '+(sel===cg.id?'selected':'')+'>'+esc(cg.name)+'</option>'; });
  return html;
}
function prodFilter(){
  PRODF.q=$('#pf-q').value; PRODF.cat=$('#pf-cat').value; PRODF.showInactive=$('#pf-inactive').checked;
  prodRows();
}
function prodRows(){
  var mgr=isMgr();
  var q=normStr(PRODF.q);
  var list=DB.products.filter(function(p){
    if(!PRODF.showInactive && p.active===false) return false;
    if(PRODF.cat && p.categoryId!==PRODF.cat) return false;
    if(PRODF.wh && getStock(PRODF.wh, p.id)<=0) return false;
    if(q && normStr(p.name).indexOf(q)<0 && normStr(p.sku).indexOf(q)<0 && normStr(p.brand).indexOf(q)<0) return false;
    return true;
  }).sort(function(a,b){ return a.sku.localeCompare(b.sku,'vi'); });
  var shown=list.slice(0,400);
  var html=shown.map(function(p){
    var ts=totalStock(p.id);
    var low=(p.minStock||0)>0 && ts<p.minStock;
    return '<tr>'+
      '<td><b>'+esc(p.sku)+'</b></td>'+
      '<td>'+esc(p.name)+(p.note?'<div class="small muted">'+esc(p.note)+'</div>':'')+'</td>'+
      '<td>'+(p.brand?esc(p.brand):'<span style="color:var(--muted2)">—</span>')+'</td>'+
      '<td>'+(p.categoryId?'<span class="tag">'+esc(catName(p.categoryId))+'</span>':'')+'</td>'+
      '<td>'+esc(p.unit)+'</td>'+
      '<td class="r">'+fmtMoney(p.costPrice)+'</td>'+
      '<td class="r">'+fmtMoney(p.salePrice)+'</td>'+
      '<td class="r '+(low?'low-flag':'')+'">'+fmtQty(ts)+(low?' ⚠️':'')+'</td>'+
      '<td'+(PRODF.wh?' class="r"':'')+'>'+(PRODF.wh?'<b>'+fmtQty(getStock(PRODF.wh,p.id))+'</b>':prodWhBreakdown(p.id))+'</td>'+
      '<td class="r muted">'+(p.minStock?fmtQty(p.minStock):'—')+'</td>'+
      '<td class="c">'+(p.active===false?'<span class="tag tag-gray">Ngừng KD</span>':'<span class="tag tag-green">Đang bán</span>')+'</td>'+
      (mgr?'<td class="c" style="white-space:nowrap"><button class="btn btn-xs btn-ghost" onclick="productForm(\''+p.id+'\')">Sửa</button> <button class="btn btn-xs btn-danger" onclick="deleteProduct(\''+p.id+'\')">Xóa</button></td>':'')+
    '</tr>';
  }).join('');
  $('#prod-tbody').innerHTML=html||'<tr><td colspan="12"><div class="empty">'+(PRODF.wh?'Không có sản phẩm nào còn tồn tại '+esc(whName(PRODF.wh))+'.':'Chưa có sản phẩm nào. '+(mgr?'Bấm “＋ Thêm sản phẩm” hoặc “Nhập Excel” để bắt đầu.':''))+'</div></td></tr>';
  $('#prod-count').textContent='Hiển thị '+shown.length+' / '+list.length+' sản phẩm'+(PRODF.wh?' còn tồn tại '+whName(PRODF.wh):'');
}
function productForm(id){
  if(!isMgr()) return;
  var p=id?prodById(id):null;
  var hasStock=p?totalStock(p.id)>0:false;
  openModal({
    title:p?'Sửa sản phẩm — '+p.sku:'Thêm sản phẩm mới', size:'md',
    body:
    '<div class="form-grid">'+
      '<div class="field"><label>Mã sản phẩm (SKU) <span class="req">*</span></label><input id="prf-sku" value="'+esc(p?p.sku:suggestSku())+'"></div>'+
      '<div class="field"><label>Tên sản phẩm <span class="req">*</span></label><input id="prf-name" value="'+esc(p?p.name:'')+'"></div>'+
      '<div class="field"><label>Hãng / Thương hiệu</label><input id="prf-brand" value="'+esc(p?p.brand:'')+'" placeholder="Logitech, Thiên Long…"></div>'+
      '<div class="field"><label>Nhóm hàng</label><select id="prf-cat">'+catOptions(p?p.categoryId:'')+'</select></div>'+
      '<div class="field"><label>Đơn vị tính <span class="req">*</span></label><input id="prf-unit" value="'+esc(p?p.unit:'cái')+'" placeholder="cái, hộp, kg…"></div>'+
      '<div class="field"><label>Giá vốn (đ)'+(hasStock&&!isAdmin()?' <span class="small muted">(tự động theo BQGQ)</span>':'')+'</label><input type="number" min="0" step="any" id="prf-cost" value="'+(p?p.costPrice||0:0)+'" '+(hasStock&&!isAdmin()?'disabled':'')+'></div>'+
      '<div class="field"><label>Giá bán (đ)</label><input type="number" min="0" step="any" id="prf-sale" value="'+(p?p.salePrice||0:0)+'"></div>'+
      '<div class="field"><label>Tồn tối thiểu (cảnh báo)</label><input type="number" min="0" step="any" id="prf-min" value="'+(p?p.minStock||0:0)+'"></div>'+
      (p?'<div class="field"><label>Trạng thái</label><select id="prf-active"><option value="1" '+(p.active!==false?'selected':'')+'>Đang kinh doanh</option><option value="0" '+(p.active===false?'selected':'')+'>Ngừng kinh doanh</option></select></div>':'')+
    '</div>'+
    '<div class="field"><label>Ghi chú</label><input id="prf-note" value="'+esc(p?p.note:'')+'"></div>'+
    (hasStock?'<div class="small muted">⚠️ Sản phẩm đang có tồn kho ('+fmtQty(totalStock(p.id))+' '+esc(p.unit)+'). Giá vốn thường được cập nhật tự động theo bình quân gia quyền khi nhập kho'+(isAdmin()?'; quản trị viên vẫn có thể sửa tay nếu cần.':'.')+'</div>':''),
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-primary" onclick="saveProduct(\''+(p?p.id:'')+'\')">Lưu sản phẩm</button>'
  });
}
function suggestSku(){
  var n=DB.products.length+1, sku;
  do{ sku='SP'+String(n).padStart(4,'0'); n++; }while(DB.products.some(function(p){return p.sku===sku;}));
  return sku;
}
function saveProduct(id){
  var sku=($('#prf-sku').value||'').trim().toUpperCase();
  var name=($('#prf-name').value||'').trim();
  var unit=($('#prf-unit').value||'').trim()||'cái';
  if(!sku) return toast('Nhập mã sản phẩm','error');
  if(!name) return toast('Nhập tên sản phẩm','error');
  if(DB.products.some(function(p){ return p.sku.toUpperCase()===sku && p.id!==id; })) return toast('Mã "'+sku+'" đã tồn tại, hãy dùng mã khác','error');
  var costEl=$('#prf-cost');
  var data={
    sku:sku, name:name, unit:unit,
    brand:($('#prf-brand').value||'').trim(),
    categoryId:$('#prf-cat').value||null,
    salePrice:parseNum($('#prf-sale').value),
    minStock:parseNum($('#prf-min').value),
    note:($('#prf-note').value||'').trim()
  };
  if(id){
    var p=prodById(id);
    var oldCost=p.costPrice;
    Object.assign(p,data);
    if(!costEl.disabled){
      var nc=parseNum(costEl.value);
      if(nc!==oldCost){ p.costPrice=nc; audit('Sửa giá vốn thủ công', p.sku+' — '+p.name+': '+fmtMoney(oldCost)+' → '+fmtMoney(nc)+' đ'); }
    }
    p.active=$('#prf-active')?$('#prf-active').value==='1':p.active;
    audit('Sửa sản phẩm', p.sku+' — '+p.name);
  } else {
    data.id=uid(); data.costPrice=parseNum(costEl.value); data.active=true; data.createdAt=nowISO();
    DB.products.push(data);
    audit('Thêm sản phẩm', data.sku+' — '+data.name);
  }
  saveDB(); closeModal(); toast('Đã lưu sản phẩm','success');
  if(CURRENT_PAGE==='products') prodRows();
}
function deleteProduct(id){
  if(!isMgr()) return;
  var p=prodById(id); if(!p) return;
  var used=DB.vouchers.some(function(v){ return v.lines.some(function(l){return l.productId===id;}); });
  var st=totalStock(id);
  if(used || st>0){
    confirmDlg('Không thể xóa','Sản phẩm <b>'+esc(p.name)+'</b> '+(st>0?'đang còn tồn kho ('+fmtQty(st)+' '+esc(p.unit)+')':'đã phát sinh phiếu nhập/xuất')+', không thể xóa để bảo toàn dữ liệu.<br><br>Bạn có muốn chuyển sang trạng thái <b>Ngừng kinh doanh</b> không?','Ngừng kinh doanh',function(){
      p.active=false; audit('Ngừng kinh doanh', p.sku+' — '+p.name); saveDB(); toast('Đã chuyển "'+p.name+'" sang ngừng kinh doanh','success'); prodRows();
    });
    return;
  }
  confirmDlg('Xóa sản phẩm','Xóa vĩnh viễn sản phẩm <b>'+esc(p.name)+'</b> ('+esc(p.sku)+')?','Xóa',function(){
    DB.products=DB.products.filter(function(x){return x.id!==id;});
    audit('Xóa sản phẩm', p.sku+' — '+p.name); saveDB(); toast('Đã xóa sản phẩm','success'); prodRows();
  }, true);
}

/* ---------- NHÓM HÀNG ---------- */
function categoriesModal(){
  if(!isMgr()) return;
  var rows=DB.categories.map(function(cg){
    var count=DB.products.filter(function(p){return p.categoryId===cg.id;}).length;
    return '<tr><td><input id="cat-n-'+cg.id+'" value="'+esc(cg.name)+'"></td><td class="c muted">'+count+' SP</td>'+
      '<td class="c" style="white-space:nowrap"><button class="btn btn-xs btn-ghost" onclick="catRename(\''+cg.id+'\')">Lưu</button> <button class="btn btn-xs btn-danger" onclick="catDelete(\''+cg.id+'\')">Xóa</button></td></tr>';
  }).join('');
  openModal({
    title:'Quản lý nhóm hàng', size:'sm',
    body:
      '<div style="display:flex;gap:8px;margin-bottom:14px"><input id="cat-new" placeholder="Tên nhóm hàng mới…"><button class="btn btn-primary btn-sm" onclick="catAdd()">Thêm</button></div>'+
      (rows?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tên nhóm</th><th class="c">Số SP</th><th class="c">Thao tác</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Chưa có nhóm hàng nào</div>')
  });
}
function catAdd(){
  var name=($('#cat-new').value||'').trim();
  if(!name) return toast('Nhập tên nhóm hàng','error');
  if(DB.categories.some(function(c){return normStr(c.name)===normStr(name);})) return toast('Nhóm này đã tồn tại','error');
  DB.categories.push({id:uid(), name:name});
  audit('Thêm nhóm hàng', name); saveDB(); toast('Đã thêm nhóm "'+name+'"','success'); categoriesModal();
}
function catRename(id){
  var c=catById(id); if(!c) return;
  var name=($('#cat-n-'+id).value||'').trim();
  if(!name) return toast('Tên nhóm không được trống','error');
  audit('Sửa nhóm hàng', c.name+' → '+name);
  c.name=name; saveDB(); toast('Đã cập nhật nhóm hàng','success'); categoriesModal();
}
function catDelete(id){
  var c=catById(id); if(!c) return;
  var count=DB.products.filter(function(p){return p.categoryId===id;}).length;
  confirmDlg('Xóa nhóm hàng','Xóa nhóm <b>'+esc(c.name)+'</b>?'+(count?' '+count+' sản phẩm thuộc nhóm này sẽ chuyển về “Không nhóm”.':''),'Xóa',function(){
    DB.products.forEach(function(p){ if(p.categoryId===id) p.categoryId=null; });
    DB.categories=DB.categories.filter(function(x){return x.id!==id;});
    audit('Xóa nhóm hàng', c.name); saveDB(); toast('Đã xóa nhóm hàng','success'); categoriesModal();
    if(CURRENT_PAGE==='products') prodRows();
  }, true);
}

/* ---------- ĐỐI TÁC ---------- */
var PARTF={tab:'supplier', q:''};
RENDERERS.partners=function(c){
  var mgr=isMgr();
  c.innerHTML=
  '<div class="tabs">'+
    '<div class="tab '+(PARTF.tab==='supplier'?'active':'')+'" onclick="PARTF.tab=\'supplier\';refreshPage()">🚚 Nhà cung cấp</div>'+
    '<div class="tab '+(PARTF.tab==='customer'?'active':'')+'" onclick="PARTF.tab=\'customer\';refreshPage()">🛒 Khách hàng</div>'+
  '</div>'+
  '<div class="toolbar">'+
    '<div class="field grow"><label>Tìm kiếm</label><input id="ptf-q" placeholder="Tên, mã, điện thoại…" value="'+esc(PARTF.q)+'"></div>'+
    '<div class="toolbar-right">'+
      (mgr?'<button class="btn btn-ghost btn-sm" onclick="importPartners()">📄 Nhập Excel</button>':'')+
      '<button class="btn btn-ghost btn-sm" onclick="exportPartners()">📊 Xuất Excel</button>'+
      (mgr?'<button class="btn btn-primary btn-sm" onclick="partnerForm(\''+PARTF.tab+'\')">＋ Thêm '+(PARTF.tab==='supplier'?'nhà cung cấp':'khách hàng')+'</button>':'')+
    '</div>'+
  '</div>'+
  '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr>'+
    '<th>Mã</th><th>Tên</th><th>Điện thoại</th><th>Địa chỉ</th><th>MST</th><th class="c">Trạng thái</th>'+(mgr?'<th class="c">Thao tác</th>':'')+
  '</tr></thead><tbody id="pt-tbody"></tbody></table></div>';
  $('#ptf-q').addEventListener('input', function(){ PARTF.q=this.value; partnerRows(); });
  partnerRows();
};
function partnerRows(){
  var mgr=isMgr(); var q=normStr(PARTF.q);
  var list=DB.partners.filter(function(p){
    if(p.type!==PARTF.tab) return false;
    if(q && normStr(p.name).indexOf(q)<0 && normStr(p.code).indexOf(q)<0 && String(p.phone||'').indexOf(PARTF.q.trim())<0) return false;
    return true;
  }).sort(function(a,b){return a.code.localeCompare(b.code,'vi');});
  var html=list.map(function(p){
    return '<tr>'+
      '<td><b>'+esc(p.code)+'</b></td><td>'+esc(p.name)+(p.note?'<div class="small muted">'+esc(p.note)+'</div>':'')+'</td>'+
      '<td>'+esc(p.phone||'')+'</td><td>'+esc(p.address||'')+'</td><td>'+esc(p.taxCode||'')+'</td>'+
      '<td class="c">'+(p.active===false?'<span class="tag tag-gray">Ngừng GD</span>':'<span class="tag tag-green">Hoạt động</span>')+'</td>'+
      (mgr?'<td class="c" style="white-space:nowrap"><button class="btn btn-xs btn-ghost" onclick="partnerForm(\''+p.type+'\',\''+p.id+'\')">Sửa</button> <button class="btn btn-xs btn-danger" onclick="deletePartner(\''+p.id+'\')">Xóa</button></td>':'')+
    '</tr>';
  }).join('');
  $('#pt-tbody').innerHTML=html||'<tr><td colspan="7"><div class="empty">Chưa có '+(PARTF.tab==='supplier'?'nhà cung cấp':'khách hàng')+' nào</div></td></tr>';
}
function partnerForm(type,id){
  if(!isMgr()) return;
  var p=id?partnerById(id):null;
  var label=type==='supplier'?'nhà cung cấp':'khách hàng';
  openModal({
    title:(p?'Sửa ':'Thêm ')+label, size:'md',
    body:
    '<div class="form-grid">'+
      '<div class="field"><label>Mã <span class="req">*</span></label><input id="paf-code" value="'+esc(p?p.code:suggestPartnerCode(type))+'"></div>'+
      '<div class="field"><label>Tên '+label+' <span class="req">*</span></label><input id="paf-name" value="'+esc(p?p.name:'')+'"></div>'+
      '<div class="field"><label>Điện thoại</label><input id="paf-phone" value="'+esc(p?p.phone:'')+'"></div>'+
      '<div class="field"><label>Mã số thuế</label><input id="paf-tax" value="'+esc(p?p.taxCode:'')+'"></div>'+
      (p?'<div class="field"><label>Trạng thái</label><select id="paf-active"><option value="1" '+(p.active!==false?'selected':'')+'>Hoạt động</option><option value="0" '+(p.active===false?'selected':'')+'>Ngừng giao dịch</option></select></div>':'')+
    '</div>'+
    '<div class="field"><label>Địa chỉ</label><input id="paf-addr" value="'+esc(p?p.address:'')+'"></div>'+
    '<div class="field"><label>Ghi chú</label><input id="paf-note" value="'+esc(p?p.note:'')+'"></div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-primary" onclick="savePartner(\''+type+'\',\''+(p?p.id:'')+'\')">Lưu</button>'
  });
}
function suggestPartnerCode(type){
  var pre=type==='supplier'?'NCC':'KH';
  var n=DB.partners.filter(function(p){return p.type===type;}).length+1, code;
  do{ code=pre+String(n).padStart(3,'0'); n++; }while(DB.partners.some(function(p){return p.code===code;}));
  return code;
}
function savePartner(type,id){
  var code=($('#paf-code').value||'').trim().toUpperCase();
  var name=($('#paf-name').value||'').trim();
  if(!code) return toast('Nhập mã','error');
  if(!name) return toast('Nhập tên','error');
  if(DB.partners.some(function(p){return p.code.toUpperCase()===code && p.id!==id;})) return toast('Mã "'+code+'" đã tồn tại','error');
  var data={ code:code, name:name, phone:($('#paf-phone').value||'').trim(), taxCode:($('#paf-tax').value||'').trim(), address:($('#paf-addr').value||'').trim(), note:($('#paf-note').value||'').trim() };
  if(id){
    var p=partnerById(id);
    Object.assign(p,data);
    p.active=$('#paf-active')?$('#paf-active').value==='1':p.active;
    audit('Sửa đối tác', p.code+' — '+p.name);
  } else {
    data.id=uid(); data.type=type; data.active=true;
    DB.partners.push(data);
    audit('Thêm đối tác', (type==='supplier'?'NCC ':'KH ')+data.code+' — '+data.name);
  }
  saveDB(); closeModal(); toast('Đã lưu','success');
  if(CURRENT_PAGE==='partners') partnerRows();
}
function deletePartner(id){
  if(!isMgr()) return;
  var p=partnerById(id); if(!p) return;
  var used=DB.vouchers.some(function(v){return v.partnerId===id;});
  if(used){
    confirmDlg('Không thể xóa','<b>'+esc(p.name)+'</b> đã phát sinh phiếu giao dịch, không thể xóa.<br><br>Chuyển sang <b>Ngừng giao dịch</b>?','Ngừng giao dịch',function(){
      p.active=false; audit('Ngừng giao dịch đối tác', p.code+' — '+p.name); saveDB(); toast('Đã cập nhật','success'); partnerRows();
    });
    return;
  }
  confirmDlg('Xóa đối tác','Xóa <b>'+esc(p.name)+'</b> ('+esc(p.code)+')?','Xóa',function(){
    DB.partners=DB.partners.filter(function(x){return x.id!==id;});
    audit('Xóa đối tác', p.code+' — '+p.name); saveDB(); toast('Đã xóa','success'); partnerRows();
  }, true);
}

/* ---------- KHO HÀNG ---------- */
RENDERERS.warehouses=function(c){
  var rows=DB.warehouses.map(function(w){
    var skuCount=0, val=0;
    var m=DB.stocks[w.id]||{};
    for(var pid in m){ if(m[pid]>0){ skuCount++; var p=prodById(pid); val+=m[pid]*((p&&p.costPrice)||0); } }
    return '<tr>'+
      '<td><b>'+esc(w.code)+'</b></td><td>'+esc(w.name)+'</td><td>'+esc(w.address||'')+'</td>'+
      '<td class="r">'+skuCount+'</td><td class="r">'+fmtMoney(val)+'</td>'+
      '<td class="c">'+(w.active===false?'<span class="tag tag-gray">Ngừng</span>':'<span class="tag tag-green">Hoạt động</span>')+'</td>'+
      '<td class="c" style="white-space:nowrap"><button class="btn btn-xs btn-ghost" onclick="warehouseForm(\''+w.id+'\')">Sửa</button> <button class="btn btn-xs btn-danger" onclick="deleteWarehouse(\''+w.id+'\')">Xóa</button></td>'+
    '</tr>';
  }).join('');
  c.innerHTML=
  '<div class="toolbar"><div class="grow"></div><div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="warehouseForm()">＋ Thêm kho</button></div></div>'+
  '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mã kho</th><th>Tên kho</th><th>Địa chỉ</th><th class="r">Số mặt hàng có tồn</th><th class="r">Giá trị tồn (đ)</th><th class="c">Trạng thái</th><th class="c">Thao tác</th></tr></thead>'+
  '<tbody>'+(rows||'<tr><td colspan="7"><div class="empty">Chưa có kho nào — hãy thêm ít nhất một kho để bắt đầu nhập hàng</div></td></tr>')+'</tbody></table></div>';
};
function warehouseForm(id){
  var w=id?whById(id):null;
  openModal({
    title:w?'Sửa kho — '+w.code:'Thêm kho mới', size:'sm',
    body:
      '<div class="field"><label>Mã kho <span class="req">*</span></label><input id="whf-code" value="'+esc(w?w.code:('KHO'+String(DB.warehouses.length+1).padStart(2,'0')))+'"></div>'+
      '<div class="field"><label>Tên kho <span class="req">*</span></label><input id="whf-name" value="'+esc(w?w.name:'')+'" placeholder="Kho chính, Kho chi nhánh…"></div>'+
      '<div class="field"><label>Địa chỉ</label><input id="whf-addr" value="'+esc(w?w.address:'')+'"></div>'+
      (w?'<div class="field"><label>Trạng thái</label><select id="whf-active"><option value="1" '+(w.active!==false?'selected':'')+'>Hoạt động</option><option value="0" '+(w.active===false?'selected':'')+'>Ngừng sử dụng</option></select></div>':''),
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-primary" onclick="saveWarehouse(\''+(w?w.id:'')+'\')">Lưu</button>'
  });
}
function saveWarehouse(id){
  var code=($('#whf-code').value||'').trim().toUpperCase();
  var name=($('#whf-name').value||'').trim();
  if(!code||!name) return toast('Nhập đủ mã và tên kho','error');
  if(DB.warehouses.some(function(w){return w.code.toUpperCase()===code && w.id!==id;})) return toast('Mã kho đã tồn tại','error');
  if(id){
    var w=whById(id);
    w.code=code; w.name=name; w.address=($('#whf-addr').value||'').trim();
    w.active=$('#whf-active')?$('#whf-active').value==='1':w.active;
    audit('Sửa kho', code+' — '+name);
  } else {
    DB.warehouses.push({id:uid(), code:code, name:name, address:($('#whf-addr').value||'').trim(), active:true});
    audit('Thêm kho', code+' — '+name);
  }
  saveDB(); closeModal(); toast('Đã lưu kho','success'); refreshPage();
}
function deleteWarehouse(id){
  var w=whById(id); if(!w) return;
  var hasStock=false, m=DB.stocks[id]||{};
  for(var pid in m){ if(Math.abs(m[pid])>1e-9){ hasStock=true; break; } }
  var used=DB.vouchers.some(function(v){return v.warehouseId===id||v.toWarehouseId===id;});
  if(hasStock) return toast('Kho còn hàng tồn — hãy chuyển hết hàng sang kho khác trước khi xóa','error');
  if(used){
    confirmDlg('Không thể xóa','Kho <b>'+esc(w.name)+'</b> đã phát sinh phiếu, không thể xóa.<br><br>Chuyển sang <b>Ngừng sử dụng</b>?','Ngừng sử dụng',function(){
      w.active=false; audit('Ngừng sử dụng kho', w.code); saveDB(); toast('Đã cập nhật','success'); refreshPage();
    });
    return;
  }
  confirmDlg('Xóa kho','Xóa kho <b>'+esc(w.name)+'</b>?','Xóa',function(){
    DB.warehouses=DB.warehouses.filter(function(x){return x.id!==id;});
    delete DB.stocks[id];
    audit('Xóa kho', w.code+' — '+w.name); saveDB(); toast('Đã xóa kho','success'); refreshPage();
  }, true);
}

/* ---------- NGƯỜI DÙNG ---------- */
RENDERERS.users=function(c){
  var rows=DB.users.map(function(u){
    return '<tr>'+
      '<td><b>'+esc(u.username)+'</b>'+(SESSION.id===u.id?' <span class="tag">bạn</span>':'')+'</td>'+
      '<td>'+esc(u.fullName||'')+'</td>'+
      '<td><span class="badge" style="background:'+(u.role==='admin'?'#eff6ff;color:#1d4ed8':u.role==='manager'?'#f0fdf4;color:#15803d':'#f8fafc;color:#475569')+'">'+ROLES[u.role]+'</span></td>'+
      '<td>'+(u.defaultWarehouseId&&whById(u.defaultWarehouseId)?esc(whName(u.defaultWarehouseId)):'<span class="muted">—</span>')+'</td>'+
      '<td class="muted small">'+fmtDateTime(u.createdAt)+'</td>'+
      '<td class="c">'+(u.active===false?'<span class="tag tag-red">Đã khóa</span>':'<span class="tag tag-green">Hoạt động</span>')+'</td>'+
      '<td class="c" style="white-space:nowrap">'+
        '<button class="btn btn-xs btn-ghost" onclick="userForm(\''+u.id+'\')">Sửa</button> '+
        '<button class="btn btn-xs btn-ghost" onclick="resetPassModal(\''+u.id+'\')">Đặt lại MK</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  c.innerHTML=
  '<div class="card" style="padding:12px 16px;font-size:13px" >👥 <b>Phân quyền:</b> <b>Quản trị</b> — toàn quyền (người dùng, sao lưu, cài đặt, xóa phiếu vĩnh viễn); <b>Quản lý</b> — nghiệp vụ, kiểm kê, báo cáo, sửa/hủy phiếu; <b>Nhân viên</b> — lập phiếu nhập/xuất/chuyển/trả, xem tồn kho và lịch sử.</div>'+
  '<div class="toolbar"><div class="grow"></div><div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="userForm()">＋ Thêm người dùng</button></div></div>'+
  '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Kho mặc định</th><th>Ngày tạo</th><th class="c">Trạng thái</th><th class="c">Thao tác</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
};
function userForm(id){
  var u=id?DB.users.find(function(x){return x.id===id;}):null;
  openModal({
    title:u?'Sửa người dùng — '+u.username:'Thêm người dùng', size:'sm',
    body:
      '<div class="field"><label>Tên đăng nhập <span class="req">*</span></label><input id="uf-un" value="'+esc(u?u.username:'')+'" '+(u?'disabled':'')+' placeholder="viết liền, không dấu"></div>'+
      '<div class="field"><label>Họ tên</label><input id="uf-fn" value="'+esc(u?u.fullName:'')+'"></div>'+
      '<div class="field"><label>Vai trò</label><select id="uf-role">'+
        Object.keys(ROLES).map(function(r){return '<option value="'+r+'" '+(u&&u.role===r?'selected':'')+'>'+ROLES[r]+'</option>';}).join('')+
      '</select></div>'+
      '<div class="field"><label>Kho làm việc mặc định</label><select id="uf-wh"><option value="">— Không đặt —</option>'+
        activeWarehouses().map(function(w){return '<option value="'+w.id+'" '+(u&&u.defaultWarehouseId===w.id?'selected':'')+'>'+esc(w.name)+'</option>';}).join('')+
      '</select><div class="small muted" style="margin-top:4px">Tự chọn sẵn kho này khi lập phiếu / kiểm kê</div></div>'+
      (!u?'<div class="field"><label>Mật khẩu <span class="req">*</span></label><input type="password" id="uf-pw" placeholder="Tối thiểu 4 ký tự"></div>':'')+
      (u?'<div class="field"><label>Trạng thái</label><select id="uf-active"><option value="1" '+(u.active!==false?'selected':'')+'>Hoạt động</option><option value="0" '+(u.active===false?'selected':'')+'>Khóa tài khoản</option></select></div>':''),
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-primary" onclick="saveUser(\''+(u?u.id:'')+'\')">Lưu</button>'
  });
}
function countActiveAdmins(){ return DB.users.filter(function(u){return u.role==='admin'&&u.active!==false;}).length; }
function saveUser(id){
  if(id){
    var u=DB.users.find(function(x){return x.id===id;});
    var role=$('#uf-role').value, active=$('#uf-active').value==='1';
    if(u.role==='admin' && (role!=='admin'||!active) && countActiveAdmins()<=1) return toast('Đây là quản trị viên hoạt động cuối cùng — không thể hạ quyền hay khóa','error');
    if(u.id===SESSION.id && !active) return toast('Không thể tự khóa tài khoản của chính mình','error');
    u.fullName=($('#uf-fn').value||'').trim(); u.role=role; u.active=active;
    u.defaultWarehouseId=$('#uf-wh').value||null;
    audit('Sửa người dùng', u.username+' — '+ROLES[u.role]+(active?'':' (khóa)'));
    if(u.id===SESSION.id){ $('#user-role').textContent=ROLES[u.role]; buildNav(); }
  } else {
    var un=($('#uf-un').value||'').trim().toLowerCase().replace(/\s/g,'');
    var pw=$('#uf-pw').value||'';
    if(!un) return toast('Nhập tên đăng nhập','error');
    if(!/^[a-z0-9._-]{3,}$/.test(un)) return toast('Tên đăng nhập: tối thiểu 3 ký tự, chỉ chữ thường/số/._-','error');
    if(DB.users.some(function(x){return x.username===un;})) return toast('Tên đăng nhập đã tồn tại','error');
    if(pw.length<4) return toast('Mật khẩu tối thiểu 4 ký tự','error');
    DB.users.push({id:uid(), username:un, passHash:hashPass(pw), fullName:($('#uf-fn').value||'').trim(), role:$('#uf-role').value, defaultWarehouseId:$('#uf-wh').value||null, active:true, createdAt:nowISO()});
    audit('Thêm người dùng', un+' — '+ROLES[$('#uf-role').value]);
  }
  saveDB(); closeModal(); toast('Đã lưu người dùng','success'); refreshPage();
}
function resetPassModal(id){
  var u=DB.users.find(function(x){return x.id===id;}); if(!u) return;
  openModal({
    title:'Đặt lại mật khẩu — '+u.username, size:'sm',
    body:'<div class="field"><label>Mật khẩu mới (tối thiểu 4 ký tự)</label><input type="password" id="rp-pw"></div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-primary" onclick="doResetPass(\''+id+'\')">Đặt lại</button>'
  });
}
function doResetPass(id){
  var u=DB.users.find(function(x){return x.id===id;}); if(!u) return;
  var pw=$('#rp-pw').value||'';
  if(pw.length<4) return toast('Mật khẩu tối thiểu 4 ký tự','error');
  u.passHash=hashPass(pw);
  audit('Đặt lại mật khẩu','Cho tài khoản '+u.username);
  saveDB(); closeModal(); toast('Đã đặt lại mật khẩu cho '+u.username,'success');
}
