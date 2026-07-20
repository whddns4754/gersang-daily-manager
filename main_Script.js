// [1. 데이터 기본값 설정]
const DEFAULT_ESSENTIAL = [
    "주막임무-일반", "주막임무-특수", "주막임무-전직", "주막임무-고고학",
    "채광(2회)", "정령탐색(3회)", "장수(개조/각성) 시나리오(5회)", 
    "전설장수 시나리오(5회)", "사천왕 시나리오(2회)"
];
const DEFAULT_SPECIAL = [
    "시련(5회)", "일반무도장(3회)"
]; 
const DEFAULT_WEEKLY = [
    "은영낭자 퀘스트1 (유명계)", "은영낭자 퀘스트2 (귀곡성)", 
    "민쿤 퀘스트1 (물품 가져다주기)", "민쿤 퀘스트2 (진시황릉)", 
    "무도장 도전모드", "혈투의전장", "기묘한설화", "빛의 시험"
];

// ★ [구글 시트 연동 설정]
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyB2pSo-rNWz_WctvW3bz9Dru8ljF2aWYV0rzGwP7dkS_U5NPZhN8pZru0UXMi2TadwGA/exec';

let myMonthlyChart = null;

// ★ [서버 이름 정제 유틸리티]
function cleanServerName(serverName) {
    if (!serverName) return "";
    let cleaned = String(serverName);
    cleaned = cleaned.replace(/\\/g, ""); 
    cleaned = cleaned.replace(/[\[\]\(\)\{\}\"\']/g, ""); 
    cleaned = cleaned.replace(/서버/g, "");
    cleaned = cleaned.trim().replace(/\s+/g, "");
    return cleaned;
}

// [서버별 고유 키 생성 도우미]
function getServerKey(key) {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    return `${cleanServer}_${key}`;
}

// ★ [클라이언트별 격리 키 생성 도우미]
function getClientServerKey(key) {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    const clientSelect = document.querySelector('.client-select');
    const clientName = clientSelect ? clientSelect.value : "1클라";
    return `${cleanServer}_${clientName}_${key}`;
}

// [데이터 로드 유틸리티]
function getSavedTasks(key, defaultArray) {
    const serverKey = getServerKey(key);
    const saved = localStorage.getItem(serverKey);
    return saved ? JSON.parse(saved) : defaultArray;
}
function getClientName(index) { 
    const serverKey = getServerKey(`clientName_${index}`);
    return localStorage.getItem(serverKey) || `${index}클라`; 
}
function getCurrencyUnit() { return localStorage.getItem('currencyUnit') || 'won'; }

// [실시간 디지털시계 엔진]
function updateLiveDateTime() {
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    if (dateEl) dateEl.innerText = `${yyyy}-${mm}-${dd}`;
    if (timeEl) timeEl.innerText = `${hh}:${min}:${ss}`;
}

// [수익 데이터 및 포맷팅]
function formatCurrency(amount) {
    amount = parseInt(amount) || 0;
    if (getCurrencyUnit() === 'billion') {
        const billion = Math.floor(amount / 100000000);
        const million = Math.floor((amount % 100000000) / 10000);
        return billion > 0 ? `${billion}억 ${million > 0 ? million + '만' : ''}원` : `${million}만원`;
    }
    return amount.toLocaleString() + "원";
}

// [1. 일간 수익 데이터 로드]
function loadProfitData() {
    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    const tbody = document.getElementById('profit-body');
    if (!tbody) return;
    tbody.innerHTML = ''; 
    savedData.forEach((entry) => {
        const entryServer = cleanServerName(entry.server || "서버없음");
        if (entryServer !== currentServer) return;

        const unitPrice = parseInt(entry.price) || 0;
        const quantity = parseInt(entry.qty) || 0;
        const total = unitPrice * quantity;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.client}</td>
            <td>${entry.item}</td>
            <td>${quantity}</td>
            <td data-raw-price="${entry.price}">${total.toLocaleString()}원</td>
            <td>
                <button onclick="editRow(this)">수정</button>
                <button onclick="deleteRow(this)">삭제</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    updateDashboard();
}

// [2. 주간 수익 데이터 렌더링 - 로컬 연산 모듈]
function renderWeeklyProfitTable() {
    const tbody = document.getElementById('weekly-profit-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    const currentWeek = getISOWeek(new Date());
    const currentYear = new Date().getFullYear();

    const weeklyData = savedData.filter(entry => {
        const entryServer = cleanServerName(entry.server || "서버없음");
        if (entryServer !== currentServer) return false;
        if (!entry.date) return true; // 구버전 데이터 호환
        
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === currentYear && getISOWeek(entryDate) === currentWeek;
    });

    if (weeklyData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 15px; color:#666;">이번 주 누적 수익 데이터가 없습니다.</td></tr>`;
        return;
    }

    weeklyData.forEach(entry => {
        const total = (parseInt(entry.price) || 0) * (parseInt(entry.qty) || 0);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.client}</td>
            <td>${entry.item}</td>
            <td>${entry.qty}</td>
            <td>${total.toLocaleString()}원</td>
        `;
        tbody.appendChild(row);
    });
}

// [3. 월간 수익 데이터 렌더링 - 로컬 연산 모듈]
function renderMonthlyProfitTable() {
    const tbody = document.getElementById('monthly-profit-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    const currentYearMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

    const monthlyData = savedData.filter(entry => {
        const entryServer = cleanServerName(entry.server || "서버없음");
        if (entryServer !== currentServer) return false;
        if (!entry.date) return true;
        return entry.date.substring(0, 7) === currentYearMonth;
    });

    if (monthlyData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 15px; color:#666;">이번 달 누적 수익 데이터가 없습니다.</td></tr>`;
        return;
    }

    monthlyData.forEach(entry => {
        const total = (parseInt(entry.price) || 0) * (parseInt(entry.qty) || 0);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.client}</td>
            <td>${entry.item}</td>
            <td>${entry.qty}</td>
            <td>${total.toLocaleString()}원</td>
        `;
        tbody.appendChild(row);
    });
}

// [4. 목표 달성률 렌더링 및 프로그레스 바 적용]
function renderGoalTable() {
    const goalBody = document.getElementById('goal-body');
    if (!goalBody) return;
    goalBody.innerHTML = ''; 

    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    const currentWeek = getISOWeek(new Date());
    const currentYear = new Date().getFullYear();

    // 클라별 이번 주 누적 수익 계산
    const clientWeeklyProfits = {};
    savedData.forEach(entry => {
        const entryServer = cleanServerName(entry.server || "서버없음");
        if (entryServer !== currentServer) return;
        
        if (entry.date) {
            const entryDate = new Date(entry.date);
            if (entryDate.getFullYear() !== currentYear || getISOWeek(entryDate) !== currentWeek) return;
        }

        const total = (parseInt(entry.price) || 0) * (parseInt(entry.qty) || 0);
        clientWeeklyProfits[entry.client] = (clientWeeklyProfits[entry.client] || 0) + total;
    });

    for (let i = 1; i <= 5; i++) {
        const cName = getClientName(i);
        const serverKey = getServerKey(`goal_${i}`);
        const savedGoal = parseInt(localStorage.getItem(serverKey)) || 0;
        const currentProfit = clientWeeklyProfits[cName] || 0;
        const percent = savedGoal > 0 ? Math.min(100, Math.floor((currentProfit / savedGoal) * 100)) : 0;

        goalBody.innerHTML += `
            <tr style="background-color: rgba(255, 255, 255, 0.6);">
                <td style="color: #000; font-weight: bold; padding: 10px;">${cName}</td>
                <td style="padding: 10px;">
                    <input type="number" value="${savedGoal}" onchange="saveGoal(${i}, this.value)" 
                           style="width: 120px; height: 30px; color: #000; background-color: #fff; border: 1px solid #333; padding: 5px; font-size: 14px; font-weight: bold;"> 원
                </td>
                <td style="padding: 10px;">
                    <div style="font-size: 12px; font-weight: bold; margin-bottom: 3px; color: #333;">
                        주간 달성: ${currentProfit.toLocaleString()}원 (${percent}%)
                    </div>
                    <div style="width: 100%; background: #e0e0e0; border-radius: 10px; height: 12px; overflow: hidden; border: 1px solid #ccc;">
                        <div style="width: ${percent}%; background: #2ecc71; height: 100%; transition: width 0.3s ease;"></div>
                    </div>
                </td>
            </tr>`;
    }
}

function saveGoal(clientIndex, value) { 
    const serverKey = getServerKey(`goal_${clientIndex}`);
    localStorage.setItem(serverKey, value); 
    renderGoalTable();
    updateDashboard();
}

// [수익 등록 - Date 필드 스탬프 및 아이템 마스터 등록 기능 포함]
async function addProfit() {
    const clientSelect = document.querySelector('.client-select');
    const client = clientSelect ? clientSelect.value : "1클라";
    const item = document.getElementById('item-name').value.trim();
    const price = document.getElementById('item-price').value;
    const qty = document.getElementById('item-qty').value;
    
    const rawServer = localStorage.getItem('selectedServer') || "서버없음";
    const currentServer = cleanServerName(rawServer);

    if (!item || !price) {
        return; 
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. 로컬 저장소 저장 (date 속성 추가)
    const newEntry = { client, item, qty, price, server: currentServer, date: todayStr };
    let savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    savedData.push(newEntry);
    localStorage.setItem('savedProfits', JSON.stringify(savedData));

    // 2. 영구 보존용 아이템 마스터 목록에 저장
    saveItemToMasterList(item);

    // 3. 중앙 DB 전송
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server: currentServer, item: item, price: parseInt(price) })
        });
    } catch (e) { console.error("시트 전송 실패:", e); }

    // 4. 로컬 최저가 관리
    let allProfits = JSON.parse(localStorage.getItem('all_user_profits') || "{}");
    const userServerKey = `${currentServer}_${client}`;
    if (!allProfits[userServerKey]) allProfits[userServerKey] = { server: currentServer, items: {} };
    allProfits[userServerKey].items[item] = parseInt(price) || 0;
    localStorage.setItem('all_user_profits', JSON.stringify(allProfits));

    loadProfitData();
    renderPriceTable(); 
    clearInput();
    updateItemDataList(); // 자동완성 목록 즉시 업데이트
    updateDashboard(); // 대시보드 실시간 업데이트
}

function saveProfitsToLocal() {
    const rows = document.querySelectorAll('#profit-body tr');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    const todayStr = new Date().toISOString().split('T')[0];

    const savedData = Array.from(rows).map(tr => {
        const c = tr.querySelectorAll('td');
        const itemName = c[1].innerText.trim();
        saveItemToMasterList(itemName); 

        return { 
            client: c[0].innerText, 
            item: itemName, 
            qty: c[2].innerText, 
            price: c[3].getAttribute('data-raw-price') || 0, 
            server: currentServer,
            date: todayStr
        };
    });
    localStorage.setItem('savedProfits', JSON.stringify(savedData));
    
    let allProfits = {};
    savedData.forEach(entry => {
        const userServerKey = `${currentServer}_${entry.client}`;
        if (!allProfits[userServerKey]) allProfits[userServerKey] = { server: currentServer, items: {} };
        allProfits[userServerKey].items[entry.item] = parseInt(entry.price) || 0;
    });
    localStorage.setItem('all_user_profits', JSON.stringify(allProfits));
    loadProfitData();
    updateDashboard();
}

function editRow(btn) {
    const row = btn.parentElement.parentElement;
    const clientSelects = document.querySelectorAll('.client-select');
    clientSelects.forEach(select => {
        select.value = row.cells[0].innerText;
    });
    
    document.getElementById('item-name').value = row.cells[1].innerText;
    document.getElementById('item-qty').value = row.cells[2].innerText;
    const rawPrice = row.cells[3].getAttribute('data-raw-price');
    if (rawPrice) document.getElementById('item-price').value = rawPrice;
    row.remove();
    saveProfitsToLocal();
    renderPriceTable();
}

function deleteRow(btn) {
    btn.parentElement.parentElement.remove();
    saveProfitsToLocal();
    renderPriceTable();
}

function clearInput() {
    document.getElementById('item-name').value = '';
    document.getElementById('item-price').value = '';
    document.getElementById('item-qty').value = '';
}

function initSettings() {
    const container = document.getElementById('client-name-inputs');
    if (!container) return;
    const essentialTasks = getSavedTasks('essentialTasks', DEFAULT_ESSENTIAL);
    const specialTasks = getSavedTasks('specialTasks', DEFAULT_SPECIAL);
    const weeklyTasks = getSavedTasks('weeklyTasks', DEFAULT_WEEKLY);
    container.innerHTML = `
        <div style="width: 75%; margin-left: 0; margin-top: 20px; padding: 20px; background: rgba(0, 0, 0, 0.75); border-radius: 10px; color: white; border: 1px solid rgba(255,255,255,0.2); max-height: 80vh; overflow-y: auto;">
            <h4 style="margin: 10px 0; color: #ffd700;">👥 클라이언트 별칭 설정</h4>
            <table style="width: 100%; border-collapse: collapse; color: white; margin-bottom: 25px;">
                ${[1,2,3,4,5].map(i => `<tr><td style="padding: 5px; width: 30%;">클라이언트 ${i}</td><td style="padding: 5px;"><input type="text" id="name_input_${i}" value="${getClientName(i)}" style="width: 95%; padding: 4px; background: rgba(255,255,255,0.1); color: white; border: 1px solid #555;"></td></tr>`).join('')}
            </table>
            <h4 style="margin: 10px 0; color: #ffd700;">📝 실시간 숙제 관리자</h4>
            <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                <div style="flex: 1; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #64b5f6;">일일 필수임무</div>
                    <div style="display: flex; gap: 5px; margin-bottom: 8px;"><input type="text" id="new-essential" style="flex:1; padding:3px; background:#222; color:#fff; border:1px solid #555;" placeholder="추가..."><button onclick="addConfigTask('essential')" style="padding:2px 8px; background:#444; color:#fff; border:1px solid #666;">+</button></div>
                    <div id="config-essential-list" style="max-height: 150px; overflow-y: auto; font-size:13px;"></div>
                </div>
                <div style="flex: 1; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #ffb74d;">일일 특수임무</div>
                    <div style="display: flex; gap: 5px; margin-bottom: 8px;"><input type="text" id="new-special" style="flex:1; padding:3px; background:#222; color:#fff; border:1px solid #555;" placeholder="추가..."><button onclick="addConfigTask('special')" style="padding:2px 8px; background:#444; color:#fff; border:1px solid #666;">+</button></div>
                    <div id="config-special-list" style="max-height: 150px; overflow-y: auto; font-size:13px;"></div>
                </div>
                <div style="flex: 1; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #81c784;">주간 숙제 목록</div>
                    <div style="display: flex; gap: 5px; margin-bottom: 8px;"><input type="text" id="new-weekly" style="flex:1; padding:3px; background:#222; color:#fff; border:1px solid #555;" placeholder="추가..."><button onclick="addConfigTask('weekly')" style="padding:2px 8px; background:#444; color:#fff; border:1px solid #666;">+</button></div>
                    <div id="config-weekly-list" style="max-height: 150px; overflow-y: auto; font-size:13px;"></div>
                </div>
            </div>

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 8px; color: #b3e5fc; font-size: 14px;">💾 데이터 백업 및 복구</div>
                <div style="display: flex; gap: 10px;">
                    <button id="btn-backup" style="flex: 1; padding: 10px; background: #2e7d32; color: white; border: 1px solid #4caf50; font-weight: bold; border-radius: 4px; cursor: pointer;">📥 전체 데이터 백업</button>
                    <button id="btn-restore-trigger" style="flex: 1; padding: 10px; background: #1565c0; color: white; border: 1px solid #2196f3; font-weight: bold; border-radius: 4px; cursor: pointer;">📤 데이터 가져오기</button>
                </div>
                <input type="file" id="restore-file-input" accept=".json" style="display: none;">
            </div>

            <div style="margin-top: 20px;">
                <button onclick="saveSettings()" style="padding: 10px 20px; cursor: pointer; background: #1b5e20; color: white; border: 1px solid #81c784; font-weight: bold; border-radius: 4px;">⚙️ 설정 및 변경저장</button>
                <button onclick="forceSyncCodeDefaults()" style="padding: 10px 15px; cursor: pointer; background: #b71c1c; color: white; border: 1px solid #ef5350; font-weight: bold; border-radius: 4px;">🔄 기본값 초기화</button>
                <span id="save-msg" style="color: #ffd700; font-weight: bold; opacity: 0; transition: opacity 0.3s ease;"></span>
                <button onclick="localStorage.removeItem('selectedServer'); window.location.href='login.html';" style="background-color: #ff9800; padding: 10px 15px; cursor: pointer; font-weight: bold; border-radius: 4px; border: 1px solid #e65100; color: white;">서버 다시 선택</button>
            </div>
        </div>
    `;

    const btnBackup = container.querySelector('#btn-backup');
    const btnRestoreTrigger = container.querySelector('#btn-restore-trigger');
    const restoreFileInput = container.querySelector('#restore-file-input');

    if (btnBackup) {
        btnBackup.addEventListener('click', () => {
            try {
                const backupData = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    backupData[key] = localStorage.getItem(key);
                }
                if (Object.keys(backupData).length === 0) return;

                const dataStr = JSON.stringify(backupData, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                const today = new Date().toISOString().split('T')[0];

                const link = document.createElement('a');
                link.setAttribute('href', dataUri);
                link.setAttribute('download', `거상매니저_백업_${today}.json`);
                link.click();
                link.remove();
            } catch (e) {
                console.error('백업 실패:', e);
            }
        });
    }

    if (btnRestoreTrigger && restoreFileInput) {
        btnRestoreTrigger.addEventListener('click', () => {
            restoreFileInput.click();
        });

        restoreFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                restoreFileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const importedData = JSON.parse(evt.target.result);
                    const hasValidKey = Object.keys(importedData).some(key => 
                        key.includes('server') || key.includes('client') || key.includes('task')
                    );

                    if (!hasValidKey) {
                        restoreFileInput.value = '';
                        return;
                    }

                    localStorage.clear();
                    Object.keys(importedData).forEach(key => {
                        localStorage.setItem(key, importedData[key]);
                    });

                    location.reload(); 
                } catch (err) {
                    console.error('백업 읽기 실패:', err);
                    restoreFileInput.value = '';
                }
            };
            reader.readAsText(file);
        });
    }

    renderConfigList('essential', essentialTasks); 
    renderConfigList('special', specialTasks); 
    renderConfigList('weekly', weeklyTasks);
}

function renderConfigList(type, array) {
    const listDiv = document.getElementById(`config-${type}-list`);
    if(!listDiv) return;
    listDiv.innerHTML = array.map((task, idx) => `<div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 2px; border-bottom:1px solid rgba(255,255,255,0.05);"><span>${task}</span><span onclick="deleteConfigTask('${type}', ${idx})" style="color:#e57373; cursor:pointer; font-weight:bold; padding: 0 4px;">✕</span></div>`).join('');
}

function addConfigTask(type) {
    const input = document.getElementById(`new-${type}`);
    if (!input || !input.value.trim()) return;
    let key = type === 'essential' ? 'essentialTasks' : (type === 'special' ? 'specialTasks' : 'weeklyTasks');
    let defArr = type === 'essential' ? DEFAULT_ESSENTIAL : (type === 'special' ? DEFAULT_SPECIAL : DEFAULT_WEEKLY);
    let current = getSavedTasks(key, defArr);
    current.push(input.value.trim());
    
    const serverKey = getServerKey(key);
    localStorage.setItem(serverKey, JSON.stringify(current));
    input.value = '';
    renderConfigList(type, current);
    refreshMainTables();
}

function deleteConfigTask(type, idx) {
    let key = type === 'essential' ? 'essentialTasks' : (type === 'special' ? 'specialTasks' : 'weeklyTasks');
    let defArr = type === 'essential' ? DEFAULT_ESSENTIAL : (type === 'special' ? DEFAULT_SPECIAL : DEFAULT_WEEKLY);
    let current = getSavedTasks(key, defArr);
    current.splice(idx, 1);
    
    const serverKey = getServerKey(key);
    localStorage.setItem(serverKey, JSON.stringify(current));
    renderConfigList(type, current);
    refreshMainTables();
}

function forceSyncCodeDefaults() {
    const essentialKey = getServerKey('essentialTasks');
    const specialKey = getServerKey('specialTasks');
    const weeklyKey = getServerKey('weeklyTasks');
    
    localStorage.setItem(essentialKey, JSON.stringify(DEFAULT_ESSENTIAL));
    localStorage.setItem(specialKey, JSON.stringify(DEFAULT_SPECIAL));
    localStorage.setItem(weeklyKey, JSON.stringify(DEFAULT_WEEKLY));
    
    if(document.getElementById('settings-view') && document.getElementById('settings-view').classList.contains('active')) initSettings();
    refreshMainTables();
}

function saveSettings() {
    for (let i = 1; i <= 5; i++) {
        const nameInput = document.getElementById(`name_input_${i}`);
        if (nameInput) {
            const serverKey = getServerKey(`clientName_${i}`);
            localStorage.setItem(serverKey, nameInput.value);
        }
    }
    
    const clientSelects = document.querySelectorAll('.client-select');
    clientSelects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '';
        for(let i=1; i<=5; i++) {
            select.innerHTML += `<option value="${getClientName(i)}">${getClientName(i)}</option>`;
        }
        select.value = currentVal;
    });
    
    refreshMainTables();
    const msgSpan = document.getElementById('save-msg');
    if (msgSpan) {
        msgSpan.innerText = "✔️ 변경사항이 저장되었습니다!";
        msgSpan.style.opacity = "1";
        setTimeout(() => { msgSpan.style.opacity = "0"; }, 2000);
    }
}

function toggleStatus(checkbox, type, taskName) {
    const span = checkbox.closest('tr').querySelector('.status');
    const isChecked = checkbox.checked;
    if(span) { span.innerText = isChecked ? "완료" : "미완료"; span.className = isChecked ? "status status-complete" : "status status-incomplete"; }
    
    const clientKey = getClientServerKey(`check_${type}_${taskName}`);
    localStorage.setItem(clientKey, isChecked ? "true" : "false");
    updateProgress();
    updateDashboard(); // 대시보드 실시간 업데이트
}

function updateProgress() {
    const ess = getSavedTasks('essentialTasks', DEFAULT_ESSENTIAL);
    const spc = getSavedTasks('specialTasks', DEFAULT_SPECIAL);
    const wk = getSavedTasks('weeklyTasks', DEFAULT_WEEKLY);
    const essChecked = document.querySelectorAll('#essential-body input:checked').length;
    const spcChecked = document.querySelectorAll('#optional-body input:checked').length;
    const wkChecked = document.querySelectorAll('#weekly-body input:checked').length;
    
    const essProgress = document.getElementById('essential-progress');
    const optProgress = document.getElementById('optional-progress');
    const wkProgress = document.getElementById('weekly-progress');
    
    if (essProgress) essProgress.innerText = `일일 숙제(필수) ${essChecked} / ${ess.length} 완료`;
    if (optProgress) optProgress.innerText = `일일 특수임무 ${spcChecked} / ${spc.length} 완료`;
    if (wkProgress) wkProgress.innerText = `주간 퀘스트 ${wkChecked} / ${wk.length} 완료`;
    updateLiveDateTime();
}

function createTable(tasks, bodyId, type) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    body.innerHTML = '';
    tasks.forEach(t => {
        const row = document.createElement('tr');
        const saveKey = getClientServerKey(`check_${type}_${t}`);
        const isSavedChecked = localStorage.getItem(saveKey) === "true";
        row.innerHTML = `<td><input type="checkbox" onchange="toggleStatus(this, '${type}', '${t}')" ${isSavedChecked ? 'checked' : ''}></td><td>${t}</td><td><span class="status ${isSavedChecked ? 'status-complete' : 'status-incomplete'}">${isSavedChecked ? '완료' : '미완료'}</span></td>`;
        body.appendChild(row);
    });
}

function getBlogText(type) {
    let targetId = type === 'daily' ? 'profit-body' : 'weekly-profit-body';
    let text = `✨ 수익 통계 ✨\n------------------------------\n`;
    document.querySelectorAll(`#${targetId} tr`).forEach(row => { text += `• ${row.cells[0].innerText} | ${row.cells[1].innerText} | ${row.cells[3].innerText}\n`; });
    return text + `------------------------------\n#거상`;
}

function copyDailyBlogText() { navigator.clipboard.writeText(getBlogText('daily')); }
function copyBlogText() { navigator.clipboard.writeText(getBlogText('weekly')); }

function refreshMainTables() {
    createTable(getSavedTasks('essentialTasks', DEFAULT_ESSENTIAL), 'essential-body', 'essential');
    createTable(getSavedTasks('specialTasks', DEFAULT_SPECIAL), 'optional-body', 'special');
    createTable(getSavedTasks('weeklyTasks', DEFAULT_WEEKLY), 'weekly-body', 'weekly');
    updateProgress();
    updateDashboard();
}

function checkAndResetTasks() {
    const today = new Date().toISOString().split('T')[0];
    const serverLastCheckDateKey = getServerKey('lastCheckDate');
    const lastCheckDate = localStorage.getItem(serverLastCheckDateKey);
    
    if (lastCheckDate !== today) {
        const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
        const cleanServer = cleanServerName(rawSelectedServer);
        
        for (let i = 1; i <= 5; i++) {
            const clientName = getClientName(i);
            ['essential', 'special'].forEach(type => {
                const tasks = getSavedTasks(`${type}Tasks`, type === 'essential' ? DEFAULT_ESSENTIAL : DEFAULT_SPECIAL);
                tasks.forEach(t => {
                    const checkKey = `${cleanServer}_${clientName}_check_${type}_${t}`;
                    localStorage.setItem(checkKey, "false");
                });
            });
        }
        localStorage.setItem(serverLastCheckDateKey, today);
    }
    
    const currentWeek = getISOWeek(new Date());
    const serverLastCheckWeekKey = getServerKey('lastCheckWeek');
    const lastWeek = localStorage.getItem(serverLastCheckWeekKey);
    
    if (lastWeek !== String(currentWeek)) {
        const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
        const cleanServer = cleanServerName(rawSelectedServer);
        
        for (let i = 1; i <= 5; i++) {
            const clientName = getClientName(i);
            const weeklyTasks = getSavedTasks('weeklyTasks', DEFAULT_WEEKLY);
            weeklyTasks.forEach(t => {
                const checkKey = `${cleanServer}_${clientName}_check_weekly_${t}`;
                localStorage.setItem(checkKey, "false");
            });
        }
        localStorage.setItem(serverLastCheckWeekKey, currentWeek);
    }
}

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function completeDailyTasks() {
    ['essential', 'special'].forEach(type => {
        const tasks = getSavedTasks(`${type}Tasks`, type === 'essential' ? DEFAULT_ESSENTIAL : DEFAULT_SPECIAL);
        tasks.forEach(t => {
            const clientKey = getClientServerKey(`check_${type}_${t}`);
            localStorage.setItem(clientKey, "true");
        });
    });
    refreshMainTables();
}

function resetDailyTasks() {
    ['essential', 'special'].forEach(type => {
        const tasks = getSavedTasks(`${type}Tasks`, type === 'essential' ? DEFAULT_ESSENTIAL : DEFAULT_SPECIAL);
        tasks.forEach(t => {
            const clientKey = getClientServerKey(`check_${type}_${t}`);
            localStorage.setItem(clientKey, "false");
        });
    });
    refreshMainTables();
}

function completeWeeklyTasks() {
    const weeklyTasks = getSavedTasks('weeklyTasks', DEFAULT_WEEKLY);
    weeklyTasks.forEach(t => {
        const clientKey = getClientServerKey(`check_weekly_${t}`);
        localStorage.setItem(clientKey, "true");
    });
    refreshMainTables();
}

function resetWeeklyTasks() {
    const weeklyTasks = getSavedTasks('weeklyTasks', DEFAULT_WEEKLY);
    weeklyTasks.forEach(t => {
        const clientKey = getClientServerKey(`check_weekly_${t}`);
        localStorage.setItem(clientKey, "false");
    });
    refreshMainTables();
}

// 최저가 연동 함수
async function renderPriceTable() {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "서버없음";
    const displayEl = document.getElementById('display-server-name');
    if(displayEl) {
        const uiName = String(rawSelectedServer).replace(/\\/g, "").replace(/\"/g, "");
        displayEl.innerText = uiName;
    }
    
    const currentServerClean = cleanServerName(rawSelectedServer);
    const tbody = document.getElementById('price-body');
    if (!tbody) return;

    try {
        const cacheBusterUrl = `${GOOGLE_SHEET_URL}${GOOGLE_SHEET_URL.includes('?') ? '&' : '?'}_=${new Date().getTime()}`;
        
        const response = await fetch(cacheBusterUrl, {
            method: 'GET',
            mode: 'cors',
            redirect: 'follow', 
            headers: { 'Accept': 'application/json' }
        });
        
        const data = await response.json(); 
        let lowestPrices = {};

        if (!data || !Array.isArray(data)) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#e57373; padding: 15px;">시트 데이터 수신 실패 (데이터 형식 오류)</td></tr>`;
            return;
        }

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;

            let srv = "", itm = "", prcRaw = "";
            if (Array.isArray(row)) {
                if (i === 0) continue; 
                srv = row[0]; itm = row[1]; prcRaw = row[2];
            } else if (typeof row === 'object') {
                srv = row["서버"] || row["server"] || row[Object.keys(row)[0]];
                itm = row["아이템"] || row["item"] || row[Object.keys(row)[1]];
                prcRaw = row["단가"] || row["price"] || row[Object.keys(row)[2]];
            }

            if (!srv || !itm) continue;

            const srvClean = cleanServerName(srv);
            const prcCleanedStr = String(prcRaw).replace(/,/g, '').replace(/[^0-9]/g, '');
            const prc = parseInt(prcCleanedStr) || 0;

            if (srvClean === currentServerClean && itm.trim() !== "") {
                const itemKey = itm.trim();
                if (!lowestPrices[itemKey] || prc < lowestPrices[itemKey]) {
                    lowestPrices[itemKey] = prc;
                }
            }
        }

        tbody.innerHTML = "";
        const keys = Object.keys(lowestPrices);
        if (keys.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#aaa; padding: 15px;">${currentServerClean} 서버에 해당하는 최저가 데이터가 없습니다.</td></tr>`;
        } else {
            for (const item in lowestPrices) {
                tbody.innerHTML += `<tr><td>${item}</td><td>${lowestPrices[item].toLocaleString()}원</td><td>실시간</td></tr>`;
            }
        }
    } catch (e) {
        console.error("최저가 조회 중 오류 발생:", e);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#e57373; padding: 15px;">서버 연결 오류가 발생했습니다.</td></tr>`;
    }
}

// showProfitTab: 탭 클릭 시 각 통계/목표 렌더링 함수 실행
function showProfitTab(tabName, event) {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');
    
    ['daily', 'weekly', 'monthly', 'goal', 'price'].forEach(name => {
        const view = document.getElementById(name + '-view');
        if (view) view.style.display = (name === tabName) ? 'block' : 'none';
    });

    if (tabName === 'daily') loadProfitData();
    if (tabName === 'weekly') renderWeeklyProfitTable();
    if (tabName === 'monthly') renderMonthlyProfitTable();
    if (tabName === 'goal') renderGoalTable();
    if (tabName === 'price') renderPriceTable(); 
}

function showSection(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        if (id === 'settings-view' && typeof initSettings === 'function') initSettings();
    }
}

