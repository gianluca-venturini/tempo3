import moment from 'moment';

export class Logger {
  constructor(private moduleName: string) {}

  public info(message: string, other?: any) {
    console.log(
      `[${this.moduleName} - ${moment().format('HH:mm:ss')}]: ${message}`,
      other,
    );
  }

  public warning(message: string, other?: any) {
    console.warn(
      '\x1b[33m%s', // Yellow color in console
      `[${this.moduleName} - ${moment().format('HH:mm:ss')}]: ${message}`,
      other,
    );
  }

  public error(message: string, other?: any) {
    console.error(
      '\x1b[31m%s', // Red color in console
      `[${this.moduleName} - ${moment().format('HH:mm:ss')}]: ${message}`,
      other,
    );
    return new Error(`${message} ${other && JSON.stringify(other)}`);
  }
}
