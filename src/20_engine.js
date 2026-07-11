'use strict';
/* ==================== ENGINE: TỒN KHO, GIÁ VỐN, PHIẾU ==================== */

function getStock(whId, pid){
  return (DB.stocks[whId] && DB.stocks[whId][pid]) || 0;
}
function addStock(whId, pid, delta){
  if(!DB.stocks[whId]) DB.stocks[whId]={};
  var nv=round3((DB.stocks[whId][pid]||0)+delta);
  if(Math.abs(nv)<1e-9) delete DB.stocks[whId][pid];
  else DB.stocks[whId][pid]=nv;
}
function totalStock(pid){
  var t=0;
  for(var w in DB.stocks){ t+=(DB.stocks[w][pid]||0); }
  return round3(t);
}
function stockValueTotal(){
  var v=0;
  DB.products.forEach(function(p){ v+=totalStock(p.id)*(p.costPrice||0); });
  return v;
}
function nextCode(type){
  // Chống trùng mã: kể cả khi DB.counters bị mất/hỏng, dò tiếp cho tới mã chưa tồn tại
  var c=DB.counters[type]||1, code;
  do{
    code=VTYPES[type].code + String(c).padStart(5,'0');
    c++;
  }while(DB.vouchers.some(function(v){return v.code===code;}));
  DB.counters[type]=c;
  return code;
}
/* Phiếu có giá trị tiền với đối tác (tham gia công nợ) */
function isMoneyVoucher(t){ return t==='in'||t==='out'||t==='return_sup'||t==='return_cus'; }

/*
 postVoucher(inp) — ghi 1 phiếu và cập nhật tồn + giá vốn.
 inp = { type, date, warehouseId, toWarehouseId?, partnerId?, note?, lines:[{productId, qty, price}] }
 - in         : nhập kho (qty>0, price = đơn giá nhập) → tăng tồn, cập nhật giá vốn bình quân gia quyền
 - out        : xuất kho (price = giá bán) → giảm tồn, chốt cost = giá vốn hiện tại để tính lợi nhuận
 - transfer   : chuyển kho nguồn → đích (không giá trị doanh thu)
 - return_sup : trả hàng cho NCC (giảm tồn, price = giá trả lại, mặc định giá vốn)
 - return_cus : khách trả lại (tăng tồn, price = giá hoàn cho khách, trừ doanh thu)
 - adjust     : điều chỉnh kiểm kê (qty là chênh lệch +/-, giá trị tính theo giá vốn)
*/
function validateVoucherInput(inp){
  var t=inp.type, vt=VTYPES[t];
  if(!vt) return {ok:false, error:'Loại phiếu không hợp lệ'};
  if(!inp.warehouseId || !whById(inp.warehouseId)) return {ok:false, error:'Chưa chọn kho'};
  if(t==='transfer'){
    if(!inp.toWarehouseId || !whById(inp.toWarehouseId)) return {ok:false, error:'Chưa chọn kho nhận'};
    if(inp.toWarehouseId===inp.warehouseId) return {ok:false, error:'Kho xuất và kho nhận phải khác nhau'};
  }
  var lines=(inp.lines||[]).filter(function(l){
    return l.productId && prodById(l.productId) && (t==='adjust' ? Math.abs(+l.qty||0)>1e-9 : (+l.qty||0)>0);
  });
  if(!lines.length) return {ok:false, error:'Phiếu phải có ít nhất một dòng hàng với số lượng hợp lệ'};

  // Chặn đơn giá / giá vốn âm — giá âm phá giá vốn bình quân và mọi báo cáo phía sau
  for(var li=0; li<lines.length; li++){
    var lneg=lines[li];
    if(parseNum(lneg.price)<0 || (lneg.costManual!==undefined && String(lneg.costManual)!=='' && parseNum(lneg.costManual)<0)){
      var pneg=prodById(lneg.productId);
      return {ok:false, error:'Đơn giá / giá vốn âm không hợp lệ ở dòng "'+(pneg?pneg.name:'?')+'"'};
    }
  }

  // Kiểm tra tồn cho các luồng xuất
  var need={};
  lines.forEach(function(l){
    var q=round3(+l.qty);
    if(t==='out'||t==='return_sup'||t==='transfer') need[l.productId]=(need[l.productId]||0)+q;
    if(t==='adjust' && q<0) need[l.productId]=(need[l.productId]||0)+(-q);
  });
  for(var pid in need){
    var have=getStock(inp.warehouseId, pid);
    if(need[pid] > have + 1e-9){
      var p=prodById(pid);
      return {ok:false, error:'Không đủ tồn kho: "'+(p?p.name:'?')+'" tại '+whName(inp.warehouseId)+' chỉ còn '+fmtQty(have)+' '+(p?p.unit:'')};
    }
  }
  return {ok:true, lines:lines};
}