// [대시보드 실시간 연동 처리]
function updateDashboard() {
    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    const todayStr = new Date().toISOString().split('T')[0];
    const currentWeek = getISOWeek(new Date());
    const currentYear = new Date().getFullYear();

    // 1. 오늘 수익 계산
    const todayProfit = savedData.filter(entry => {
        return cleanServerName(entry.server) === currentServer && entry.date === todayStr;
    }).reduce((acc, curr) => acc + (parseInt(curr.price || 0) * parseInt(curr.qty || 0)), 0);

    const profitEl = document.getElementById('today-total-profit');
    if (profitEl) profitEl.innerText = todayProfit.toLocaleString() + '원';

    // 2. 주간 목표 및 누적 수익 계산
    let totalWeeklyGoal = 0;
    for (let i = 1; i <= 5; i++) {
        totalWeeklyGoal += parseInt(localStorage.getItem(getServerKey(`goal_${i}`)) || 0);
    }

    const currentWeekProfit = savedData.filter(entry => {
        if (cleanServerName(entry.server) !== currentServer) return false;
        if (!entry.date) return true;
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === currentYear && getISOWeek(entryDate) === currentWeek;
    }).reduce((acc, curr) => acc + (parseInt(curr.price || 0) * parseInt(curr.qty || 0)), 0);

    const goalPercent = totalWeeklyGoal > 0 ? Math.min(100, Math.floor((currentWeekProfit / totalWeeklyGoal) * 100)) : 0;
    
    const goalBarFill = document.getElementById('weekly-goal-bar-fill');
    const goalText = document.getElementById('weekly-goal-text');
    if (goalBarFill) goalBarFill.style.width = `${goalPercent}%`;
    if (goalText) goalText.innerText = `${goalPercent}%`;

    // 3. 숙제 완료율 계산
    const checkboxes = document.querySelectorAll('#essential-body input[type="checkbox"], #optional-body input[type="checkbox"]');
    const checked = document.querySelectorAll('#essential-body input[type="checkbox"]:checked, #optional-body input[type="checkbox"]:checked');
    
    if (checkboxes.length > 0) {
        const percent = Math.floor((checked.length / checkboxes.length) * 100);
        const barFill = document.getElementById('today-progress-bar-fill');
        const progressText = document.getElementById('today-progress-text');
        if (barFill) barFill.style.width = `${percent}%`;
        if (progressText) progressText.innerText = `${percent}%`;
    }
}

