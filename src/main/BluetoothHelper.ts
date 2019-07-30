import {sendEvent, onEvent} from './ElectronHelper';
import {BluetoothContext} from './BluetoothContextJson';
import {ElectronContext} from './ElectronContextJson';
import {BluetoothState} from './Blue3';
import {Logger} from './Logger';

const logger = new Logger('BluetoothHelper');

export function initBluetooth(context: BluetoothContext & ElectronContext) {
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
      'bluetooth-status-change',
      {
        state,
      },
      context,
    );
  }

  function newDeviceDiscovered(peripheralId: string) {
    sendEvent(
      'bluetooth-new-device',
      {
        peripheralId,
      },
      context,
    );
  }

  context.bluetooth.bluetoothStateChange = bluetoothStateChange;
  context.bluetooth.newDeviceDiscovered = newDeviceDiscovered;

  onEvent('bluetooth-add-device', (event, args) => {
    logger.info('Added bluetooth device', {peripheralId: args.peripheralId});
    context.knownPeripheralIds.add(args.peripheralId);

    // Restart the scanning including the new device
    bluetoothStopScanning(context);
    const state = context.bluetooth.getBluetoothState();
    if (state === BluetoothState.POWER_ON && context.readyWindows.size > 0) {
      bluetoothStartScanning(context);
    }
  });
}

export function bluetoothStartScanning(context: BluetoothContext) {
  context.bluetooth.startScanning(Array.from(context.knownPeripheralIds));
}

export function bluetoothStopScanning(context: BluetoothContext) {
  context.bluetooth.stopScanning();
}
