// מחלקה לניהול המצב הכללי של האפליקציה
class MessageManager {
    constructor() {
        // מצב המערכת
        this.groups = [];               // רשימת כל הקבוצות
        this.selectedGroups = new Set(); // קבוצות שנבחרו (אינדקסים של הקבוצות)
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

            // אוספים את כל השמות מעמודה B וה-IDs מעמודה D (למעט השורה הראשונה)
            const groups = [];

            json.table.rows.forEach((row, index) => {
                console.log('Processing row:', index, row.c);
                if (row.c && row.c[1] && row.c[1].v) {
                    const name = row.c[1].v;
                    let id = null;

                    if (row.c[3] && row.c[3].v) {
                        id = row.c[3].v;
                    }

                    console.log(`Found group: name=${name}, id=${id}`);

                    // מדלגים על השורה הראשונה אם היא כותרת
                    if (name !== 'שכונה' && !name.includes('כללי') && !name.includes('GENERAL')) {
                        groups.push({ name, id });
                    }
                }
            });

            // לוג לבדיקת הקבוצות הטעונות
            console.log('Loaded groups:', groups);

            // מסדרים ומכינים את מערך הקבוצות
            this.groups = groups.sort((a, b) => a.name.localeCompare(b.name));

            const container = document.querySelector('.neighborhood-list');
            if (container) {
                container.innerHTML = this.groups.map((group, index) => `
                    <div class="group-item">
                        <input type="checkbox" 
                               id="group-${index}" 
                               onchange="messageManager.toggleGroup(${index})">
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
                           ${this.selectedGroups.has(index) ? 'checked' : ''}
                           onchange="messageManager.toggleGroup(${index})">
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
    async sendTextMessage(chatId, message) {
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
    async sendFile(chatId, file, caption) {
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
            for (const groupIndex of this.selectedGroups) {
                if (this.shouldStop) break;

                const group = this.groups[groupIndex];
                const groupName = group.name;
                const chatId = group.id;

                if (!chatId) {
                    console.error(`No chat ID for group: ${groupName}`);
                    continue; // Skip this group
                }

                try {
                    // שליחת הודעת טקסט
                    await this.sendTextMessage(chatId, message);

                    // שליחת קבצים אם יש
                    if (this.files.length > 0) {
                        for (const file of this.files) {
                            await this.sendFile(chatId, file, '');
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

        // ביטול/אפשור שדות קלט, מלבד כפתור עצור
        inputs.forEach(input => {
            if (input.id !== 'stopButton') {
                input.disabled = isSending;
            }
        });
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
    toggleGroup(groupIndex) {
        groupIndex = parseInt(groupIndex);
        if (this.selectedGroups.has(groupIndex)) {
            this.selectedGroups.delete(groupIndex);
        } else {
            this.selectedGroups.add(groupIndex);
        }
        this.validateForm();
    }

    // בחירת כל הקבוצות
    selectAll() {
        this.groups.forEach((group, index) => this.selectedGroups.add(index));
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
