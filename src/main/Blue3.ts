import noble from 'noble';
import {Logger} from './Logger';
import {isArray, isString} from 'lodash';

const ECHO_SERVICE_UUID = 'ffe0';
const ECHO_CHARACTERISTIC_UUID = 'ffe1';

export enum BluetoothState {
  UNKNOWN = 'unknown',
  POWER_OFF = 'power_off',
  POWER_ON = 'power_on',
}

const logger = new Logger('Bluetooth');

/**
 * Continuously search the bluetooth serial with the pre-defined characteristics.
 * Once the bluetooth serial is found attempt to connect and fetch data from it.
 */
export class Blue3 {
  private bluetoothState: BluetoothState = BluetoothState.UNKNOWN;
  private isScanning: boolean = false;
  private peripheralIds?: Set<string>;
  private newDeviceDiscoveredCallback?: (peripheralId: string) => void;
  private deviceStatusUpdateCallback?: (state: DeviceState) => void;

  constructor() {
    noble.on('stateChange', this.handleStateChange);
    noble.on('discover', this.handleDiscover);
  }

  set bluetoothStateChange(callback: () => void) {
    noble.on('stateChange', callback);
  }

  set newDeviceDiscovered(callback: (peripheralId: string) => void) {
    this.newDeviceDiscoveredCallback = callback;
  }

  set deviceStateUpdate(callback: (state: DeviceState) => void) {
    this.deviceStatusUpdateCallback = callback;
  }

  getBluetoothState = () => {
    return this.bluetoothState;
  };

  startScanning = (peripheralIds?: string[]) => {
    if (this.isScanning) {
      return;
    }
    this.isScanning = true;
    logger.info(`Start scanning bluetooth for ids ${peripheralIds}`);
    this.peripheralIds = new Set(peripheralIds);
    noble.startScanning([ECHO_SERVICE_UUID]);
  };

  stopScanning = () => {
    if (!this.isScanning) {
      return;
    }
    this.isScanning = false;
    logger.info('Stop scanning bluetooth');
    noble.stopScanning();
  };

  private handleStateChange = (state: string) => {
    if (state === 'poweredOn') {
      logger.info('Bluetooth power on');
      this.setBluetoothStateChange(BluetoothState.POWER_ON);
    } else {
      logger.info('Bluetooth power off');
      this.setBluetoothStateChange(BluetoothState.POWER_OFF);
      noble.stopScanning();
    }
  };

  private setBluetoothStateChange = (state: BluetoothState) => {
    this.bluetoothState = state;
    if (this.bluetoothStateChange) {
      this.bluetoothStateChange();
    }
  };

  private handleDiscover = (peripheral: noble.Peripheral) => {
    logger.info(`Discovered peripheral ${peripheral.id}`);
    if (this.peripheralIds && this.peripheralIds.has(peripheral.id)) {
      // Known device found
      noble.stopScanning();
      logger.info(
        `Connecting to '${peripheral.advertisement.localName}' ${peripheral.id}`,
      );

      const timestamp = new Date().getTime() / 1000;
      const requestBuffer = Buffer.allocUnsafe(5);
      requestBuffer.writeUInt8(0x8 | 0x4 | 0x2 | 0x1, 0);
      requestBuffer.writeUInt32BE(timestamp, 1);

      // Get device events, battery, name and set time
      this.fetch(
        peripheral,
        this.handleServicesAndCharacteristicsDiscovered,
        requestBuffer,
        this.handleEventsMessage,
      );
    } else {
      // New device found
      this.fetch(
        peripheral,
        this.handleServicesAndCharacteristicsDiscovered,
        Buffer.from('01', 'hex'), // Request name
        response => this.handleNameMessage(response, peripheral.id),
      );
    }
    peripheral.on('disconnect', this.handlePeripheralDisconnect);
  };

  private handlePeripheralDisconnect = () => {
    logger.info('Disconnect');
  };

