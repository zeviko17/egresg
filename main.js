// מחלקה לניהול המצב הכללי של האפליקציה
class MessageManager {
    constructor() {
        this.api = new WhatsAppAPI(API_CONFIG);
        this.groups = [];
        this.selectedGroups = new Set();
        this.files = [];
        this.isSending = false;
        this.shouldStop = false;

        this.initializeUI();
        this.loadGroups();
    }

    // אתחול ממשק המשתמש
    initializeUI() {
        // חיבור אירועים לאלמנטים
        document.getElementById('messageText').addEventListener('input', this.validateForm.bind(this));
        document.getElementById('fileInput').addEventListener('change', this.handleFileSelect.bind(this));
        document.getElementById('searchInput').addEventListener('input', this.filterGroups.bind(this));
    }

    // טעינת קבוצות מ-Google Sheets
    async loadGroups() {
        try {
            const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.sheetId}/gviz/tq?tqx=out:json&sheet=${SHEETS_CONFIG.tabName}`);
            const text = await response.text();
            const data = JSON.parse(text.substr(47).slice(0, -2));
            
            this.groups = data.table.rows.map(row => ({
                id: row.c[2].v,        // ID קבוצה
                name: row.c[1].v,      // שם שכונה
                link: row.c[2].v,      // קישור
                members: row.c[4]?.v || 0  // מספר חברים
            }));

            this.renderGroups();
        } catch (error) {
            console.error('Error loading groups:', error);
            alert('שגיאה בטעינת רשימת הקבוצות');
        }
    }

    // הצגת רשימת הקבוצות
    renderGroups() {
        const container = document.querySelector('.groups-list');
        container.innerHTML = this.groups.map(group => `
            <div class="group-item">
                <input type="checkbox" 
                       id="group-${group.id}" 
                       ${this.selectedGroups.has(group.id) ? 'checked' : ''}
                       onchange="messageManager.toggleGroup('${group.id}')">
                <label for="group-${group.id}">
                    <div>${group.name}</div>
                    <div class="group-info">${group.members} חברים</div>
                </label>
            </div>
        `).join('');
        
        this.updateSelectedCount();
    }

    // טיפול בבחירת קבצים
    handleFileSelect(event) {
        const newFiles = Array.from(event.target.files);
        this.files = this.files.concat(newFiles);
        this.renderFilesPreviews();
        this.validateForm();
    }

    // הצגת תצוגה מקדימה של הקבצים
    renderFilesPreviews() {
        const container = document.getElementById('filesPreview');
        container.innerHTML = this.files.map((file, index) => `
            <div class="file-preview">
                ${file.type.startsWith('image/') 
                    ? `<img src="${URL.createObjectURL(file)}" alt="${file.name}">`
                    : `<div class="file-icon">📁</div>`
                }
                <div class="remove" onclick="messageManager.removeFile(${index})">×</div>
            </div>
        `).join('');
    }

    // התחלת תהליך השליחה
    async startSending() {
        if (!this.validateForm()) return;

        this.isSending = true;
        this.shouldStop = false;
        this.updateUI(true);

        const message = document.getElementById('messageText').value;
        const totalGroups = this.selectedGroups.size;
        let sent = 0;

        for (const groupId of this.selectedGroups) {
            if (this.shouldStop) break;

            try {
                if (this.files.length > 0) {
                    for (const file of this.files) {
                        await this.sendFileToGroup(groupId, message, file);
                    }
                } else {
                    await this.api.sendMessage(groupId, message);
                }
                sent++;
                this.updateProgress(sent, totalGroups);
            } catch (error) {
                console.error(`Error sending to group ${groupId}:`, error);
            }

            // המתנה בין הודעות
            if (!this.shouldStop) {
                await new Promise(resolve => setTimeout(resolve, API_CONFIG.messageDelay));
            }
        }

        this.isSending = false;
        this.updateUI(false);
        alert('תהליך השליחה הסתיים');
    }

    // שליחת קובץ לקבוצה
    async sendFileToGroup(groupId, message, file) {
        // כאן צריך להוסיף לוגיקה להעלאת הקובץ לשרת זמני או לדרייב
        // ואז לשלוח את הקישור דרך ה-API
        const fileUrl = await this.uploadFile(file);
        await this.api.sendFile(groupId, message, fileUrl, file.name);
    }

    // עדכון התקדמות
    updateProgress(sent, total) {
        const progress = document.querySelector('.progress-bar');
        const percentage = (sent / total) * 100;
        progress.style.width = `${percentage}%`;
        document.querySelector('#progress span').textContent = `${sent}/${total} קבוצות`;
    }

    // עדכון ממשק המשתמש
    updateUI(isSending) {
        document.getElementById('progress').style.display = isSending ? 'block' : 'none';
        document.querySelector('button[onclick="messageManager.startSending()"]').disabled = isSending;
        // עדכון שאר האלמנטים בהתאם למצב
    }

    // פונקציות עזר נוספות
    validateForm() {
        const message = document.getElementById('messageText').value;
        const isValid = message.trim() && this.selectedGroups.size > 0;
        document.querySelector('button[onclick="messageManager.startSending()"]').disabled = !isValid;
        return isValid;
    }

    toggleGroup(groupId) {
        if (this.selectedGroups.has(groupId)) {
            this.selectedGroups.delete(groupId);
        } else {
            this.selectedGroups.add(groupId);
        }
        this.updateSelectedCount();
        this.validateForm();
    }

    selectAll() {
        this.groups.forEach(group => this.selectedGroups.add(group.id));
        this.renderGroups();
        this.validateForm();
    }

    clearAll() {
        this.selectedGroups.clear();
        this.renderGroups();
        this.validateForm();
    }

    stopSending() {
        this.shouldStop = true;
    }
}

// יצירת אובייקט המנהל והתחלת האפליקציה
const messageManager = new MessageManager();

// טעינת קבוצות מהגוגל שיטס
async function loadGroups() {
    const SHEET_ID = '10IkkOpeD_VoDpqMN23QFxGyuW0_p0TZx4NpWNcMN-Ss';
    const TAB_NAME = 'קבוצות להודעות';
    
    try {
        const response = await fetch(
            `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${TAB_NAME}`
        );
        const text = await response.text();
        const data = JSON.parse(text.substr(47).slice(0, -2));
        
        const groupsList = document.querySelector('.neighborhood-list');
        // מניח שהנתונים בטבלה הם: שכונה, קישור, ID הקבוצה
        groupsList.innerHTML = data.table.rows.map(row => `
            <div class="group-item">
                <input type="checkbox" id="group_${row.c[2].v}">
                <label for="group_${row.c[2].v}">${row.c[0].v}</label>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading groups:', error);
        alert('שגיאה בטעינת רשימת הקבוצות');
    }
}

// הפעלה כשהדף נטען
document.addEventListener('DOMContentLoaded', loadGroups);
