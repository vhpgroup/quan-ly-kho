'use strict';
/* ==================== THEO DÕI: TỒN KHO / LỊCH SỬ / BÁO CÁO ==================== */

/* ---------- TỒN KHO ---------- */
var INVF={q:'', cat:'', wh:'', lowOnly:false};
RENDERERS.inventory=function(c){
  var whs=activeWarehouses();
  c.innerHTML=
  '<div class="toolbar">'+
    '<div class="field grow"><label>Tìm kiếm</label><input id="inv-q" placeholder="Tên hoặc mã sản phẩm…" value="'+esc(INVF.q)+'"></div>'+
    '<div class="field"><label>Nhóm hàng</label><select id="inv-cat" onchange="invFilter()">'+catOptions(INVF.cat,true)+'</select></div>'+
    '<div class="field"><label>Kho</label><select id="inv-wh" onchange="invFilter()"><option value="">— Tất cả các kho —</option>'+whs.map(function(w){return '<option value="'+w.id+'" '+(INVF.wh===w.id?'selected':'')+'>'+esc(w.name)+'</option>';}).join('')+'</select></div>'+
    '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-weight:500;margin:0;padding:8px 0"><input type="checkbox" id="inv-low" '+(INVF.lowOnly?'checked':'')+' onchange="invFilter()"> ⚠️ Chỉ hàng dưới tồn tối thiểu</label></div>'+
    '<div class="toolbar-right"><button class="btn btn-ghost btn-sm" onclick="exportInventory()">📊 Xuất Excel</button></div>'+
  '</div>'+
  '<div id="inv-table"></div>';
  $('#inv-q').addEventListener('input', invFilter);
  invTable();
};
function invFilter(){
  INVF.q=$('#inv-q').value; INVF.cat=$('#inv-cat').value; INVF.wh=$('#inv-wh').value; INVF.lowOnly=$('#inv-low').checked;
  invTable();
}
function invRowsData(){
  var q=normStr(INVF.q);
  return DB.products.filter(function(p){
    if(p.active===false && totalStock(p.id)<=0) return false;
    if(INVF.cat && p.categoryId!==INVF.cat) return false;
    if(q && normStr(p.name).indexOf(q)<0 && normStr(p.sku).indexOf(q)<0) return false;
    if(INVF.lowOnly && !((p.minStock||0)>0 && totalStock(p.id)<p.minStock)) return false;
    return true;
  }).sort(function(a,b){return a.sku.localeCompare(b.sku,'vi');});
}
function invTable(){
  var whs=activeWarehouses();
  var showAll=!INVF.wh;
  var list=invRowsData();
  var totalVal=0;
  var rows=list.slice(0,400).map(function(p){
    var tot=totalStock(p.id);
    var qty=showAll?tot:getStock(INVF.wh,p.id);
    var val=qty*(p.costPrice||0); totalVal+=val;
    var low=(p.minStock||0)>0 && tot<p.minStock;
    return '<tr>'+
      '<td><b>'+esc(p.sku)+'</b></td>'+
      '<td>'+esc(p.name)+(p.active===false?' <span class="tag tag-gray">Ngừng KD</span>':'')+'</td>'+
      '<td class="c">'+esc(p.unit)+'</td>'+
      (showAll?whs.map(function(w){ var s=getStock(w.id,p.id); return '<td class="r'+(s?'':' muted')+'">'+(s?fmtQty(s):'·')+'</td>'; }).join(''):'')+
      '<td class="r"><b class="'+(low?'low-flag':'')+'">'+fmtQty(qty)+(low?' ⚠️':'')+'</b></td>'+
      '<td class="r muted">'+fmtMoney(p.costPrice)+'</td>'+
      '<td class="r">'+fmtMoney(val)+'</td>'+
      '<td class="r muted">'+(p.minStock?fmtQty(p.minStock):'—')+'</td>'+
    '</tr>';
  }).join('');
  var colCount=(showAll?whs.length:0)+7;
  $('#inv-table').innerHTML=
  '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr>'+
    '<th>Mã</th><th>Tên sản phẩm</th><th class="c">ĐVT</th>'+
    (showAll?whs.map(function(w){return '<th class="r">'+esc(w.name)+'</th>';}).join(''):'')+
    '<th class="r">'+(showAll?'Tổng tồn':'Tồn tại kho')+'</th><th class="r">Giá vốn (đ)</th><th class="r">Giá trị tồn (đ)</th><th class="r">Tồn min</th>'+
  '</tr></thead><tbody>'+(rows||'<tr><td colspan="'+colCount+'"><div class="empty">Không có dữ liệu tồn kho phù hợp</div></td></tr>')+'</tbody>'+
  '<tfoot><tr><td colspan="'+(colCount-2)+'" class="r">TỔNG GIÁ TRỊ TỒN'+(showAll?' (toàn công ty)':' ('+esc(whName(INVF.wh))+')')+'</td><td class="r" style="color:var(--primary)">'+fmtMoney(totalVal)+'</td><td></td></tr></tfoot>'+
  '</table></div>'+
  '<div class="pagin">'+list.length+' mặt hàng'+(list.length>400?' (hiển thị 400 đầu tiên — dùng bộ lọc để thu hẹp)':'')+'</div>';
}

