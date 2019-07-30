import {Blue3} from './Blue3';

export interface BluetoothContext {
  bluetooth: Blue3;
  knownPeripheralIds: Set<string>;
}
