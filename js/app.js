// State
let tasks = JSON.parse(localStorage.getItem('noxcuse_tasks')) || [];
let backlog = JSON.parse(localStorage.getItem('noxcuse_backlog')) || [];
let currentTaskId = null;
let timerInterval = null;
let timeLeft = 25 * 60;
let isRunning = false;
let currentSessions = 0;
let isBreak = false;
let collapsedTasks = new Set();
let collapsedBacklog = new Set();

// Calendar state
let currentCalendarDate = new Date();
let selectedDateStr = null;

// DOM
const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const timerControls = document.getElementById('timerControls');
const breakButtons = document.getElementById('breakButtons');
const break5Btn = document.getElementById('break5Btn');
const break15Btn = document.getElementById('break15Btn');
const skipBreakBtn = document.getElementById('skipBreakBtn');
const cancelBreakContainer = document.getElementById('cancelBreakContainer');
const cancelBreakBtn = document.getElementById('cancelBreakBtn');
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const sessionsDisplay = document.getElementById('sessions');

// Backlog elements
const backlogToggle = document.getElementById('backlogToggle');
const backlogSidebar = document.getElementById('backlogSidebar');
const closeBacklog = document.getElementById('closeBacklog');
const backlogOverlay = document.getElementById('backlogOverlay');
const backlogInput = document.getElementById('backlogInput');
const addBacklogBtn = document.getElementById('addBacklogBtn');
const backlogList = document.getElementById('backlogList');

// Calendar elements
const calendarToggle = document.getElementById('calendarToggle');
const calendarSidebar = document.getElementById('calendarSidebar');
const closeCalendar = document.getElementById('closeCalendar');
const calendarOverlay = document.getElementById('calendarOverlay');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const currentMonth = document.getElementById('currentMonth');
const calendarDates = document.getElementById('calendarDates');
const dateDetails = document.getElementById('dateDetails');
const selectedDate = document.getElementById('selectedDate');
const sessionCount = document.getElementById('sessionCount');
const sessionDots = document.getElementById('sessionDots');

// Notification elements
const notificationModal = document.getElementById('notificationModal');
const notificationIcon = document.getElementById('notificationIcon');
const notificationTitle = document.getElementById('notificationTitle');
const notificationMessage = document.getElementById('notificationMessage');
const notificationClose = document.getElementById('notificationClose');
const notificationSound = document.getElementById('notificationSound');

// Helpers
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function saveTasks() {
    localStorage.setItem('noxcuse_tasks', JSON.stringify(tasks));
}

function saveBacklog() {
    localStorage.setItem('noxcuse_backlog', JSON.stringify(backlog));
}

// Daily session tracking
function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

function loadDailySessions() {
    const data = JSON.parse(localStorage.getItem('noxcuse_daily_sessions')) || {};
    const today = getTodayDate();
    
    // Check if day changed
    if (data.currentDate !== today) {
        // Save yesterday's sessions to history
        if (data.currentDate && data.currentSessions > 0) {
            if (!data.history) data.history = {};
            data.history[data.currentDate] = data.currentSessions;
        }
        
        // Reset for new day
        data.currentDate = today;
        data.currentSessions = 0;
        localStorage.setItem('noxcuse_daily_sessions', JSON.stringify(data));
        
        currentSessions = 0;
    } else {
        // Same day, load current sessions
        currentSessions = data.currentSessions || 0;
    }
    
    return data;
}

function saveDailySessions() {
    const data = JSON.parse(localStorage.getItem('noxcuse_daily_sessions')) || {};
    const today = getTodayDate();
    
    data.currentDate = today;
    data.currentSessions = currentSessions;
    
    localStorage.setItem('noxcuse_daily_sessions', JSON.stringify(data));
}

// Custom notification
function showNotification(title, message, iconClass = 'fa-bell', iconColor = 'bg-blue-600') {
    // Play sound
    notificationSound.currentTime = 0;
    notificationSound.play().catch(err => console.log('Audio play failed:', err));
    
    // Update notification content
    notificationTitle.textContent = title;
    notificationMessage.textContent = message;
    notificationIcon.className = `w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${iconColor}`;
    notificationIcon.querySelector('i').className = `fas ${iconClass} text-3xl text-white`;
    
    // Show modal
    notificationModal.classList.remove('hidden');
}

