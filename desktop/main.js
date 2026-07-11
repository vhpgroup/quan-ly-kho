'use strict';
/* ==================== QUẢN LÝ KHO — ELECTRON MAIN ==================== */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

/* Một phiên bản duy nhất — mở lần 2 sẽ focus cửa sổ đang chạy */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'Quản Lý Kho',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#eef1f7',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  win.loadFile(path.join(__dirname, 'app.html'));
  win.once('ready-to-show', function () { win.show(); });

  /* Link ngoài (nếu có) mở bằng trình duyệt hệ thống, không mở cửa sổ mới */
  win.webContents.setWindowOpenHandler(function (details) {
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url);
    return { action: 'deny' };
  });
  win.on('closed', function () { win = null; });
}

/* ---------- Menu tiếng Việt ---------- */
function buildMenu() {
  const template = [
    {
      label: 'Tệp',
      submenu: [
        {
          label: 'In trang hiện tại…',
          accelerator: 'CmdOrCtrl+P',
          click: function () { if (win) win.webContents.print(); }
        },
        { type: 'separator' },
        { label: 'Thoát', role: 'quit' }
      ]
    },
    {
      label: 'Xem',
      submenu: [
        { label: 'Phóng to', role: 'zoomIn' },
        { label: 'Thu nhỏ', role: 'zoomOut' },
        { label: 'Cỡ chữ mặc định', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toàn màn hình', role: 'togglefullscreen' },
        { label: 'Công cụ nhà phát triển', role: 'toggleDevTools', accelerator: 'Ctrl+Shift+I' }
      ]
    },
    {
      label: 'Trợ giúp',
      submenu: [
        {
          label: 'Giới thiệu',
          click: function () {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'Giới thiệu',
              message: 'Quản Lý Kho Nội Bộ',
              detail: 'Phiên bản ' + app.getVersion() + '\n\nDữ liệu lưu ngay trên máy này (thư mục hồ sơ ứng dụng).\nNên tải file sao lưu định kỳ trong mục "Sao lưu & Cài đặt".\n\nThư mục dữ liệu:\n' + app.getPath('userData')
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', function () {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(function () {
  buildMenu();
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
