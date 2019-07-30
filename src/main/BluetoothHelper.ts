import {sendEvent} from './ElectronHelper';
import {BluetoothContext} from './BluetoothContextJson';
import {ElectronContext} from './ElectronContextJson';
import {BluetoothState} from './Blue3';

export function registerBluetoothCallbacks(
  context: BluetoothContext & ElectronContext,
) {
  function bluetoothStateChange() {
    const state = context.bluetooth.getBluetoothState();

    if (state === BluetoothState.POWER_ON && context.readyWindows.size > 0) {
      bluetoothStartScanning(context);
    }

    if (
      state === BluetoothState.POWER_OFF ||
      state === BluetoothState.UNKNOWN
    ) {
      bluetoothStopScanning(context);
    }

    sendEvent(
      'bluetooth-change',
      {
        state,
      },
      context,
    );
  }

  function newDeviceDiscovered(peripheralId: string) {
    context.knownPeripheralIds.add(peripheralId);
  }

  context.bluetooth.bluetoothStateChange = bluetoothStateChange;
  context.bluetooth.newDeviceDiscovered = newDeviceDiscovered;
}

export function bluetoothStartScanning(context: BluetoothContext) {
  context.bluetooth.startScanning(Array.from(context.knownPeripheralIds));
}

export function bluetoothStopScanning(context: BluetoothContext) {
  context.bluetooth.stopScanning();
}
