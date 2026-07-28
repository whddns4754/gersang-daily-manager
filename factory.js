/**
 * factory.js - 사용자 히스토리 기반 생산시설 관리 모듈
 */

const fs = require('fs');
const path = require('path');

const getStoragePath = () => {
    try {
        const appData = process.env.APPDATA || (process.platform === 'darwin' 
            ? process.env.HOME + '/Library/Preferences' 
            : process.env.HOME + '/.local/share');
        return path.join(appData, 'gersang_factory_data.json');
    } catch (e) {
        return path.join(__dirname, 'gersang_factory_data.json');
    }
};

const DATA_FILE = getStoragePath();
const DEBOUNCE_DELAY = 500;
const MAX_IDLE_HOURS = 152;

let factoryState = {
    facilities: {},
    // 아이템별 이전 설정값 및 재료 히스토리 저장소
    itemHistory: {} 
};

let autoSaveTimer = null;
let currentFacilityKey = '';
let currentFacilityType = '농장';

const FactoryManager = {

    init() {
        console.log("🏭 생산시설 관리 모듈이 구동되었습니다.");
        this.loadData();
        this.bindGlobalEvents();
        if (document.getElementById('factory-table-body')) {
            this.renderFactoryList(currentFacilityType);
        }
    },

    renderFactoryList(facilityName) {
        currentFacilityType = facilityName;
        const titleEl = document.getElementById('factory-list-title');
        if (titleEl) titleEl.innerText = `${facilityName} 목록`;
        
        const tbody = document.getElementById('factory-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        for (let i = 1; i <= 20; i++) {
            const numStr = i < 10 ? `0${i}` : `${i}`;
            const key = `${facilityName}_${numStr}`;
            const savedData = factoryState.facilities[key] || {};

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="white-space: nowrap;">${numStr}번 ${facilityName}</td>
                <td>${savedData.owner || '-'}</td>
                <td class="text-right">${savedData.itemName || '-'}</td>
                <td class="text-right">${(savedData.targetQty || 0).toLocaleString()}</td>
            `;

            tr.onclick = () => {
                this.openFactoryDetail(numStr, facilityName);
            };

            tbody.appendChild(tr);
        }
    },

    switchFactoryCategory(facilityName, btnElement) {
        document.querySelectorAll('.factory-category-btn').forEach(btn => btn.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');

        const listView = document.getElementById('factory-list-view');
        const detailView = document.getElementById('factory-detail-view');
        
        if (listView) listView.style.display = 'block';
        if (detailView) detailView.style.display = 'none';

        this.renderFactoryList(facilityName);
    },

    openFactoryDetail(numStr, facilityName) {
        currentFacilityKey = `${facilityName}_${numStr}`;
        
        const listView = document.getElementById('factory-list-view');
        const detailView = document.getElementById('factory-detail-view');
        
        if (listView) listView.style.display = 'none';
        if (detailView) detailView.style.display = 'block';
        
        const headerTitle = document.getElementById('detail-header-title');
        if (headerTitle) headerTitle.innerText = `${numStr}번 ${facilityName} 관리`;

        this.updateDatalistOptions();

        const data = factoryState.facilities[currentFacilityKey] || {};
        
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('facilityOwner', data.owner || '');
        setVal('itemInput', data.itemName || '');
        setVal('baseWorkload', data.baseWorkload || 0);
        setVal('targetQty', data.targetQty || 1);
        
        const masterBuffEl = document.getElementById('useMasterBuff');
        if (masterBuffEl) masterBuffEl.checked = data.useMasterBuff || false;
        
        setVal('masterTicketPrice', data.masterTicketPrice || 0);
        setVal('wagePerWorkload', data.wagePerWorkload || 0);
        setVal('dailySpeed', data.dailySpeed || 1200);
        setVal('sellPrice', data.sellPrice || 0);

        this.onSelectFactoryItem(data.materialPrices);
    },

    backToFactoryList() {
        const listView = document.getElementById('factory-list-view');
        const detailView = document.getElementById('factory-detail-view');
        
        if (listView) listView.style.display = 'block';
        if (detailView) detailView.style.display = 'none';

        this.renderFactoryList(currentFacilityType);
    },

    // 히스토리 기반 Datalist 필터링
    updateDatalistOptions() {
        const datalist = document.getElementById('factory-item-list');
        if (!datalist) return;
        datalist.innerHTML = '';

        const itemSet = new Set();
        Object.keys(factoryState.itemHistory || {}).forEach(name => {
            if (name) itemSet.add(name);
        });

        itemSet.forEach(itemName => {
            const opt = document.createElement('option');
            opt.value = itemName;
            datalist.appendChild(opt);
        });
    },

    // 동적 재료 입력 필드 렌더링
    renderMaterialInputs(materials, savedPrices = {}) {
        const container = document.getElementById('material-list-container');
        if (!container) return;
        container.innerHTML = '';

        if (!materials || materials.length === 0) return;

        materials.forEach(mat => {
            const price = savedPrices[mat.name] !== undefined ? savedPrices[mat.name] : 0;
            const div = document.createElement('div');
            div.className = 'factory-form-group';
            div.style.marginBottom = '8px';
            div.innerHTML = `
                <label style="font-size: 13px; color: #ccc;">${mat.name} 단가 (1개당 ${mat.qty}개 필요)</label>
                <input type="number" class="mat-price-input" 
                       data-mat-name="${mat.name}" 
                       data-mat-qty="${mat.qty}" 
                       value="${price}" 
                       oninput="calculateFactoryAll()"
                       style="width: 100%; padding: 5px; background: rgba(255,255,255,0.1); border: 1px solid #555; color: white;">
            `;
            container.appendChild(div);
        });
    },

    onSelectFactoryItem(savedMaterialPrices = null) {
        const itemInput = document.getElementById('itemInput');
        const itemName = itemInput ? itemInput.value.trim() : '';

        const history = factoryState.itemHistory ? factoryState.itemHistory[itemName] : null;
        let materials = [];

        if (history) {
            document.getElementById('baseWorkload').value = history.baseWorkload || 0;
            if (document.getElementById('masterTicketPrice').value == 0) {
                document.getElementById('masterTicketPrice').value = history.masterTicketPrice || 0;
            }
            if (document.getElementById('wagePerWorkload').value == 0) {
                document.getElementById('wagePerWorkload').value = history.wagePerWorkload || 0;
            }
            if (document.getElementById('sellPrice').value == 0) {
                document.getElementById('sellPrice').value = history.sellPrice || 0;
            }
            materials = history.materials || [];
        }

        this.renderMaterialInputs(materials, savedMaterialPrices || (history ? history.materialPrices : {}));
        this.calculateFactoryAll();
    },

    calculateFactoryAll() {
        const owner = document.getElementById('facilityOwner')?.value || '';
        const itemName = document.getElementById('itemInput')?.value.trim() || '';
        const baseWorkload = parseFloat(document.getElementById('baseWorkload')?.value) || 0;
        const targetQty = parseFloat(document.getElementById('targetQty')?.value) || 1;
        const useMasterBuff = document.getElementById('useMasterBuff')?.checked || false;
        const masterTicketPrice = parseFloat(document.getElementById('masterTicketPrice')?.value) || 0;
        const wagePerWorkload = parseFloat(document.getElementById('wagePerWorkload')?.value) || 0;
        const dailySpeed = parseFloat(document.getElementById('dailySpeed')?.value) || 1200;
        const sellPrice = parseFloat(document.getElementById('sellPrice')?.value) || 0;

        let totalMaterialCost = 0;
        const materialPrices = {};
        document.querySelectorAll('.mat-price-input').forEach(input => {
            const matName = input.getAttribute('data-mat-name');
            const matQtyPerUnit = parseFloat(input.getAttribute('data-mat-qty')) || 0;
            const price = parseFloat(input.value) || 0;

            materialPrices[matName] = price;
            totalMaterialCost += (matQtyPerUnit * targetQty) * price;
        });

        const totalWorkload = baseWorkload * targetQty;
        let totalWageCost = 0;
        let totalMasterCost = 0;
        let masterTicketCount = 0;

        if (useMasterBuff) {
            masterTicketCount = Math.ceil(totalWorkload / 10000);
            totalMasterCost = masterTicketCount * masterTicketPrice;
        } else {
            totalWageCost = totalWorkload * wagePerWorkload;
        }

        const totalProductionCost = totalMaterialCost + totalWageCost + totalMasterCost;
        const unitProductionCost = targetQty > 0 ? Math.floor(totalProductionCost / targetQty) : 0;
        const totalRevenue = sellPrice * targetQty;
        const netProfit = totalRevenue - totalProductionCost;
        const roi = totalProductionCost > 0 ? ((netProfit / totalProductionCost) * 100).toFixed(2) : 0;

        const timerRes = this.calculateTimers(totalWorkload, dailySpeed);

        const setElText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setElText('resTotalWorkload', totalWorkload.toLocaleString());
        setElText('resMasterCount', `${masterTicketCount.toLocaleString()} 개`);
        setElText('resMaterialCost', `${totalMaterialCost.toLocaleString()} G`);
        setElText('resTotalCost', `${totalProductionCost.toLocaleString()} G`);
        setElText('resUnitCost', `${unitProductionCost.toLocaleString()} G`);
        setElText('resNetProfit', `${netProfit.toLocaleString()} G`);
        setElText('resROI', `${roi} %`);

        if (timerRes.completionDate) {
            setElText('resCompletionTime', timerRes.completionDate.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
            setElText('resDestructionTime', timerRes.destructionDate.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
        } else {
            setElText('resCompletionTime', '-');
            setElText('resDestructionTime', '-');
        }

        if (currentFacilityKey) {
            factoryState.facilities[currentFacilityKey] = {
                owner,
                itemName,
                baseWorkload,
                targetQty,
                useMasterBuff,
                masterTicketPrice,
                wagePerWorkload,
                dailySpeed,
                sellPrice,
                materialPrices,
                completionDate: timerRes.completionDate,
                destructionDate: timerRes.destructionDate
            };

            if (itemName) {
                if (!factoryState.itemHistory) factoryState.itemHistory = {};
                
                const currentMaterials = [];
                document.querySelectorAll('.mat-price-input').forEach(input => {
                    currentMaterials.push({
                        name: input.getAttribute('data-mat-name'),
                        qty: parseFloat(input.getAttribute('data-mat-qty')) || 0
                    });
                });

                factoryState.itemHistory[itemName] = {
                    baseWorkload,
                    masterTicketPrice,
                    wagePerWorkload,
                    sellPrice,
                    materialPrices,
                    materials: currentMaterials.length > 0 
                        ? currentMaterials 
                        : (factoryState.itemHistory[itemName]?.materials || [])
                };
                this.updateDatalistOptions();
            }

            this.saveDataDebounced();
        }
    },

    calculateTimers(remainingWorkload, dailySpeed) {
        if (!dailySpeed || dailySpeed <= 0 || remainingWorkload <= 0) {
            return { completionDate: null, destructionDate: null };
        }

        const hoursToComplete = (remainingWorkload / dailySpeed) * 0.8;
        const completionDate = new Date(Date.now() + hoursToComplete * 3600 * 1000);
        const destructionDate = new Date(completionDate.getTime() + MAX_IDLE_HOURS * 3600 * 1000);

        return { completionDate, destructionDate };
    },

    loadData() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                factoryState = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
                if (!factoryState.itemHistory) factoryState.itemHistory = {};
            }
        } catch (err) {
            factoryState = { facilities: {}, itemHistory: {} };
        }
    },

    saveDataDebounced() {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => this.saveDataImmediately(), DEBOUNCE_DELAY);
    },

    saveDataImmediately() {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(factoryState, null, 2), 'utf-8');
        } catch (err) {}
    },

    bindGlobalEvents() {
        window.addEventListener('beforeunload', () => this.saveDataImmediately());
    }
};

// 전역 함수 연결
window.FactoryManager = FactoryManager;
window.switchFactoryCategory = (facilityName, btnElement) => FactoryManager.switchFactoryCategory(facilityName, btnElement);
window.openFactoryDetail = (numStr, facilityName) => FactoryManager.openFactoryDetail(numStr, facilityName);
window.backToFactoryList = () => FactoryManager.backToFactoryList();
window.calculateFactoryAll = () => FactoryManager.calculateFactoryAll();
window.onSelectFactoryItem = (savedMaterialPrices) => FactoryManager.onSelectFactoryItem(savedMaterialPrices);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FactoryManager;
}