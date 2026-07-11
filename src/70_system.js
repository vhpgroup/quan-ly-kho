'use strict';
/* ==================== HỆ THỐNG: EXCEL / SAO LƯU / NHẬT KÝ / DASHBOARD / DỮ LIỆU MẪU ==================== */

/* ---------- Tải file & Excel ---------- */
function downloadBlob(content, filename, type){
  var b=content instanceof Blob?content:new Blob([content],{type:type||'application/octet-stream'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(b); a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },3000);
}
function xlsxExport(filename, sheets){
  if(typeof XLSX!=='undefined'){
    var wb=XLSX.utils.book_new();
    sheets.forEach(function(s){
      var ws=XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, String(s.name||'Sheet').slice(0,31));
    });
    XLSX.writeFile(wb, filename+'.xlsx');
    toast('Đã xuất file '+filename+'.xlsx','success');
  } else {
    var csv='﻿'+sheets[0].rows.map(function(r){
      return r.map(function(c){
        c=(c===null||c===undefined)?'':String(c);
        return /[",;\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;
      }).join(',');
    }).join('\r\n');
    downloadBlob(csv, filename+'.csv','text/csv;charset=utf-8');
    toast('Chưa tải được thư viện Excel (cần internet lần đầu) — đã xuất CSV thay thế, Excel mở được bình thường','warn');
  }
}
function pickFile(accept, cb){
  var fi=$('#file-input');
  fi.accept=accept;
  fi.onchange=function(){ var f=fi.files[0]; fi.value=''; if(f) cb(f); };
  fi.click();
}
function parseCSV(text){
  text=String(text).replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  var nl=text.indexOf('\n'); var firstLine=nl>=0?text.slice(0,nl):text;
  var delim=(firstLine.split(';').length>firstLine.split(',').length)?';':',';
  var rows=[], row=[], cur='', inQ=false;
  for(var i=0;i<text.length;i++){
    var c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else inQ=false; }
      else cur+=c;
    }
    else if(c==='"') inQ=true;
    else if(c===delim){ row.push(cur); cur=''; }
    else if(c==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
    else cur+=c;
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(function(r){ return r.some(function(c){ return String(c).trim()!==''; }); });
}
function readSheetFile(f, cb){
  var isExcel=/\.(xlsx|xls)$/i.test(f.name);
  if(isExcel){
    if(typeof XLSX==='undefined') return toast('Chưa tải được thư viện Excel (cần internet lần đầu) — hãy lưu file dưới dạng CSV rồi thử lại','error');
    var r=new FileReader();
    r.onload=function(e){
      try{
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        var ws=wb.Sheets[wb.SheetNames[0]];
        cb(XLSX.utils.sheet_to_json(ws,{header:1,defval:''}));
      }catch(err){ toast('Không đọc được file: '+err.message,'error'); }
    };
    r.readAsArrayBuffer(f);
  } else if(/\.csv$/i.test(f.name)){
    var r2=new FileReader();
    r2.onload=function(e){ cb(parseCSV(e.target.result)); };
    r2.readAsText(f,'utf-8');
  } else toast('Chỉ hỗ trợ file .xlsx, .xls hoặc .csv','error');
}
function headerMap(headers, defs){
  // defs: [{key, match:[chuỗi đã normStr]}] → trả {key: colIndex}
  // match bắt đầu bằng '=' nghĩa là so khớp CHÍNH XÁC (tránh trùng chuỗi con, VD '=hang' không khớp 'ma hang')
  var map={};
  headers.forEach(function(h,i){
    var n=normStr(h);
    if(!n) return;
    defs.forEach(function(d){
      if(map[d.key]!==undefined) return;
      if(d.match.some(function(m){ return m.charAt(0)==='=' ? n===m.slice(1) : (n===m || n.indexOf(m)>=0); })) map[d.key]=i;
    });
  });
  return map;
}

