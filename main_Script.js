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

// ★ [서버 이름 정제 유틸리티 - 정밀 보완 버전]
function cleanServerName(serverName) {
    if (!serverName) return "";
    
    let cleaned = String(serverName);
    
    // 1. 역슬래시(\) 및 특수 기호, 괄호 전부 삭제
    cleaned = cleaned.replace(/\\/g, ""); 
    cleaned = cleaned.replace(/[\[\]\(\)\{\}\"\']/g, ""); 
    
    // 2. "서버"라는 단어 자체도 삭제
    cleaned = cleaned.replace(/서버/g, "");
    
    // 3. 앞뒤 및 중간 공백 완전 제거
    cleaned = cleaned.trim().replace(/\s+/g, "");
    
    return cleaned;
}

// [서버별 고유 키 생성 도우미]
function getServerKey(key) {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    return `${cleanServer}_${key}`;
}

// ★ [클라이언트별 격리 키 생성 도우미 - 다중 드롭다운 대응]
// 화면의 여러 드롭다운 중 첫 번째 활성화된 값을 기준으로 클라이언트명을 가져옵니다.
function getClientServerKey(key) {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    
    const clientSelect = document.querySelector('.client-select');
    const clientName = clientSelect ? clientSelect.value : "1클라";
    return `${cleanServer}_${clientName}_${key}`;
}

// [데이터 로드 유틸리티 - 서버별 고유 키를 기반으로 로드]
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
}

// [addProfit]

async function addProfit() {
    const clientSelect = document.querySelector('.client-select');
    const client = clientSelect ? clientSelect.value : "1클라";
    const item = document.getElementById('item-name').value;
    const price = document.getElementById('item-price').value;
    const qty = document.getElementById('item-qty').value;
    
    const rawServer = localStorage.getItem('selectedServer') || "서버없음";
    const currentServer = cleanServerName(rawServer);

    if (!item || !price) {
        alert("아이템명과 단가를 입력해주세요!");
        return;
    }

    // 로컬 저장소 저장
    const newEntry = { client, item, qty, price, server: currentServer };
    let savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    savedData.push(newEntry);
    localStorage.setItem('savedProfits', JSON.stringify(savedData));

    // 중앙 DB 전송
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server: currentServer, item: item, price: parseInt(price) })
        });
    } catch (e) { console.error("시트 전송 실패:", e); }

    // 로컬 최저가 관리
    let allProfits = JSON.parse(localStorage.getItem('all_user_profits') || "{}");
    const userServerKey = `${currentServer}_${client}`;
    if (!allProfits[userServerKey]) allProfits[userServerKey] = { server: currentServer, items: {} };
    allProfits[userServerKey].items[item] = parseInt(price) || 0;
    localStorage.setItem('all_user_profits', JSON.stringify(allProfits));

    loadProfitData();
    renderPriceTable(); 
    clearInput();
    
    // [추가] 아이템 추가 후 자동완성 목록 갱신
    updateItemDataList(); 
}

function saveProfitsToLocal() {
    const rows = document.querySelectorAll('#profit-body tr');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    const savedData = Array.from(rows).map(tr => {
        const c = tr.querySelectorAll('td');
        return { client: c[0].innerText, item: c[1].innerText, qty: c[2].innerText, price: c[3].getAttribute('data-raw-price') || 0, server: currentServer };
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
}

function editRow(btn) {
    const row = btn.parentElement.parentElement;
    
    // 활성화된 모든 드롭다운의 값을 수정 대상 클라이언트로 변경
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

    // ⚙️ [추가된 백엔드 로직] 동적 생성된 백업/가져오기 버튼에 실시간 이벤트 바인딩
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
                if (Object.keys(backupData).length === 0) {
                    alert('백업할 데이터가 존재하지 않습니다.');
                    return;
                }
                const dataStr = JSON.stringify(backupData, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                const today = new Date().toISOString().split('T')[0];

                const link = document.createElement('a');
                link.setAttribute('href', dataUri);
                link.setAttribute('download', `거상매니저_백업_${today}.json`);
                link.click();
                link.remove();
            } catch (e) {
                alert('백업 도중 오류가 발생했습니다.');
            }
        });
    }

    if (btnRestoreTrigger && restoreFileInput) {
        btnRestoreTrigger.addEventListener('click', () => {
            if (confirm('데이터를 가져오면 기존의 모든 설정(숙제 진행도, 클라 별칭, 서버 정보 등)이 백업 파일 데이터로 완전히 대체됩니다. 진행하시겠습니까?')) {
                restoreFileInput.click();
            }
        });

        restoreFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const importedData = JSON.parse(evt.target.result);
                    const hasValidKey = Object.keys(importedData).some(key => 
                        key.includes('server') || key.includes('client') || key.includes('task')
                    );

                    if (!hasValidKey) {
                        alert('올바른 거상 데일리 매니저 백업 파일이 아닙니다.');
                        return;
                    }

                    localStorage.clear();
                    Object.keys(importedData).forEach(key => {
                        localStorage.setItem(key, importedData[key]);
                    });

                    alert('🎉 데이터 복구가 성공적으로 완료되었습니다! 프로그램을 재시작합니다.');
                    location.reload();
                } catch (err) {
                    alert('파일을 읽는 도중 오류가 발생했거나 올바른 데이터 규격이 아닙니다.');
                }
            };
            reader.readAsText(file);
        });
    }

    renderConfigList('essential', essentialTasks); renderConfigList('special', specialTasks); renderConfigList('weekly', weeklyTasks);
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
    
    // 화면에 있는 모든 드롭박스(일일, 주간, 통계 탭 포함)를 전부 찾아서 동시 업데이트
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

