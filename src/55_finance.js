'use strict';
/* ==================== THU CHI & CÔNG NỢ ==================== */

var FIN={tab:'pay', type:'', q:''};

RENDERERS.finance=function(c){
  var t=FIN.tab;
  c.innerHTML=
  '<div class="tabs">'+
    '<div class="tab '+(t==='pay'?'active':'')+'" onclick="FIN.tab=\'pay\';refreshPage()">💳 Phiếu thu / chi</div>'+
    '<div class="tab '+(t==='sup'?'active':'')+'" onclick="FIN.tab=\'sup\';refreshPage()">📉 Công nợ nhà cung cấp</div>'+
    '<div class="tab '+(t==='cus'?'active':'')+'" onclick="FIN.tab=\'cus\';refreshPage()">📈 Công nợ khách hàng</div>'+
  '</div>'+
  '<div id="fin-body"></div>';
  if(t==='pay') finPayTab();
  else finDebtTab(t==='sup'?'supplier':'customer');
};

/* ---------- TAB PHIẾU THU / CHI ---------- */
function finPayTab(){
  var box=$('#fin-body');
  box.innerHTML=
  '<div class="toolbar">'+
    '<div class="field"><label>Loại phiếu</label><select id="fin-type" onchange="FIN.type=this.value;finPayRows()"><option value="">— Tất cả —</option><option value="receipt" '+(FIN.type==='receipt'?'selected':'')+'>💰 Phiếu thu</option><option value="payment" '+(FIN.type==='payment'?'selected':'')+'>💸 Phiếu chi</option></select></div>'+
    '<div class="field grow"><label>Tìm kiếm</label><input id="fin-q" placeholder="Số phiếu, đối tác, ghi chú…" value="'+esc(FIN.q)+'"></div>'+
    '<div class="toolbar-right">'+
      '<button class="btn btn-ghost btn-sm" onclick="exportPayments()">📊 Xuất Excel</button>'+
      '<button class="btn btn-success btn-sm" onclick="paymentForm(\'receipt\')">＋ Lập phiếu thu</button>'+
      '<button class="btn btn-primary btn-sm" onclick="paymentForm(\'payment\')">＋ Lập phiếu chi</button>'+
    '</div>'+
  '</div>'+
  '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr>'+
    '<th>Số phiếu</th><th>Ngày</th><th>Đối tác</th><th class="c">Phương thức</th><th class="r">Số tiền (đ)</th><th>Ghi chú</th><th>Người lập</th><th class="c">Trạng thái</th>'+
  '</tr></thead><tbody id="fin-tbody"></tbody></table></div>'+
  '<div class="pagin" id="fin-count"></div>';
  $('#fin-q').addEventListener('input', function(){ FIN.q=this.value; finPayRows(); });
  finPayRows();
}
function finPayRows(){
  var q=normStr(FIN.q);
  var list=DB.payments.filter(function(pm){
    if(FIN.type && pm.type!==FIN.type) return false;
    if(q && normStr(pm.code).indexOf(q)<0 && normStr(partnerName(pm.partnerId)).indexOf(q)<0 && normStr(pm.note).indexOf(q)<0) return false;
    return true;
  });
  var shown=list.slice(0,200);
  var html=shown.map(function(pm){
    var pt=PTYPES[pm.type];
    var isVoid=pm.status==='void';
    return '<tr class="click" onclick="paymentDetail(\''+pm.id+'\')">'+
      '<td><span class="badge" style="background:'+pt.color+'1a;color:'+pt.color+'">'+pt.icon+' '+esc(pm.code)+'</span></td>'+
      '<td>'+fmtDate(pm.date)+'</td>'+
      '<td>'+esc(partnerName(pm.partnerId))+'</td>'+
      '<td class="c">'+(pm.method==='bank'?'🏦 Chuyển khoản':'💵 Tiền mặt')+'</td>'+
      '<td class="r"'+(isVoid?' style="text-decoration:line-through"':'')+'><b class="'+(pm.type==='receipt'?'num-pos':'num-neg')+'">'+(pm.type==='receipt'?'+':'−')+fmtMoney(pm.amount)+'</b></td>'+
      '<td class="muted small">'+esc(pm.note||'')+'</td>'+
      '<td class="muted">'+esc(pm.createdBy)+'</td>'+
      '<td class="c">'+(isVoid?'<span class="tag tag-red">Đã hủy</span>':'<span class="tag tag-green">Đã ghi sổ</span>')+'</td>'+
    '</tr>';
  }).join('');
  $('#fin-tbody').innerHTML=html||'<tr><td colspan="8"><div class="empty">Chưa có phiếu thu / chi nào. Lập phiếu thu khi nhận tiền, phiếu chi khi trả tiền cho đối tác.</div></td></tr>';
  $('#fin-count').textContent='Hiển thị '+shown.length+' / '+list.length+' phiếu';
}

