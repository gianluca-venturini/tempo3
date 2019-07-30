import {BluetoothContext} from './BluetoothContextJson';
import {ElectronContext} from './ElectronContextJson';

export interface Tempo3Config {
  getBluetoothContext: () => BluetoothContext;
  getElectronContext: () => ElectronContext;
}