/* Áp các dòng hàng (đã validate) vào phiếu v: cập nhật tồn kho + giá vốn, ghi v.lines/v.total */
function applyVoucherLines(v, lines){
  var t=v.type;
  v.lines=[]; v.total=0;
  lines.forEach(function(l){
    var p=prodById(l.productId);
    var qty=round3(+l.qty);
    var price=round2(parseNum(l.price));
    var cost=round2(p.costPrice||0);
    var manualCost=false;

    if(t==='in'){
      var tq=totalStock(p.id);
      var newCost=(tq+qty)>0 ? ((tq*(p.costPrice||0)) + qty*price)/(tq+qty) : price;
      p.costPrice=round2(newCost);
      addStock(v.warehouseId, p.id, qty);
      cost=p.costPrice;
    } else if(t==='out'){
      addStock(v.warehouseId, p.id, -qty);
    } else if(t==='transfer'){
      addStock(v.warehouseId, p.id, -qty);
      addStock(v.toWarehouseId, p.id, qty);
      price=0;
    } else if(t==='return_sup'){
      addStock(v.warehouseId, p.id, -qty);
      if(!price) price=cost;
    } else if(t==='return_cus'){
      addStock(v.warehouseId, p.id, qty);
      // Giá vốn hàng khách trả: mặc định là giá vốn bình quân hiện tại; Quản lý/Quản trị
      // có thể nhập tay giá vốn gốc của lần bán để lợi nhuận không bị méo (đồng thuận hội đồng soát xét)
      if(l.costManual!==undefined && String(l.costManual)!==''){
        var mc=parseNum(l.costManual);
        if(mc>=0){ cost=round2(mc); manualCost=true; }
      }
    } else if(t==='adjust'){
      addStock(v.warehouseId, p.id, qty); // qty là chênh lệch +/-
      price=cost;
    }
    var line={ productId:p.id, sku:p.sku, name:p.name, unit:p.unit, qty:qty, price:price, cost:cost };
    if(manualCost) line.costManual=true;
    v.lines.push(line);
    v.total=round2(v.total + qty*price);
  });
}

function postVoucher(inp){
  var val=validateVoucherInput(inp);
  if(!val.ok) return val;
  var t=inp.type;
  var v={
    id:uid(), code:nextCode(t), type:t,
    date:(inp.date||todayStr()).slice(0,10),
    warehouseId:inp.warehouseId, toWarehouseId:inp.toWarehouseId||null,
    partnerId:inp.partnerId||null, note:inp.note||'',
    lines:[], total:0, status:'posted',
    createdBy:SESSION?SESSION.username:'hệ thống', createdAt:nowISO()
  };
  applyVoucherLines(v, val.lines);
  v.paid=isMoneyVoucher(t) ? Math.max(0, round2(parseNum(inp.paid))) : 0;
  DB.vouchers.unshift(v);
  audit('Tạo phiếu', VTYPES[t].name+' '+v.code+' — '+v.lines.length+' dòng, tổng '+fmtMoney(v.total)+' đ'+(isMoneyVoucher(t)&&v.paid<v.total?', đã TT '+fmtMoney(v.paid)+' đ':''));
  saveDB();
  return {ok:true, voucher:v};
}

/* Cộng lại đúng tác động số lượng của nội dung phiếu cũ (nghịch đảo applyReversal, không đụng giá vốn) */
function reapplyOldEffects(type, old){
  old.lines.forEach(function(l){
    if(type==='in'||type==='return_cus') addStock(old.warehouseId, l.productId, +l.qty);
    else if(type==='out'||type==='return_sup') addStock(old.warehouseId, l.productId, -l.qty);
    else if(type==='transfer'){
      addStock(old.warehouseId, l.productId, -l.qty);
      addStock(old.toWarehouseId, l.productId, +l.qty);
    }
    else if(type==='adjust') addStock(old.warehouseId, l.productId, +l.qty);
  });
}

