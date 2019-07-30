import electron from 'electron';
import {ipcMain} from 'electron';
import {BluetoothContext} from './BluetoothContextJson';
import {ElectronContext} from './ElectronContextJson';
import * as url from 'url';
import path from 'path';
import {bluetoothStopScanning, bluetoothStartScanning} from './BluetoothHelper';
import {Events, EventArgType} from '../common/EventsJson';

function createWindow(context: BluetoothContext & ElectronContext) {
  // Create the browser window.
  const mainWindow = new electron.BrowserWindow({
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
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function() {
    context.readyWindows.delete(mainWindow);
  });

  context.readyWindows.add(mainWindow);
}

export function initApp(context: ElectronContext & BluetoothContext) {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  context.app.on('ready', () => createWindow(context));

  // Quit when all windows are closed.
  context.app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      context.app.quit();
    }
  });

  context.app.on('activate', function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (context.readyWindows.size === 0) {
      createWindow(context);
    }
  });

  onApplucationReady(context);
}

function cleanupWindow(
  window: electron.BrowserWindow,
  context: BluetoothContext & ElectronContext,
) {
  context.readyWindows.delete(window);
  if (context.readyWindows.size === 0) {
    bluetoothStopScanning(context);
  }
}

function onApplucationReady(context: BluetoothContext & ElectronContext) {
  ipcMain.on('application-ready', (event: electron.Event) => {
    context.readyWindows.forEach(window => {
      if (window.webContents === event.sender) {
        event.sender.on('destroyed', () => cleanupWindow(window, context));
      }
      bluetoothStartScanning(context);
    });
  });
}

export function sendEvent<E extends Events>(
  eventName: E,
  args: EventArgType[E],
  context: ElectronContext,
) {
  context.readyWindows.forEach(window => {
    window.webContents.send(eventName, args);
  });
}

export function onEvent<E extends Events>(
  eventName: E,
  callback: (event: electron.Event, args: EventArgType[E]) => void,
) {
  ipcMain.on(eventName, callback);
}
