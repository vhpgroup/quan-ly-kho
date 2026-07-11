#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ghép các module trong src/ thành file quan-ly-kho.html hoàn chỉnh (một file duy nhất).

Cách dùng:  python3 build.py
Kết quả :  quan-ly-kho.html tại thư mục gốc — mở trực tiếp bằng trình duyệt là chạy.
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'src')
OUT = os.path.join(BASE, 'quan-ly-kho.html')

PARTS_JS = [
    '10_core.js',      # tiện ích, SHA-256, đọc số thành chữ, lưu trữ localStorage
    '20_engine.js',    # tồn kho, giá vốn BQGQ, ghi/sửa/hủy/xóa phiếu, số liệu báo cáo
    '30_shell.js',     # điều hướng, modal, toast, đăng nhập, phân quyền
    '40_catalog.js',   # sản phẩm, nhóm hàng, đối tác, kho, người dùng
    '50_vouchers.js',  # form phiếu nhập/xuất/chuyển/trả, kiểm kê, chi tiết & in phiếu
    '60_tracking.js',  # tồn kho, lịch sử phiếu, báo cáo
    '70_system.js',    # Excel, sao lưu/khôi phục, nhật ký, dashboard, dữ liệu mẫu
]


def read(name, folder=SRC):
    with open(os.path.join(folder, name), encoding='utf-8') as f:
        return f.read().rstrip()


def main():
    out = [read('01_head.html'), read('02_body.html')]
    for name in PARTS_JS:
        js = read(name)
        assert '</script' not in js.lower(), 'Phát hiện </script> trong ' + name
        out.append('<script>\n' + js + '\n</script>')
    out.append('</body>\n</html>')
    html = '\n\n'.join(out)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print('Đã ghép %s — %d ký tự, %d dòng' % (OUT, len(html), html.count('\n') + 1))


if __name__ == '__main__':
    main()
