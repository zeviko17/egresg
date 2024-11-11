// מחלקה לניהול המצב הכללי של האפליקציה
class MessageManager {
    constructor() {
        // מצב המערכת
        this.groups = [];               // רשימת כל הקבוצות
        this.selectedGroups = new Set(); // קבוצות שנבחרו
        this.files = [];                // קבצים שהועלו
        this.isSending = false;         // האם כרגע בתהליך שליחה
        this.shouldStop = false;        // האם לעצור את השליחה
        
        // קבועים
        this.API_CONFIG = API_CONFIG;

        // אתחול
        this.initializeUI();
        this.loadGroups();
    }

    // אתחול ממשק המשתמש
    initializeUI() {
        const messageInput = document.getElementById('message');
        const fileInput = document.getElementById('fileInput');
        const searchInput = document.getElementById('search');
        
        if (messageInput) {
            messageInput.addEventListener('input', this.validateForm.bind(this));
        }
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
        if (searchInput) {
            searchInput.addEventListener('input', this.handleSearch.bind(this));
        }
    }

    // טעינת קבוצות מגוגל שיטס
    async loadGroups() {
        try {
            const response = await fetch(
                `https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.sheetId}/gviz/tq?tqx=out:json&sheet=${SHEETS_CONFIG.tabName}`
            );
            const text = await response.text();
            const json = JSON.parse(text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/)[1]);

            // אוספים את כל השמות מעמודה B (למעט השורה הראשונה)
            const groupNames = [];

            json.table.rows.forEach((row) => {
                if (row.c && row.c[1] && row.c[1].v) {
                    const name = row.c[1].v;
                    if (name !== 'שכונה' && !name.includes('כללי') && !name.includes('GENERAL')) {
                        groupNames.push(name);
                    }
                }
            });

            // מסדרים ומכינים את מערך הקבוצות
            this.groups = groupNames.sort().map((name) => ({ name }));

            const container = document.querySelector('.neighborhood-list');
            if (container) {
                container.innerHTML = this.groups.map((group, index) => `
                    <div class="group-item">
                        <input type="checkbox" 
                               id="group-${index}" 
                               onchange="messageManager.toggleGroup('${group.name}')">
                        <label for="group-${index}"> ${group.name}</label>
                    </div>
                `).join('');
            }

        } catch (error) {
            console.error('Error loading groups:', error);
            alert('שגיאה בטעינת רשימת הקבוצות');
        }
    }

    // חיפוש קבוצות (אם נדרש)
    handleSearch(event) {
        const searchTerm = event.target.value.trim().toLowerCase();
        const filteredGroups = searchTerm 
            ? this.groups.filter(group => 
                group.name.toLowerCase().includes(searchTerm)
              )
            : this.groups;
        
        this.renderFilteredGroups(filteredGroups);
    }

    // הצגת קבוצות מסוננות
    renderFilteredGroups(groups) {
        const container = document.querySelector('.neighborhood-list');
        if (container) {
            container.innerHTML = groups.map((group, index) => `
                <div class="group-item">
                    <input type="checkbox" 
                           id="group-${index}" 
                           ${this.selectedGroups.has(group.name) ? 'checked' : ''}
                           onchange="messageManager.toggleGroup('${group.name}')">
                    <label for="group-${index}">
                        ${group.name}
                    </label>
                </div>
            `).join('');
        }
    }

    // טיפול בבחירת קבצים
    handleFileSelect(event) {
        const maxFiles = 10;
        const newFiles = Array.from(event.target.files);
        
        if (this.files.length + newFiles.length > maxFiles) {
            alert(`ניתן להעלות עד ${maxFiles} קבצים`);
            return;
        }

        this.files = this.files.concat(newFiles);
        this.renderFilesPreviews();
        this.validateForm();
    }

    // הצגת תצוגה מקדימה של קבצים
    renderFilesPreviews() {
        const container = document.getElementById('image-preview');
        if (container) {
            container.innerHTML = this.files.map((file, index) => `
                <div class="file-preview">
                    ${file.type.startsWith('image/') 
                        ? `<img src="${URL.createObjectURL(file)}" alt="${file.name}">`
                        : `<div class="file-icon">📁 ${file.name}</div>`
                    }
                    <div class="remove" onclick="messageManager.removeFile(${index})">×</div>
                </div>
            `).join('');
        }
    }

    // הסרת קובץ
    removeFile(index) {
        this.files.splice(index, 1);
        this.renderFilesPreviews();
        this.validateForm();
    }

    // שליחת הודעת טקסט
    async sendTextMessage(groupName, message) {
        const chatId = await this.getChatIdFromGroupName(groupName);

        if (!chatId) {
            console.error(`Chat ID not found for group: ${groupName}`);
            return;
        }

        const url = `${this.API_CONFIG.baseUrl}${this.API_CONFIG.instanceId}/sendMessage/${this.API_CONFIG.token}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chatId: chatId,
                message: message
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
        }

        return response.json();
    }

    // שליחת קובץ
    async sendFile(groupName, file, caption) {
        const chatId = await this.getChatIdFromGroupName(groupName);

        if (!chatId) {
            console.error(`Chat ID not found for group: ${groupName}`);
            return;
        }

        const url = `${this.API_CONFIG.baseUrl}${this.API_CONFIG.instanceId}/sendFileByUpload/${this.API_CONFIG.token}`;

        const formData = new FormData();
        formData.append('chatId', chatId);
        formData.append('caption', caption);
        formData.append('file', file);

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Failed to send file: ${response.statusText}`);
        }

        return response.json();
    }

    // קבלת chatId על פי שם הקבוצה
    async getChatIdFromGroupName(groupName) {
        // יש לממש לוגיקה לקבלת chatId על פי שם הקבוצה
        // לדוגמה, שימוש במיפוי מקומי או קריאה ל-API
        // כאן נניח שיש לנו מיפוי מקומי:
        if (!this.groupNameToChatIdMap) {
            // אתחל מיפוי של שמות קבוצות ל-chatId
            this.groupNameToChatIdMap = {
                // 'שם קבוצה': 'chatId@g.us',
                // לדוגמה:
                // 'קבוצת בדיקה': '1234567890-1234567890@g.us',
            };
        }

        return this.groupNameToChatIdMap[groupName] || null;
    }

    // התחלת תהליך השליחה
    async startSending() {
        if (!this.validateForm()) return;
        if (this.isSending) return;

        const messageInput = document.getElementById('message');
        if (!messageInput) return;

        const message = messageInput.value;
        const totalGroups = this.selectedGroups.size;
        let sent = 0;

        this.isSending = true;
        this.shouldStop = false;
        this.updateUI(true);

        try {
            for (const groupName of this.selectedGroups) {
                if (this.shouldStop) break;

                try {
                    // שליחת הודעת טקסט
                    await this.sendTextMessage(groupName, message);

                    // שליחת קבצים אם יש
                    if (this.files.length > 0) {
                        for (const file of this.files) {
                            await this.sendFile(groupName, file, '');
                        }
                    }

                    sent++;
                    this.updateProgress(sent, totalGroups);

                    // המתנה בין הודעות
                    if (!this.shouldStop && sent < totalGroups) {
                        await new Promise(resolve => setTimeout(resolve, this.API_CONFIG.messageDelay));
                    }
                } catch (error) {
                    console.error(`Error sending to group ${groupName}:`, error);
                }
            }
        } finally {
            this.isSending = false;
            this.updateUI(false);
            if (this.shouldStop) {
                alert('השליחה הופסקה');
            } else {
                alert('השליחה הושלמה');
            }
        }
    }

    // עדכון התקדמות
    updateProgress(sent, total) {
        const progressBar = document.querySelector('.progress-bar');
        const statusText = document.querySelector('.status-text');
        
        if (progressBar) {
            const percentage = (sent / total) * 100;
            progressBar.style.width = `${percentage}%`;
        }
        
        if (statusText) {
            statusText.textContent = `${sent}/${total} קבוצות`;
        }
    }

    // עדכון ממשק המשתמש
    updateUI(isSending) {
        const progressArea = document.getElementById('progress');
        const sendButton = document.querySelector('.send-button');
        const inputs = document.querySelectorAll('input, textarea');
        
        if (progressArea) {
            progressArea.style.display = isSending ? 'block' : 'none';
        }
        
        if (sendButton) {
            sendButton.disabled = isSending;
        }

        // ביטול/אפשור שדות קלט
        inputs.forEach(input => input.disabled = isSending);
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

    // החלפת מצב בחירה של קבוצה
    toggleGroup(groupName) {
        if (this.selectedGroups.has(groupName)) {
            this.selectedGroups.delete(groupName);
        } else {
            this.selectedGroups.add(groupName);
        }
        this.validateForm();
    }

    // בחירת כל הקבוצות
    selectAll() {
        this.groups.forEach(group => this.selectedGroups.add(group.name));
        this.renderFilteredGroups(this.groups);
        this.validateForm();
    }

    // ניקוי כל הבחירות
    deselectAll() {
        this.selectedGroups.clear();
        this.renderFilteredGroups(this.groups);
        this.validateForm();
    }

    // עצירת תהליך השליחה
    stopSending() {
        this.shouldStop = true;
    }
}

// יצירת אובייקט המנהל והתחלת האפליקציה
const messageManager = new MessageManager();
