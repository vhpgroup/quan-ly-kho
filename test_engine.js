'use strict';
/* Node test harness cho core + engine + seed */
const fs=require('fs');

// ---- stub môi trường trình duyệt ----
const _store={};
global.localStorage={
  setItem:(k,v)=>{_store[k]=String(v);},
  getItem:(k)=>(k in _store?_store[k]:null),
  removeItem:(k)=>{delete _store[k];}
};
global.sessionStorage={setItem(){},getItem(){return null;},removeItem(){}};
global.document={addEventListener(){}, querySelector(){return null;}, querySelectorAll(){return [];}, createElement(){return {style:{},classList:{add(){},remove(){}},setAttribute(){},click(){},remove(){}};}, body:{appendChild(){}}};
global.window=global;

let failures=0, passes=0;
function check(name, cond, extra){
  if(cond){ passes++; }
  else { failures++; console.log('  ❌ FAIL: '+name+(extra!==undefined?' — got: '+JSON.stringify(extra):'')); }
}

// ---- nạp các module (như các thẻ <script> chia sẻ global trên trình duyệt) ----
const vm=require('vm');
let bundle='';
for(const f of ['10_core.js','20_engine.js','30_shell.js','40_catalog.js','50_vouchers.js','60_tracking.js','70_system.js']){
  bundle+=fs.readFileSync(__dirname+'/src/'+f,'utf-8').replace(/^'use strict';\s*/,'')+'\n';
}
vm.runInThisContext(bundle);

