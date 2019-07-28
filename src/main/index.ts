import electron from 'electron';
import {ipcMain} from 'electron';
import * as url from 'url';
import * as path from 'path';

// Module to control application life.
const app = electron.app;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: electron.BrowserWindow | null;

function createWindow() {
  // Create the browser window.
  mainWindow = new electron.BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, '../renderer/index.html'),
      protocol: 'file:',
      slashes: true,
    }),
  );

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function() {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

const readyWindows = new Set<electron.WebContents>();

function cleanupWindow(sender: electron.WebContents) {
  readyWindows.delete(sender);
}

function listenApplicationReadyEvents() {
  ipcMain.on('application-ready', (event: electron.Event) => {
    readyWindows.add(event.sender);
    event.sender.on('destroyed', () => cleanupWindow(event.sender));
  });
}

listenApplicationReadyEvents();

setInterval(() => {
  readyWindows.forEach(sender => {
    sender.send('test', {a: '123'});
  });
}, 1000);