/* ---------- Xuất / nhập SẢN PHẨM ---------- */
function exportProducts(){
  var rows=[['Mã hàng','Tên hàng','Hãng','Nhóm hàng','Đơn vị','Giá vốn','Giá bán','Tồn tối thiểu','Tổng tồn','Ghi chú','Trạng thái']];
  DB.products.forEach(function(p){
    rows.push([p.sku, p.name, p.brand||'', catName(p.categoryId), p.unit, p.costPrice||0, p.salePrice||0, p.minStock||0, totalStock(p.id), p.note||'', p.active===false?'Ngừng KD':'Đang bán']);
  });
  xlsxExport('danh-sach-san-pham-'+todayStr(), [{name:'SanPham', rows:rows}]);
}
function importProducts(){
  if(!isMgr()) return;
  openModal({
    title:'Nhập sản phẩm từ Excel', size:'md',
    body:
      '<div style="font-size:13.5px;line-height:1.8">File Excel/CSV cần dòng đầu là tiêu đề cột, gồm:<br>'+
      '<b>Mã hàng</b> (bắt buộc) · <b>Tên hàng</b> (bắt buộc) · Hãng · Nhóm hàng · Đơn vị · Giá vốn · Giá bán · Tồn tối thiểu · Ghi chú<br>'+
      '<span class="muted">— Mã đã tồn tại sẽ được <b>cập nhật</b>, mã mới sẽ được <b>thêm</b>. Nhóm hàng chưa có sẽ tự tạo.<br>— Tồn kho đầu kỳ không nhập ở đây: sau khi có danh mục, hãy tạo <b>Phiếu nhập kho</b> đầu kỳ để tồn và giá vốn được ghi sổ đúng.</span></div>',
    footer:
      '<button class="btn btn-ghost" onclick="downloadProductTemplate()">📄 Tải file mẫu</button>'+
      '<button class="btn btn-primary" onclick="closeModal();pickFile(\'.xlsx,.xls,.csv\',doImportProducts)">Chọn file để nhập…</button>'
  });
}
function downloadProductTemplate(){
  xlsxExport('mau-nhap-san-pham', [{name:'SanPham', rows:[
    ['Mã hàng','Tên hàng','Hãng','Nhóm hàng','Đơn vị','Giá vốn','Giá bán','Tồn tối thiểu','Ghi chú'],
    ['SP0001','Giấy A4 Double A','Double A','Văn phòng phẩm','ream',65000,75000,20,''],
    ['SP0002','Bút bi xanh','Thiên Long','Văn phòng phẩm','cây',3500,5000,50,'Ví dụ — xóa dòng này']
  ]}]);
}
function doImportProducts(f){
  readSheetFile(f, function(aoa){
    if(!aoa || aoa.length<2) return toast('File không có dữ liệu','error');
    var map=headerMap(aoa[0],[
      {key:'sku',  match:['ma hang','ma san pham','sku','ma']},
      {key:'name', match:['ten hang','ten san pham','ten']},
      {key:'brand',match:['=hang','thuong hieu','hang sx','hang san xuat','nha san xuat','brand']},
      {key:'cat',  match:['nhom']},
      {key:'unit', match:['don vi','dvt']},
      {key:'cost', match:['gia von']},
      {key:'sale', match:['gia ban']},
      {key:'min',  match:['ton toi thieu','ton min','toi thieu']},
      {key:'note', match:['ghi chu']}
    ]);
    if(map.sku===undefined||map.name===undefined) return toast('Không tìm thấy cột "Mã hàng" hoặc "Tên hàng" ở dòng tiêu đề','error');
    var added=0, updated=0, errs=[];
    for(var i=1;i<aoa.length;i++){
      var r=aoa[i];
      var sku=String(r[map.sku]||'').trim().toUpperCase();
      var name=String(r[map.name]||'').trim();
      if(!sku&&!name) continue;
      if(!sku||!name){ errs.push('Dòng '+(i+1)+': thiếu mã hoặc tên'); continue; }
      var catId=null;
      if(map.cat!==undefined){
        var cn=String(r[map.cat]||'').trim();
        if(cn){
          var cat=DB.categories.find(function(c){return normStr(c.name)===normStr(cn);});
          if(!cat){ cat={id:uid(), name:cn}; DB.categories.push(cat); }
          catId=cat.id;
        }
      }
      var ex=DB.products.find(function(p){return p.sku.toUpperCase()===sku;});
      if(ex){
        ex.name=name;
        if(map.brand!==undefined && String(r[map.brand]).trim()) ex.brand=String(r[map.brand]).trim();
        if(catId) ex.categoryId=catId;
        if(map.unit!==undefined && String(r[map.unit]).trim()) ex.unit=String(r[map.unit]).trim();
        if(map.sale!==undefined && String(r[map.sale]).trim()!=='') ex.salePrice=parseNum(r[map.sale]);
        if(map.min!==undefined && String(r[map.min]).trim()!=='') ex.minStock=parseNum(r[map.min]);
        if(map.cost!==undefined && String(r[map.cost]).trim()!=='' && totalStock(ex.id)<=0) ex.costPrice=parseNum(r[map.cost]);
        if(map.note!==undefined && String(r[map.note]).trim()) ex.note=String(r[map.note]).trim();
        updated++;
      } else {
        DB.products.push({
          id:uid(), sku:sku, name:name, categoryId:catId,
          brand:map.brand!==undefined?String(r[map.brand]).trim():'',
          unit:map.unit!==undefined&&String(r[map.unit]).trim()?String(r[map.unit]).trim():'cái',
          costPrice:map.cost!==undefined?parseNum(r[map.cost]):0,
          salePrice:map.sale!==undefined?parseNum(r[map.sale]):0,
          minStock:map.min!==undefined?parseNum(r[map.min]):0,
          note:map.note!==undefined?String(r[map.note]).trim():'',
          active:true, createdAt:nowISO()
        });
        added++;
      }
    }
    audit('Nhập Excel sản phẩm', f.name+' — thêm '+added+', cập nhật '+updated+(errs.length?', lỗi '+errs.length:''));
    saveDB();
    openModal({
      title:'Kết quả nhập sản phẩm', size:'sm',
      body:'<div style="font-size:14px;line-height:2">✅ Thêm mới: <b>'+added+'</b><br>🔄 Cập nhật: <b>'+updated+'</b>'+(errs.length?'<br>⚠️ Bỏ qua '+errs.length+' dòng lỗi:<div class="small muted" style="max-height:120px;overflow:auto">'+errs.map(esc).join('<br>')+'</div>':'')+'</div>'
    });
    if(CURRENT_PAGE==='products') prodRows();
  });
}