/* Sửa phiếu đã ghi sổ: hoàn tác tác động cũ → kiểm tra nội dung mới → áp dụng.
   Nếu nội dung mới không hợp lệ thì hoàn nguyên nguyên trạng (rollback). */
function updateVoucher(id, inp){
  var v=DB.vouchers.find(function(x){return x.id===id;});
  if(!v) return {ok:false, error:'Không tìm thấy phiếu'};
  if(v.status==='void') return {ok:false, error:'Phiếu đã hủy — không thể sửa'};
  if(inp.type && inp.type!==v.type) return {ok:false, error:'Không thể đổi loại phiếu'};
  inp.type=v.type;

  var old={ warehouseId:v.warehouseId, toWarehouseId:v.toWarehouseId, lines:v.lines };
  var r=applyReversal(v);
  if(!r.ok) return {ok:false, error:'Không thể sửa: '+r.error};

  var val=validateVoucherInput(inp);
  if(!val.ok){
    reapplyOldEffects(v.type, old); // rollback về nguyên trạng
    return val;
  }
  v.date=(inp.date||v.date).slice(0,10);
  v.warehouseId=inp.warehouseId;
  v.toWarehouseId=inp.toWarehouseId||null;
  v.partnerId=inp.partnerId||null;
  v.note=inp.note||'';
  applyVoucherLines(v, val.lines);
  v.paid=isMoneyVoucher(v.type) ? Math.max(0, round2(parseNum(inp.paid))) : 0;
  v.editedBy=SESSION?SESSION.username:'hệ thống';
  v.editedAt=nowISO();
  audit('Sửa phiếu', VTYPES[v.type].name+' '+v.code+' — '+v.lines.length+' dòng, tổng mới '+fmtMoney(v.total)+' đ');
  saveDB();
  return {ok:true, voucher:v};
}

/* Hoàn tác tác động tồn kho của một phiếu (dùng chung cho hủy & xóa) */
function applyReversal(v){
  var deltas=[];
  v.lines.forEach(function(l){
    if(v.type==='in'||v.type==='return_cus') deltas.push({wh:v.warehouseId, pid:l.productId, d:-l.qty});
    else if(v.type==='out'||v.type==='return_sup') deltas.push({wh:v.warehouseId, pid:l.productId, d:+l.qty});
    else if(v.type==='transfer'){
      deltas.push({wh:v.toWarehouseId, pid:l.productId, d:-l.qty});
      deltas.push({wh:v.warehouseId, pid:l.productId, d:+l.qty});
    }
    else if(v.type==='adjust') deltas.push({wh:v.warehouseId, pid:l.productId, d:-l.qty});
  });
  var byKey={};
  deltas.forEach(function(x){ var k=x.wh+'|'+x.pid; byKey[k]=(byKey[k]||0)+x.d; });
  for(var k in byKey){
    var parts=k.split('|');
    if(getStock(parts[0],parts[1]) + byKey[k] < -1e-9){
      var p=prodById(parts[1]);
      return {ok:false, error:'tồn kho hiện tại của "'+(p?p.name:'?')+'" không đủ để hoàn tác phiếu này'};
    }
  }
  deltas.forEach(function(x){ addStock(x.wh, x.pid, x.d); });
  return {ok:true};
}

/* Hủy phiếu: hoàn tác tồn kho, giữ lại phiếu trong lịch sử (giá vốn bình quân giữ nguyên) */
function voidVoucher(id){
  var v=DB.vouchers.find(function(x){return x.id===id;});
  if(!v) return {ok:false, error:'Không tìm thấy phiếu'};
  if(v.status==='void') return {ok:false, error:'Phiếu này đã hủy trước đó'};
  var r=applyReversal(v);
  if(!r.ok) return {ok:false, error:'Không thể hủy: '+r.error};
  v.status='void';
  v.voidedBy=SESSION?SESSION.username:'hệ thống';
  v.voidedAt=nowISO();
  audit('Hủy phiếu', VTYPES[v.type].name+' '+v.code);
  saveDB();
  return {ok:true};
}

