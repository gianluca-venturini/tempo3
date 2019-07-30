import {BluetoothState} from '../main/Blue3';

export interface EventArgType {
  'bluetooth-status-change': {
    state: BluetoothState;
  };
  'bluetooth-new-device': {
    peripheralId: string;
  };
  'bluetooth-add-device': {
    peripheralId: string;
  };
}

export type Events = keyof EventArgType;
