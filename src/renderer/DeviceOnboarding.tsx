import * as React from 'react';
import {
  Button,
  DialogActions,
  DialogContentText,
  DialogContent,
  DialogTitle,
  Dialog,
} from '@material-ui/core';
import electron, {ipcRenderer} from 'electron';
import {onEvent} from './ElectronHelper';

interface DeviceOnboardingState {
  peripheralId?: string;
}

export class DeviceOnboarding extends React.Component<
  {},
  DeviceOnboardingState
> {
  state: DeviceOnboardingState = {};

  componentDidMount() {
    onEvent(
      'bluetooth-new-device',
      (_: electron.Event, args: {peripheralId: string}) => {
        this.setState({peripheralId: args.peripheralId});
      },
    );
  }

  render() {
    const {peripheralId} = this.state;
    return (
      <Dialog
        open={!!peripheralId}
        onClose={this.handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Discovered new time tracking device
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {`Do you want to add ${peripheralId} to the list of know devices?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleClose} color="primary">
            No
          </Button>
          <Button onClick={this.handleAddPeripheral} color="primary">
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    );
    // return <Snackbar message="Discovered new device" open={!!peripheralId} />;
  }

  private handleClose = () => {
    this.setState({peripheralId: undefined});
  };

  private handleAddPeripheral = () => {
    this.setState({peripheralId: undefined});
    const {peripheralId} = this.state;
    if (peripheralId) {
      ipcRenderer.send('bluetooth-add-device', {peripheralId});
    }
  };
}