/* ---------- FORM PHIẾU THU / CHI ---------- */
function paymentForm(type, partnerId, amount){
  var pt=PTYPES[type]; if(!pt) return;
  if(!DB.partners.length){ toast('Chưa có đối tác nào — hãy thêm nhà cung cấp / khách hàng trước','warn'); return; }
  var sups=activePartners('supplier'), cuss=activePartners('customer');
  // Phiếu thu thường từ khách hàng, phiếu chi thường cho NCC → nhóm ưu tiên lên trước
  function opts(list,label){
    if(!list.length) return '';
    return '<optgroup label="'+label+'">'+list.map(function(p){
      var debt=partnerDebt(p.id);
      return '<option value="'+p.id+'" '+(partnerId===p.id?'selected':'')+'>'+esc(p.name)+(Math.abs(debt)>0.005?' — nợ '+fmtMoney(debt)+' đ':'')+'</option>';
    }).join('')+'</optgroup>';
  }
  var partnerOpts = type==='receipt'
    ? opts(cuss,'Khách hàng (thu nợ)')+opts(sups,'Nhà cung cấp (NCC hoàn tiền)')
    : opts(sups,'Nhà cung cấp (trả nợ)')+opts(cuss,'Khách hàng (hoàn tiền khách)');
  openModal({
    title:pt.icon+' Lập '+pt.name.toLowerCase(), size:'sm',
    body:
      '<div class="field"><label>Ngày chứng từ <span class="req">*</span></label><input type="date" id="pmf-date" value="'+todayStr()+'"></div>'+
      '<div class="field"><label>Đối tác <span class="req">*</span></label><select id="pmf-partner">'+(partnerId?'':'<option value="">— Chọn đối tác —</option>')+partnerOpts+'</select></div>'+
      '<div class="field"><label>Số tiền (đ) <span class="req">*</span></label><input type="number" min="0" step="any" id="pmf-amount" style="text-align:right;font-size:16px;font-weight:700" value="'+(amount?round2(amount):'')+'" placeholder="0"></div>'+
      '<div class="field"><label>Phương thức</label><select id="pmf-method"><option value="cash">💵 Tiền mặt</option><option value="bank">🏦 Chuyển khoản</option></select></div>'+
      '<div class="field"><label>Lý do / Ghi chú</label><input id="pmf-note" placeholder="'+(type==='receipt'?'Thu nợ theo phiếu xuất…':'Thanh toán nợ nhà cung cấp…')+'"></div>',
    footer:
      '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button>'+
      '<button class="btn btn-ghost" onclick="savePayment(\''+type+'\',true)">💾 Lưu &amp; In</button>'+
      '<button class="btn '+(type==='receipt'?'btn-success':'btn-primary')+'" onclick="savePayment(\''+type+'\',false)">💾 Lưu phiếu</button>'
  });
}
function savePayment(type, doPrint){
  var res=postPayment({
    type:type,
    date:$('#pmf-date').value,
    partnerId:$('#pmf-partner').value||null,
    amount:parseNum($('#pmf-amount').value),
    method:$('#pmf-method').value,
    note:($('#pmf-note').value||'').trim()
  });
  if(!res.ok) return toast(res.error,'error');
  closeModal();
  toast('Đã lưu '+PTYPES[type].name.toLowerCase()+' số '+res.payment.code,'success');
  if(CURRENT_PAGE==='finance') refreshPage(); else if(CURRENT_PAGE==='dashboard') refreshPage();
  if(doPrint) printPayment(res.payment.id);
}

