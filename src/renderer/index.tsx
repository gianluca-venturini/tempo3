import * as React from 'react';
import * as ReactDOM from 'react-dom';
import electron from 'electron';
import {ipcRenderer} from 'electron';

ReactDOM.render(<div>Time 3</div>, document.getElementById('root'), () => {
  ipcRenderer.send('application-ready');
});

ipcRenderer.on('test', (_: electron.Event, args: {a: number}) => {
  console.log(args);
});