function hideNotification() {
    notificationModal.classList.add('hidden');
}

function toggleBacklogSidebar() {
    const isOpen = !backlogSidebar.classList.contains('translate-x-full');
    
    if (isOpen) {
        // Close
        backlogSidebar.classList.add('translate-x-full');
        backlogOverlay.classList.add('hidden');
        backlogToggle.classList.remove('hidden'); // Show button
    } else {
        // Open
        backlogSidebar.classList.remove('translate-x-full');
        backlogOverlay.classList.remove('hidden');
        backlogToggle.classList.add('hidden'); // Hide button
        
        // Close calendar if open
        if (!calendarSidebar.classList.contains('-translate-x-full')) {
            toggleCalendarSidebar();
        }
    }
}

function toggleCalendarSidebar() {
    const isOpen = !calendarSidebar.classList.contains('-translate-x-full');
    
    if (isOpen) {
        // Close
        calendarSidebar.classList.add('-translate-x-full');
        calendarOverlay.classList.add('hidden');
        calendarToggle.classList.remove('hidden'); // Show button
    } else {
        // Open
        calendarSidebar.classList.remove('-translate-x-full');
        calendarOverlay.classList.remove('hidden');
        calendarToggle.classList.add('hidden'); // Hide button
        renderCalendar();
        
        // Close backlog if open
        if (!backlogSidebar.classList.contains('translate-x-full')) {
            toggleBacklogSidebar();
        }
    }
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Set month/year header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    currentMonth.textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Get session data
    const sessionData = JSON.parse(localStorage.getItem('noxcuse_daily_sessions')) || {};
    const history = sessionData.history || {};
    const today = getTodayDate();
    
    // Clear calendar
    calendarDates.innerHTML = '';
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'aspect-square';
        calendarDates.appendChild(emptyCell);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const sessions = dateStr === today ? sessionData.currentSessions : (history[dateStr] || 0);
        
        const dayCell = document.createElement('div');
        dayCell.className = 'aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors relative';
        
        // Today highlight
        if (dateStr === today) {
            dayCell.classList.add('bg-blue-600/20', 'border', 'border-blue-600');
        } else {
            dayCell.classList.add('hover:bg-neutral-800');
        }
        
        // Day number
        const dayNum = document.createElement('div');
        dayNum.className = 'text-sm font-medium';
        dayNum.textContent = day;
        
        // Session indicator
        if (sessions > 0) {
            dayNum.classList.add('text-white');
            
            const indicator = document.createElement('div');
            indicator.className = 'flex gap-0.5 mt-1';
            
            // Color based on session count (check overtime FIRST!)
            let dotColor = 'bg-gray-600';
            if (sessions > 16) {
                dotColor = 'bg-rose-500'; // Overtime (17+)
            } else if (sessions === 16) {
                dotColor = 'bg-green-500'; // Full day (exactly 16)
            } else if (sessions >= 8) {
                dotColor = 'bg-green-400'; // Half day+ (8-15)
            } else if (sessions > 0) {
                dotColor = 'bg-green-300'; // Some work (1-7)
            }
            
            // Show dots (max 3)
            const dotCount = Math.min(3, Math.ceil(sessions / 6));
            for (let i = 0; i < dotCount; i++) {
                const dot = document.createElement('div');
                dot.className = `w-1 h-1 rounded-full ${dotColor}`;
                indicator.appendChild(dot);
            }
            
            dayCell.appendChild(dayNum);
            dayCell.appendChild(indicator);
        } else {
            dayNum.classList.add('text-gray-500');
            dayCell.appendChild(dayNum);
        }
        
        // Click to show details
        dayCell.onclick = () => showDateDetails(dateStr, sessions);
        
        calendarDates.appendChild(dayCell);
    }
}

function showDateDetails(dateStr, sessions) {
    selectedDateStr = dateStr;
    
    // Format date
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    selectedDate.textContent = date.toLocaleDateString('en-US', options);
    
    // Session count
    sessionCount.textContent = `${sessions} session${sessions !== 1 ? 's' : ''}`;
    
    // Render session dots
    sessionDots.innerHTML = '';
    const totalDots = Math.max(16, sessions);
    
    for (let i = 0; i < totalDots; i++) {
        const dot = document.createElement('div');
        
        if (i < sessions) {
            if (i < 16) {
                dot.className = 'w-2 h-2 rounded-full bg-green-500';
            } else {
                dot.className = 'w-2 h-2 rounded-full bg-rose-500';
            }
        } else {
            dot.className = 'w-2 h-2 rounded-full bg-neutral-700';
        }
        
        sessionDots.appendChild(dot);
    }
    
    dateDetails.style.display = 'block';
}

function navigateMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
    dateDetails.style.display = 'none';
}

function addBacklogItem(text, parentId = null) {
    if (!text.trim()) return;
    
    const item = {
        id: generateId(),
        text: text.trim(),
        subtasks: [],
        parentId: parentId
    };
    
    if (parentId) {
        const parentItem = backlog.find(b => b.id === parentId);
        if (parentItem) {
            parentItem.subtasks.push(item);
        }
    } else {
        backlog.push(item);
    }
    
    saveBacklog();
    renderBacklog();
}

function deleteBacklogItem(id) {
    function removeFromArray(arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].id === id) {
                arr.splice(i, 1);
                return true;
            }
            if (arr[i].subtasks && arr[i].subtasks.length > 0) {
                if (removeFromArray(arr[i].subtasks)) return true;
            }
        }
        return false;
    }
    
    removeFromArray(backlog);
    saveBacklog();
    renderBacklog();
}

function moveToTasks(id) {
    const item = findBacklogItem(id);
    if (!item) return;
    
    // Add to tasks with all subtasks
    const newTask = {
        id: generateId(),
        text: item.text,
        completed: false,
        subtasks: item.subtasks.map(sub => ({
            id: generateId(),
            text: sub.text,
            completed: false,
            subtasks: [],
            parentId: null
        }))
    };
    
    tasks.push(newTask);
    saveTasks();
    renderTasks();
    
    // Remove from backlog
    deleteBacklogItem(id);
}

function moveTaskToBacklog(id) {
    const task = findTask(id);
    if (!task) return;
    
    // Add to backlog with all subtasks
    const newBacklogItem = {
        id: generateId(),
        text: task.text,
        subtasks: task.subtasks.map(sub => ({
            id: generateId(),
            text: sub.text,
            subtasks: [],
            parentId: null
        }))
    };
    
    backlog.push(newBacklogItem);
    saveBacklog();
    renderBacklog();
    
    // Remove from tasks
    deleteTask(id);
}

function findBacklogItem(id, itemArray = backlog) {
    for (let item of itemArray) {
        if (item.id === id) return item;
        if (item.subtasks && item.subtasks.length > 0) {
            const found = findBacklogItem(id, item.subtasks);
            if (found) return found;
        }
    }
    return null;
}

function findTask(id, taskArray = tasks) {
    for (let task of taskArray) {
        if (task.id === id) return task;
        if (task.subtasks.length > 0) {
            const found = findTask(id, task.subtasks);
            if (found) return found;
        }
    }
    return null;
}

function addTask(text, parentId = null) {
    if (!text.trim()) return;
    
    const task = {
        id: generateId(),
        text: text.trim(),
        completed: false,
        subtasks: [],
        parentId: parentId
    };

    if (parentId) {
        const parentTask = findTask(parentId);
        if (parentTask) parentTask.subtasks.push(task);
    } else {
        tasks.push(task);
    }

    saveTasks();
    renderTasks();
}

function deleteTask(id) {
    function removeFromArray(arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].id === id) {
                arr.splice(i, 1);
                return true;
            }
            if (arr[i].subtasks.length > 0) {
                if (removeFromArray(arr[i].subtasks)) return true;
            }
        }
        return false;
    }
    
    removeFromArray(tasks);
    saveTasks();
    renderTasks();
}

function toggleTask(id) {
    const task = findTask(id);
    if (task) {
        task.completed = !task.completed;
        
        // If this is a main task with subtasks, toggle all subtasks too
        if (task.subtasks && task.subtasks.length > 0) {
            task.subtasks.forEach(subtask => {
                subtask.completed = task.completed;
            });
        }
        
        saveTasks();
        renderTasks();
    }
}

function toggleCollapse(taskId) {
    if (collapsedTasks.has(taskId)) {
        collapsedTasks.delete(taskId);
    } else {
        collapsedTasks.add(taskId);
    }
    renderTasks();
}