/* ---------- CHI TIẾT / HỦY / XÓA PHIẾU THU CHI ---------- */
function paymentDetail(id){
  var pm=DB.payments.find(function(x){return x.id===id;}); if(!pm) return;
  var pt=PTYPES[pm.type];
  var p=partnerById(pm.partnerId);
  openModal({
    title:pt.icon+' '+pt.name+' — '+pm.code, size:'sm',
    body:
      '<div style="font-size:14px;line-height:2.1">'+
        '<div>Ngày chứng từ: <b>'+fmtDate(pm.date)+'</b></div>'+
        '<div>'+(pm.type==='receipt'?'Thu từ':'Chi cho')+': <b>'+esc(partnerName(pm.partnerId))+'</b>'+(p?' <span class="tag">'+(p.type==='supplier'?'NCC':'Khách hàng')+'</span>':'')+'</div>'+
        '<div>Số tiền: <b style="font-size:18px" class="'+(pm.type==='receipt'?'num-pos':'num-neg')+'">'+fmtMoney(pm.amount)+' đ</b></div>'+
        '<div class="small muted">Bằng chữ: '+esc(docSoTien(pm.amount))+'</div>'+
        '<div>Phương thức: <b>'+(pm.method==='bank'?'Chuyển khoản':'Tiền mặt')+'</b></div>'+
        (pm.note?'<div>Ghi chú: '+esc(pm.note)+'</div>':'')+
        '<div class="small muted">Người lập: '+esc(pm.createdBy)+' — '+fmtDateTime(pm.createdAt)+'</div>'+
        (pm.status==='void'?'<div class="banner banner-warn" style="margin-top:8px">⛔ Phiếu đã bị hủy bởi <b>'+esc(pm.voidedBy||'')+'</b> lúc '+fmtDateTime(pm.voidedAt)+' — không còn tính vào công nợ.</div>':'')+
      '</div>',
    footer:
      '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'+
      (isAdmin()?'<button class="btn btn-danger" onclick="askDeletePayment(\''+pm.id+'\')">🗑️ Xóa</button>':'')+
      (pm.status!=='void'&&isMgr()?'<button class="btn btn-danger" onclick="askVoidPayment(\''+pm.id+'\')">⛔ Hủy phiếu</button>':'')+
      (pm.status!=='void'?'<button class="btn btn-primary" onclick="printPayment(\''+pm.id+'\')">🖨️ In phiếu</button>':'')
  });
}
function askVoidPayment(id){
  var pm=DB.payments.find(function(x){return x.id===id;}); if(!pm) return;
  confirmDlg('Hủy phiếu '+pm.code,'Hủy phiếu sẽ <b>loại khoản tiền này khỏi công nợ</b>. Phiếu vẫn được giữ trong danh sách với trạng thái "Đã hủy" để tra cứu.<br><br>Bạn chắc chắn muốn hủy?','Hủy phiếu',function(){
    var res=voidPayment(id);
    if(!res.ok) return toast(res.error,'error');
    toast('Đã hủy phiếu '+pm.code,'success');
    refreshPage();
  }, true);
}
function askDeletePayment(id){
  if(!isAdmin()) return toast('Chỉ Quản trị viên mới được xóa phiếu','warn');
  var pm=DB.payments.find(function(x){return x.id===id;}); if(!pm) return;
  confirmDlg('🗑️ Xóa phiếu '+pm.code,'Xóa vĩnh viễn phiếu <b>'+esc(pm.code)+'</b> ('+fmtMoney(pm.amount)+' đ) khỏi danh sách — không thể khôi phục và số phiếu sẽ bị khuyết.<br><br>Bạn chắc chắn?','Xóa vĩnh viễn',function(){
    var res=deletePayment(id);
    if(!res.ok) return toast(res.error,'error');
    toast('Đã xóa phiếu '+pm.code,'success');
    refreshPage();
  }, true);
}

