import {Blue3} from './Blue3';
import {BluetoothContext} from './BluetoothContextJson';

export class BluetoothContextImpl implements BluetoothContext {
  public knownPeripheralIds = new Set<string>();

  constructor(public bluetooth: Blue3) {}
}