// Timer
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const timeString = formatTime(timeLeft);
    timerDisplay.textContent = timeString;
    
    // Update document title
    if (isRunning) {
        document.title = `${timeString} - NoXcuse`;
    } else {
        document.title = 'NoXcuse';
    }
}

function startTimer() {
    if (isRunning) return;
    
    isRunning = true;
    startBtn.disabled = true;
    startBtn.classList.add('opacity-50', 'cursor-not-allowed');
    stopBtn.disabled = false;
    stopBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-neutral-800', 'hover:bg-neutral-700');
    stopBtn.classList.add('bg-rose-500', 'hover:bg-rose-400', 'text-white');

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            stopTimer();
            handleTimerComplete();
        }
    }, 1000);
}

function stopTimer() {
    isRunning = false;
    startBtn.disabled = false;
    startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    stopBtn.disabled = true;
    stopBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-neutral-800', 'hover:bg-neutral-700');
    stopBtn.classList.remove('bg-rose-500', 'hover:bg-rose-400', 'text-white');
    clearInterval(timerInterval);
}

function resetTimer() {
    stopTimer();
    timeLeft = 25 * 60;
    updateTimerDisplay();
    isBreak = false;
    
    // Show timer controls, hide all break buttons
    timerControls.style.display = 'flex';
    breakButtons.style.display = 'none';
    cancelBreakContainer.style.display = 'none';
}

function handleTimerComplete() {
    if (!isBreak) {
        // Pomodoro complete
        currentSessions++;
        saveDailySessions(); // Save to localStorage
        updateSessionsDisplay();
        
        // Show break buttons, hide timer controls
        timerControls.style.display = 'none';
        breakButtons.style.display = 'flex';
        
        showNotification(
            'Pomodoro Complete! 🎉',
            'Great work! Time to take a break.',
            'fa-check-circle',
            'bg-green-600'
        );
    } else {
        // Break complete
        timeLeft = 25 * 60;
        isBreak = false;
        
        // Show timer controls, hide cancel break button
        cancelBreakContainer.style.display = 'none';
        timerControls.style.display = 'flex';
        
        updateTimerDisplay();
        
        showNotification(
            'Break Complete! 💪',
            'Ready for the next pomodoro session?',
            'fa-play-circle',
            'bg-blue-600'
        );
    }
}

function startBreak(minutes) {
    timeLeft = minutes * 60;
    isBreak = true;
    updateTimerDisplay();
    
    // Hide break buttons and timer controls, show cancel break button
    breakButtons.style.display = 'none';
    timerControls.style.display = 'none';
    cancelBreakContainer.style.display = 'flex';
    
    // Auto start break timer
    startTimer();
}

function cancelBreak() {
    stopTimer();
    timeLeft = 25 * 60;
    isBreak = false;
    updateTimerDisplay();
    
    // Hide cancel break button, show timer controls
    cancelBreakContainer.style.display = 'none';
    timerControls.style.display = 'flex';
}

function skipBreak() {
    timeLeft = 25 * 60;
    isBreak = false;
    updateTimerDisplay();
    
    // Hide break buttons, show timer controls
    breakButtons.style.display = 'none';
    timerControls.style.display = 'flex';
}


function updateSessionsDisplay() {
    sessionsDisplay.innerHTML = '';
    
    // Show at least 16 dots (normal working hours)
    // If overtime (>16), show all completed sessions
    const totalDotsToShow = Math.max(16, currentSessions);
    
    for (let i = 0; i < totalDotsToShow; i++) {
        const dot = document.createElement('div');
        
        if (i < currentSessions) {
            // Completed sessions
            if (i < 16) {
                // Normal sessions (1-16): green
                dot.className = 'w-2 h-2 rounded-full bg-green-500';
            } else {
                // Overtime sessions (17+): rose (pastel red - soft but saturated)
                dot.className = 'w-2 h-2 rounded-full bg-rose-500';
            }
        } else {
            // Incomplete sessions: gray
            dot.className = 'w-2 h-2 rounded-full bg-neutral-700';
        }
        
        sessionsDisplay.appendChild(dot);
    }
}

