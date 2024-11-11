// מחלקה לניהול המצב הכללי של האפליקציה
class MessageManager {
    constructor() {
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
        const messageInput = document.getElementById('message');
        const fileInput = document.getElementById('images');
        
        if (messageInput) {
            messageInput.addEventListener('input', this.validateForm.bind(this));
        }
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
    }

    // טעינת קבוצות מ-Google Sheets
    async loadGroups() {
        const SHEET_ID = '10IkkOpeD_VoDpqMN23QFxGyuW0_p0TZx4NpWNcMN-Ss';
        const TAB_NAME = 'קבוצות להודעות';
        
        try {
            const response = await fetch(
                `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${TAB_NAME}`
            );
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
        const container = document.querySelector('.neighborhood-list');
        if (container) {
            container.innerHTML = this.groups.map(group => `
                <div class="group-item">
                    <input type="checkbox" 
                           id="group-${group.id}" 
                           ${this.selectedGroups.has(group.id) ? 'checked' : ''}
                           onchange="messageManager.toggleGroup('${group.id}')">
                    <label for="group-${group.id}">
                        ${group.name}
                    </label>
                </div>
            `).join('');
        }
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
        const container = document.getElementById('image-preview');
        if (container) {
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
    }

    // מחיקת קובץ
    removeFile(index) {
        this.files.splice(index, 1);
        this.renderFilesPreviews();
        this.validateForm();
    }

    // בחירת כל הקבוצות
    selectAll() {
        this.groups.forEach(group => this.selectedGroups.add(group.id));
        this.renderGroups();
        this.validateForm();
    }

    // ניקוי כל הבחירות
    deselectAll() {
        this.selectedGroups.clear();
        this.renderGroups();
        this.validateForm();
    }

    // החלפת מצב בחירה של קבוצה
    toggleGroup(groupId) {
        if (this.selectedGroups.has(groupId)) {
            this.selectedGroups.delete(groupId);
        } else {
            this.selectedGroups.add(groupId);
        }
        this.validateForm();
    }

    // בדיקת תקינות הטופס
    validateForm() {
        const messageInput = document.getElementById('message');
        const sendButton = document.querySelector('.send-button');
        
        if (messageInput && sendButton) {
            const isValid = messageInput.value.trim() && this.selectedGroups.size > 0;
            sendButton.disabled = !isValid;
            return isValid;
        }
        return false;
    }

    // התחלת תהליך השליחה
    async startSending() {
        if (!this.validateForm()) return;

        const messageInput = document.getElementById('message');
        if (!messageInput) return;

        this.isSending = true;
        this.shouldStop = false;
        this.updateUI(true);

        const message = messageInput.value;
        const totalGroups = this.selectedGroups.size;
        let sent = 0;

        try {
            for (const groupId of this.selectedGroups) {
                if (this.shouldStop) break;

                try {
                    if (this.files.length > 0) {
                        for (const file of this.files) {
                            // כאן תהיה הלוגיקה לשליחת קובץ
                            console.log(`Sending file ${file.name} to group ${groupId}`);
                        }
                    }
                    
                    // כאן תהיה הלוגיקה לשליחת הודעה
                    console.log(`Sending message to group ${groupId}: ${message}`);
                    
                    sent++;
                    this.updateProgress(sent, totalGroups);
                    
                    // המתנה בין הודעות
                    if (!this.shouldStop) {
                        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
                    }
                } catch (error) {
                    console.error(`Error sending to group ${groupId}:`, error);
                }
            }
        } finally {
            this.isSending = false;
            this.updateUI(false);
        }
    }

    // עדכון התקדמות
    updateProgress(sent, total) {
        const progress = document.querySelector('.progress-bar');
        const statusText = document.querySelector('.status-text');
        
        if (progress) {
            const percentage = (sent / total) * 100;
            progress.style.width = `${percentage}%`;
        }
        
        if (statusText) {
            statusText.textContent = `${sent}/${total} קבוצות`;
        }
    }

    // עדכון ממשק המשתמש
    updateUI(isSending) {
        const progressArea = document.getElementById('progress');
        const sendButton = document.querySelector('.send-button');
        
        if (progressArea) {
            progressArea.style.display = isSending ? 'block' : 'none';
        }
        
        if (sendButton) {
            sendButton.disabled = isSending;
        }
    }

    // עצירת תהליך השליחה
    stopSending() {
        this.shouldStop = true;
    }
}

// יצירת אובייקט המנהל והתחלת האפליקציה
const messageManager = new MessageManager();