/* Xóa phiếu vĩnh viễn: nếu phiếu đang ghi sổ thì hoàn tác tồn kho trước, rồi xóa khỏi lịch sử */
function deleteVoucher(id){
  var v=DB.vouchers.find(function(x){return x.id===id;});
  if(!v) return {ok:false, error:'Không tìm thấy phiếu'};
  if(v.status!=='void'){
    var r=applyReversal(v);
    if(!r.ok) return {ok:false, error:'Không thể xóa: '+r.error};
  }
  DB.vouchers=DB.vouchers.filter(function(x){return x.id!==id;});
  audit('Xóa phiếu', VTYPES[v.type].name+' '+v.code+' — '+v.lines.length+' dòng, tổng '+fmtMoney(v.total)+' đ'+(v.status==='void'?' (phiếu đã hủy từ trước)':' (đã hoàn tác tồn kho trước khi xóa)'));
  saveDB();
  return {ok:true};
}

/* ---------- Tính lại giá vốn toàn bộ (replay theo trình tự thời gian) ----------
 Dùng khi giá vốn bị lệch do sửa/hủy/xóa phiếu nhập trong quá khứ (BQGQ vốn không hồi tố).
 Chỉ tính lại CHIỀU GIÁ TRỊ: costPrice sản phẩm + cost từng dòng phiếu (+ price/total của
 phiếu kiểm kê vì giá trị điều chỉnh tính theo giá vốn). KHÔNG đụng số lượng tồn kho.
 Giá vốn nhập tay trên phiếu khách trả (costManual) được tôn trọng, không ghi đè. */
function recostAll(){
  var vs=DB.vouchers.filter(function(v){return v.status!=='void';}).slice().sort(function(a,b){
    if(a.date!==b.date) return a.date<b.date?-1:1;
    return String(a.createdAt||'')<String(b.createdAt||'')?-1:1;
  });
  var sim={}; // pid -> {qty, cost} — trạng thái BQGQ toàn công ty mô phỏng theo dòng thời gian
  function st(pid){ return sim[pid]||(sim[pid]={qty:0, cost:0}); }
  var changedLines=0, changedProducts=0;
  vs.forEach(function(v){
    var newTotal=0;
    v.lines.forEach(function(l){
      var s=st(l.productId);
      var c=round2(s.cost);
      if(v.type==='in'){
        var nq=round3(s.qty+l.qty);
        s.cost = nq>0 ? round2(((s.qty*s.cost)+l.qty*l.price)/nq) : round2(l.price);
        s.qty=nq;
        if(l.cost!==s.cost){ l.cost=s.cost; changedLines++; }
      } else if(v.type==='out'){
        if(l.cost!==c){ l.cost=c; changedLines++; }
        s.qty=round3(s.qty-l.qty);
      } else if(v.type==='transfer'){
        if(l.cost!==c){ l.cost=c; changedLines++; }
      } else if(v.type==='return_sup'){
        if(l.cost!==c){ l.cost=c; changedLines++; }
        s.qty=round3(s.qty-l.qty);
      } else if(v.type==='return_cus'){
        if(!l.costManual && l.cost!==c){ l.cost=c; changedLines++; }
        s.qty=round3(s.qty+l.qty);
      } else if(v.type==='adjust'){
        if(l.cost!==c){ l.cost=c; changedLines++; }
        if(l.price!==c) l.price=c; // giá trị điều chỉnh kiểm kê tính theo giá vốn
        s.qty=round3(s.qty+l.qty);
      }
      newTotal=round2(newTotal + l.qty*(l.price||0));
    });
    if(v.type==='adjust' && v.total!==newTotal) v.total=newTotal;
  });
  DB.products.forEach(function(p){
    var s=sim[p.id];
    if(s){
      var nc=round2(s.cost);
      if(p.costPrice!==nc){ p.costPrice=nc; changedProducts++; }
    }
  });
  audit('Tính lại giá vốn toàn bộ', 'Cập nhật '+changedProducts+' sản phẩm, '+changedLines+' dòng phiếu (replay '+vs.length+' phiếu theo trình tự thời gian)');
  saveDB();
  return {ok:true, changedProducts:changedProducts, changedLines:changedLines, replayed:vs.length};
}