/* ---------- IN PHIẾU THU / CHI ---------- */
function printPayment(id){
  var pm=DB.payments.find(function(x){return x.id===id;}); if(!pm) return;
  var s=DB.settings||{};
  var p=partnerById(pm.partnerId);
  var d=pm.date.split('-');
  var isRc=pm.type==='receipt';
  $('#print-area').innerHTML=
  '<div class="pv">'+
    '<div class="pv-head">'+
      '<div class="co"><b>'+esc(s.companyName||'CÔNG TY')+'</b><br>'+esc(s.companyAddress||'')+(s.companyPhone?'<br>ĐT: '+esc(s.companyPhone):'')+(s.companyTax?'<br>MST: '+esc(s.companyTax):'')+'</div>'+
      '<div style="text-align:right">Số: <b>'+esc(pm.code)+'</b><br><i>Ngày '+d[2]+' tháng '+d[1]+' năm '+d[0]+'</i></div>'+
    '</div>'+
    '<h1>'+(isRc?'PHIẾU THU':'PHIẾU CHI')+'</h1>'+
    '<div class="pv-code">Người lập: '+esc(pm.createdBy)+(pm.status==='void'?' — <b>PHIẾU ĐÃ HỦY</b>':'')+'</div>'+
    '<div class="pv-info">'+
      '<div>Họ tên người '+(isRc?'nộp':'nhận')+' tiền: <b>'+esc(partnerName(pm.partnerId))+'</b></div>'+
      (p&&p.address?'<div>Địa chỉ: '+esc(p.address)+'</div>':'')+
      '<div>Lý do '+(isRc?'thu':'chi')+': '+esc(pm.note||(isRc?'Thu nợ khách hàng':'Thanh toán nợ nhà cung cấp'))+'</div>'+
      '<div>Số tiền: <b style="font-size:15px">'+fmtMoney(pm.amount)+' đ</b> ('+(pm.method==='bank'?'chuyển khoản':'tiền mặt')+')</div>'+
      '<div><i>Bằng chữ: <b>'+docSoTien(pm.amount)+'</b></i></div>'+
    '</div>'+
    '<div class="pv-sign">'+['Giám đốc','Kế toán','Thủ quỹ',(isRc?'Người nộp tiền':'Người nhận tiền')].map(function(sg){return '<div><b>'+sg+'</b><i>(Ký, họ tên)</i><div class="sp"></div></div>';}).join('')+'</div>'+
  '</div>';
  window.print();
}

