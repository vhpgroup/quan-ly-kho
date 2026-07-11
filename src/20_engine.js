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
  var c=DB.counters[type]||1;
  DB.counters[type]=c+1;
  return VTYPES[type].code + String(c).padStart(5,'0');
}

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
    } else if(t==='adjust'){
      addStock(v.warehouseId, p.id, qty); // qty là chênh lệch +/-
      price=cost;
    }
    v.lines.push({ productId:p.id, sku:p.sku, name:p.name, unit:p.unit, qty:qty, price:price, cost:cost });
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
  DB.vouchers.unshift(v);
  audit('Tạo phiếu', VTYPES[t].name+' '+v.code+' — '+v.lines.length+' dòng, tổng '+fmtMoney(v.total)+' đ');
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