/* ==================== CÔNG NỢ & PHIẾU THU / CHI ====================
 Quy ước dấu (theo góc nhìn CỦA TA):
 - NCC   (phải trả): nhập +(total−paid) · trả hàng NCC −(total−paid) · phiếu chi −amount · phiếu thu +amount
 - Khách (phải thu): xuất +(total−paid) · khách trả hàng −(total−paid) · phiếu thu −amount · phiếu chi +amount
 Số dương = đối tác đang nợ theo chiều thông thường; số âm = trả thừa / hoàn ngược.
 Phiếu đã hủy (status='void') không tính. paid trên phiếu trả hàng = tiền đã hoàn ngay khi trả. */
function nextPayCode(type){
  var key='pay_'+type;
  var c=DB.counters[key]||1, code;
  do{
    code=PTYPES[type].code + String(c).padStart(5,'0');
    c++;
  }while(DB.payments.some(function(p){return p.code===code;}));
  DB.counters[key]=c;
  return code;
}
function voucherDebtDelta(v){
  if(v.status==='void' || !v.partnerId || !isMoneyVoucher(v.type)) return 0;
  var paid=(v.paid===undefined)?(v.total||0):v.paid;
  var d=round2((v.total||0)-paid);
  return (v.type==='in'||v.type==='out') ? d : -d;
}
function paymentDebtDelta(pm, partnerType){
  if(pm.status==='void') return 0;
  if(partnerType==='supplier') return pm.type==='payment' ? -pm.amount : pm.amount;
  return pm.type==='receipt' ? -pm.amount : pm.amount;
}
function postPayment(inp){
  var pt=PTYPES[inp.type];
  if(!pt) return {ok:false, error:'Loại phiếu thu/chi không hợp lệ'};
  var partner=partnerById(inp.partnerId);
  if(!partner) return {ok:false, error:'Chưa chọn đối tác'};
  var amount=round2(parseNum(inp.amount));
  if(!(amount>0)) return {ok:false, error:'Số tiền phải lớn hơn 0'};
  var pm={
    id:uid(), code:nextPayCode(inp.type), type:inp.type,
    date:(inp.date||todayStr()).slice(0,10),
    partnerId:partner.id, amount:amount,
    method:inp.method==='bank'?'bank':'cash',
    note:inp.note||'', status:'posted',
    createdBy:SESSION?SESSION.username:'hệ thống', createdAt:nowISO()
  };
  DB.payments.unshift(pm);
  audit('Tạo phiếu', pt.name+' '+pm.code+' — '+partner.name+': '+fmtMoney(amount)+' đ');
  saveDB();
  return {ok:true, payment:pm};
}
function voidPayment(id){
  var pm=DB.payments.find(function(x){return x.id===id;});
  if(!pm) return {ok:false, error:'Không tìm thấy phiếu'};
  if(pm.status==='void') return {ok:false, error:'Phiếu này đã hủy trước đó'};
  pm.status='void';
  pm.voidedBy=SESSION?SESSION.username:'hệ thống';
  pm.voidedAt=nowISO();
  audit('Hủy phiếu', PTYPES[pm.type].name+' '+pm.code);
  saveDB();
  return {ok:true};
}
function deletePayment(id){
  var pm=DB.payments.find(function(x){return x.id===id;});
  if(!pm) return {ok:false, error:'Không tìm thấy phiếu'};
  DB.payments=DB.payments.filter(function(x){return x.id!==id;});
  audit('Xóa phiếu', PTYPES[pm.type].name+' '+pm.code+' — '+partnerName(pm.partnerId)+': '+fmtMoney(pm.amount)+' đ');
  saveDB();
  return {ok:true};
}
/* Công nợ hiện tại của 1 đối tác */
function partnerDebt(partnerId){
  var partner=partnerById(partnerId); if(!partner) return 0;
  var d=0;
  DB.vouchers.forEach(function(v){ if(v.partnerId===partnerId) d+=voucherDebtDelta(v); });
  DB.payments.forEach(function(pm){ if(pm.partnerId===partnerId) d+=paymentDebtDelta(pm, partner.type); });
  return round2(d);
}
/* Bảng tổng hợp công nợ theo loại đối tác ('supplier'|'customer') */
function debtSummary(type){
  var rows=[];
  DB.partners.filter(function(p){return p.type===type;}).forEach(function(p){
    var gross=0, returned=0, paidNet=0, has=false;
    DB.vouchers.forEach(function(v){
      if(v.partnerId!==p.id || v.status==='void' || !isMoneyVoucher(v.type)) return;
      has=true;
      var paid=(v.paid===undefined)?(v.total||0):v.paid;
      if(v.type==='in'||v.type==='out'){ gross+=(v.total||0); paidNet+=paid; }
      else { returned+=(v.total||0); paidNet-=paid; }
    });
    DB.payments.forEach(function(pm){
      if(pm.partnerId!==p.id || pm.status==='void') return;
      has=true;
      paidNet += (type==='supplier') ? (pm.type==='payment'?pm.amount:-pm.amount)
                                     : (pm.type==='receipt'?pm.amount:-pm.amount);
    });
    var balance=round2(gross-returned-paidNet);
    if(has) rows.push({partner:p, gross:round2(gross), returned:round2(returned), paidNet:round2(paidNet), balance:balance});
  });
  rows.sort(function(a,b){ return b.balance-a.balance; });
  return rows;
}
/* Sổ chi tiết công nợ 1 đối tác: các dòng phát sinh theo thời gian + số dư lũy kế */
function partnerStatement(partnerId){
  var p=partnerById(partnerId); if(!p) return [];
  var entries=[];
  DB.vouchers.forEach(function(v){
    if(v.partnerId!==partnerId || v.status==='void' || !isMoneyVoucher(v.type)) return;
    entries.push({date:v.date, time:v.createdAt||'', code:v.code, kind:'voucher', id:v.id,
      label:VTYPES[v.type].icon+' '+VTYPES[v.type].name, total:v.total||0,
      paid:(v.paid===undefined)?(v.total||0):v.paid, delta:voucherDebtDelta(v)});
  });
  DB.payments.forEach(function(pm){
    if(pm.partnerId!==partnerId || pm.status==='void') return;
    entries.push({date:pm.date, time:pm.createdAt||'', code:pm.code, kind:'payment', id:pm.id,
      label:PTYPES[pm.type].icon+' '+PTYPES[pm.type].name+(pm.method==='bank'?' (CK)':' (TM)'), total:pm.amount,
      paid:null, delta:paymentDebtDelta(pm, p.type)});
  });
  entries.sort(function(a,b){ return a.date===b.date ? (a.time<b.time?-1:1) : (a.date<b.date?-1:1); });
  var bal=0;
  entries.forEach(function(e){ bal=round2(bal+e.delta); e.balance=bal; });
  return entries;
}
/* Tổng phải thu / phải trả (chỉ cộng số dương — trả thừa xem ở từng đối tác) */
function totalReceivable(){ var s=0; debtSummary('customer').forEach(function(r){ if(r.balance>0) s+=r.balance; }); return round2(s); }
function totalPayable(){ var s=0; debtSummary('supplier').forEach(function(r){ if(r.balance>0) s+=r.balance; }); return round2(s); }