/* ---------- TAB CÔNG NỢ ---------- */
function finDebtTab(type){
  var isSup=type==='supplier';
  var rows=debtSummary(type);
  var totalOwe=0, totalOver=0;
  rows.forEach(function(r){ if(r.balance>0) totalOwe+=r.balance; else totalOver+=(-r.balance); });
  var html=rows.map(function(r){
    var b=r.balance;
    return '<tr class="click" onclick="debtStatement(\''+r.partner.id+'\')">'+
      '<td><b>'+esc(r.partner.code)+'</b></td>'+
      '<td>'+esc(r.partner.name)+(r.partner.phone?'<div class="small muted">'+esc(r.partner.phone)+'</div>':'')+'</td>'+
      '<td class="r">'+fmtMoney(r.gross)+'</td>'+
      '<td class="r">'+(r.returned?fmtMoney(r.returned):'<span class="muted">—</span>')+'</td>'+
      '<td class="r">'+fmtMoney(r.paidNet)+'</td>'+
      '<td class="r">'+(Math.abs(b)<0.005?'<span class="tag tag-green">✓ Hết nợ</span>':b>0?'<b class="num-neg">'+fmtMoney(b)+'</b>':'<b style="color:var(--amber)">'+fmtMoney(-b)+' (trả thừa)</b>')+'</td>'+
      '<td class="c" style="white-space:nowrap">'+
        '<button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();debtStatement(\''+r.partner.id+'\')">Sổ chi tiết</button> '+
        (b>0.005?'<button class="btn btn-xs '+(isSup?'btn-primary':'btn-ghost')+'" onclick="event.stopPropagation();paymentForm(\''+(isSup?'payment':'receipt')+'\',\''+r.partner.id+'\','+b+')">'+(isSup?'💸 Trả nợ':'💰 Thu nợ')+'</button>':'')+
      '</td>'+
    '</tr>';
  }).join('');
  $('#fin-body').innerHTML=
  '<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">'+
    '<div class="kpi"><div class="ic" style="background:'+(isSup?'#fff7ed':'#eff6ff')+'">'+(isSup?'💸':'💰')+'</div><div><div class="v '+(totalOwe>0?'num-neg':'')+'">'+fmtMoney(totalOwe)+' đ</div><div class="l">'+(isSup?'Tổng còn phải trả nhà cung cấp':'Tổng còn phải thu khách hàng')+'</div></div></div>'+
    (totalOver>0.005?'<div class="kpi"><div class="ic" style="background:#fffbeb">⚖️</div><div><div class="v" style="color:var(--amber)">'+fmtMoney(totalOver)+' đ</div><div class="l">'+(isSup?'NCC đang giữ thừa của ta':'Ta đang giữ thừa của khách')+'</div></div></div>':'')+
  '</div>'+
  '<div class="toolbar"><div class="grow" style="font-size:13px;color:var(--muted)">Bấm vào từng dòng để xem <b>sổ chi tiết công nợ</b> theo thời gian. Số liệu tính từ các phiếu đã ghi sổ và phiếu thu / chi.</div>'+
    '<div class="toolbar-right"><button class="btn btn-ghost btn-sm" onclick="exportDebts(\''+type+'\')">📊 Xuất Excel</button></div></div>'+
  '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr>'+
    '<th>Mã</th><th>'+(isSup?'Nhà cung cấp':'Khách hàng')+'</th><th class="r">'+(isSup?'Tổng mua (đ)':'Tổng bán (đ)')+'</th><th class="r">Trả hàng (đ)</th><th class="r">Đã thanh toán (đ)</th><th class="r">'+(isSup?'Còn phải trả (đ)':'Còn phải thu (đ)')+'</th><th class="c">Thao tác</th>'+
  '</tr></thead><tbody>'+(html||'<tr><td colspan="7"><div class="empty">Chưa phát sinh công nợ với '+(isSup?'nhà cung cấp':'khách hàng')+' nào</div></td></tr>')+'</tbody></table></div>';
}

