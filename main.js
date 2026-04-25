const { app, BrowserWindow, ipcMain, screen, shell, Tray, nativeImage } = require('electron');
const path = require('path');

let tray = null;
let sensorWindow = null;
let panelWindow = null;

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 500;

function createSensorWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    sensorWindow = new BrowserWindow({
        width: width,
        height: 5,
        x: 0,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    sensorWindow.setIgnoreMouseEvents(false);

    sensorWindow.loadURL(`file://${__dirname}/renderer/sensor.html`);

    sensorWindow.on('mouse-enter', () => {
        ipcMain.handleOnce('get-screen-dimensions', () => screen.getPrimaryDisplay().workAreaSize);
        createPanelWindow();
        panelWindow.show();
    });
}

function createPanelWindow() {
    if (panelWindow) return;
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    panelWindow = new BrowserWindow({
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        x: width - PANEL_WIDTH,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    panelWindow.loadURL(`file://${__dirname}/renderer/popup.html`);

    panelWindow.on('blur', () => {
        if (!panelWindow.webContents.isDevToolsOpened()) {
            panelWindow.hide();
        }
    });
}

app.whenReady().then(() => {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png'));
    tray = new Tray(icon);
    tray.setToolTip('Quick Tasks');

    createSensorWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSensorWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('execute-task', (event, task) => {
    switch (task.type) {
        case 'app':
            // In a real app, you'd use child_process.spawn
            console.log(`Executing app: ${task.target}`);
            break;
        case 'website':
            shell.openExternal(task.target);
            break;
        case 'command':
            // In a real app, you'd use child_process.exec
            console.log(`Executing command: ${task.target}`);
            break;
    }
});
