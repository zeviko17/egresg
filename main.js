// מחלקה לניהול המצב הכללי של האפליקציה
class MessageManager {
    constructor() {
        // מצב המערכת
        this.groups = [];              // רשימת כל הקבוצות
        this.selectedGroups = new Set(); // קבוצות שנבחרו
        this.files = [];               // קבצים שהועלו
        this.isSending = false;        // האם כרגע בתהליך שליחה
        this.shouldStop = false;       // האם לעצור את השליחה
        
        // קבועים
        this.API_CONFIG = {
            instanceId: '7103962196',
            token: '64e3bf31b17246f1957f8935b45f7fb5dc5517ee029d41fbae',
            baseUrl: 'https://7103.api.greenapi.com/waInstance',
            messageDelay: 10000 // 10 seconds
        };

        // אתחול
        this.initializeUI();
        this.loadGroups();
    }

    // אתחול ממשק המשתמש
    initializeUI() {
        const messageInput = document.getElementById('message');
        const fileInput = document.getElementById('images');
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

        const uniqueGroups = [];

        json.table.rows.forEach(row => {
            if (row.c && row.c[1] && row.c[1].v) {
                const name = row.c[1].v;
                if (name !== 'שכונה' && !name.includes('כללי') && !name.includes('GENERAL')) {
                    uniqueGroups.push({ id: name, name });
                }
            }
        });

        this.groups = uniqueGroups.sort((a, b) => a.name.localeCompare(b.name));

        const container = document.querySelector('.neighborhood-list');
        if (container) {
            container.innerHTML = this.groups.map(group => `
                <div class="group-item">
                    <input type="checkbox" 
                           id="group-${group.id}" 
                           onchange="messageManager.toggleGroup('${group.id}')">
                    <label for="group-${group.id}"> ${group.name}</label>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error('Error loading groups:', error);
        alert('שגיאה בטעינת רשימת הקבוצות');
    }
}


    // חיפוש קבוצות
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
            container.innerHTML = groups.map(group => `
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
    async sendTextMessage(groupId, message) {
        const url = `${this.API_CONFIG.baseUrl}${this.API_CONFIG.instanceId}/sendMessage/${this.API_CONFIG.token}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chatId: groupId,
                message: message
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
        }
        
        return response.json();
    }

    // שליחת קובץ
    async sendFile(groupId, file, caption) {
        const url = `${this.API_CONFIG.baseUrl}${this.API_CONFIG.instanceId}/sendFileByUpload/${this.API_CONFIG.token}`;
        
        const formData = new FormData();
        formData.append('chatId', groupId);
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
            for (const groupId of this.selectedGroups) {
                if (this.shouldStop) break;

                try {
                    // שליחת הודעת טקסט
                    await this.sendTextMessage(groupId, message);

                    // שליחת קבצים אם יש
                    if (this.files.length > 0) {
                        for (const file of this.files) {
                            await this.sendFile(groupId, file, '');
                        }
                    }

                    sent++;
                    this.updateProgress(sent, totalGroups);

                    // המתנה בין הודעות
                    if (!this.shouldStop && sent < totalGroups) {
                        await new Promise(resolve => setTimeout(resolve, this.API_CONFIG.messageDelay));
                    }
                } catch (error) {
                    console.error(`Error sending to group ${groupId}:`, error);
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
    toggleGroup(groupId) {
        if (this.selectedGroups.has(groupId)) {
            this.selectedGroups.delete(groupId);
        } else {
            this.selectedGroups.add(groupId);
        }
        this.validateForm();
    }

    // בחירת כל הקבוצות
    selectAll() {
        this.groups.forEach(group => this.selectedGroups.add(group.id));
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
