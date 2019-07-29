# tempo3

## Prepare dev environment

Prepare all the native modules for running in Electron 5.

```
export npm_config_target=5.0.0
export npm_config_arch=x64
export npm_config_target_arch=x64
export npm_config_disturl=https://electronjs.org/headers
export npm_config_runtime=electron
export npm_config_build_from_source=true
HOME=~/.electron-gyp yarn install
```

## Start the application in dev mode

Build and start the app
`npm start`