/* ---------- LỊCH SỬ PHIẾU ---------- */
var HISTF={type:'', wh:'', from:'', to:'', q:'', page:0};
RENDERERS.history=function(c){
  var whs=DB.warehouses;
  c.innerHTML=
  '<div class="toolbar">'+
    '<div class="field"><label>Loại phiếu</label><select id="hf-type" onchange="histFilter()"><option value="">— Tất cả —</option>'+
      Object.keys(VTYPES).map(function(t){return '<option value="'+t+'" '+(HISTF.type===t?'selected':'')+'>'+VTYPES[t].icon+' '+VTYPES[t].name+'</option>';}).join('')+
    '</select></div>'+
    '<div class="field"><label>Kho</label><select id="hf-wh" onchange="histFilter()"><option value="">— Tất cả —</option>'+whs.map(function(w){return '<option value="'+w.id+'" '+(HISTF.wh===w.id?'selected':'')+'>'+esc(w.name)+'</option>';}).join('')+'</select></div>'+
    '<div class="field"><label>Từ ngày</label><input type="date" id="hf-from" value="'+HISTF.from+'" onchange="histFilter()"></div>'+
    '<div class="field"><label>Đến ngày</label><input type="date" id="hf-to" value="'+HISTF.to+'" onchange="histFilter()"></div>'+
    '<div class="field grow"><label>Tìm kiếm</label><input id="hf-q" placeholder="Số phiếu, đối tác, người lập, sản phẩm…" value="'+esc(HISTF.q)+'"></div>'+
    '<div class="toolbar-right"><button class="btn btn-ghost btn-sm" onclick="exportHistory()">📊 Xuất Excel</button></div>'+
  '</div>'+
  '<div id="hist-table"></div>';
  $('#hf-q').addEventListener('input', function(){ HISTF.q=this.value; HISTF.page=0; histTable(); });
  histTable();
};
function histFilter(){
  HISTF.type=$('#hf-type').value; HISTF.wh=$('#hf-wh').value;
  HISTF.from=$('#hf-from').value; HISTF.to=$('#hf-to').value;
  HISTF.page=0; histTable();
}
function histData(){
  var q=normStr(HISTF.q);
  return DB.vouchers.filter(function(v){
    if(HISTF.type && v.type!==HISTF.type) return false;
    if(HISTF.wh && v.warehouseId!==HISTF.wh && v.toWarehouseId!==HISTF.wh) return false;
    if(HISTF.from && v.date<HISTF.from) return false;
    if(HISTF.to && v.date>HISTF.to) return false;
    if(q){
      var hay=normStr(v.code+' '+(v.partnerId?partnerName(v.partnerId):'')+' '+v.createdBy+' '+v.note+' '+v.lines.map(function(l){return l.name+' '+l.sku;}).join(' '));
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  });
}
function histTable(){
  var PAGE=20;
  var list=histData();
  var pages=Math.max(1,Math.ceil(list.length/PAGE));
  if(HISTF.page>=pages) HISTF.page=pages-1;
  var shown=list.slice(HISTF.page*PAGE,(HISTF.page+1)*PAGE);
  var rows=shown.map(function(v){
    var vt=VTYPES[v.type], isVoid=v.status==='void';
    return '<tr class="click" onclick="voucherDetail(\''+v.id+'\')">'+
      '<td><span class="badge" style="background:'+vt.color+'1a;color:'+vt.color+'">'+vt.icon+' '+esc(v.code)+'</span></td>'+
      '<td>'+vt.name+'</td>'+
      '<td>'+fmtDate(v.date)+'</td>'+
      '<td>'+esc(whName(v.warehouseId))+(v.type==='transfer'?' → '+esc(whName(v.toWarehouseId)):'')+'</td>'+
      '<td>'+(v.partnerId?esc(partnerName(v.partnerId)):'<span class="muted">—</span>')+'</td>'+
      '<td class="r"'+(isVoid?' style="text-decoration:line-through"':'')+'><b>'+fmtMoney(v.total)+'</b></td>'+
      '<td class="muted">'+esc(v.createdBy)+'</td>'+
      '<td class="c">'+(isVoid?'<span class="tag tag-red">Đã hủy</span>':'<span class="tag tag-green">Đã ghi sổ</span>')+'</td>'+
    '</tr>';
  }).join('');
  $('#hist-table').innerHTML=
  '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Số phiếu</th><th>Loại</th><th>Ngày</th><th>Kho</th><th>Đối tác</th><th class="r">Tổng tiền (đ)</th><th>Người lập</th><th class="c">Trạng thái</th></tr></thead>'+
  '<tbody>'+(rows||'<tr><td colspan="8"><div class="empty">Không tìm thấy phiếu nào</div></td></tr>')+'</tbody></table></div>'+
  '<div class="pagin">'+
    '<span>'+list.length+' phiếu — trang '+(HISTF.page+1)+'/'+pages+'</span>'+
    '<button class="btn btn-xs btn-ghost" '+(HISTF.page<=0?'disabled':'')+' onclick="HISTF.page--;histTable()">← Trước</button>'+
    '<button class="btn btn-xs btn-ghost" '+(HISTF.page>=pages-1?'disabled':'')+' onclick="HISTF.page++;histTable()">Sau →</button>'+
  '</div>';
}

/* ---------- BÁO CÁO ---------- */
var RPT={tab:'nxt', from:'', to:'', wh:'', topBy:'revenue'};
function monthFirst(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-01'; }
RENDERERS.reports=function(c){
  if(!RPT.from) RPT.from=monthFirst();
  if(!RPT.to) RPT.to=todayStr();
  c.innerHTML=
  '<div class="tabs">'+
    '<div class="tab '+(RPT.tab==='nxt'?'active':'')+'" onclick="RPT.tab=\'nxt\';refreshPage()">📦 Nhập – Xuất – Tồn</div>'+
    '<div class="tab '+(RPT.tab==='profit'?'active':'')+'" onclick="RPT.tab=\'profit\';refreshPage()">💰 Doanh thu &amp; Lợi nhuận</div>'+
    '<div class="tab '+(RPT.tab==='top'?'active':'')+'" onclick="RPT.tab=\'top\';refreshPage()">🏆 Top sản phẩm</div>'+
  '</div>'+
  '<div class="toolbar">'+
    '<div class="field"><label>Từ ngày</label><input type="date" id="rpt-from" value="'+RPT.from+'" onchange="rptRefresh()"></div>'+
    '<div class="field"><label>Đến ngày</label><input type="date" id="rpt-to" value="'+RPT.to+'" onchange="rptRefresh()"></div>'+
    (RPT.tab==='nxt'?'<div class="field"><label>Kho</label><select id="rpt-wh" onchange="rptRefresh()"><option value="">— Toàn công ty —</option>'+activeWarehouses().map(function(w){return '<option value="'+w.id+'" '+(RPT.wh===w.id?'selected':'')+'>'+esc(w.name)+'</option>';}).join('')+'</select></div>':'')+
    (RPT.tab==='top'?'<div class="field"><label>Xếp theo</label><select id="rpt-topby" onchange="rptRefresh()"><option value="revenue" '+(RPT.topBy==='revenue'?'selected':'')+'>Doanh thu</option><option value="qty" '+(RPT.topBy==='qty'?'selected':'')+'>Số lượng bán</option></select></div>':'')+
    '<div class="field"><label>Nhanh</label><div style="display:flex;gap:6px">'+
      '<button class="btn btn-xs btn-ghost" onclick="rptPreset(0)">Hôm nay</button>'+
      '<button class="btn btn-xs btn-ghost" onclick="rptPreset(7)">7 ngày</button>'+
      '<button class="btn btn-xs btn-ghost" onclick="rptPreset(\'month\')">Tháng này</button>'+
      '<button class="btn btn-xs btn-ghost" onclick="rptPreset(\'lastmonth\')">Tháng trước</button>'+
    '</div></div>'+
    '<div class="toolbar-right"><button class="btn btn-ghost btn-sm" onclick="exportReport()">📊 Xuất Excel</button></div>'+
  '</div>'+
  '<div id="rpt-body"></div>';
  rptBody();
};
function rptRefresh(){
  RPT.from=$('#rpt-from').value; RPT.to=$('#rpt-to').value;
  if($('#rpt-wh')) RPT.wh=$('#rpt-wh').value;
  if($('#rpt-topby')) RPT.topBy=$('#rpt-topby').value;
  rptBody();
}
function rptPreset(p){
  if(p==='month'){ RPT.from=monthFirst(); RPT.to=todayStr(); }
  else if(p==='lastmonth'){
    var d=new Date(); d.setDate(1); d.setDate(0); // ngày cuối tháng trước
    var last=d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
    RPT.from=last.slice(0,8)+'01'; RPT.to=last;
  }
  else if(p===0){ RPT.from=todayStr(); RPT.to=todayStr(); }
  else { RPT.from=dayOffset(-p+1); RPT.to=todayStr(); }
  refreshPage();
}
function rptBody(){
  var box=$('#rpt-body'); if(!box) return;
  if(RPT.tab==='nxt') box.innerHTML=rptNXTHTML();
  else if(RPT.tab==='profit') box.innerHTML=rptProfitHTML();
  else box.innerHTML=rptTopHTML();
}
function rptNXTHTML(){
  var data=reportNXT(RPT.from, RPT.to, RPT.wh||null);
  var s={openQ:0,inQ:0,inV:0,outQ:0,outV:0,closeQ:0,closeV:0};
  var rows=data.map(function(r){
    var p=r.product;
    var closeV=r.closeQ*(p.costPrice||0);
    s.inV+=r.inV; s.outV+=r.outV; s.closeV+=closeV;
    return '<tr>'+
      '<td><b>'+esc(p.sku)+'</b></td><td>'+esc(p.name)+'</td><td class="c">'+esc(p.unit)+'</td>'+
      '<td class="r">'+fmtQty(r.openQ)+'</td>'+
      '<td class="r num-pos">'+(r.inQ?fmtQty(r.inQ):'·')+'</td><td class="r">'+(r.inV?fmtMoney(r.inV):'·')+'</td>'+
      '<td class="r" style="color:var(--orange)">'+(r.outQ?fmtQty(r.outQ):'·')+'</td><td class="r">'+(r.outV?fmtMoney(r.outV):'·')+'</td>'+
      '<td class="r"><b>'+fmtQty(r.closeQ)+'</b></td><td class="r">'+fmtMoney(closeV)+'</td>'+
    '</tr>';
  }).join('');
  return '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr>'+
    '<th>Mã</th><th>Tên sản phẩm</th><th class="c">ĐVT</th><th class="r">Tồn đầu kỳ</th><th class="r">SL nhập</th><th class="r">GT nhập (đ)</th><th class="r">SL xuất</th><th class="r">GT xuất (đ)</th><th class="r">Tồn cuối kỳ</th><th class="r">GT cuối (đ)</th>'+
    '</tr></thead><tbody>'+(rows||'<tr><td colspan="10"><div class="empty">Không có biến động trong kỳ này</div></td></tr>')+'</tbody>'+
    '<tfoot><tr><td colspan="5" class="r">TỔNG CỘNG</td><td class="r">'+fmtMoney(s.inV)+'</td><td></td><td class="r">'+fmtMoney(s.outV)+'</td><td></td><td class="r" style="color:var(--primary)">'+fmtMoney(s.closeV)+'</td></tr></tfoot></table></div>'+
    '<div class="pagin">Kỳ '+fmtDate(RPT.from)+' – '+fmtDate(RPT.to)+(RPT.wh?' · '+esc(whName(RPT.wh)):' · toàn công ty (chuyển kho nội bộ không tính vào nhập/xuất)')+' · GT nhập theo giá mua thực tế, GT xuất & tồn theo giá vốn bình quân</div>';
}
function rptProfitHTML(){
  var rp=reportProfit(RPT.from, RPT.to);
  var kpi=
  '<div class="kpis">'+
    '<div class="kpi"><div class="ic" style="background:#eff6ff">💵</div><div><div class="v">'+fmtMoney(rp.sum.revenue)+' đ</div><div class="l">Doanh thu thuần (đã trừ hàng trả)</div></div></div>'+
    '<div class="kpi"><div class="ic" style="background:#fff7ed">📦</div><div><div class="v">'+fmtMoney(rp.sum.cogs)+' đ</div><div class="l">Giá vốn hàng bán</div></div></div>'+
    '<div class="kpi"><div class="ic" style="background:#f0fdf4">💰</div><div><div class="v'+(rp.sum.profit>=0?'':' num-neg')+'">'+fmtMoney(rp.sum.profit)+' đ</div><div class="l">Lợi nhuận gộp</div></div></div>'+
    '<div class="kpi"><div class="ic" style="background:#faf5ff">📈</div><div><div class="v">'+rp.sum.margin.toFixed(1)+'%</div><div class="l">Biên lợi nhuận gộp</div></div></div>'+
  '</div>';
  var rows=rp.rows.map(function(r){
    return '<tr>'+
      '<td><b>'+esc(r.product.sku)+'</b></td><td>'+esc(r.product.name)+'</td>'+
      '<td class="r">'+fmtQty(r.soldQ)+'</td><td class="r">'+(r.returnQ?fmtQty(r.returnQ):'·')+'</td>'+
      '<td class="r">'+fmtMoney(r.revenue)+'</td><td class="r muted">'+fmtMoney(r.cogs)+'</td>'+
      '<td class="r '+(r.profit>=0?'num-pos':'num-neg')+'">'+fmtMoney(r.profit)+'</td>'+
      '<td class="r">'+r.margin.toFixed(1)+'%</td>'+
    '</tr>';
  }).join('');
  return kpi+
    '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr>'+
    '<th>Mã</th><th>Tên sản phẩm</th><th class="r">SL bán</th><th class="r">SL trả lại</th><th class="r">Doanh thu (đ)</th><th class="r">Giá vốn (đ)</th><th class="r">Lợi nhuận (đ)</th><th class="r">Biên LN</th>'+
    '</tr></thead><tbody>'+(rows||'<tr><td colspan="8"><div class="empty">Chưa có giao dịch bán hàng trong kỳ này</div></td></tr>')+'</tbody>'+
    '<tfoot><tr><td colspan="4" class="r">TỔNG CỘNG</td><td class="r">'+fmtMoney(rp.sum.revenue)+'</td><td class="r">'+fmtMoney(rp.sum.cogs)+'</td><td class="r '+(rp.sum.profit>=0?'num-pos':'num-neg')+'">'+fmtMoney(rp.sum.profit)+'</td><td class="r">'+rp.sum.margin.toFixed(1)+'%</td></tr></tfoot></table></div>'+
    '<div class="pagin">Kỳ '+fmtDate(RPT.from)+' – '+fmtDate(RPT.to)+' · lợi nhuận gộp = doanh thu bán ra − giá vốn bình quân tại thời điểm xuất</div>';
}
function rptTopHTML(){
  var rp=reportProfit(RPT.from, RPT.to);
  var list=rp.rows.slice().sort(function(a,b){ return RPT.topBy==='qty' ? b.netQ-a.netQ : b.revenue-a.revenue; }).slice(0,10);
  if(!list.length) return '<div class="card"><div class="empty">Chưa có giao dịch bán hàng trong kỳ này</div></div>';
  var max=Math.max.apply(null,list.map(function(r){return RPT.topBy==='qty'?r.netQ:r.revenue;}));
  var rows=list.map(function(r,i){
    var val=RPT.topBy==='qty'?r.netQ:r.revenue;
    var w=max>0?Math.max(2,val/max*100):0;
    return '<div class="top-bar-item">'+
      '<div style="width:22px;font-weight:700;color:var(--muted)">'+(i+1)+'</div>'+
      '<div style="width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>'+esc(r.product.name)+'</b> <span class="muted small">'+esc(r.product.sku)+'</span></div>'+
      '<div class="bar-track"><div class="bar-fill" style="width:'+w+'%"></div></div>'+
      '<div style="width:150px;text-align:right"><b>'+(RPT.topBy==='qty'?fmtQty(r.netQ)+' '+esc(r.product.unit):fmtMoney(r.revenue)+' đ')+'</b><div class="small muted">LN: '+fmtMoney(r.profit)+' đ</div></div>'+
    '</div>';
  }).join('');
  return '<div class="card"><div class="card-title">🏆 Top 10 sản phẩm theo '+(RPT.topBy==='qty'?'số lượng bán':'doanh thu')+' · '+fmtDate(RPT.from)+' – '+fmtDate(RPT.to)+'</div>'+rows+'</div>';
}
