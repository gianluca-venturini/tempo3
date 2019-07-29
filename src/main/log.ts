import moment from 'moment';

export class Logger {
  constructor(private moduleName: string) {}

  public info(message: string, other?: any) {
    console.log(
      `[${this.moduleName} - ${moment().format('HH:mm:ss')}]: ${message}`,
      other,
    );
  }

  public error(message: string, other?: any) {
    console.error(
      '\x1b[33m%s\x1b[0m',
      `[${this.moduleName} - ${moment().format('HH:mm:ss')}]: ${message}`,
      other,
    );
  }
}