/* ---------- Xuất / nhập ĐỐI TÁC ---------- */
function exportPartners(){
  var rows=[['Mã','Tên','Loại','Điện thoại','Địa chỉ','Mã số thuế','Ghi chú','Trạng thái']];
  DB.partners.forEach(function(p){
    rows.push([p.code,p.name,p.type==='supplier'?'Nhà cung cấp':'Khách hàng',p.phone||'',p.address||'',p.taxCode||'',p.note||'',p.active===false?'Ngừng GD':'Hoạt động']);
  });
  xlsxExport('danh-sach-doi-tac-'+todayStr(), [{name:'DoiTac', rows:rows}]);
}
function importPartners(){
  if(!isMgr()) return;
  openModal({
    title:'Nhập đối tác từ Excel', size:'md',
    body:'<div style="font-size:13.5px;line-height:1.8">File cần dòng tiêu đề gồm: <b>Mã</b> (bắt buộc) · <b>Tên</b> (bắt buộc) · Loại (ghi "Nhà cung cấp" hoặc "Khách hàng") · Điện thoại · Địa chỉ · Mã số thuế · Ghi chú<br><span class="muted">Nếu không có cột Loại, tất cả sẽ được nhập vào tab đang mở. Mã trùng sẽ được cập nhật.</span></div>',
    footer:'<button class="btn btn-primary" onclick="closeModal();pickFile(\'.xlsx,.xls,.csv\',doImportPartners)">Chọn file để nhập…</button>'
  });
}
function doImportPartners(f){
  readSheetFile(f, function(aoa){
    if(!aoa || aoa.length<2) return toast('File không có dữ liệu','error');
    var map=headerMap(aoa[0],[
      {key:'code', match:['ma']},
      {key:'name', match:['ten']},
      {key:'type', match:['loai']},
      {key:'phone',match:['dien thoai','sdt','phone']},
      {key:'addr', match:['dia chi']},
      {key:'tax',  match:['ma so thue','mst']},
      {key:'note', match:['ghi chu']}
    ]);
    if(map.code===undefined||map.name===undefined) return toast('Không tìm thấy cột "Mã" hoặc "Tên" ở dòng tiêu đề','error');
    var added=0, updated=0, errs=[];
    for(var i=1;i<aoa.length;i++){
      var r=aoa[i];
      var code=String(r[map.code]||'').trim().toUpperCase();
      var name=String(r[map.name]||'').trim();
      if(!code&&!name) continue;
      if(!code||!name){ errs.push('Dòng '+(i+1)+': thiếu mã hoặc tên'); continue; }
      var type=PARTF.tab;
      if(map.type!==undefined){
        var tn=normStr(r[map.type]);
        if(tn.indexOf('cung cap')>=0||tn.indexOf('ncc')>=0) type='supplier';
        else if(tn.indexOf('khach')>=0||tn.indexOf('kh')===0) type='customer';
      }
      var ex=DB.partners.find(function(p){return p.code.toUpperCase()===code;});
      var data={
        name:name,
        phone:map.phone!==undefined?String(r[map.phone]).trim():'',
        address:map.addr!==undefined?String(r[map.addr]).trim():'',
        taxCode:map.tax!==undefined?String(r[map.tax]).trim():'',
        note:map.note!==undefined?String(r[map.note]).trim():''
      };
      if(ex){ Object.assign(ex,data); updated++; }
      else { DB.partners.push(Object.assign({id:uid(), code:code, type:type, active:true},data)); added++; }
    }
    audit('Nhập Excel đối tác', f.name+' — thêm '+added+', cập nhật '+updated);
    saveDB();
    openModal({ title:'Kết quả nhập đối tác', size:'sm',
      body:'<div style="font-size:14px;line-height:2">✅ Thêm mới: <b>'+added+'</b><br>🔄 Cập nhật: <b>'+updated+'</b>'+(errs.length?'<br>⚠️ Bỏ qua '+errs.length+' dòng lỗi:<div class="small muted">'+errs.map(esc).join('<br>')+'</div>':'')+'</div>' });
    if(CURRENT_PAGE==='partners') partnerRows();
  });
}

