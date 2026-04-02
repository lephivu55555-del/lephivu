// Utils
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Bổ sung xử lý ngày tháng
function getTodayStr() {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

function formatDateOnly(dateStr) {
    const parts = dateStr.split('-');
    if(parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Lấy/Lưu dữ liệu LocalStorage
const STORAGE_KEY = 'lifesync_data';
const defaultData = {
    dailyLogs: {}, // 'YYYY-MM-DD' => { personalTasks: [], workTasks: [], personalDiary: '', workDiary: '' }
    finances: [],
    gymRoutines: []
};

let appData = defaultData;
let currentPersonalDateStr = getTodayStr();
let currentWorkDateStr = getTodayStr();

function migrateData() {
    let storedData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!storedData) return;

    // Migrate from v1 / v2 to v3 (DailyLogs)
    if (storedData.tasks || storedData.diary || storedData.personalDiary || storedData.workDiary) {
        if (!storedData.dailyLogs) storedData.dailyLogs = {};
        const today = getTodayStr();
        if (!storedData.dailyLogs[today]) {
            storedData.dailyLogs[today] = { personalTasks: [], workTasks: [], personalDiary: '', workDiary: '' };
        }
        
        if (storedData.tasks) {
            storedData.tasks.forEach(t => {
                if (t.type === 'personal') storedData.dailyLogs[today].personalTasks.push(t);
                if (t.type === 'work') storedData.dailyLogs[today].workTasks.push(t);
            });
            delete storedData.tasks;
        }

        if (storedData.diary) {
             storedData.dailyLogs[today].personalDiary = storedData.diary;
             delete storedData.diary;
        }
        if (storedData.personalDiary) {
             storedData.dailyLogs[today].personalDiary = storedData.personalDiary;
             delete storedData.personalDiary;
        }
        if (storedData.workDiary) {
             storedData.dailyLogs[today].workDiary = storedData.workDiary;
             delete storedData.workDiary;
        }
        appData = storedData;
        saveData();
    } else {
        appData = storedData;
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    updateDashboard();
}

function ensureLogExists(dateStr) {
    if (!appData.dailyLogs[dateStr]) {
        appData.dailyLogs[dateStr] = {
            personalTasks: [],
            workTasks: [],
            personalDiary: '',
            workDiary: ''
        };
    }
}

function initApp() {
    migrateData();
    setupNavigation();
    
    // Bind global buttons
    $('#personal-today-btn').addEventListener('click', () => loadDailyData('personal', getTodayStr()));
    $('#work-today-btn').addEventListener('click', () => loadDailyData('work', getTodayStr()));
    
    // Init dates
    loadDailyData('personal', getTodayStr());
    loadDailyData('work', getTodayStr());
    
    renderFinances();
    renderGym();
    updateDashboard();
}

// ================= NAVIGATION =================
function setupNavigation() {
    const navItems = $$('.nav-links li');
    const tabs = $$('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            tabs.forEach(tab => tab.classList.remove('active'));

            item.classList.add('active');
            const targetId = item.getAttribute('data-tab');
            targetId && $(`#${targetId}`).classList.add('active');
        });
    });
}

// ================= TIME TREE & DAILY LOGS =================

function loadDailyData(domain, dateStr) {
    ensureLogExists(dateStr);
    
    if (domain === 'personal') {
        currentPersonalDateStr = dateStr;
    } else {
        currentWorkDateStr = dateStr;
    }

    renderTimeTree(domain);
    renderDailyContent(domain, dateStr);
}

function renderTimeTree(domain) {
    const treeEl = $(`#${domain}-time-tree`);
    treeEl.innerHTML = '';
    
    const dates = Object.keys(appData.dailyLogs).sort().reverse();
    const today = getTodayStr();
    if (!dates.includes(today)) dates.unshift(today);
    
    let currentMonthStr = '';
    const activeDateStr = domain === 'personal' ? currentPersonalDateStr : currentWorkDateStr;
    
    dates.forEach(dateStr => {
        const monthPrefix = dateStr.substring(0, 7); 
        if (monthPrefix !== currentMonthStr) {
            const monthEl = document.createElement('div');
            monthEl.className = 'tree-month';
            monthEl.textContent = `Tháng ${monthPrefix.substring(5,7)} / ${monthPrefix.substring(0,4)}`;
            treeEl.appendChild(monthEl);
            currentMonthStr = monthPrefix;
        }
        
        const li = document.createElement('li');
        li.className = 'tree-node';
        if (dateStr === activeDateStr) li.classList.add('active');
        li.textContent = dateStr === today ? 'Hôm nay' : formatDateOnly(dateStr);
        li.addEventListener('click', () => loadDailyData(domain, dateStr));
        treeEl.appendChild(li);
    });
}

