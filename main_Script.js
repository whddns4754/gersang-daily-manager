// ==========================================
// [factory.js 모듈 로드 처리]
// ==========================================
let FactoryManager;
try {
    FactoryManager = require('./factory.js');
} catch (e) {
    FactoryManager = window.FactoryManager;
}

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

const DEFAULT_COMMON_ITEMS = [
    "시간의금화", "시간의은화", "영웅의금화", "영웅의은화", 
    "영웅의영혼석", "시간의가루", "봉인된힘의파편"
];

const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyB2pSo-rNWz_WctvW3bz9Dru8ljF2aWYV0rzGwP7dkS_U5NPZhN8pZru0UXMi2TadwGA/exec';

let myMonthlyChart = null;
let currentConfigClientIndex = 1;

let priceTableState = {
    currentPage: 1,
    pageSize: 10,
    validDays: 7,
    allData: []
};

function formatRelativeTime(dateInput) {
    if (!dateInput) return "등록일 미상";
    
    const targetDate = new Date(dateInput);
    if (isNaN(targetDate.getTime())) return String(dateInput);

    const now = new Date();
    const diffMs = now - targetDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (diffDays === 0) {
        return `오늘 ${timeStr}`;
    } else if (diffDays === 1) {
        return `어제 ${timeStr}`;
    } else if (diffDays < 7) {
        return `${diffDays}일 전`;
    } else {
        const month = targetDate.getMonth() + 1;
        const day = targetDate.getDate();
        return `${month}/${day} ${timeStr}`;
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function cleanServerName(serverName) {
    if (!serverName) return "";
    let cleaned = String(serverName);
    cleaned = cleaned.replace(/\\/g, ""); 
    cleaned = cleaned.replace(/[\[\]\(\)\{\}\"\']/g, ""); 
    cleaned = cleaned.replace(/서버/g, "");
    cleaned = cleaned.trim().replace(/\s+/g, "");
    return cleaned;
}

function getServerKey(key) {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    return `${cleanServer}_${key}`;
}

function getClientServerKey(key) {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    const clientSelect = document.querySelector('.client-select');
    const clientName = clientSelect ? clientSelect.value : getClientName(1);
    return `${cleanServer}_${clientName}_${key}`;
}

function getClientName(index) { 
    const serverKey = getServerKey(`clientName_${index}`);
    return localStorage.getItem(serverKey) || `${index}클라`; 
}

function getCurrencyUnit() { return localStorage.getItem('currencyUnit') || 'won'; }

function getSavedTasks(key, defaultArray) {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    
    const clientSelect = document.querySelector('.client-select');
    const currentClientName = clientSelect ? clientSelect.value : getClientName(1);
    
    const clientSpecificKey = `${cleanServer}_${currentClientName}_${key}`;
    const clientSaved = localStorage.getItem(clientSpecificKey);
    if (clientSaved) return JSON.parse(clientSaved);

    const serverKey = getServerKey(key);
    const saved = localStorage.getItem(serverKey);
    return saved ? JSON.parse(saved) : defaultArray;
}

function getConfigTasks(type) {
    const key = `${type}Tasks`;
    const clientName = getClientName(currentConfigClientIndex);
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    
    const clientSpecificKey = `${cleanServer}_${clientName}_${key}`;
    const saved = localStorage.getItem(clientSpecificKey);
    
    if (saved) return JSON.parse(saved);
    
    const defaultKey = getServerKey(key);
    const commonSaved = localStorage.getItem(defaultKey);
    const defArr = type === 'essential' ? DEFAULT_ESSENTIAL : (type === 'special' ? DEFAULT_SPECIAL : DEFAULT_WEEKLY);
    return commonSaved ? JSON.parse(commonSaved) : defArr;
}

function saveConfigTasks(type, array) {
    const key = `${type}Tasks`;
    const clientName = getClientName(currentConfigClientIndex);
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    
    const clientSpecificKey = `${cleanServer}_${clientName}_${key}`;
    localStorage.setItem(clientSpecificKey, JSON.stringify(array));
}

function copyClient1ConfigToAll() {
    const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
    const cleanServer = cleanServerName(rawSelectedServer);
    const c1Name = getClientName(1);

    const types = ['essential', 'special', 'weekly'];
    const c1Data = {};

    types.forEach(type => {
        const key = `${type}Tasks`;
        const c1Key = `${cleanServer}_${c1Name}_${key}`;
        const saved = localStorage.getItem(c1Key);
        const defArr = type === 'essential' ? DEFAULT_ESSENTIAL : (type === 'special' ? DEFAULT_SPECIAL : DEFAULT_WEEKLY);
        
        if (saved) {
            c1Data[type] = JSON.parse(saved);
        } else {
            const commonSaved = localStorage.getItem(getServerKey(key));
            c1Data[type] = commonSaved ? JSON.parse(commonSaved) : defArr;
        }
    });

    for (let i = 1; i <= 5; i++) {
        const targetClientName = getClientName(i);
        types.forEach(type => {
            const key = `${type}Tasks`;
            const targetKey = `${cleanServer}_${targetClientName}_${key}`;
            localStorage.setItem(targetKey, JSON.stringify(c1Data[type]));
        });
    }

    switchConfigClient(currentConfigClientIndex);
    refreshMainTables();
    showToast("📋 1클라의 숙제 설정이 모든 클라이언트에 복사 되었습니다!");
}

function switchConfigClient(clientIdx) {
    currentConfigClientIndex = parseInt(clientIdx);
    renderConfigList('essential', getConfigTasks('essential'));
    renderConfigList('special', getConfigTasks('special'));
    renderConfigList('weekly', getConfigTasks('weekly'));
}

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
    updateDashboard();
}

function renderWeeklyProfitTable() {
    const tbody = document.getElementById('weekly-profit-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    
    const now = new Date();
    const dayOfWeek = now.getDay(); 
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    
    const monday = new Date(now.setDate(diffToMonday));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weeklyData = savedData.filter(entry => {
        const entryServer = cleanServerName(entry.server || "서버없음");
        if (entryServer !== currentServer) return false;
        if (!entry.date) return true; 
        
        const entryDate = new Date(entry.date);
        return entryDate >= monday && entryDate <= sunday;
    });

    if (weeklyData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 15px; color:#666;">이번 주 누적 수익 데이터가 없습니다.</td></tr>`;
        return;
    }

    const aggregated = {};
    weeklyData.forEach(entry => {
        const key = `${entry.client}_${entry.item}`;
        const qty = parseInt(entry.qty) || 0;
        const price = parseInt(entry.price) || 0;
        const total = qty * price;

        if (!aggregated[key]) {
            aggregated[key] = {
                client: entry.client,
                item: entry.item,
                qty: 0,
                totalPrice: 0
            };
        }
        aggregated[key].qty += qty;
        aggregated[key].totalPrice += total;
    });

    Object.values(aggregated).forEach(data => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.client}</td>
            <td>${data.item}</td>
            <td>${data.qty}</td>
            <td>${data.totalPrice.toLocaleString()}원</td>
        `;
        tbody.appendChild(row);
    });
}

function renderMonthlyProfitTable() {
    const tbody = document.getElementById('monthly-profit-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); 

    const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const monthlyData = savedData.filter(entry => {
        const entryServer = cleanServerName(entry.server || "서버없음");
        if (entryServer !== currentServer) return false;
        if (!entry.date) return true; 
        
        const entryDate = new Date(entry.date);
        return entryDate >= startOfMonth && entryDate <= endOfMonth;
    });

    if (monthlyData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 15px; color:#666;">이번 달 누적 수익 데이터가 없습니다.</td></tr>`;
        return;
    }

    const aggregated = {};
    monthlyData.forEach(entry => {
        const key = `${entry.client}_${entry.item}`;
        const qty = parseInt(entry.qty) || 0;
        const price = parseInt(entry.price) || 0;
        const total = qty * price;

        if (!aggregated[key]) {
            aggregated[key] = {
                client: entry.client,
                item: entry.item,
                qty: 0,
                totalPrice: 0
            };
        }
        aggregated[key].qty += qty;
        aggregated[key].totalPrice += total;
    });

    Object.values(aggregated).forEach(data => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.client}</td>
            <td>${data.item}</td>
            <td>${data.qty}</td>
            <td>${data.totalPrice.toLocaleString()}원</td>
        `;
        tbody.appendChild(row);
    });
}

function renderGoalTable() {
    const goalBody = document.getElementById('goal-body');
    if (!goalBody) return;
    goalBody.innerHTML = ''; 

    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const clientMonthlyProfits = {};
    savedData.forEach(entry => {
        const entryServer = cleanServerName(entry.server || "서버없음");
        if (entryServer !== currentServer) return;
        
        if (entry.date) {
            const entryDate = new Date(entry.date);
            if (entryDate < startOfMonth || entryDate > endOfMonth) return;
        }

        const total = (parseInt(entry.price) || 0) * (parseInt(entry.qty) || 0);
        clientMonthlyProfits[entry.client] = (clientMonthlyProfits[entry.client] || 0) + total;
    });

    for (let i = 1; i <= 5; i++) {
        const cName = getClientName(i);
        const serverKey = getServerKey(`goal_${i}`);
        const savedGoal = parseInt(localStorage.getItem(serverKey)) || 0;
        const currentProfit = clientMonthlyProfits[cName] || 0;
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
                        월간 달성: ${currentProfit.toLocaleString()}원 (${percent}%)
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

async function addProfit() {
    const clientSelect = document.querySelector('.client-select');
    const client = clientSelect ? clientSelect.value : "1클라";
    const item = document.getElementById('item-name').value.trim();
    const price = document.getElementById('item-price').value;
    const qty = document.getElementById('item-qty').value;

    if (!item || !price) {
        return; 
    }

    await saveProfitEntry(client, item, price, qty);

    clearInput();
    updateItemDataList(); 
}

async function saveProfitEntry(client, item, price, qty) {
    const rawServer = localStorage.getItem('selectedServer') || "서버없음";
    const currentServer = cleanServerName(rawServer);
    const todayStr = new Date().toISOString().split('T')[0];

    const newEntry = { client, item, qty: parseInt(qty) || 1, price: parseInt(price) || 0, server: currentServer, date: todayStr };
    let savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    savedData.push(newEntry);
    localStorage.setItem('savedProfits', JSON.stringify(savedData));

    saveItemToMasterList(item);

    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server: currentServer, item: item, price: parseInt(price) || 0 })
        });
    } catch (e) { console.error("시트 전송 실패:", e); }

    let allProfits = JSON.parse(localStorage.getItem('all_user_profits') || "{}");
    const userServerKey = `${currentServer}_${client}`;
    if (!allProfits[userServerKey]) allProfits[userServerKey] = { server: currentServer, items: {} };
    allProfits[userServerKey].items[item] = parseInt(price) || 0;
    localStorage.setItem('all_user_profits', JSON.stringify(allProfits));

    loadProfitData();
    renderPriceTable(); 
    updateDashboard(); 
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

function exportFullBackupJSON() {
    try {
        const backupData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            backupData[key] = localStorage.getItem(key);
        }
        if (Object.keys(backupData).length === 0) return false;

        const dataStr = JSON.stringify(backupData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const today = new Date().toISOString().split('T')[0];

        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', `거상매니저_백업_${today}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        return true;
    } catch (e) {
        console.error('백업 생성 실패:', e);
        return false;
    }
}

function runDataKillChain() {
    const daysSelect = document.getElementById('killchain-days-select');
    const daysThreshold = parseInt(daysSelect ? daysSelect.value : "30", 10);

    const backupSuccess = exportFullBackupJSON();
    if (!backupSuccess) {
        showToast("백업 대상 데이터가 없거나 백업 중 오류가 발생했습니다.", "error");
        return;
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysThreshold);

    const rawProfits = localStorage.getItem('savedProfits');
    let deletedProfitsCount = 0;

    if (rawProfits) {
        try {
            const profitsArr = JSON.parse(rawProfits);
            const initialCount = profitsArr.length;

            const cleanedProfits = profitsArr.filter(entry => {
                if (!entry.date) return true; 
                const entryDate = new Date(entry.date);
                return entryDate >= targetDate;
            });

            deletedProfitsCount = initialCount - cleanedProfits.length;
            localStorage.setItem('savedProfits', JSON.stringify(cleanedProfits));
        } catch (err) {
            console.error("수익 데이터 청소 중 오류:", err);
        }
    }

    loadProfitData();
    renderWeeklyProfitTable();
    renderMonthlyProfitTable();
    updateDashboard();

    showToast(`🧹 ${daysThreshold}일 이전 데이터 ${deletedProfitsCount}건 정리 완료! (백업 저장됨)`, "warning");
}

function initSettings() {
    const container = document.getElementById('client-name-inputs');
    if (!container) return;

    container.innerHTML = `
        <div style="width: 75%; margin-left: 0; margin-top: 20px; padding: 20px; background: rgba(0, 0, 0, 0.75); border-radius: 10px; color: white; border: 1px solid rgba(255,255,255,0.2); max-height: 80vh; overflow-y: auto;">
            <h4 style="margin: 10px 0; color: #ffd700;">👥 클라이언트 별칭 설정</h4>
            <table style="width: 100%; border-collapse: collapse; color: white; margin-bottom: 25px;">
                ${[1,2,3,4,5].map(i => `<tr><td style="padding: 5px; width: 30%;">클라이언트 ${i}</td><td style="padding: 5px;"><input type="text" id="name_input_${i}" value="${getClientName(i)}" style="width: 95%; padding: 4px; background: rgba(255,255,255,0.1); color: white; border: 1px solid #555;"></td></tr>`).join('')}
            </table>
            
            <h4 style="margin: 10px 0; color: #ffd700; display: flex; align-items: center; justify-content: space-between;">
                <span>📝 실시간 숙제 관리자</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-size: 12px; color: #aaa;">편집 대상:</span>
                    <select onchange="switchConfigClient(this.value)" style="padding: 4px 8px; background: #ff9800; color: white; font-weight: bold; border-radius: 4px; border: none; cursor: pointer; outline: none;">
                        ${[1,2,3,4,5].map(i => `<option value="${i}" ${i === currentConfigClientIndex ? 'selected' : ''}>${getClientName(i)}</option>`)}
                    </select>
                    <button onclick="copyClient1ConfigToAll()" style="padding: 5px 10px; background-color: #0284c7; color: white; border: 1px solid #38bdf8; font-weight: bold; border-radius: 4px; cursor: pointer;">
                        📋 1클라 설정 전체 복사
                    </button>
                </div>
            </h4>

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
                <div style="font-weight: bold; margin-bottom: 8px; color: #b3e5fc; font-size: 14px;">💾 데이터 백업, 복구 및 킬체인</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="btn-backup" style="flex: 1; min-width: 140px; padding: 10px; background: #2e7d32; color: white; border: 1px solid #4caf50; font-weight: bold; border-radius: 4px; cursor: pointer;">📥 전체 백업</button>
                    <button id="btn-restore-trigger" style="flex: 1; min-width: 140px; padding: 10px; background: #1565c0; color: white; border: 1px solid #2196f3; font-weight: bold; border-radius: 4px; cursor: pointer;">📤 데이터 가져오기</button>
                    
                    <div style="flex: 1.2; min-width: 240px; display: flex; gap: 5px;">
                        <select id="killchain-days-select" class="select-days" style="flex: 1;">
                            <option value="30">30일 이전 정리</option>
                            <option value="60">60일 이전 정리</option>
                            <option value="90">90일 이전 정리</option>
                        </select>
                        <button id="btn-killchain" class="btn-warning" style="flex: 1.5; padding: 10px;">🧹 킬체인 실행</button>
                    </div>
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
    const btnKillChain = container.querySelector('#btn-killchain');

    if (btnBackup) {
        btnBackup.addEventListener('click', () => {
            const ok = exportFullBackupJSON();
            if (ok) showToast("전체 데이터 백업 파일이 다운로드되었습니다.");
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
                        showToast("올바른 거상 매니저 백업 파일이 아닙니다.", "error");
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
                    showToast("파일을 읽는 중 오류가 발생했습니다.", "error");
                    restoreFileInput.value = '';
                }
            };
            reader.readAsText(file);
        });
    }

    if (btnKillChain) {
        btnKillChain.addEventListener('click', runDataKillChain);
    }

    switchConfigClient(currentConfigClientIndex);
}

function renderConfigList(type, array) {
    const listDiv = document.getElementById(`config-${type}-list`);
    if(!listDiv) return;
    listDiv.innerHTML = array.map((task, idx) => `<div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 2px; border-bottom:1px solid rgba(255,255,255,0.05);"><span>${task}</span><span onclick="deleteConfigTask('${type}', ${idx})" style="color:#e57373; cursor:pointer; font-weight:bold; padding: 0 4px;">✕</span></div>`).join('');
}

function addConfigTask(type) {
    const input = document.getElementById(`new-${type}`);
    if (!input || !input.value.trim()) return;
    
    let current = getConfigTasks(type);
    current.push(input.value.trim());
    
    saveConfigTasks(type, current);
    input.value = '';
    renderConfigList(type, current);
    refreshMainTables();
}

function deleteConfigTask(type, idx) {
    let current = getConfigTasks(type);
    current.splice(idx, 1);
    
    saveConfigTasks(type, current);
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
    showToast("✔️ 변경사항이 저장되었습니다!");
}

function toggleStatus(checkbox, type, taskName) {
    const span = checkbox.closest('tr').querySelector('.status');
    const isChecked = checkbox.checked;
    if(span) { span.innerText = isChecked ? "완료" : "미완료"; span.className = isChecked ? "status status-complete" : "status status-incomplete"; }
    
    const clientKey = getClientServerKey(`check_${type}_${taskName}`);
    localStorage.setItem(clientKey, isChecked ? "true" : "false");
    updateProgress();
    updateDashboard(); 
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

function copyDailyBlogText() { 
    navigator.clipboard.writeText(getBlogText('daily')); 
    showToast("일간 수익 복사가 완료되었습니다.");
}
function copyBlogText() { 
    navigator.clipboard.writeText(getBlogText('weekly')); 
    showToast("주간 수익 복사가 완료되었습니다.");
}

function refreshMainTables() {
    createTable(getSavedTasks('essentialTasks', DEFAULT_ESSENTIAL), 'essential-body', 'essential');
    createTable(getSavedTasks('specialTasks', DEFAULT_SPECIAL), 'optional-body', 'special');
    createTable(getSavedTasks('weeklyTasks', DEFAULT_WEEKLY), 'weekly-body', 'weekly');
    updateProgress();
    updateDashboard();
}

// ==========================================
// [날짜 변경 시 숙제 체크 및 일간 수익 통계 자동 초기화]
// ==========================================
function checkAndResetTasks() {
    const today = new Date().toISOString().split('T')[0];
    const serverLastCheckDateKey = getServerKey('lastCheckDate');
    const lastCheckDate = localStorage.getItem(serverLastCheckDateKey);
    
    if (lastCheckDate !== today) {
        const rawSelectedServer = localStorage.getItem('selectedServer') || "공통";
        const cleanServer = cleanServerName(rawSelectedServer);
        
        // 1. 일일 숙제 체크 해제
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

        // 2. 날짜 변경 시 일간 수익 통계(savedProfits) 자동 삭제
        localStorage.removeItem('savedProfits');

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

    const validDaysSelect = document.getElementById('price-valid-days');
    if (validDaysSelect) {
        priceTableState.validDays = parseInt(validDaysSelect.value) || 7;
    }

    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#ffd700; padding: 20px;">🔄 최신 최저가 데이터를 불러오는 중입니다...</td></tr>`;

    try {
        const cacheBusterUrl = `${GOOGLE_SHEET_URL}${GOOGLE_SHEET_URL.includes('?') ? '&' : '?'}_=${new Date().getTime()}`;
        
        const response = await fetch(cacheBusterUrl, {
            method: 'GET',
            mode: 'cors',
            redirect: 'follow', 
            headers: { 'Accept': 'application/json' }
        });
        
        const data = await response.json(); 

        if (!data || !Array.isArray(data)) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#e57373; padding: 15px;">시트 데이터 수신 실패 (데이터 형식 오류)</td></tr>`;
            return;
        }

        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - priceTableState.validDays);

        let lowestPrices = {};

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;

            let srv = "", itm = "", prcRaw = "", dateRaw = "";
            if (Array.isArray(row)) {
                if (i === 0) continue; 
                srv = row[0]; itm = row[1]; prcRaw = row[2]; dateRaw = row[3] || "";
            } else if (typeof row === 'object') {
                srv = row["서버"] || row["server"] || row[Object.keys(row)[0]];
                itm = row["아이템"] || row["item"] || row[Object.keys(row)[1]];
                prcRaw = row["단가"] || row["price"] || row[Object.keys(row)[2]];
                dateRaw = row["등록일시"] || row["date"] || row[Object.keys(row)[3]] || "";
            }

            if (!srv || !itm) continue;

            const srvClean = cleanServerName(srv);
            const prcCleanedStr = String(prcRaw).replace(/,/g, '').replace(/[^0-9]/g, '');
            const prc = parseInt(prcCleanedStr) || 0;

            if (dateRaw) {
                const entryDate = new Date(dateRaw);
                if (!isNaN(entryDate.getTime()) && entryDate < cutoffDate) {
                    continue; 
                }
            }

            if (srvClean === currentServerClean && itm.trim() !== "" && prc > 0) {
                const itemKey = itm.trim();
                if (!lowestPrices[itemKey] || prc < lowestPrices[itemKey].price) {
                    lowestPrices[itemKey] = {
                        price: prc,
                        date: dateRaw || now.toISOString()
                    };
                }
            }
        }

        priceTableState.allData = Object.keys(lowestPrices).map(item => ({
            item: item,
            price: lowestPrices[item].price,
            date: lowestPrices[item].date
        }));

        priceTableState.currentPage = 1;
        renderPriceTablePage();

    } catch (e) {
        console.error("최저가 조회 중 오류 발생:", e);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#e57373; padding: 15px;">서버 연결 오류가 발생했습니다.</td></tr>`;
    }
}

function renderPriceTablePage() {
    const tbody = document.getElementById('price-body');
    const paginationContainer = document.getElementById('price-pagination');
    if (!tbody) return;

    tbody.innerHTML = "";

    const { allData, currentPage, pageSize } = priceTableState;
    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#aaa; padding: 15px;">최근 ${priceTableState.validDays}일 이내 등록된 최저가 데이터가 없습니다.</td></tr>`;
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const pageData = allData.slice(startIndex, startIndex + pageSize);

    pageData.forEach(row => {
        tbody.innerHTML += `
            <tr>
                <td>${row.item}</td>
                <td style="color:#2ecc71; font-weight:bold;">${row.price.toLocaleString()}원</td>
                <td style="color:#ccc; font-size:12px;">${formatRelativeTime(row.date)}</td>
            </tr>
        `;
    });

    if (paginationContainer) {
        const totalPages = Math.ceil(allData.length / pageSize);
        let paginationHTML = "";

        for (let i = 1; i <= totalPages; i++) {
            const activeStyle = (i === currentPage) 
                ? 'background-color: #ff9800; color: white; font-weight: bold; border-color: #ff9800;' 
                : 'background-color: rgba(255,255,255,0.1); color: #ccc; border-color: #555;';

            paginationHTML += `
                <button onclick="changePricePage(${i})" style="padding: 4px 10px; margin: 0 2px; border: 1px solid; border-radius: 3px; cursor: pointer; ${activeStyle}">
                    ${i}
                </button>
            `;
        }
        paginationContainer.innerHTML = paginationHTML;
    }
}

function changePricePage(pageNumber) {
    priceTableState.currentPage = pageNumber;
    renderPriceTablePage();
}

let calcDropItems = [];

function openCalcModal() {
    const modal = document.getElementById('calc-modal');
    if (modal) {
        modal.style.display = 'flex';
        calculateProfitMargin();
    }
}

function closeCalcModal() {
    const modal = document.getElementById('calc-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function quickSelectCalcItem(itemName) {
    const nameInput = document.getElementById('calc-item-name');
    const priceInput = document.getElementById('calc-item-price');
    if (nameInput) {
        nameInput.value = itemName;
        if (priceInput) priceInput.focus();
    }
}

async function addCalcItem() {
    const nameInput = document.getElementById('calc-item-name');
    const priceInput = document.getElementById('calc-item-price');
    const qtyInput = document.getElementById('calc-item-qty');

    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value) || 0;
    const qty = parseInt(qtyInput.value) || 1;

    if (!name || price <= 0) {
        showToast("아이템명과 단가를 바르게 입력해 주세요.", "warning");
        return;
    }

    calcDropItems.push({ name, price, qty });

    const clientSelect = document.querySelector('.client-select');
    const currentClient = clientSelect ? clientSelect.value : getClientName(1);
    
    await saveProfitEntry(currentClient, name, price, qty);

    showToast(`'${name}' 아이템이 손익계산기 및 일간 통계에 연동되었습니다.`, "success");

    nameInput.value = '';
    priceInput.value = '';
    qtyInput.value = '1';

    renderCalcItemList();
    calculateProfitMargin();
    updateItemDataList();
}

function removeCalcItem(index) {
    calcDropItems.splice(index, 1);
    renderCalcItemList();
    calculateProfitMargin();
}

function renderCalcItemList() {
    const container = document.getElementById('calc-item-list');
    if (!container) return;

    if (calcDropItems.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 10px;">등록된 획득 아이템이 없습니다.</div>`;
        return;
    }

    container.innerHTML = calcDropItems.map((item, idx) => {
        const total = item.price * item.qty;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; border-bottom: 1px solid #1e293b;">
                <span><strong>${item.name}</strong> (${item.qty}개)</span>
                <div>
                    <span style="color: #38bdf8; margin-right: 8px;">${total.toLocaleString()}원</span>
                    <span onclick="removeCalcItem(${idx})" style="color: #ef4444; cursor: pointer; font-weight: bold;">✕</span>
                </div>
            </div>
        `;
    }).join('');
}

function calculateProfitMargin() {
    const buyPrice = parseInt(document.getElementById('calc-buy-price').value) || 0;
    const qty = parseInt(document.getElementById('calc-qty').value) || 1;

    const totalCost = buyPrice * qty;
    const totalItemValue = calcDropItems.reduce((acc, cur) => acc + (cur.price * cur.qty), 0);
    const netProfit = totalItemValue - totalCost;

    let roi = 0;
    if (totalCost > 0) {
        roi = ((netProfit / totalCost) * 100).toFixed(1);
    }

    const costEl = document.getElementById('calc-total-cost');
    const valueEl = document.getElementById('calc-total-item-value');
    const netProfitEl = document.getElementById('calc-net-profit');
    const roiEl = document.getElementById('calc-roi');

    if (costEl) costEl.innerText = `${totalCost.toLocaleString()}원`;
    if (valueEl) valueEl.innerText = `${totalItemValue.toLocaleString()}원`;

    if (netProfitEl) {
        if (netProfit > 0) {
            netProfitEl.innerText = `+${netProfit.toLocaleString()}원 (이득!)`;
            netProfitEl.style.color = '#2ecc71'; 
        } else if (netProfit < 0) {
            netProfitEl.innerText = `${netProfit.toLocaleString()}원 (손해)`;
            netProfitEl.style.color = '#ef4444'; 
        } else {
            netProfitEl.innerText = `0원 (본전)`;
            netProfitEl.style.color = '#f8fafc';
        }
    }

    if (roiEl) {
        roiEl.innerText = `${roi}%`;
        roiEl.style.color = netProfit >= 0 ? '#38bdf8' : '#ef4444';
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

function updateDashboard() {
    const savedData = JSON.parse(localStorage.getItem('savedProfits') || '[]');
    const currentServer = cleanServerName(localStorage.getItem('selectedServer') || "서버없음");
    const todayStr = new Date().toISOString().split('T')[0];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const todayProfit = savedData.filter(entry => {
        return cleanServerName(entry.server) === currentServer && entry.date === todayStr;
    }).reduce((acc, curr) => acc + (parseInt(curr.price || 0) * parseInt(curr.qty || 0)), 0);

    const profitEl = document.getElementById('today-total-profit');
    if (profitEl) profitEl.innerText = todayProfit.toLocaleString() + '원';

    let totalMonthlyGoal = 0;
    for (let i = 1; i <= 5; i++) {
        totalMonthlyGoal += parseInt(localStorage.getItem(getServerKey(`goal_${i}`)) || 0);
    }

    const currentMonthProfit = savedData.filter(entry => {
        if (cleanServerName(entry.server) !== currentServer) return false;
        if (!entry.date) return true;
        const entryDate = new Date(entry.date);
        return entryDate >= startOfMonth && entryDate <= endOfMonth;
    }).reduce((acc, curr) => acc + (parseInt(curr.price || 0) * parseInt(curr.qty || 0)), 0);

    const goalPercent = totalMonthlyGoal > 0 ? Math.min(100, Math.floor((currentMonthProfit / totalMonthlyGoal) * 100)) : 0;
    
    const goalBarFill = document.getElementById('weekly-goal-bar-fill');
    const goalText = document.getElementById('weekly-goal-text');
    if (goalBarFill) goalBarFill.style.width = `${goalPercent}%`;
    if (goalText) goalText.innerText = `${goalPercent}%`;

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

function saveItemToMasterList(itemName) {
    if (!itemName) return;
    let masterList = JSON.parse(localStorage.getItem('itemMasterList') || '[]');
    if (!masterList.includes(itemName)) {
        masterList.push(itemName);
        localStorage.setItem('itemMasterList', JSON.stringify(masterList));
    }
}

function updateItemDataList() {
    const dataList = document.getElementById('item-list');
    if (!dataList) return;

    dataList.innerHTML = '';
    const itemSet = new Set();

    DEFAULT_COMMON_ITEMS.forEach(item => itemSet.add(item));

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

window.onload = () => {
    // FactoryManager 안전 초기화 (DOM 요소 존재 시 구동)
    if (FactoryManager && typeof FactoryManager.init === 'function') {
        if (document.getElementById('factory-table-body')) {
            FactoryManager.init();
        }
    }

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

try {
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
    }
} catch (e) {
    console.log("웹 브라우저 환경 실행 중 (Electron 미사용)");
}