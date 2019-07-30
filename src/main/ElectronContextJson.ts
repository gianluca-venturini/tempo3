import electron from 'electron';

export interface ElectronContext {
  app: electron.App;
  readyWindows: Set<electron.BrowserWindow>;
}
