import electron from 'electron';
import {ElectronContext} from './ElectronContextJson';

export class ElectronContextImpl implements ElectronContext {
  public readyWindows = new Set<electron.BrowserWindow>();

  constructor(public app: electron.App) {}
}
