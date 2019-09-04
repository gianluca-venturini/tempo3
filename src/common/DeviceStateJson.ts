interface DeviceState {
    /** Name of the device */
    name: string;

    /** Battery charge */
    battery: string;

    /** Position events */
    events: {ts: number; pos: number}[];
}