// Render Backlog
function renderBacklog() {
    backlogList.innerHTML = '';
    backlog.forEach(item => {
        const isCollapsed = collapsedBacklog.has(item.id);
        
        // Add main item
        backlogList.appendChild(createBacklogElement(item, false, isCollapsed));
        
        // Add subtasks
        if (item.subtasks && item.subtasks.length > 0 && !isCollapsed) {
            item.subtasks.forEach((subitem, index) => {
                const isLast = index === item.subtasks.length - 1;
                backlogList.appendChild(createBacklogElement(subitem, true, false, item.id, isLast));
            });
        }
    });
    
    // Initialize sortable for backlog
    new Sortable(backlogList, {
        animation: 150,
        handle: '.backlog-drag-handle',
        sort: true,
        filter: '.backlog-subtask',
        onEnd: function(evt) {
            // Reorder backlog (main items only)
            const items = Array.from(backlogList.querySelectorAll('[data-id]'));
            const seenItems = new Set();
            const newOrder = [];
            
            items.forEach(el => {
                const id = el.getAttribute('data-id');
                const item = backlog.find(b => b.id === id);
                
                if (item && !seenItems.has(item.id)) {
                    seenItems.add(item.id);
                    newOrder.push(item);
                }
            });
            
            backlog = newOrder;
            saveBacklog();
        }
    });
}

function toggleBacklogCollapse(itemId) {
    if (collapsedBacklog.has(itemId)) {
        collapsedBacklog.delete(itemId);
    } else {
        collapsedBacklog.add(itemId);
    }
    renderBacklog();
}

