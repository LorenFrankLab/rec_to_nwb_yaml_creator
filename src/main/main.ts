/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

import fs from 'fs';
import YAML from 'yaml';
import jsYaml from 'js-yaml';
import Os from 'os';
import { resolveHtmlPath } from './util';
import MenuBuilder from './menu';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// Event handler for asynchronous incoming messages
ipcMain.on('asynchronous-message', (event, arg) => {
  console.log(arg);

  // TODO: Move this into a function. It is a quick hack
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const file = require('path').resolve(
    __dirname,
    getAssetPath('jsonSchema.json')
  );
  fs.readFile(file, 'utf8', (error, data) => {
    event.sender.send('RESPONSE_AFTER_READING_OF_JSON_SCHEMA_FILE', data);
  });
});

ipcMain.on('SAVE_USER_DATA', async (event, userData) => {
  const doc = new YAML.Document();
  doc.contents = userData;

  // "app is ready" notification seems to be a ubuntu message
  // see - https://github.com/electron/electron/issues/32857
  dialog
    .showSaveDialog({
      title: 'Save YAML File',
      defaultPath: path.join(Os.homedir(), 'data.yml'),
      buttonLabel: 'Save As',
      filters: [{ name: 'YAML' }, { extension: ['yaml', 'yml'] }],
      properties: [],
    })
    .then((file) => {
      if (!file.canceled) {
        fs.writeFileSync(file.filePath, doc.toString());
      }
    })
    .catch(() => {
      dialog.showMessageBox({
        buttons: ['OK'],
        message: 'File download unsucessful',
      });
    });
});

ipcMain.on('REQUEST_OPEN_TEMPLATE_FILE_BOX', async (event) => {
  dialog
    .showOpenDialog({ properties: ['openFile'] })
    .then((result) => {
      if (result.canceled) {
        dialog.showMessageBox({
          buttons: ['OK'],
          message: 'File upload canceled',
        });
      }

      const filePath = result.filePaths[0];

      try {
        fs.readFile(filePath, 'utf8', (error, data) => {
          event.sender.send(
            'RESPONSE_OPEN_TEMPLATE_FILE_BOX',
            jsYaml.load(data)
          );
        });
      } catch (error) {
        console.error(`=============\n${error}\n============`);
      }
    })
    .catch((error) => {
      console.error(error);
      dialog.showMessageBox({
        buttons: ['OK'],
        message: 'No File found to upload',
      });
    });
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('lorenlab-icon.png'),
    webPreferences: {
      sandbox: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