function renderDailyContent(domain, dateStr) {
    const isToday = (dateStr === getTodayStr());
    const headerEl = $(`#${domain}-current-date-header`);
    headerEl.textContent = isToday ? `Hôm nay - ${formatDateOnly(dateStr)}` : `Ngày ${formatDateOnly(dateStr)}`;

    const log = appData.dailyLogs[dateStr];
    
    // Render Tasks
    const listEl = $(`#${domain}-task-list`);
    listEl.innerHTML = '';
    
    const tasks = domain === 'personal' ? log.personalTasks : log.workTasks;
    if (tasks.length === 0) {
        listEl.innerHTML = `<li style="text-align:center; padding: 1.5rem; color: var(--text-secondary)">Chưa có kế hoạch nào.</li>`;
    } else {
        tasks.forEach(task => listEl.appendChild(createTaskElement(task, domain, dateStr)));
    }

    // Render Diary
    const textareaEl = $(`#${domain}-diary-entry`);
    textareaEl.value = domain === 'personal' ? log.personalDiary : log.workDiary;
}

// ================= TASKS ACTIONS =================
$('#add-personal-task-btn').addEventListener('click', () => addTask('personal'));
$('#new-personal-task-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask('personal');
});

$('#add-work-task-btn').addEventListener('click', () => addTask('work'));
$('#new-work-task-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask('work');
});

function addTask(domain) {
    const input = $(`#new-${domain}-task-input`);
    const text = input.value.trim();
    if (!text) return;

    const dateStr = domain === 'personal' ? currentPersonalDateStr : currentWorkDateStr;
    ensureLogExists(dateStr);

    const taskListRaw = domain === 'personal' ? appData.dailyLogs[dateStr].personalTasks : appData.dailyLogs[dateStr].workTasks;
    
    taskListRaw.unshift({
        id: Date.now().toString(),
        text,
        completed: false
    });
    
    input.value = '';
    saveData();
    renderTimeTree(domain); // in case a new day was created
    renderDailyContent(domain, dateStr);
}

function toggleTask(id, domain, dateStr) {
    const taskList = domain === 'personal' ? appData.dailyLogs[dateStr].personalTasks : appData.dailyLogs[dateStr].workTasks;
    const task = taskList.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveData();
        renderDailyContent(domain, dateStr);
    }
}

function deleteTask(id, domain, dateStr) {
    if (domain === 'personal') {
        appData.dailyLogs[dateStr].personalTasks = appData.dailyLogs[dateStr].personalTasks.filter(t => t.id !== id);
    } else {
        appData.dailyLogs[dateStr].workTasks = appData.dailyLogs[dateStr].workTasks.filter(t => t.id !== id);
    }
    saveData();
    renderDailyContent(domain, dateStr);
}

function createTaskElement(task, domain, dateStr) {
    const li = document.createElement('li');
    li.className = 'list-item';
    
    li.innerHTML = `
        <div class="task-item ${task.completed ? 'completed' : ''}">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <div class="task-content">
                <span class="task-text">${task.text}</span>
            </div>
        </div>
        <button class="delete-btn">×</button>
    `;

    li.querySelector('.task-checkbox').addEventListener('change', () => toggleTask(task.id, domain, dateStr));
    li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id, domain, dateStr));
    
    return li;
}

// ================= DIARIES ACTIONS =================
$('#save-personal-diary-btn').addEventListener('click', () => {
    ensureLogExists(currentPersonalDateStr);
    appData.dailyLogs[currentPersonalDateStr].personalDiary = $('#personal-diary-entry').value;
    saveData();
    showStatusMsg('#personal-diary-status');
});

$('#save-work-diary-btn').addEventListener('click', () => {
    ensureLogExists(currentWorkDateStr);
    appData.dailyLogs[currentWorkDateStr].workDiary = $('#work-diary-entry').value;
    saveData();
    showStatusMsg('#work-diary-status');
});

