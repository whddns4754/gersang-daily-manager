const { contextBridge, ipcRenderer } = require('electron');

// 웹 화면(Script.js)과 일렉트론 메인 엔진 사이에 빈 안전 통로만 열어줍니다.
contextBridge.exposeInMainWorld('electronAPI', {});