/* ---------- Xuất TỒN KHO / LỊCH SỬ / BÁO CÁO ---------- */
function exportInventory(){
  var whs=activeWarehouses();
  var head=['Mã','Tên sản phẩm','Hãng','ĐVT'].concat(whs.map(function(w){return 'Tồn '+w.name;})).concat(['Tổng tồn','Giá vốn','Giá trị tồn','Tồn tối thiểu']);
  var rows=[head];
  invRowsData().forEach(function(p){
    var tot=totalStock(p.id);
    rows.push([p.sku,p.name,p.brand||'',p.unit].concat(whs.map(function(w){return getStock(w.id,p.id);})).concat([tot,p.costPrice||0,Math.round(tot*(p.costPrice||0)),p.minStock||0]));
  });
  xlsxExport('ton-kho-'+todayStr(), [{name:'TonKho', rows:rows}]);
}
function exportHistory(){
  var list=histData();
  var s1=[['Số phiếu','Loại','Ngày','Kho','Kho nhận','Đối tác','Số dòng','Tổng tiền','Người lập','Ghi chú','Trạng thái']];
  var s2=[['Số phiếu','Loại','Ngày','Kho','Mã hàng','Tên hàng','ĐVT','Số lượng','Đơn giá','Thành tiền','Giá vốn']];
  list.forEach(function(v){
    var vt=VTYPES[v.type];
    s1.push([v.code,vt.name,v.date,whName(v.warehouseId),v.type==='transfer'?whName(v.toWarehouseId):'',v.partnerId?partnerName(v.partnerId):'',v.lines.length,v.total,v.createdBy,v.note||'',v.status==='void'?'Đã hủy':'Đã ghi sổ']);
    v.lines.forEach(function(l){
      s2.push([v.code,vt.name,v.date,whName(v.warehouseId),l.sku,l.name,l.unit,l.qty,l.price,Math.round(l.qty*l.price),l.cost]);
    });
  });
  xlsxExport('lich-su-phieu-'+todayStr(), [{name:'DanhSachPhieu',rows:s1},{name:'ChiTietDong',rows:s2}]);
}
function exportReport(){
  if(RPT.tab==='nxt'){
    var data=reportNXT(RPT.from,RPT.to,RPT.wh||null);
    var rows=[['Mã','Tên sản phẩm','ĐVT','Tồn đầu kỳ','SL nhập','GT nhập','SL xuất','GT xuất','Tồn cuối kỳ','GT cuối kỳ']];
    data.forEach(function(r){
      rows.push([r.product.sku,r.product.name,r.product.unit,r.openQ,r.inQ,Math.round(r.inV),r.outQ,Math.round(r.outV),r.closeQ,Math.round(r.closeQ*(r.product.costPrice||0))]);
    });
    xlsxExport('bao-cao-nhap-xuat-ton-'+RPT.from+'-den-'+RPT.to, [{name:'NXT',rows:rows}]);
  } else {
    var rp=reportProfit(RPT.from,RPT.to);
    var rows2=[['Mã','Tên sản phẩm','SL bán','SL trả lại','Doanh thu','Giá vốn','Lợi nhuận','Biên LN %']];
    rp.rows.forEach(function(r){
      rows2.push([r.product.sku,r.product.name,r.soldQ,r.returnQ,Math.round(r.revenue),Math.round(r.cogs),Math.round(r.profit),+r.margin.toFixed(1)]);
    });
    rows2.push(['','TỔNG CỘNG',rp.sum.soldQ,rp.sum.returnQ,Math.round(rp.sum.revenue),Math.round(rp.sum.cogs),Math.round(rp.sum.profit),+rp.sum.margin.toFixed(1)]);
    xlsxExport('bao-cao-loi-nhuan-'+RPT.from+'-den-'+RPT.to, [{name:'LoiNhuan',rows:rows2}]);
  }
}