// 영구 보존용 아이템 마스터 목록 저장 함수
function saveItemToMasterList(itemName) {
    if (!itemName) return;
    let masterList = JSON.parse(localStorage.getItem('itemMasterList') || '[]');
    if (!masterList.includes(itemName)) {
        masterList.push(itemName);
        localStorage.setItem('itemMasterList', JSON.stringify(masterList));
    }
}

// 일일 통계 데이터가 초기화되어도 자동완성이 유지되는 연동 함수
function updateItemDataList() {
    const dataList = document.getElementById('item-list');
    if (!dataList) return;

    dataList.innerHTML = '';
    const itemSet = new Set();

    const masterList = JSON.parse(localStorage.getItem('itemMasterList') || '[]');
    masterList.forEach(item => itemSet.add(item));

    const allProfits = JSON.parse(localStorage.getItem('all_user_profits') || "{}");
    for (const key in allProfits) {
        if (allProfits[key].items) {
            Object.keys(allProfits[key].items).forEach(itemName => itemSet.add(itemName));
        }
    }

    itemSet.forEach(itemName => {
        const option = document.createElement('option');
        option.value = itemName;
        dataList.appendChild(option);
    });
}

// window.onload 이벤트
window.onload = () => {
    checkAndResetTasks();
    updateItemDataList();
    
    const clientSelects = document.querySelectorAll('.client-select');
    if (clientSelects.length > 0) {
        clientSelects.forEach(select => {
            select.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                select.innerHTML += `<option value="${getClientName(i)}">${getClientName(i)}</option>`;
            }
            
            select.addEventListener('change', (e) => {
                const targetValue = e.target.value;
                clientSelects.forEach(otherSelect => {
                    otherSelect.value = targetValue;
                });
                
                refreshMainTables();
                loadProfitData();
            });
        });
    }
    
    refreshMainTables(); 
    loadProfitData(); 
    renderGoalTable();
    updateDashboard();
    
    updateLiveDateTime(); 
    setInterval(updateLiveDateTime, 1000);
};

