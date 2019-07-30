import {initApp} from './ElectronHelper';
import {config} from './config';
import {initBluetooth} from './BluetoothHelper';

const context = {
  ...config.getBluetoothContext(),
  ...config.getElectronContext(),
};

initApp(context);
initBluetooth(context);