/* ---------- Cảnh báo tồn thấp ---------- */
function lowStockProducts(){
  return activeProducts()
    .filter(function(p){ return (p.minStock||0)>0 && totalStock(p.id) < p.minStock; })
    .sort(function(a,b){ return (totalStock(a.id)/a.minStock) - (totalStock(b.id)/b.minStock); });
}

/* ---------- Báo cáo Nhập-Xuất-Tồn ---------- */
function reportNXT(from, to, whId){
  var rows={};
  DB.products.forEach(function(p){
    rows[p.id]={ product:p, openQ:0, inQ:0, inV:0, outQ:0, outV:0 };
  });
  DB.vouchers.forEach(function(v){
    if(v.status==='void') return;
    if(!whId && v.type==='transfer') return; // phạm vi toàn công ty: chuyển nội bộ không tính
    v.lines.forEach(function(l){
      var r=rows[l.productId]; if(!r) return;
      var effects=[];
      if(v.type==='in')             effects.push({wh:v.warehouseId, dq:+l.qty, val:l.qty*l.price, dir:'in'});
      else if(v.type==='return_cus')effects.push({wh:v.warehouseId, dq:+l.qty, val:l.qty*l.cost,  dir:'in'});
      else if(v.type==='out')       effects.push({wh:v.warehouseId, dq:-l.qty, val:l.qty*l.cost,  dir:'out'});
      else if(v.type==='return_sup')effects.push({wh:v.warehouseId, dq:-l.qty, val:l.qty*l.cost,  dir:'out'});
      else if(v.type==='transfer'){
        effects.push({wh:v.warehouseId,   dq:-l.qty, val:l.qty*l.cost, dir:'out'});
        effects.push({wh:v.toWarehouseId, dq:+l.qty, val:l.qty*l.cost, dir:'in'});
      }
      else if(v.type==='adjust'){
        effects.push({wh:v.warehouseId, dq:l.qty, val:Math.abs(l.qty)*l.cost, dir:(l.qty>=0?'in':'out')});
      }
      effects.forEach(function(e){
        if(whId && e.wh!==whId) return;
        if(v.date<from){ r.openQ=round3(r.openQ+e.dq); }
        else if(v.date<=to){
          if(e.dir==='in'){ r.inQ=round3(r.inQ+Math.abs(e.dq)); r.inV+=e.val; }
          else { r.outQ=round3(r.outQ+Math.abs(e.dq)); r.outV+=e.val; }
        }
      });
    });
  });
  var out=[];
  for(var pid in rows){
    var r=rows[pid];
    r.closeQ=round3(r.openQ + r.inQ - r.outQ);
    if(r.openQ||r.inQ||r.outQ||r.closeQ) out.push(r);
  }
  out.sort(function(a,b){ return a.product.name.localeCompare(b.product.name,'vi'); });
  return out;
}