// [Electron 항상 위 고정 기능 - 마지막 상태 기억]
const { ipcRenderer } = require('electron');
const pinBtn = document.getElementById('pin-btn');

if (pinBtn) {
    const savedAlwaysOnTop = localStorage.getItem('alwaysOnTopState') === 'true';

    function applyAlwaysOnTopState(isTop) {
        if (isTop) {
            pinBtn.classList.add('active');
            pinBtn.innerText = '📌 항상 위';
        } else {
            pinBtn.classList.remove('active');
            pinBtn.innerText = '❌ 항상 위';
        }
        ipcRenderer.send('toggle-always-on-top', isTop);
    }

    applyAlwaysOnTopState(savedAlwaysOnTop);

    pinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const currentActive = pinBtn.classList.contains('active');
        const nextState = !currentActive;
        
        localStorage.setItem('alwaysOnTopState', nextState ? 'true' : 'false');
        applyAlwaysOnTopState(nextState);
    });


// 1. 현재 내 프로그램의 버전 (업데이트 패치할 때 올려줍니다)
const CURRENT_APP_VERSION = "1.2.4"; 

// 2. 깃허브에 올라가 있는 update.json의 Raw 파일 주소
// ✅ 올바른 작성법 (raw 주소)
const UPDATE_CHECK_URL = "https://raw.githubusercontent.com/whddns4754/gersang-daily-manager/main/update.json";