/* ---------- SAO LƯU / KHÔI PHỤC / XÓA ---------- */
function doBackup(){
  DB.meta.lastBackupAt=nowISO();
  audit('Sao lưu dữ liệu','Tải file sao lưu về máy');
  saveDB();
  var d=new Date();
  var fn='sao-luu-kho-'+todayStr()+'-'+pad2(d.getHours())+pad2(d.getMinutes())+'.json';
  downloadBlob(JSON.stringify(DB,null,1), fn, 'application/json;charset=utf-8');
  toast('Đã tải file sao lưu: '+fn,'success');
  if(CURRENT_PAGE==='system') refreshPage();
}
function doRestore(){
  pickFile('.json', function(f){
    var r=new FileReader();
    r.onload=function(e){
      var obj=null;
      try{ obj=JSON.parse(e.target.result); }catch(err){ return toast('File không đúng định dạng JSON','error'); }
      if(!obj || !obj.users || !obj.products || !obj.vouchers) return toast('File này không phải file sao lưu của phần mềm quản lý kho','error');
      confirmDlg('Khôi phục dữ liệu',
        'Toàn bộ dữ liệu hiện tại sẽ bị <b>thay thế</b> bằng dữ liệu trong file <b>'+esc(f.name)+'</b>:<br><br>'+
        '· '+obj.products.length+' sản phẩm · '+obj.vouchers.length+' phiếu · '+obj.users.length+' người dùng<br>· Sao lưu gần nhất của file: '+(obj.meta&&obj.meta.updatedAt?fmtDateTime(obj.meta.updatedAt):'—')+'<br><br>Tiếp tục?',
        'Khôi phục', function(){
          DB=migrateDB(obj);
          audit('Khôi phục dữ liệu','Từ file '+f.name);
          saveDB();
          applySettingsUI();
          doLogout('Khôi phục dữ liệu thành công — vui lòng đăng nhập lại.');
        }, true);
    };
    r.readAsText(f,'utf-8');
  });
}
function doReset(){
  openModal({
    title:'⚠️ Xóa toàn bộ dữ liệu', size:'sm',
    body:'<div style="font-size:14px;line-height:1.8">Thao tác này <b>xóa vĩnh viễn</b> toàn bộ sản phẩm, phiếu, đối tác, người dùng và đưa phần mềm về trạng thái ban đầu (tài khoản <b>admin / admin123</b>).<br><br>Nên <b>tải file sao lưu</b> trước khi xóa.<br><br>Gõ <b>XOA</b> vào ô dưới để xác nhận:</div><input id="reset-confirm" style="margin-top:10px" placeholder="XOA">',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-danger" onclick="doResetConfirm()">Xóa toàn bộ</button>'
  });
}
function doResetConfirm(){
  if(($('#reset-confirm').value||'').trim().toUpperCase()!=='XOA') return toast('Gõ chữ XOA để xác nhận','warn');
  DB=defaultDB();
  saveDB();
  closeModal();
  applySettingsUI();
  doLogout('Đã xóa toàn bộ dữ liệu. Đăng nhập bằng admin / admin123 để bắt đầu mới.');
}
function loadDemoData(){
  seedDemo();
  saveDB();
  toast('Đã nạp dữ liệu mẫu','success');
  refreshPage();
}

/* ---------- TRANG HỆ THỐNG ---------- */
RENDERERS.system=function(c){
  var s=DB.settings;
  var lastBk=DB.meta.lastBackupAt;
  c.innerHTML=
  '<div class="grid2">'+
  '<div>'+
    '<div class="card">'+
      '<div class="card-title">🏢 Thông tin công ty <span class="small muted" style="font-weight:400">(hiển thị trên phiếu in)</span></div>'+
      '<div class="field"><label>Tên công ty</label><input id="set-name" value="'+esc(s.companyName||'')+'" placeholder="CÔNG TY TNHH ABC"></div>'+
      '<div class="field"><label>Địa chỉ</label><input id="set-addr" value="'+esc(s.companyAddress||'')+'"></div>'+
      '<div class="form-grid">'+
        '<div class="field"><label>Điện thoại</label><input id="set-phone" value="'+esc(s.companyPhone||'')+'"></div>'+
        '<div class="field"><label>Mã số thuế</label><input id="set-tax" value="'+esc(s.companyTax||'')+'"></div>'+
      '</div>'+
      '<button class="btn btn-primary btn-sm" onclick="saveSettings()">Lưu thông tin</button>'+
    '</div>'+
    '<div class="card">'+
      '<div class="card-title">📖 Hướng dẫn nhanh</div>'+
      '<div style="font-size:13px;line-height:2">'+
      '1️⃣ Tạo <b>Kho hàng</b> → thêm <b>Sản phẩm</b> (hoặc nhập Excel) → thêm <b>Đối tác</b><br>'+
      '2️⃣ Tạo <b>Phiếu nhập kho đầu kỳ</b> để ghi tồn ban đầu và giá vốn<br>'+
      '3️⃣ Vận hành hằng ngày: Nhập → Xuất → Chuyển kho → Trả hàng → Kiểm kê định kỳ<br>'+
      '4️⃣ Theo dõi <b>Tồn kho</b>, <b>Báo cáo NXT / Lợi nhuận</b>, xuất Excel khi cần<br>'+
      '5️⃣ <b>Sao lưu dữ liệu định kỳ</b> — dữ liệu nằm trên máy này, file sao lưu giúp chuyển máy / khôi phục<br>'+
      '<span class="muted">💡 Giá vốn tính theo bình quân gia quyền, tự cập nhật mỗi lần nhập kho. Muốn dùng trên máy khác: tải file HTML + file sao lưu sang máy đó rồi Khôi phục.</span>'+
      '</div>'+
    '</div>'+
  '</div>'+
  '<div>'+
    '<div class="card">'+
      '<div class="card-title">💾 Sao lưu &amp; Khôi phục</div>'+
      '<div style="font-size:13px;line-height:1.8;margin-bottom:12px">Toàn bộ dữ liệu được lưu trong trình duyệt trên máy này'+(storageOK?'':' <b class="low-flag">(hiện đang bị chặn — chỉ lưu tạm!)</b>')+'.<br>Sao lưu gần nhất: <b>'+(lastBk?fmtDateTime(lastBk):'chưa sao lưu lần nào')+'</b></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<button class="btn btn-primary btn-sm" onclick="doBackup()">📥 Tải file sao lưu (.json)</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="doRestore()">📤 Khôi phục từ file…</button>'+
      '</div>'+
    '</div>'+
    '<div class="card">'+
      '<div class="card-title">🗄️ Dữ liệu</div>'+
      '<div style="font-size:13px;margin-bottom:12px" class="muted">'+DB.products.length+' sản phẩm · '+DB.partners.length+' đối tác · '+DB.warehouses.length+' kho · '+DB.vouchers.length+' phiếu · '+DB.users.length+' người dùng'+(DB.meta.demo?' · <b>đang chứa dữ liệu mẫu</b>':'')+'</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        (!DB.products.length?'<button class="btn btn-ghost btn-sm" onclick="loadDemoData()">🧪 Nạp dữ liệu mẫu</button>':'')+
        '<button class="btn btn-danger btn-sm" onclick="doReset()">🗑️ Xóa toàn bộ &amp; bắt đầu mới</button>'+
      '</div>'+
      (DB.meta.demo?'<div class="small muted" style="margin-top:10px">Khi bắt đầu dùng thật: bấm "Xóa toàn bộ &amp; bắt đầu mới" để làm sạch dữ liệu mẫu.</div>':'')+
    '</div>'+
  '</div>'+
  '</div>';
};
function saveSettings(){
  DB.settings.companyName=($('#set-name').value||'').trim();
  DB.settings.companyAddress=($('#set-addr').value||'').trim();
  DB.settings.companyPhone=($('#set-phone').value||'').trim();
  DB.settings.companyTax=($('#set-tax').value||'').trim();
  audit('Cập nhật thông tin công ty', DB.settings.companyName);
  saveDB(); applySettingsUI();
  toast('Đã lưu thông tin công ty','success');
}