function showStatusMsg(selector) {
    const statusMsg = $(selector);
    statusMsg.textContent = 'Đã lưu ✓';
    statusMsg.classList.add('show');
    setTimeout(() => statusMsg.classList.remove('show'), 2000);
}

// ================= FINANCE ================= (giữ nguyên logic v1)
$('#fin-amount').addEventListener('input', function(e) {
    let val = this.value.replace(/\D/g, '');
    if (val === '') {
        this.value = '';
        return;
    }
    this.value = new Intl.NumberFormat('vi-VN').format(parseInt(val, 10));
});

$('#finance-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="fin-type"]:checked').value;
    const amountStr = $('#fin-amount').value.replace(/\D/g, '');
    const amount = parseInt(amountStr);
    const desc = $('#fin-desc').value.trim();
    if (!amount || !desc) return;

    appData.finances.unshift({
        id: Date.now().toString(),
        type, amount, desc, date: new Date().toISOString()
    });

    $('#fin-amount').value = ''; $('#fin-desc').value = '';
    saveData(); renderFinances();
});

function deleteFinance(id) {
    appData.finances = appData.finances.filter(f => f.id !== id);
    saveData(); renderFinances();
}

function renderFinances() {
    const list = $('#finance-list');
    list.innerHTML = '';
    let totalIncome = 0; let totalExpense = 0;

    appData.finances.forEach(fin => {
        if (fin.type === 'income') totalIncome += fin.amount;
        else totalExpense += fin.amount;

        const li = document.createElement('li');
        li.className = 'list-item';
        const isInc = fin.type === 'income';
        
        li.innerHTML = `
            <div class="fin-item-info">
                <span class="fin-item-desc">${fin.desc}</span>
                <span class="fin-item-date">${formatDate(fin.date)}</span>
            </div>
            <div style="text-align: right;">
                <div class="fin-item-amount ${isInc ? 'income-text' : 'expense-text'}">
                    ${isInc ? '+' : '-'}${formatCurrency(fin.amount)}
                </div>
            </div>
            <button class="delete-btn" style="margin-left:1rem">×</button>
        `;
        li.querySelector('.delete-btn').addEventListener('click', () => deleteFinance(fin.id));
        list.appendChild(li);
    });

    if (appData.finances.length === 0) list.innerHTML = `<li style="text-align:center; padding: 2rem; color: var(--text-secondary)">Chưa có giao dịch.</li>`;
    $('#total-income').textContent = formatCurrency(totalIncome);
    $('#total-expense').textContent = formatCurrency(totalExpense);
    $('#current-balance').textContent = formatCurrency(totalIncome - totalExpense);
}

// ================= GYM ================= (giữ nguyên logic v1)
$('#gym-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#gym-name').value.trim();
    const details = $('#gym-details').value.trim();
    if (!name) return;

    appData.gymRoutines.unshift({
        id: Date.now().toString(),
        name, details, date: new Date().toISOString()
    });

    $('#gym-name').value = ''; $('#gym-details').value = '';
    saveData(); renderGym();
});

function deleteGymRoutine(id) {
    appData.gymRoutines = appData.gymRoutines.filter(g => g.id !== id);
    saveData(); renderGym();
}

function renderGym() {
    const list = $('#gym-list'); list.innerHTML = '';
    if (appData.gymRoutines.length === 0) {
        list.innerHTML = `<li style="text-align:center; padding: 2rem; color: var(--text-secondary)">Chưa có bài tập nào. Hãy lên lịch!</li>`; return;
    }
    appData.gymRoutines.forEach(routine => {
        const li = document.createElement('li'); li.className = 'list-item';
        
        // Hỗ trợ hiển thị dữ liệu cũ (có sets, reps) nếu có
        let detailText = routine.details || '';
        if (!detailText && routine.sets) {
            detailText = `${routine.sets} Hiệp x ${routine.reps} Lần ${routine.weight ? ` • ${routine.weight}kg` : ''}`;
        }

        li.innerHTML = `
            <div class="gym-item-info">
                <div class="gym-item-name">${routine.name}</div>
                <div class="gym-item-details">
                    ${detailText} | ${formatDate(routine.date)}
                </div>
            </div>
            <button class="delete-btn">×</button>
        `;
        li.querySelector('.delete-btn').addEventListener('click', () => deleteGymRoutine(routine.id));
        list.appendChild(li);
    });
}