// ================== 1. SHA-256 ==================
check('sha256("") chuẩn', sha256('')==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', sha256(''));
check('sha256("abc") chuẩn', sha256('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', sha256('abc'));
check('hashPass ổn định', hashPass('admin123')===hashPass('admin123') && hashPass('admin123')!==hashPass('admin124'));
check('hashPass unicode OK', typeof hashPass('mật khẩu tiếng Việt ơ ư đ')==='string' && hashPass('mật khẩu tiếng Việt ơ ư đ').length===64);

// ================== 2. docSoTien ==================
check('docSoTien 1234567', docSoTien(1234567)==='Một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy đồng', docSoTien(1234567));
check('docSoTien 105000', docSoTien(105000)==='Một trăm lẻ năm nghìn đồng', docSoTien(105000));
check('docSoTien 21000', docSoTien(21000)==='Hai mươi mốt nghìn đồng', docSoTien(21000));
check('docSoTien 0', docSoTien(0)==='Không đồng', docSoTien(0));
check('docSoTien 2425000', docSoTien(2425000)==='Hai triệu bốn trăm hai mươi lăm nghìn đồng', docSoTien(2425000));
check('docSoTien 1000000005', docSoTien(1000000005)==='Một tỷ không trăm lẻ năm đồng', docSoTien(1000000005));

// ================== 3. parseNum ==================
check('parseNum 1.234.567', parseNum('1.234.567')===1234567, parseNum('1.234.567'));
check('parseNum 1,234,567', parseNum('1,234,567')===1234567, parseNum('1,234,567'));
check('parseNum 1234,5', parseNum('1234,5')===1234.5, parseNum('1234,5'));
check('parseNum 65000', parseNum('65000')===65000);
check('parseNum số', parseNum(123.45)===123.45);
check('normStr', normStr('Giấy A4 Đôi')==='giay a4 doi', normStr('Giấy A4 Đôi'));

// ================== 4. Engine: giá vốn BQGQ + tồn ==================
DB=defaultDB();
SESSION=DB.users[0];
const w1={id:'w1',code:'K1',name:'Kho 1',active:true};
const w2={id:'w2',code:'K2',name:'Kho 2',active:true};
DB.warehouses.push(w1,w2);
const pA={id:'pA',sku:'A01',name:'Hàng A',unit:'cái',costPrice:0,salePrice:300,minStock:5,active:true};
DB.products.push(pA);

let r=postVoucher({type:'in',date:'2026-07-01',warehouseId:'w1',lines:[{productId:'pA',qty:10,price:100}]});
check('nhập lần 1 OK', r.ok, r.error);
check('giá vốn = 100', pA.costPrice===100, pA.costPrice);
check('tồn w1 = 10', getStock('w1','pA')===10);
check('mã phiếu PN00001', r.voucher.code==='PN00001', r.voucher.code);

r=postVoucher({type:'in',date:'2026-07-02',warehouseId:'w1',lines:[{productId:'pA',qty:10,price:200}]});
check('BQGQ = 150', pA.costPrice===150, pA.costPrice);
check('tồn = 20', getStock('w1','pA')===20);

r=postVoucher({type:'out',date:'2026-07-03',warehouseId:'w1',lines:[{productId:'pA',qty:5,price:300}]});
check('xuất OK', r.ok, r.error);
check('chốt cost=150 trên dòng xuất', r.voucher.lines[0].cost===150, r.voucher.lines[0].cost);
check('tồn còn 15', getStock('w1','pA')===15);
check('tổng phiếu xuất 1500', r.voucher.total===1500, r.voucher.total);
const outV=r.voucher;

r=postVoucher({type:'transfer',date:'2026-07-04',warehouseId:'w1',toWarehouseId:'w2',lines:[{productId:'pA',qty:5}]});
check('chuyển kho OK', r.ok, r.error);
check('w1=10, w2=5', getStock('w1','pA')===10 && getStock('w2','pA')===5);
check('tổng tồn 15', totalStock('pA')===15);

r=postVoucher({type:'out',date:'2026-07-05',warehouseId:'w1',lines:[{productId:'pA',qty:20,price:300}]});
check('xuất quá tồn bị chặn', !r.ok, r);

r=postVoucher({type:'transfer',date:'2026-07-05',warehouseId:'w1',toWarehouseId:'w1',lines:[{productId:'pA',qty:1}]});
check('chuyển cùng kho bị chặn', !r.ok);

r=postVoucher({type:'adjust',date:'2026-07-06',warehouseId:'w2',lines:[{productId:'pA',qty:-2}]});
check('điều chỉnh -2 OK', r.ok, r.error);
check('w2 còn 3', getStock('w2','pA')===3);

r=postVoucher({type:'adjust',date:'2026-07-06',warehouseId:'w2',lines:[{productId:'pA',qty:-99}]});
check('điều chỉnh âm quá tồn bị chặn', !r.ok);

r=postVoucher({type:'return_sup',date:'2026-07-07',warehouseId:'w1',lines:[{productId:'pA',qty:2,price:0}]});
check('trả NCC OK, giá mặc định = giá vốn', r.ok && r.voucher.lines[0].price===150, r.ok?r.voucher.lines[0].price:r.error);
check('w1 còn 8', getStock('w1','pA')===8);

r=postVoucher({type:'return_cus',date:'2026-07-08',warehouseId:'w1',partnerId:null,lines:[{productId:'pA',qty:1,price:300}]});
check('khách trả OK', r.ok, r.error);
check('w1 = 9', getStock('w1','pA')===9);

// ---- báo cáo lợi nhuận ----
let rp=reportProfit('2026-07-01','2026-07-31');
// bán 5 @300 (cost 150) = LN 750; khách trả 1 @300 (cost 150) → LN -150 → 600
check('LN gộp = 600', Math.round(rp.sum.profit)===600, rp.sum.profit);
check('doanh thu thuần = 1200', Math.round(rp.sum.revenue)===1200, rp.sum.revenue);

// ---- NXT ----
let nxt=reportNXT('2026-07-03','2026-07-31',null);
let rowA=nxt.find(x=>x.product.id==='pA');
check('NXT: đầu kỳ 20', rowA.openQ===20, rowA.openQ);
check('NXT: nhập trong kỳ 1 (khách trả)', rowA.inQ===1, rowA.inQ);
check('NXT: xuất trong kỳ 9 (5 bán + 2 trả NCC + 2 kiểm kê)', rowA.outQ===9, rowA.outQ);
check('NXT: cuối kỳ 12', rowA.closeQ===12, rowA.closeQ);
check('NXT khớp tồn thực', rowA.closeQ===totalStock('pA'));

// NXT theo kho w1: transfer phải được tính
let nxtW1=reportNXT('2026-07-01','2026-07-31','w1');
let rowW1=nxtW1.find(x=>x.product.id==='pA');
check('NXT w1: cuối kỳ = tồn w1', rowW1.closeQ===getStock('w1','pA'), rowW1.closeQ+' vs '+getStock('w1','pA'));

// ---- hủy phiếu ----
const stockBefore=getStock('w1','pA');
r=voidVoucher(outV.id);
check('hủy phiếu xuất OK', r.ok, r.error);
check('tồn hoàn lại +5', getStock('w1','pA')===stockBefore+5);
check('trạng thái void', outV.status==='void');
r=voidVoucher(outV.id);
check('hủy lần 2 bị chặn', !r.ok);
rp=reportProfit('2026-07-01','2026-07-31');
check('LN sau hủy = -150 (chỉ còn khách trả)', Math.round(rp.sum.profit)===-150, rp.sum.profit);

// ---- tồn thấp ----
check('cảnh báo tồn thấp: chưa có', lowStockProducts().length===0, lowStockProducts().length);
postVoucher({type:'out',date:'2026-07-09',warehouseId:'w1',lines:[{productId:'pA',qty:13,price:300}]});
check('còn 4 < min 5 → cảnh báo', lowStockProducts().length===1, totalStock('pA'));

// ================== 4b. Xóa phiếu ==================
const pB={id:'pB',sku:'B01',name:'Hàng B',unit:'cái',costPrice:0,salePrice:500,minStock:0,active:true};
DB.products.push(pB);
let vIn=postVoucher({type:'in',date:'2026-07-10',warehouseId:'w1',lines:[{productId:'pB',qty:10,price:200}]}).voucher;
let vOut=postVoucher({type:'out',date:'2026-07-10',warehouseId:'w1',lines:[{productId:'pB',qty:4,price:500}]}).voucher;
check('xóa: tồn trước khi xóa = 6', getStock('w1','pB')===6);
const countBefore=DB.vouchers.length;

r=deleteVoucher(vOut.id);
check('xóa phiếu xuất đang ghi sổ OK', r.ok, r.error);
check('xóa: tồn hoàn tác về 10', getStock('w1','pB')===10, getStock('w1','pB'));
check('xóa: phiếu biến mất khỏi lịch sử', DB.vouchers.length===countBefore-1 && !DB.vouchers.some(x=>x.id===vOut.id));

let vOut2=postVoucher({type:'out',date:'2026-07-10',warehouseId:'w1',lines:[{productId:'pB',qty:10,price:500}]}).voucher;
check('xóa: đã xuất hết (tồn 0)', getStock('w1','pB')===0);
r=deleteVoucher(vIn.id);
check('xóa phiếu nhập bị chặn khi hoàn tác làm âm tồn', !r.ok, r);

r=voidVoucher(vOut2.id);
check('hủy phiếu xuất thứ 2 OK', r.ok, r.error);
check('tồn về lại 10', getStock('w1','pB')===10);
const countBeforeVoidDel=DB.vouchers.length;
r=deleteVoucher(vOut2.id);
check('xóa phiếu ĐÃ HỦY: không hoàn tác lần 2, chỉ gỡ khỏi lịch sử', r.ok && getStock('w1','pB')===10 && DB.vouchers.length===countBeforeVoidDel-1, getStock('w1','pB'));
r=deleteVoucher('khong-ton-tai');
check('xóa phiếu không tồn tại bị chặn', !r.ok);

// ================== 4c. Sửa phiếu ==================
const pC={id:'pC',sku:'C01',name:'Hàng C',unit:'cái',costPrice:0,salePrice:300,minStock:0,active:true};
DB.products.push(pC);
let vInC=postVoucher({type:'in',date:'2026-07-09',warehouseId:'w1',partnerId:null,lines:[{productId:'pC',qty:10,price:100}]}).voucher;
check('sửa-setup: nhập 10 @100, giá vốn 100', pC.costPrice===100 && getStock('w1','pC')===10);
const codeBefore=vInC.code, countV=DB.vouchers.length;

r=updateVoucher(vInC.id, {type:'in', date:'2026-07-09', warehouseId:'w1', partnerId:null, note:'đã sửa', lines:[{productId:'pC',qty:20,price:150}]});
check('sửa phiếu nhập OK', r.ok, r.error);
check('sửa: tồn tính lại = 20', getStock('w1','pC')===20, getStock('w1','pC'));
check('sửa: giá vốn tính lại = 150', pC.costPrice===150, pC.costPrice);
check('sửa: giữ nguyên số phiếu & không thêm phiếu mới', vInC.code===codeBefore && DB.vouchers.length===countV);
check('sửa: tổng mới 3000', vInC.total===3000, vInC.total);
check('sửa: có dấu vết editedBy', !!vInC.editedAt && !!vInC.editedBy);
check('sửa: ghi chú cập nhật', vInC.note==='đã sửa');

let vOutC=postVoucher({type:'out',date:'2026-07-10',warehouseId:'w1',lines:[{productId:'pC',qty:5,price:300}]}).voucher;
check('sửa-setup: xuất 5, tồn 15', getStock('w1','pC')===15);
r=updateVoucher(vOutC.id, {type:'out', date:'2026-07-10', warehouseId:'w1', lines:[{productId:'pC',qty:18,price:300}]});
check('sửa phiếu xuất tăng SL trong giới hạn (18 ≤ 15+5 hoàn tác)', r.ok, r.error);
check('sửa: tồn còn 2', getStock('w1','pC')===2, getStock('w1','pC'));
check('sửa: cost chốt lại theo giá vốn hiện tại', vOutC.lines[0].cost===150, vOutC.lines[0].cost);
check('sửa: tổng 5400', vOutC.total===5400, vOutC.total);

r=updateVoucher(vOutC.id, {type:'out', date:'2026-07-10', warehouseId:'w1', lines:[{productId:'pC',qty:25,price:300}]});
check('sửa vượt tồn bị chặn', !r.ok, r);
check('rollback: tồn vẫn 2', getStock('w1','pC')===2, getStock('w1','pC'));
check('rollback: phiếu giữ nguyên qty 18, tổng 5400', vOutC.lines[0].qty===18 && vOutC.total===5400);

r=updateVoucher(vOutC.id, {type:'out', date:'2026-07-10', warehouseId:'w1', lines:[]});
check('sửa với 0 dòng bị chặn + rollback', !r.ok && getStock('w1','pC')===2 && vOutC.lines.length===1);

r=updateVoucher(vOutC.id, {type:'in', date:'2026-07-10', warehouseId:'w1', lines:[{productId:'pC',qty:1,price:100}]});
check('đổi loại phiếu bị chặn', !r.ok);

voidVoucher(vOutC.id);
r=updateVoucher(vOutC.id, {type:'out', date:'2026-07-10', warehouseId:'w1', lines:[{productId:'pC',qty:1,price:300}]});
check('sửa phiếu đã hủy bị chặn', !r.ok);

// sửa chuyển kho: đổi kho đích
let vTr=postVoucher({type:'transfer',date:'2026-07-10',warehouseId:'w1',toWarehouseId:'w2',lines:[{productId:'pC',qty:5}]}).voucher;
check('sửa-setup: chuyển 5 sang w2', getStock('w2','pC')===5 && getStock('w1','pC')===15);
r=updateVoucher(vTr.id, {type:'transfer', date:'2026-07-10', warehouseId:'w1', toWarehouseId:'w2', lines:[{productId:'pC',qty:2}]});
check('sửa phiếu chuyển giảm SL', r.ok, r.error);
check('sửa chuyển: w1=18, w2=2', getStock('w1','pC')===18 && getStock('w2','pC')===2, getStock('w1','pC')+'/'+getStock('w2','pC'));

// ================== 5. Seed demo ==================
DB=defaultDB();
SESSION=null;
seedDemo();
check('seed: 8 sản phẩm', DB.products.length===8, DB.products.length);
check('seed: 7 phiếu', DB.vouchers.length===7, DB.vouchers.length);
check('seed: 3 người dùng', DB.users.length===3);
check('seed: có cờ demo', DB.meta.demo===true);
const g=(sku)=>DB.products.find(p=>p.sku===sku);
const wh1=DB.warehouses[0], wh2=DB.warehouses[1];
check('seed: VPP001 tồn KHO01=25', getStock(wh1.id,g('VPP001').id)===25, getStock(wh1.id,g('VPP001').id));
check('seed: VPP001 tồn KHO02=5', getStock(wh2.id,g('VPP001').id)===5);
check('seed: DT001 tồn 16', totalStock(g('DT001').id)===16, totalStock(g('DT001').id));
check('seed: 3 mặt hàng tồn thấp', lowStockProducts().length===3, lowStockProducts().map(p=>p.sku));
rp=reportProfit(dayOffset(-30), todayStr());
check('seed: doanh thu thuần 4.140.000', Math.round(rp.sum.revenue)===4140000, rp.sum.revenue);
check('seed: giá vốn 3.360.000', Math.round(rp.sum.cogs)===3360000, rp.sum.cogs);
check('seed: lợi nhuận 780.000', Math.round(rp.sum.profit)===780000, rp.sum.profit);
const dst=dashStats();
check('seed: giá trị tồn kho > 0', dst.stockValue>0, dst.stockValue);
// giá trị tồn kỳ vọng: tính tay
let expectVal=0;
DB.products.forEach(p=>{ expectVal+=totalStock(p.id)*p.costPrice; });
check('seed: dashStats khớp tính tay', Math.abs(dst.stockValue-expectVal)<1);

// serialize không lỗi
check('DB serialize được', JSON.stringify(DB).length>1000);

console.log('\n===== KẾT QUẢ: '+passes+' đạt, '+failures+' lỗi =====');
process.exit(failures?1:0);
