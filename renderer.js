const { ipcRenderer } = require('electron');

document.getElementById('scanButton').addEventListener('click', () => {
  ipcRenderer.send('start-processing');
});

ipcRenderer.on('processing-done', (event, MonsArray) => {
    initializeFilters(MonsArray);
    displayMons(MonsArray); // Call display function directly with the received data

    // Notify the main process to focus the app window
    ipcRenderer.send('bring-app-to-front');
});


// In render.js
ipcRenderer.on('log-message', (event, message) => {
  console.log(message);
});
