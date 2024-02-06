const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// Assuming script.js is in the same directory as main.js
const { startProcessing } = require('./scriptv2.js');

let win; // Declare win globally to access it outside createWindow

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Consider using contextIsolation and preload scripts for production
    },
    icon: path.join(__dirname, 'BreederBuddyIcon.png')
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

// In main.js
ipcMain.on('start-processing', async (event) => {
  console.log('Starting processing...');
  const logFunction = (message) => {
    event.sender.send('log-message', message);
  };
  const MonsArray = await startProcessing(logFunction);
  event.reply('processing-done', MonsArray);
});

// Listen for the message from the renderer process to bring app to front
ipcMain.on('bring-app-to-front', () => {
  if (win) {
    if (win.isMinimized()) win.restore(); // Unminimize if minimized
    win.focus(); // Bring the window to the front
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