  private fetch = <T>(
    peripheral: noble.Peripheral,
    handleServicesAndCharacteristicsDiscovered: <T>(
      error: string,
      services: noble.Service[],
      characteristics: noble.Characteristic[],
      peripheral: noble.Peripheral,
      request: Buffer,
      callback: (response: T) => void,
    ) => void,
    request: Buffer,
    callback: (response: T) => void,
  ) => {
    peripheral.connect(error => {
      logger.info('Connected to', peripheral.id);

      // specify the services and characteristics to discover
      const serviceUUIDs = [ECHO_SERVICE_UUID];
      const characteristicUUIDs = [ECHO_CHARACTERISTIC_UUID];

      peripheral.discoverSomeServicesAndCharacteristics(
        serviceUUIDs,
        characteristicUUIDs,
        (error, services, characteristics) =>
          handleServicesAndCharacteristicsDiscovered(
            error,
            services,
            characteristics,
            peripheral,
            request,
            callback,
          ),
      );
    });
  };

  private handleEventsMessage = (message: object) => {
    logger.info('Correctly synched status ', message);
    if (this.deviceStatusUpdateCallback) {
      if (this.isState(message)) {
        this.deviceStatusUpdateCallback(message);
      } else {
        throw logger.error('Impossible to parse bluetooth message', {message});
      }
    }
  };

  private isState(message: any): message is DeviceState {
    if (
      isString(message.name) &&
      isString(message.battery) &&
      isArray(message.events)
    ) {
      return true;
    }
    return false;
  }

  private handleNameMessage = (message: any, peripheralId: string) => {
    logger.info('Correctly found device name ', message);
    if (this.newDeviceDiscoveredCallback) {
      this.newDeviceDiscoveredCallback(peripheralId);
    } else {
      logger.warning('No callback set for device dicovering. Discarding event');
    }
  };

  private handleServicesAndCharacteristicsDiscovered = <T>(
    error: string,
    services: noble.Service[],
    characteristics: noble.Characteristic[],
    peripheral: noble.Peripheral,
    request: Buffer,
    callback: (response: T) => void,
  ) => {
    logger.info('Discovered services and characteristics');
    const echoCharacteristic = characteristics[0];

    let receptionBuffer: Buffer | undefined;
    let messageLength: number | undefined;

    // data callback receives notifications
    echoCharacteristic.on('data', (data: Buffer, isNotification: boolean) => {
      logger.info('Received: "' + data + '"');
      if (data.includes(0x0)) {
        logger.info('FOUND');
        const numberLength = data.indexOf(0x0);
        messageLength = parseInt(data.slice(0, numberLength).toString());
        receptionBuffer = data.slice(numberLength + 1);
        logger.info(`Message length ${messageLength}`);
      } else {
        if (receptionBuffer === undefined) {
          throw 'Protocol violation: reception buffer undefined.';
        } else {
          receptionBuffer = Buffer.concat([receptionBuffer, data]);
        }
      }

      if (receptionBuffer !== undefined && messageLength !== undefined) {
        if (receptionBuffer.length === messageLength) {
          logger.info('Message reception completed');
          const response = JSON.parse(receptionBuffer.toString());
          callback(response);
          peripheral.disconnect();
          receptionBuffer = undefined;
        } else if (receptionBuffer.length > messageLength) {
          throw `Protocol violation: reception buffer larger than expected expeted: ${messageLength} actual ${receptionBuffer.length}.`;
        }
      }
    });

    // subscribe to be notified whenever the peripheral update the characteristic
    echoCharacteristic.subscribe(error => {
      if (error) {
        logger.error('Error subscribing to echoCharacteristic');
      } else {
        logger.info('Subscribed for echoCharacteristic notifications');
      }
    });

    // create an interval to send data to the service
    setTimeout(() => {
      logger.info("Sending:  '" + request.toString('hex') + "'");
      echoCharacteristic.write(request, false);
    }, 1000);
  };
}