/* ---------- NHẬT KÝ THAO TÁC ---------- */
var AUDF={user:'', q:''};
RENDERERS.auditlog=function(c){
  var users=[]; DB.auditLog.forEach(function(a){ if(users.indexOf(a.username)<0) users.push(a.username); });
  c.innerHTML=
  '<div class="toolbar">'+
    '<div class="field"><label>Người dùng</label><select id="au-user" onchange="AUDF.user=this.value;audRows()"><option value="">— Tất cả —</option>'+users.map(function(u){return '<option value="'+esc(u)+'" '+(AUDF.user===u?'selected':'')+'>'+esc(u)+'</option>';}).join('')+'</select></div>'+
    '<div class="field grow"><label>Tìm kiếm</label><input id="au-q" placeholder="Hành động, nội dung…" value="'+esc(AUDF.q)+'"></div>'+
  '</div>'+
  '<div class="tbl-wrap tbl-scroll"><table class="tbl"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Chi tiết</th></tr></thead><tbody id="au-tbody"></tbody></table></div>'+
  '<div class="pagin" id="au-count"></div>';
  $('#au-q').addEventListener('input', function(){ AUDF.q=this.value; audRows(); });
  audRows();
};
function audRows(){
  var q=normStr(AUDF.q);
  var list=DB.auditLog.filter(function(a){
    if(AUDF.user && a.username!==AUDF.user) return false;
    if(q && normStr(a.action+' '+a.detail).indexOf(q)<0) return false;
    return true;
  });
  var shown=list.slice(0,300);
  $('#au-tbody').innerHTML=shown.map(function(a){
    return '<tr><td style="white-space:nowrap" class="muted">'+fmtDateTime(a.time)+'</td><td><b>'+esc(a.username)+'</b></td><td>'+esc(a.action)+'</td><td class="muted">'+esc(a.detail)+'</td></tr>';
  }).join('')||'<tr><td colspan="4"><div class="empty">Chưa có hoạt động nào</div></td></tr>';
  $('#au-count').textContent='Hiển thị '+shown.length+' / '+list.length+' bản ghi (lưu tối đa 3.000 bản ghi gần nhất)';
}