function createBacklogElement(item, isSubitem = false, isCollapsed = false, parentId = null, isLast = false) {
    const div = document.createElement('div');
    
    const subtaskClass = isSubitem 
        ? (isLast ? 'backlog-subtask border-l-2 border-neutral-700 ml-6 mt-2 mb-10 pl-4' : 'backlog-subtask border-l-2 border-neutral-700 ml-6 mt-2 mb-2 pl-4')
        : 'mb-2';
    
    div.className = `bg-neutral-800 border border-neutral-700 rounded-lg p-3 hover:border-neutral-600 ${subtaskClass}`;
    div.setAttribute('data-id', item.id);
    
    const content = document.createElement('div');
    content.className = 'flex items-center gap-3';
    
    // Drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'backlog-drag-handle text-gray-500 hover:text-gray-300 text-sm cursor-grab';
    dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
    
    content.appendChild(dragHandle);
    
    // Text
    const text = document.createElement('span');
    text.className = 'flex-1 text-gray-300 text-sm cursor-text hover:text-white outline-none';
    text.contentEditable = 'true';
    text.textContent = item.text;
    text.setAttribute('spellcheck', 'false');
    
    text.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            text.blur();
        }
    });
    
    text.addEventListener('blur', () => {
        const newText = text.textContent.trim();
        if (newText && newText !== item.text) {
            item.text = newText;
            saveBacklog();
        } else if (!newText) {
            text.textContent = item.text;
        }
    });
    
    content.appendChild(text);
    
    // Expand/collapse button (for items with subtasks) - ON THE RIGHT
    if (!isSubitem && item.subtasks && item.subtasks.length > 0) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-300';
        expandBtn.innerHTML = isCollapsed ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-down"></i>';
        expandBtn.onclick = () => toggleBacklogCollapse(item.id);
        content.appendChild(expandBtn);
    } else if (!isSubitem) {
        const spacer = document.createElement('div');
        spacer.className = 'w-6';
        content.appendChild(spacer);
    }
    
    // Move to tasks button
    const moveBtn = document.createElement('button');
    moveBtn.className = 'bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs';
    moveBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    moveBtn.title = 'Move to tasks';
    moveBtn.onclick = () => moveToTasks(item.id);
    
    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'bg-rose-500 hover:bg-rose-400 px-2 py-1 rounded text-white text-xs';
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.onclick = () => deleteBacklogItem(item.id);
    
    content.appendChild(moveBtn);
    content.appendChild(delBtn);
    div.appendChild(content);
    
    // Add sub-item button (only for main items)
    if (!isSubitem) {
        const subInputContainer = document.createElement('div');
        subInputContainer.className = 'flex gap-2 mt-3';
        subInputContainer.style.display = 'none';
        
        const subInput = document.createElement('input');
        subInput.type = 'text';
        subInput.placeholder = 'Enter sub-item...';
        subInput.className = 'flex-1 bg-neutral-700 border border-neutral-600 px-3 py-1.5 rounded-md text-gray-200 placeholder-gray-500 text-sm';
        
        const addSubBtn = document.createElement('button');
        addSubBtn.textContent = 'Add';
        addSubBtn.className = 'bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md text-xs font-medium';
        addSubBtn.onclick = () => {
            if (subInput.value.trim()) {
                addBacklogItem(subInput.value, item.id);
                subInput.value = '';
                subInputContainer.style.display = 'none';
                if (collapsedBacklog.has(item.id)) collapsedBacklog.delete(item.id);
            }
        };
        
        const cancelSubBtn = document.createElement('button');
        cancelSubBtn.textContent = '×';
        cancelSubBtn.className = 'bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 rounded-md font-medium text-lg';
        cancelSubBtn.onclick = () => {
            subInput.value = '';
            subInputContainer.style.display = 'none';
        };
        
        subInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && subInput.value.trim()) {
                addBacklogItem(subInput.value, item.id);
                subInput.value = '';
                subInputContainer.style.display = 'none';
                if (collapsedBacklog.has(item.id)) collapsedBacklog.delete(item.id);
            }
        });
        
        subInputContainer.appendChild(subInput);
        subInputContainer.appendChild(addSubBtn);
        subInputContainer.appendChild(cancelSubBtn);
        
        const addSubItemBtn = document.createElement('button');
        addSubItemBtn.textContent = '+ Add sub-item';
        addSubItemBtn.className = 'text-xs text-gray-500 hover:text-gray-400 mt-2';
        addSubItemBtn.onclick = () => {
            subInputContainer.style.display = 'flex';
            subInput.focus();
        };
        
        div.appendChild(addSubItemBtn);
        div.appendChild(subInputContainer);
    }
    
    return div;
}
function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach(task => {
        const isCollapsed = collapsedTasks.has(task.id);
        
        // Create container for main task + its subtasks
        const taskContainer = document.createElement('div');
        taskContainer.className = 'task-container mb-2';
        taskContainer.setAttribute('data-id', task.id);
        
        // Add main task
        const mainTaskElement = createTaskElement(task, false, isCollapsed);
        mainTaskElement.classList.remove('mb-2'); // Remove margin from main task
        taskContainer.appendChild(mainTaskElement);
        
        // Add subtasks inside a subtasks container
        if (task.subtasks && task.subtasks.length > 0 && !isCollapsed) {
            const subtasksContainer = document.createElement('div');
            subtasksContainer.className = 'subtasks-container';
            subtasksContainer.setAttribute('data-parent-id', task.id);
            
            task.subtasks.forEach((subtask, index) => {
                const isLast = index === task.subtasks.length - 1;
                const subtaskElement = createTaskElement(subtask, true, false, task.id, isLast);
                subtaskElement.setAttribute('data-id', subtask.id);
                subtasksContainer.appendChild(subtaskElement);
            });
            
            taskContainer.appendChild(subtasksContainer);
        }
        
        taskList.appendChild(taskContainer);
    });
    
    // Initialize drag and drop
    initSortable();
}