/* ---------- Báo cáo lợi nhuận (doanh thu bán hàng - giá vốn, trừ hàng khách trả) ---------- */
function reportProfit(from, to){
  var rows={};
  function row(pid){
    if(!rows[pid]){
      var p=prodById(pid);
      rows[pid]={ product:p, soldQ:0, returnQ:0, revenue:0, cogs:0 };
    }
    return rows[pid];
  }
  DB.vouchers.forEach(function(v){
    if(v.status==='void') return;
    if(v.date<from || v.date>to) return;
    if(v.type==='out'){
      v.lines.forEach(function(l){
        var r=row(l.productId); if(!r.product) return;
        r.soldQ=round3(r.soldQ+l.qty); r.revenue+=l.qty*l.price; r.cogs+=l.qty*l.cost;
      });
    } else if(v.type==='return_cus'){
      v.lines.forEach(function(l){
        var r=row(l.productId); if(!r.product) return;
        r.returnQ=round3(r.returnQ+l.qty); r.revenue-=l.qty*l.price; r.cogs-=l.qty*l.cost;
      });
    }
  });
  var out=[], sum={revenue:0, cogs:0, profit:0, soldQ:0, returnQ:0};
  for(var pid in rows){
    var r=rows[pid];
    if(!r.product) continue;
    if(!r.soldQ && !r.returnQ) continue;
    r.netQ=round3(r.soldQ-r.returnQ);
    r.profit=r.revenue-r.cogs;
    r.margin=r.revenue>0 ? (r.profit/r.revenue*100) : 0;
    sum.revenue+=r.revenue; sum.cogs+=r.cogs; sum.profit+=r.profit;
    sum.soldQ=round3(sum.soldQ+r.soldQ); sum.returnQ=round3(sum.returnQ+r.returnQ);
    out.push(r);
  }
  out.sort(function(a,b){ return b.revenue-a.revenue; });
  sum.margin=sum.revenue>0 ? (sum.profit/sum.revenue*100) : 0;
  return {rows:out, sum:sum};
}

/* ---------- Số liệu bảng điều khiển ---------- */
function dashStats(){
  var t=todayStr();
  var todayVs=DB.vouchers.filter(function(v){ return v.status!=='void' && v.date===t; });
  var inToday=todayVs.filter(function(v){return v.type==='in';});
  var outToday=todayVs.filter(function(v){return v.type==='out';});
  var days=[];
  for(var i=6;i>=0;i--){
    var d=dayOffset(-i), inV=0, outV=0;
    DB.vouchers.forEach(function(v){
      if(v.status==='void'||v.date!==d) return;
      if(v.type==='in') inV+=v.total;
      else if(v.type==='out') outV+=v.total;
    });
    days.push({date:d, inV:inV, outV:outV});
  }
  return {
    skuCount:activeProducts().length,
    stockValue:stockValueTotal(),
    lowList:lowStockProducts(),
    inTodayCount:inToday.length, inTodayVal:inToday.reduce(function(s,v){return s+v.total;},0),
    outTodayCount:outToday.length, outTodayVal:outToday.reduce(function(s,v){return s+v.total;},0),
    days:days
  };
}