/* ---------- BẢNG ĐIỀU KHIỂN ---------- */
RENDERERS.dashboard=function(c){
  var st=dashStats();
  var bkOld = !DB.meta.lastBackupAt || (Date.now()-new Date(DB.meta.lastBackupAt).getTime() > 7*24*3600*1000);
  var banner='';
  if(!storageOK) banner+='<div class="banner banner-warn">⚠️ <div style="flex:1">Trình duyệt đang chặn bộ nhớ cục bộ — dữ liệu <b>chỉ giữ tạm trong phiên này</b>. Hãy tải file HTML về máy và mở trực tiếp; trước khi đóng trang nhớ tải file sao lưu.</div>'+(isAdmin()?'<button class="btn btn-sm btn-primary" onclick="doBackup()">Sao lưu ngay</button>':'')+'</div>';
  else if(isAdmin() && bkOld && DB.vouchers.length) banner+='<div class="banner banner-warn">💾 <div style="flex:1">'+(DB.meta.lastBackupAt?'Đã hơn 7 ngày kể từ lần sao lưu gần nhất ('+fmtDateTime(DB.meta.lastBackupAt)+').':'Bạn chưa tải file sao lưu lần nào — dữ liệu chỉ nằm trên máy này.')+' Nên sao lưu định kỳ để tránh mất dữ liệu.</div><button class="btn btn-sm btn-primary" onclick="doBackup()">Sao lưu ngay</button></div>';
  var maxV=1;
  st.days.forEach(function(d){ maxV=Math.max(maxV,d.inV,d.outV); });
  var chart=st.days.map(function(d){
    var hi=Math.round(d.inV/maxV*100), ho=Math.round(d.outV/maxV*100);
    return '<div class="day"><div class="bars">'+
      '<div class="bar in" style="height:'+Math.max(hi,2)+'%" title="Nhập '+fmtDate(d.date)+': '+fmtMoney(d.inV)+' đ"></div>'+
      '<div class="bar out" style="height:'+Math.max(ho,2)+'%" title="Xuất '+fmtDate(d.date)+': '+fmtMoney(d.outV)+' đ"></div>'+
      '</div><div class="dl">'+d.date.slice(8,10)+'/'+d.date.slice(5,7)+'</div></div>';
  }).join('');
  var lowRows=st.lowList.slice(0,8).map(function(p){
    return '<tr class="click" onclick="showPage(\'products\')"><td><b>'+esc(p.sku)+'</b></td><td>'+esc(p.name)+'</td><td class="r low-flag">'+fmtQty(totalStock(p.id))+'</td><td class="r muted">'+fmtQty(p.minStock)+'</td><td class="c">'+esc(p.unit)+'</td></tr>';
  }).join('');
  c.innerHTML=banner+
  '<div class="kpis">'+
    '<div class="kpi"><div class="ic" style="background:#eff6ff">📦</div><div><div class="v">'+st.skuCount+'</div><div class="l">Mặt hàng đang kinh doanh</div></div></div>'+
    '<div class="kpi"><div class="ic" style="background:#f0fdf4">💰</div><div><div class="v">'+fmtMoney(st.stockValue)+' đ</div><div class="l">Giá trị tồn kho (theo giá vốn)</div></div></div>'+
    '<div class="kpi"><div class="ic" style="background:'+(st.lowList.length?'#fef2f2':'#f8fafc')+'">⚠️</div><div><div class="v" style="color:'+(st.lowList.length?'var(--red)':'inherit')+'">'+st.lowList.length+'</div><div class="l">Mặt hàng dưới tồn tối thiểu</div></div></div>'+
    '<div class="kpi"><div class="ic" style="background:#fff7ed">🔄</div><div><div class="v">'+st.inTodayCount+' nhập · '+st.outTodayCount+' xuất</div><div class="l">Phiếu hôm nay</div></div></div>'+
  '</div>'+
  '<div class="grid2">'+
    '<div class="card"><div class="card-title">📊 Giá trị nhập / xuất 7 ngày gần nhất</div><div class="chart">'+chart+'</div>'+
      '<div class="legend"><span><i style="background:#22c55e"></i>Nhập kho</span><span><i style="background:#fb923c"></i>Xuất kho</span></div></div>'+
    '<div class="card"><div class="card-title">⚠️ Cảnh báo tồn thấp <button class="btn btn-xs btn-ghost" onclick="INVF.lowOnly=true;showPage(\'inventory\')">Xem tất cả →</button></div>'+
      (lowRows?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mã</th><th>Tên sản phẩm</th><th class="r">Tồn</th><th class="r">Tối thiểu</th><th class="c">ĐVT</th></tr></thead><tbody>'+lowRows+'</tbody></table></div>':'<div class="empty">👍 Không có mặt hàng nào dưới mức tồn tối thiểu</div>')+
    '</div>'+
  '</div>'+
  '<div class="card"><div class="card-title">🕘 Phiếu gần đây <button class="btn btn-xs btn-ghost" onclick="showPage(\'history\')">Lịch sử đầy đủ →</button></div>'+
    voucherTable(Object.keys(VTYPES), 8)+
  '</div>';
};

/* ---------- DỮ LIỆU MẪU ---------- */
function seedDemo(){
  var oldSession=SESSION;
  SESSION={username:'admin'};
  var catVPP={id:uid(),name:'Văn phòng phẩm'}, catDT={id:uid(),name:'Thiết bị điện tử'}, catDG={id:uid(),name:'Vật tư đóng gói'};
  DB.categories.push(catVPP,catDT,catDG);
  function mkP(sku,name,cat,unit,sale,min,brand){
    var p={id:uid(),sku:sku,name:name,brand:brand||'',categoryId:cat.id,unit:unit,costPrice:0,salePrice:sale,minStock:min,note:'',active:true,createdAt:nowISO()};
    DB.products.push(p); return p;
  }
  var p1=mkP('VPP001','Giấy A4 Double A 70gsm',catVPP,'ream',75000,20,'Double A');
  var p2=mkP('VPP002','Bút bi Thiên Long TL-027',catVPP,'cây',5000,50,'Thiên Long');
  var p3=mkP('VPP003','Sổ tay A5 200 trang',catVPP,'quyển',22000,30,'');
  var p4=mkP('DT001','Chuột Logitech B100',catDT,'cái',220000,5,'Logitech');
  var p5=mkP('DT002','Bàn phím Dareu LK185',catDT,'cái',300000,20,'Dareu');
  var p6=mkP('DT003','Ổ cắm Điện Quang 4 lỗ',catDT,'cái',125000,30,'Điện Quang');
  var p7=mkP('DG001','Thùng carton 60x40x40',catDG,'cái',15000,100,'');
  var p8=mkP('DG002','Băng keo trong 5cm',catDG,'cuộn',12000,200,'');
  var w1={id:uid(),code:'KHO01',name:'Kho chính',address:'Số 12 Nguyễn Văn Cừ, Q.5, TP.HCM',active:true};
  var w2={id:uid(),code:'KHO02',name:'Kho chi nhánh',address:'88 Lê Lợi, Hải Châu, Đà Nẵng',active:true};
  DB.warehouses.push(w1,w2);
  var s1={id:uid(),code:'NCC001',type:'supplier',name:'Công ty TNHH VPP Hồng Hà',phone:'028 3835 1234',address:'Q.1, TP.HCM',taxCode:'0301234567',note:'',active:true};
  var s2={id:uid(),code:'NCC002',type:'supplier',name:'Công ty CP Thiết bị Phong Vũ',phone:'028 3862 8888',address:'Q.10, TP.HCM',taxCode:'0307654321',note:'',active:true};
  var k1={id:uid(),code:'KH001',type:'customer',name:'Công ty TNHH Thương mại ABC',phone:'0909 123 456',address:'Q.3, TP.HCM',taxCode:'0312345678',note:'',active:true};
  var k2={id:uid(),code:'KH002',type:'customer',name:'Cửa hàng Minh Anh',phone:'0912 345 678',address:'Đà Nẵng',taxCode:'',note:'',active:true};
  DB.partners.push(s1,s2,k1,k2);
  DB.users.push(
    {id:uid(),username:'quanly',passHash:hashPass('quanly123'),fullName:'Trần Quản Lý',role:'manager',active:true,createdAt:nowISO()},
    {id:uid(),username:'nhanvien',passHash:hashPass('nhanvien123'),fullName:'Lê Nhân Viên',role:'staff',active:true,createdAt:nowISO()}
  );
  postVoucher({type:'in', date:dayOffset(-7), warehouseId:w1.id, partnerId:s1.id, note:'Nhập hàng văn phòng phẩm đầu kỳ',
    lines:[{productId:p1.id,qty:50,price:65000},{productId:p2.id,qty:200,price:3500},{productId:p3.id,qty:60,price:15000}]});
  postVoucher({type:'in', date:dayOffset(-6), warehouseId:w1.id, partnerId:s2.id, note:'Nhập thiết bị điện tử',
    lines:[{productId:p4.id,qty:20,price:180000},{productId:p5.id,qty:15,price:250000},{productId:p6.id,qty:25,price:95000}]});
  postVoucher({type:'in', date:dayOffset(-5), warehouseId:w2.id, partnerId:s1.id, note:'Nhập vật tư đóng gói cho chi nhánh',
    lines:[{productId:p7.id,qty:300,price:12000},{productId:p8.id,qty:150,price:8000}]});
  postVoucher({type:'transfer', date:dayOffset(-3), warehouseId:w1.id, toWarehouseId:w2.id, note:'Bổ sung VPP cho chi nhánh',
    lines:[{productId:p1.id,qty:10},{productId:p2.id,qty:50}]});
  postVoucher({type:'out', date:dayOffset(-2), warehouseId:w1.id, partnerId:k1.id, note:'Xuất bán theo đơn số 025',
    lines:[{productId:p1.id,qty:15,price:75000},{productId:p4.id,qty:5,price:220000},{productId:p2.id,qty:40,price:5000}]});
  postVoucher({type:'out', date:dayOffset(-1), warehouseId:w2.id, partnerId:k2.id, note:'Xuất bán lẻ',
    lines:[{productId:p7.id,qty:80,price:15000},{productId:p8.id,qty:30,price:12000},{productId:p1.id,qty:5,price:75000}]});
  postVoucher({type:'return_cus', date:todayStr(), warehouseId:w1.id, partnerId:k1.id, note:'Khách trả 1 chuột do lỗi nút cuộn',
    lines:[{productId:p4.id,qty:1,price:220000}]});
  DB.meta.demo=true;
  SESSION=oldSession;
}
