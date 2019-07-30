import {sendEvent, initApp} from './ElectronHelper';
import {config} from './config';
import {registerBluetoothCallbacks} from './BluetoothHelper';

const context = {
  ...config.getBluetoothContext(),
  ...config.getElectronContext(),
};

initApp(context);
registerBluetoothCallbacks(context);

setInterval(() => {
  sendEvent('test', {a: '123'}, context);
}, 1000);