/* ---------- SỔ CHI TIẾT CÔNG NỢ ĐỐI TÁC ---------- */
function debtStatement(partnerId){
  var p=partnerById(partnerId); if(!p) return;
  var isSup=p.type==='supplier';
  var entries=partnerStatement(partnerId);
  var bal=entries.length?entries[entries.length-1].balance:0;
  var rows=entries.map(function(e){
    return '<tr class="click" onclick="'+(e.kind==='voucher'?'closeModal();voucherDetail(\''+e.id+'\')':'closeModal();paymentDetail(\''+e.id+'\')')+'">'+
      '<td>'+fmtDate(e.date)+'</td>'+
      '<td><b>'+esc(e.code)+'</b></td>'+
      '<td>'+e.label+'</td>'+
      '<td class="r">'+fmtMoney(e.total)+'</td>'+
      '<td class="r">'+(e.delta>0?'<b class="num-neg">+'+fmtMoney(e.delta)+'</b>':e.delta<0?'<b class="num-pos">−'+fmtMoney(-e.delta)+'</b>':'<span class="muted">0</span>')+'</td>'+
      '<td class="r"><b>'+fmtMoney(e.balance)+'</b></td>'+
    '</tr>';
  }).join('');
  openModal({
    title:'📒 Sổ công nợ — '+p.name, size:'lg',
    body:
      '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:13px;font-size:13.5px;align-items:center">'+
        '<span class="tag">'+(isSup?'Nhà cung cấp':'Khách hàng')+' · '+esc(p.code)+'</span>'+
        (p.phone?'<span class="muted">☎ '+esc(p.phone)+'</span>':'')+
        '<span style="margin-left:auto">'+(isSup?'Còn phải trả':'Còn phải thu')+': <b style="font-size:16px" class="'+(bal>0.005?'num-neg':'num-pos')+'">'+fmtMoney(bal)+' đ</b></span>'+
      '</div>'+
      (entries.length?'<div class="tbl-wrap" style="max-height:52vh;overflow:auto"><table class="tbl"><thead><tr>'+
        '<th>Ngày</th><th>Chứng từ</th><th>Loại</th><th class="r">Giá trị (đ)</th><th class="r">Phát sinh nợ (đ)</th><th class="r">Số dư (đ)</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table></div><div class="small muted" style="margin-top:8px">Phát sinh dương = tăng nợ · âm = giảm nợ (thanh toán / trả hàng). Bấm vào dòng để mở chứng từ gốc.</div>'
      :'<div class="empty">Chưa có phát sinh nào với đối tác này</div>'),
    footer:
      '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'+
      '<button class="btn btn-success" onclick="closeModal();paymentForm(\'receipt\',\''+p.id+'\','+((!isSup&&bal>0.005)?bal:(isSup&&bal<-0.005)?-bal:0)+')">💰 Lập phiếu thu</button>'+
      '<button class="btn btn-primary" onclick="closeModal();paymentForm(\'payment\',\''+p.id+'\','+((isSup&&bal>0.005)?bal:(!isSup&&bal<-0.005)?-bal:0)+')">💸 Lập phiếu chi</button>'
  });
}

/* ---------- XUẤT EXCEL ---------- */
function exportPayments(){
  var rows=[['Số phiếu','Loại','Ngày','Đối tác','Phương thức','Số tiền','Ghi chú','Người lập','Trạng thái']];
  DB.payments.forEach(function(pm){
    rows.push([pm.code, PTYPES[pm.type].name, pm.date, partnerName(pm.partnerId), pm.method==='bank'?'Chuyển khoản':'Tiền mặt', pm.amount, pm.note||'', pm.createdBy, pm.status==='void'?'Đã hủy':'Đã ghi sổ']);
  });
  xlsxExport('phieu-thu-chi-'+todayStr(), [{name:'ThuChi', rows:rows}]);
}
function exportDebts(type){
  var isSup=type==='supplier';
  var rows=[['Mã','Tên '+(isSup?'nhà cung cấp':'khách hàng'),'Điện thoại',(isSup?'Tổng mua':'Tổng bán'),'Trả hàng','Đã thanh toán',(isSup?'Còn phải trả':'Còn phải thu')]];
  debtSummary(type).forEach(function(r){
    rows.push([r.partner.code, r.partner.name, r.partner.phone||'', r.gross, r.returned, r.paidNet, r.balance]);
  });
  xlsxExport('cong-no-'+(isSup?'ncc':'khach-hang')+'-'+todayStr(), [{name:'CongNo', rows:rows}]);
}