// ================= DASHBOARD OVERVIEW =================
function updateDashboard() {
    const today = getTodayStr();
    let activeTasks = 0;
    let pendingTaskElements = [];

    if (appData.dailyLogs && appData.dailyLogs[today]) {
        const pTasks = appData.dailyLogs[today].personalTasks.filter(t => !t.completed);
        const wTasks = appData.dailyLogs[today].workTasks.filter(t => !t.completed);
        activeTasks = pTasks.length + wTasks.length;

        // Render pending tasks list for dashboard
        pTasks.forEach(t => {
            pendingTaskElements.push(`
                <li class="list-item" style="padding: 0.75rem 1rem;">
                    <div class="task-item" style="gap: 0.75rem;">
                        <input type="checkbox" class="task-checkbox" onchange="toggleTask('${t.id}', 'personal', '${today}')">
                        <span class="task-text">${t.text}</span>
                        <span style="font-size: 0.7rem; color: #a78bfa; background: rgba(167, 139, 250, 0.1); padding: 2px 6px; border-radius: 8px;">Cá nhân</span>
                    </div>
                </li>
            `);
        });

        wTasks.forEach(t => {
            pendingTaskElements.push(`
                <li class="list-item" style="padding: 0.75rem 1rem;">
                    <div class="task-item" style="gap: 0.75rem;">
                        <input type="checkbox" class="task-checkbox" onchange="toggleTask('${t.id}', 'work', '${today}')">
                        <span class="task-text">${t.text}</span>
                        <span style="font-size: 0.7rem; color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 2px 6px; border-radius: 8px;">Công việc</span>
                    </div>
                </li>
            `);
        });
    }
    $('#dash-tasks-count').textContent = activeTasks;

    const dashPendingList = $('#dash-pending-tasks');
    if (dashPendingList) {
        if (pendingTaskElements.length === 0) {
            dashPendingList.innerHTML = `<li style="text-align:center; padding: 1.5rem; color: var(--text-secondary)">Tuyệt vời, bạn đã hoàn thành mọi việc của hôm nay!</li>`;
        } else {
            dashPendingList.innerHTML = pendingTaskElements.join('');
        }
    }

    let balance = 0;
    appData.finances.forEach(fin => {
        if (fin.type === 'income') balance += fin.amount;
        else balance -= fin.amount;
    });
    $('#dash-balance').textContent = formatCurrency(balance);
    $('#dash-balance').className = `big-number ${balance >= 0 ? 'highlight' : 'expense-text'}`;

    const nextGym = appData.gymRoutines[0];
    $('#dash-gym-next').textContent = nextGym ? nextGym.name : 'Chưa có lịch';
}

// ================= GLOBAL EXPORTS FOR INLINE EVENT HANDLERS =================
window.toggleTask = toggleTask;

// Boot
// Configuration: Mật khẩu truy cập
const APP_PASSWORD = '1111'; // Thay đổi mật khẩu tại đây
let isAuthenticated = false;

function setupLoginGate() {
    const loginGate = $('#login-gate');
    const mainApp = $('#main-app');
    const passInput = $('#site-password');
    const loginBtn = $('#login-btn');
    const errorMsg = $('#login-error');

    function attemptLogin() {
        if (passInput.value === APP_PASSWORD) {
            isAuthenticated = true;
            loginGate.style.opacity = '0';
            setTimeout(() => {
                loginGate.style.display = 'none';
                mainApp.style.display = 'flex';
                initApp();
            }, 500);
        } else {
            errorMsg.style.opacity = '1';
            passInput.value = '';
            passInput.focus();
            // Lắc màn hình nhẹ khi sai
            loginGate.querySelector('.login-card').style.transform = 'translateY(0) translateX(-10px)';
            setTimeout(() => loginGate.querySelector('.login-card').style.transform = 'translateY(0) translateX(10px)', 100);
            setTimeout(() => loginGate.querySelector('.login-card').style.transform = 'translateY(0) translateX(0)', 200);
        }
    }

    loginBtn.addEventListener('click', attemptLogin);
    passInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptLogin();
        // Ẩn lỗi khi bắt đầu gõ lại
        errorMsg.style.opacity = '0';
    });
}

// Khởi chạy hệ thống login thay vì initApp liền
setupLoginGate();