function initSortable() {
    // Sortable for main tasks
    new Sortable(taskList, {
        group: {
            name: 'shared',
            pull: true,
            put: true
        },
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        draggable: '.task-container',
        onAdd: function(evt) {
            // Item dragged from backlog to tasks
            const id = evt.item.getAttribute('data-id');
            const backlogItem = findBacklogItem(id);
            
            if (backlogItem) {
                // Add to tasks with all subtasks
                const newTask = {
                    id: generateId(),
                    text: backlogItem.text,
                    completed: false,
                    subtasks: backlogItem.subtasks ? backlogItem.subtasks.map(sub => ({
                        id: generateId(),
                        text: sub.text,
                        completed: false,
                        subtasks: [],
                        parentId: null
                    })) : []
                };
                
                tasks.push(newTask);
                saveTasks();
                renderTasks();
                
                // Remove from backlog
                deleteBacklogItem(id);
                
                // Remove the cloned element
                evt.item.remove();
            }
        },
        onEnd: function(evt) {
            // Get new order from containers
            const containers = Array.from(taskList.querySelectorAll('.task-container'));
            const newOrder = [];
            
            containers.forEach(container => {
                const id = container.getAttribute('data-id');
                const task = tasks.find(t => t.id === id);
                if (task) {
                    newOrder.push(task);
                }
            });
            
            tasks = newOrder;
            saveTasks();
        }
    });
    
    // Sortable for subtasks within each parent
    const subtaskContainers = document.querySelectorAll('.subtasks-container');
    subtaskContainers.forEach(container => {
        new Sortable(container, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                const parentId = container.getAttribute('data-parent-id');
                const parentTask = tasks.find(t => t.id === parentId);
                
                if (parentTask) {
                    // Get new subtask order
                    const subtaskElements = Array.from(container.children);
                    const newSubtaskOrder = [];
                    
                    subtaskElements.forEach(el => {
                        const subtaskId = el.getAttribute('data-id');
                        const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
                        if (subtask) {
                            newSubtaskOrder.push(subtask);
                        }
                    });
                    
                    parentTask.subtasks = newSubtaskOrder;
                    saveTasks();
                }
            }
        });
    });
}

function createTaskElement(task, isSubtask = false, isCollapsed = false, parentId = null, isLast = false) {
    const div = document.createElement('div');
    const completedClass = task.completed ? 'opacity-50' : '';
    const subtaskClass = isSubtask 
        ? (isLast ? 'border-l-2 border-neutral-700 ml-6 mt-2 mb-10 pl-4' : 'border-l-2 border-neutral-700 ml-6 mt-2 mb-2 pl-4')
        : 'mb-2';
    
    div.className = `${completedClass} ${subtaskClass} bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:border-neutral-700`;

    const content = document.createElement('div');
    content.className = 'grid items-center gap-3';
    content.style.gridTemplateColumns = 'auto auto 1fr auto auto auto';
    
    // Drag handle (LEFT)
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle text-gray-500 hover:text-gray-300 text-sm';
    dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.className = 'w-4 h-4 cursor-pointer accent-blue-600 rounded';
    checkbox.onchange = () => toggleTask(task.id);
    
    // Text (inline editable)
    const text = document.createElement('span');
    text.className = task.completed ? 'line-through text-gray-600 text-sm cursor-text outline-none' : 'text-gray-300 text-sm cursor-text hover:text-white outline-none';
    text.contentEditable = 'true';
    text.textContent = task.text;
    text.setAttribute('spellcheck', 'false');
    
    // Prevent newlines
    text.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            text.blur();
        }
    });
    
    // Save on blur
    text.addEventListener('blur', () => {
        const newText = text.textContent.trim();
        if (newText && newText !== task.text) {
            task.text = newText;
            saveTasks();
        } else if (!newText) {
            text.textContent = task.text; // Revert if empty
        }
    });
    
    // Right section - expand/collapse + send to backlog + trash
    // Expand button (only for main tasks with subtasks)
    let expandBtn;
    if (!isSubtask && task.subtasks && task.subtasks.length > 0) {
        expandBtn = document.createElement('button');
        expandBtn.className = 'w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-300';
        expandBtn.innerHTML = isCollapsed ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-down"></i>';
        expandBtn.onclick = () => toggleCollapse(task.id);
    } else {
        // Empty div for consistent spacing
        expandBtn = document.createElement('div');
        expandBtn.className = 'w-0';
    }
    
    // Send to Backlog button (only for main tasks)
    let sendBacklogBtn;
    if (!isSubtask) {
        sendBacklogBtn = document.createElement('button');
        sendBacklogBtn.className = 'bg-purple-600 hover:bg-purple-500 px-2 py-1.5 rounded-md text-white text-xs transition-colors';
        sendBacklogBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
        sendBacklogBtn.title = 'Send to Backlog';
        sendBacklogBtn.onclick = () => moveTaskToBacklog(task.id);
    } else {
        sendBacklogBtn = document.createElement('div');
        sendBacklogBtn.className = 'w-0';
    }
    
    const delBtn = document.createElement('button');
    delBtn.className = 'bg-rose-500 hover:bg-rose-400 px-2.5 py-1.5 rounded-md text-white text-xs transition-colors';
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.onclick = () => {
        if (currentTaskId === task.id) {
            stopTimer();
            resetTimer();
            currentTaskId = null;
        }
        deleteTask(task.id);
    };
    
    content.appendChild(dragHandle);
    content.appendChild(checkbox);
    content.appendChild(text);
    content.appendChild(expandBtn);
    content.appendChild(sendBacklogBtn);
    content.appendChild(delBtn);
    div.appendChild(content);

    // Subtask input (only for main tasks)
    if (!isSubtask) {
        const inputContainer = document.createElement('div');
        inputContainer.className = 'flex gap-2 mt-3 ml-10';
        inputContainer.style.display = 'none';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter subtask...';
        input.className = 'flex-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md text-gray-200 placeholder-gray-500 text-sm';
        
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        addBtn.className = 'bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md text-xs font-medium';
        addBtn.onclick = () => {
            if (input.value.trim()) {
                addTask(input.value, task.id);
                input.value = '';
                inputContainer.style.display = 'none';
                if (collapsedTasks.has(task.id)) collapsedTasks.delete(task.id);
            }
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '×';
        cancelBtn.className = 'bg-neutral-800 hover:bg-neutral-700 px-3 py-2 rounded-md font-medium';
        cancelBtn.style.fontSize = '18px';
        cancelBtn.style.lineHeight = '1';
        cancelBtn.onclick = () => {
            input.value = '';
            inputContainer.style.display = 'none';
        };
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                addTask(input.value, task.id);
                input.value = '';
                inputContainer.style.display = 'none';
                if (collapsedTasks.has(task.id)) collapsedTasks.delete(task.id);
            }
        });
        
        inputContainer.appendChild(input);
        inputContainer.appendChild(addBtn);
        inputContainer.appendChild(cancelBtn);
        
        const addSubBtn = document.createElement('button');
        addSubBtn.textContent = '+ Add subtask';
        addSubBtn.className = 'text-xs text-gray-500 hover:text-gray-400 ml-10 mt-2';
        addSubBtn.onclick = () => {
            inputContainer.style.display = 'flex';
            input.focus();
        };
        
        div.appendChild(addSubBtn);
        div.appendChild(inputContainer);
    }

    return div;
}

