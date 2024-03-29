import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {ipcRenderer} from 'electron';
import {App} from './App';

ReactDOM.render(<App />, document.getElementById('root'), () => {
  ipcRenderer.send('application-ready');
});
