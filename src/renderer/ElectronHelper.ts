import {Events, EventArgType} from '../common/EventsJson';
import electron from 'electron';
import {ipcRenderer} from 'electron';

export function onEvent<E extends Events>(
  eventName: E,
  callback: (event: electron.Event, args: EventArgType[E]) => void,
) {
  ipcRenderer.on(eventName, callback);
}