// toggleStatus: 선택된 클라이언트 전용 저장공간에 저장
function toggleStatus(checkbox, type, taskName) {
    const span = checkbox.closest('tr').querySelector('.status');
    const isChecked = checkbox.checked;
    if(span) { span.innerText = isChecked ? "완료" : "미완료"; span.className = isChecked ? "status status-complete" : "status status-incomplete"; }
    
    const clientKey = getClientServerKey(`check_${type}_${taskName}`);
    localStorage.setItem(clientKey, isChecked ? "true" : "false");
    updateProgress();
}

// updateProgress: 현재 선택된 클라이언트 전용 완료 상태를 기준으로 개수를 카운팅
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

// createTable: 클라이언트 개별 저장 키를 매칭하여 렌더링
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

function renderGoalTable() {
    const goalBody = document.getElementById('goal-body');
    if (!goalBody) return;
    goalBody.innerHTML = ''; 
    for (let i = 1; i <= 5; i++) {
        const cName = getClientName(i);
        const serverKey = getServerKey(`goal_${i}`);
        const savedGoal = localStorage.getItem(serverKey) || 0;
        goalBody.innerHTML += `<tr style="background-color: #f9f9f9;"><td style="color: #000 !important; font-weight: bold; padding: 10px;">${cName}</td><td style="padding: 10px;"><input type="number" value="${savedGoal}" onchange="saveGoal(${i}, this.value)" style="width: 120px; height: 30px; color: #000 !important; background-color: #fff !important; border: 1px solid #333 !important; padding: 5px !important; font-size: 14px !important; font-weight: bold !important; display: inline-block;"></td><td style="color: #000 !important; padding: 10px;">목표 설정</td></tr>`;
    }
}

function saveGoal(clientIndex, value) { 
    const serverKey = getServerKey(`goal_${clientIndex}`);
    localStorage.setItem(serverKey, value); 
    renderGoalTable(); 
}

function getBlogText(type) {
    let targetId = type === 'daily' ? 'profit-body' : 'weekly-body-stats';
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
}

// checkAndResetTasks: 날짜/주차 변경 시 모든 클라이언트(1~5클라) 개별 리셋
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

// completeDailyTasks: 현재 선택된 클라이언트 전용 일괄 완료
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

// resetDailyTasks: 현재 선택된 클라이언트 전용 일괄 해제
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

// completeWeeklyTasks: 현재 선택된 클라이언트 전용 주간 일괄 완료
function completeWeeklyTasks() {
    const weeklyTasks = getSavedTasks('weeklyTasks', DEFAULT_WEEKLY);
    weeklyTasks.forEach(t => {
        const clientKey = getClientServerKey(`check_weekly_${t}`);
        localStorage.setItem(clientKey, "true");
    });
    refreshMainTables();
}

// resetWeeklyTasks: 현재 선택된 클라이언트 전용 주간 일괄 해제
function resetWeeklyTasks() {
    const weeklyTasks = getSavedTasks('weeklyTasks', DEFAULT_WEEKLY);
    weeklyTasks.forEach(t => {
        const clientKey = getClientServerKey(`check_weekly_${t}`);
        localStorage.setItem(clientKey, "false");
    });
    refreshMainTables();
}

