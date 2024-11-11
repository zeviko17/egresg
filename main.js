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
        this.API_CONFIG = API_CONFIG;

        // אתחול
        this.initializeUI();
        this.loadGroups();
    }

    // אתחול ממשק המשתמש
    initializeUI() {
        const messageInput = document.getElementById('message');
        const fileInput = document.getElementById('fileInput');
        
        if (messageInput) {
            messageInput.addEventListener('input', this.validateForm.bind(this));
        }
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
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

            // קודם נרוץ על כל השורות ונאסוף את כל השמות מעמודה B
            const uniqueGroups = new Set(); // משתמשים ב-Set כדי למנוע כפילויות

            json.table.rows.forEach(row => {
                if (row.c && row.c[1] && row.c[1].v) {
                    // מדלגים על השורה הראשונה שהיא כותרת וכל שורה שמכילה "כללי" או "GENERAL"
                    const name = row.c[1].v;
                    if (name !== 'שכונה' && !name.includes('כללי') && !name.includes('GENERAL')) {
                        uniqueGroups.add(name);
                    }
                }
            });

            this.groups = Array.from(uniqueGroups).sort(); // ממיין לפי א"ב

            const container = document.querySelector('.neighborhood-list');
            if (container) {
                container.innerHTML = this.groups.map(name =>
                    `<div class="group-item">
                        <input type="checkbox" 
                               id="group-${name}" 
                               onchange="messageManager.toggleGroup('${name}')">
                        <label for="group-${name}"> ${name}</label>
                    </div>`
                ).join('');
            }

        } catch (error) {
            console.error('Error loading groups:', error);
            alert('שגיאה בטעינת רשימת הקבוצות');
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
        const container = document.getElementById('filePreview');
        if (container) {
            container.innerHTML = this.files.map((file, index) => 
                `<div class="file-preview">
                    ${file.type.startsWith('image/') 
                        ? `<img src="${URL.createObjectURL(file)}" alt="${file.name}">`
                        : `<div class="file-icon">📁 ${file.name}</div>`
                    }
                    <div class="remove" onclick="messageManager.removeFile(${index})">×</div>
                </div>`
            ).join('');
        }
    }

    // הסרת קובץ
    removeFile(index) {
        this.files.splice(index, 1);
        this.renderFilesPreviews();
        this.validateForm();
    }

    // התחלת תהליך השליחה
    async startSending() {
        if (!this.validateForm() || this.isSending) return;

        const messageInput = document.getElementById('message');
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
            alert(this.shouldStop ? 'השליחה הופסקה' : 'השליחה הושלמה');
        }
    }

    // פונקציות נוספות לא נשלחו כאן, אך נשמרו בהתאם

}

// יצירת אובייקט המנהל והתחלת האפליקציה
const messageManager = new MessageManager();