// 버전 체크 및 팝업 출력 함수
async function checkForUpdates() {
    try {
        const response = await fetch(`${UPDATE_CHECK_URL}?_=${new Date().getTime()}`);
        if (!response.ok) return;

        const data = await response.json();

        // 프로그램 버전보다 깃허브 버전이 높으면 팝업 생성
        if (isNewerVersion(CURRENT_APP_VERSION, data.latestVersion)) {
            showUpdateNotice(data);
        }
    } catch (error) {
        console.log("업데이트 체크 스킵:", error);
    }
}

// 버전 단순 비교 (1.0.0 < 1.0.1)
function isNewerVersion(current, latest) {
    const cParts = current.split('.').map(Number);
    const lParts = latest.split('.').map(Number);
    for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
        const c = cParts[i] || 0;
        const l = lParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
    }
    return false;
}

// 팝업 창 UI 동적 생성 (설명 포함)
function showUpdateNotice(data) {
    const modalHtml = `
        <div id="update-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 99999;">
            <div style="background: #1e1e1e; color: #fff; padding: 25px; border-radius: 12px; width: 420px; border: 1px solid #ffd700; box-shadow: 0 0 20px rgba(255,215,0,0.4);">
                <h3 style="margin: 0 0 10px 0; color: #ffd700; font-size: 18px;">🔔 새로운 업데이트가 있습니다!</h3>
                <div style="font-size: 13px; color: #aaa; margin-bottom: 15px;">
                    <span>현재 버전: v${CURRENT_APP_VERSION}</span> ➔ <b style="color: #2ecc71;">최신 버전: v${data.latestVersion}</b>
                </div>
                
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); max-height: 180px; overflow-y: auto; margin-bottom: 20px;">
                    <div style="font-size: 13px; font-weight: bold; color: #ffd700; margin-bottom: 8px;">📝 업데이트 변경 내용</div>
                    <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: #ddd;">
                        ${data.changelog.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>

                <div style="display: flex; justify-content: space-between; gap: 10px;">
                    <button onclick="document.getElementById('update-modal').remove()" style="flex: 1; padding: 10px; background: #444; color: #fff; border: none; border-radius: 5px; cursor: pointer;">나중에 하기</button>
                    <button onclick="window.open('${data.downloadUrl}')" style="flex: 1.5; padding: 10px; background: #27ae60; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">업데이트 받기</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
}