// ★ [수정] window.onload: 모든 .client-select 클래스를 찾아 드롭다운 옵션을 채우고 서로 동기화시킵니다.
window.onload = () => {
    checkAndResetTasks();

// [추가] 자동완성 데이터 업데이트 호출
    updateItemDataList();
    
    // 화면에 존재하는 일일, 주간, 통계 드롭박스 전부 가져오기
    const clientSelects = document.querySelectorAll('.client-select');
    
    if (clientSelects.length > 0) {
        // 모든 드롭박스에 환경설정의 사용자 지정 별명 채우기
        clientSelects.forEach(select => {
            select.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                select.innerHTML += `<option value="${getClientName(i)}">${getClientName(i)}</option>`;
            }
            
            // 어느 한 드롭박스(통계든 임무든) 값이 바뀌면 다른 드롭박스 전부 똑같이 동기화
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
    
    // 초기 화면 렌더링
    refreshMainTables(); 
    loadProfitData(); 
    renderGoalTable();
    
    // 시계 구동
    updateLiveDateTime(); 
    setInterval(updateLiveDateTime, 1000);
};

// [exe 환경 호환 및 리다이렉트 추적형 최저가 조회 함수]
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
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json(); 
        
        console.log("=== [최저가 DB 조회 디버깅] ===");
        console.log("■ 프로그램 선택 서버(원본):", rawSelectedServer);
        console.log("■ 프로그램 선택 서버(정제):", currentServerClean);
        console.log("■ 구글 시트 수신 원본 데이터 존재 여부:", Array.isArray(data));

        let lowestPrices = {};

        if (!data || !Array.isArray(data)) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#e57373; padding: 15px;">시트 데이터 수신 실패 (데이터 형식 오류)</td></tr>`;
            return;
        }

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;

            let srv = "";
            let itm = "";
            let prcRaw = "";

            if (Array.isArray(row)) {
                if (i === 0) continue; 
                srv = row[0];
                itm = row[1];
                prcRaw = row[2];
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

        console.log("■ 매칭된 서버별 최저가 결과:", lowestPrices);
        console.log("===============================");

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
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#e57373; padding: 15px;">서버 연결 오류가 발생했습니다. (F12 콘솔 확인)</td></tr>`;
    }
}

function showProfitTab(tabName, event) {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');
    ['daily', 'weekly', 'monthly', 'goal', 'price'].forEach(name => {
        const view = document.getElementById(name + '-view');
        if (view) view.style.display = (name === tabName) ? 'block' : 'none';
    });
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

// [데이터 계산기] 수익과 숙제 완료율을 로컬 데이터로 실시간 계산
function updateDashboard() {
    // 1. 수익 계산
    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const totalProfit = savedData.reduce((acc, curr) => acc + (parseInt(curr.price) * parseInt(curr.qty)), 0);
    const profitEl = document.getElementById('today-total-profit');
    if (profitEl) profitEl.innerText = totalProfit.toLocaleString() + '원';

    // 2. 완료율 계산
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const checked = document.querySelectorAll('input[type="checkbox"]:checked');
    if (checkboxes.length > 0) {
        const percent = Math.floor((checked.length / checkboxes.length) * 100);
        const barFill = document.getElementById('today-progress-bar-fill');
        const progressText = document.getElementById('today-progress-text');
        if (barFill) barFill.style.width = `${percent}%`;
        if (progressText) progressText.innerText = `${percent}%`;
    }
}

// 기존 refreshMainTables 끝에 호출 추가
const originalRefresh = refreshMainTables;
refreshMainTables = function() {
    originalRefresh();
    updateDashboard();
};

// [자동완성 목록 업데이트 함수]
function updateItemDataList() {
    const dataList = document.getElementById('item-list');
    if (!dataList) return;

    dataList.innerHTML = ''; // 기존 목록 초기화

    // 나의 판매가 현황(all_user_profits)에서 저장된 아이템 목록을 추출
    const allProfits = JSON.parse(localStorage.getItem('all_user_profits') || "{}");
    const itemSet = new Set(); // 중복 방지용

    // 저장된 모든 아이템들을 찾아 Set에 담기
    for (const key in allProfits) {
        if (allProfits[key].items) {
            Object.keys(allProfits[key].items).forEach(itemName => itemSet.add(itemName));
        }
    }

    // datalist에 옵션 추가
    itemSet.forEach(itemName => {
        const option = document.createElement('option');
        option.value = itemName;
        dataList.appendChild(option);
    });
}

const { ipcRenderer } = require('electron');

const pinBtn = document.getElementById('pin-btn');
let isAlwaysOnTop = true; // 기본적으로 처음엔 켜져 있다고 가정

pinBtn.addEventListener('click', () => {
    // 상태 반전
    isAlwaysOnTop = !isAlwaysOnTop;
    
    // UI 변경 (active 클래스 토글)
    if (isAlwaysOnTop) {
        pinBtn.classList.add('active');
        pinBtn.innerText = '📌 항상 위';
    } else {
        pinBtn.classList.remove('active');
        pinBtn.innerText = '❌ 항상 위'; // 혹은 📍 핀 아이콘으로 대체 가능
    }
    
    // 메인 프로세스(main.js)로 온탑 상태 전송
    ipcRenderer.send('toggle-always-on-top', isAlwaysOnTop);
});