// Events
addTaskBtn.addEventListener('click', () => {
    addTask(taskInput.value);
    taskInput.value = '';
});

taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask(taskInput.value);
        taskInput.value = '';
    }
});

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);
resetBtn.addEventListener('click', resetTimer);

break5Btn.addEventListener('click', () => startBreak(5));
break15Btn.addEventListener('click', () => startBreak(15));
skipBreakBtn.addEventListener('click', skipBreak);
cancelBreakBtn.addEventListener('click', cancelBreak);

// Backlog events
backlogToggle.addEventListener('click', toggleBacklogSidebar);
closeBacklog.addEventListener('click', toggleBacklogSidebar);
backlogOverlay.addEventListener('click', toggleBacklogSidebar);

// Calendar events
calendarToggle.addEventListener('click', toggleCalendarSidebar);
closeCalendar.addEventListener('click', toggleCalendarSidebar);
calendarOverlay.addEventListener('click', () => {
    if (!calendarSidebar.classList.contains('-translate-x-full')) {
        toggleCalendarSidebar();
    }
    if (!backlogSidebar.classList.contains('translate-x-full')) {
        toggleBacklogSidebar();
    }
});
prevMonth.addEventListener('click', () => navigateMonth(-1));
nextMonth.addEventListener('click', () => navigateMonth(1));

addBacklogBtn.addEventListener('click', () => {
    addBacklogItem(backlogInput.value);
    backlogInput.value = '';
});

backlogInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addBacklogItem(backlogInput.value);
        backlogInput.value = '';
    }
});

// Notification events
notificationClose.addEventListener('click', hideNotification);
notificationModal.addEventListener('click', (e) => {
    // Close if clicking outside the modal content
    if (e.target === notificationModal || e.target.classList.contains('bg-black/60')) {
        hideNotification();
    }
});

// Keyboard support - ESC to close notification
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !notificationModal.classList.contains('hidden')) {
        hideNotification();
    }
});

// Init
loadDailySessions();
renderTasks();
renderBacklog();
updateTimerDisplay();
updateSessionsDisplay();