import {Tempo3Config} from './ConfigJson';
import {BluetoothContextImpl} from './BluetoothContext';
import {Blue3} from './Blue3';
import {ElectronContextImpl} from './ElectronContext';
import electron from 'electron';

const bluetooth = new Blue3();
const app = electron.app;

export const config: Tempo3Config = {
  getBluetoothContext: () => new BluetoothContextImpl(bluetooth),
  getElectronContext: () => new ElectronContextImpl(app),
};
