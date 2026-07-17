const { app, BrowserWindow } = require("electron");
const path = require("path");

// 렉 방지 및 Chromium 엔진 성능 최적화 명령어 설정
app.commandLine.appendSwitch('disable-gpu-vsync'); // 수직동기화 해제로 잔렉 및 인풋랙 방지
app.commandLine.appendSwitch('disable-renderer-backgrounding'); // 백그라운드 상태에서 멈춤/렉 방지
app.commandLine.appendSwitch('disable-background-timer-throttling'); // 백그라운드 타이머 제한 해제

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,            // ★ 중요: 렉과 깜빡임 방지를 위해 로딩 전까지 창을 숨김
        alwaysOnTop: true,
        backgroundColor: '#000000', // 배경색을 어둡게 지정해 초기 화이트 플래시(하얀 깜빡임) 완전 차단
        autoHideMenuBar: true,  // 메뉴바 숨김
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false // 창이 뒤로 가도 프레임 저하(렉)가 일어나지 않도록 방지
        }
    });

    // 시작 파일 로드
    win.loadFile("login.html");

    // ★ 핵심 최적화: HTML과 구글 시트 연동 등 모든 리소스 로딩이 끝나 "정말 준비되었을 때"만 창을 보여줌
    win.once('ready-to-show', () => {
        win.show();
        win.focus();
    });

    // 창이 포커스를 잃었을 때 강제로 다시 잡아오는 기존 기능 유지
    win.on('blur', () => {
        setTimeout(() => {
            if (!win.isFocused()) win.focus();
        }, 500);
    });
}

// 앱 성능 저하 요인 차단 및 창 생성
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});