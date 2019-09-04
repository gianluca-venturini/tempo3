import sequelize, {Sequelize, Model, Op} from 'sequelize';
import electron = require('electron');
import {Logger} from './Logger';

const logger = new Logger('DeviceState');

const userDataPath = (electron.app || electron.remote.app).getPath('userData');
console.log(`sqlite:${encodeURI(userDataPath)}/device.db`);
const sequelizeDb = new Sequelize(
  `sqlite:${encodeURI(userDataPath)}/device.db`,
);

class Event extends Model {
  date!: Date;
  pos!: number;
}

Event.init(
  {
    ts: {
      type: sequelize.DATE,
      primaryKey: true,
    },
    pos: sequelize.INTEGER,
  },
  {sequelize: sequelizeDb, modelName: 'event'},
);

/**
 * Updates the local database that contains events. Only new events are saved.
 * This function is idempotent.
 * For optimization purposes only new events are saved.
 */
export async function updateEvents(state: DeviceState) {
  const timestamps = state.events.map(event => event.ts);

  const events: Event[] = await Event.findAll({
    where: {
      date: {
        [Op.or]: timestamps,
      },
    },
  });

  const alreadyStoredEventsTs = new Set<number>();
  events.forEach(event => alreadyStoredEventsTs.add(dateToTs(event.date)));
  logger.info('Saving events on DB', {
    totalEvents: state.events.length,
    alreadyStoredEvents: alreadyStoredEventsTs.size,
  });
  state.events.forEach(event => {
    if (!alreadyStoredEventsTs.has(event.ts)) {
      const eventInstance = Event.create({
        date: tsToDate(event.ts),
        pos: event.pos,
      });
      eventInstance.save();
    }
  });
}

/** Transforms timestamps in seconds to date */
function tsToDate(ts: number): Date {
  // Date accepts ts in milliseconds
  return new Date(ts * 1000);
}

/** Transforms date to timestamp is seconds */
function dateToTs(date: Date): number {
  return date.getTime() / 1000;
}
