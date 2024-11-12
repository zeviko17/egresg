// הגדרות Google Sheets
const SHEETS_CONFIG = {
    sheetId: '10IkkOpeD_VoDpqMN23QFxGyuW0_p0TZx4NpWNcMN-Ss',
    tabName: 'קבוצות להודעות'
};

// מחלקה לניהול המצב הכללי של האפליקציה
class MessageManager {
   constructor() {
    // מצב המערכת
    this.groups = [];               
    this.selectedGroups = new Set(); 
    this.files = [];                
    this.isSending = false;         
    this.shouldStop = false;        
    
    // קבועים - למחוק את השורה הזו
    this.API_CONFIG = API_CONFIG;  // למחוק את השורה הזו
    this.whatsAppAPI = new WhatsAppAPI(this.API_CONFIG);  // למחוק את השורה הזו

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
            console.log('Starting to load groups from Google Sheets...');
            const response = await fetch(
                `https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.sheetId}/gviz/tq?tqx=out:json&sheet=${SHEETS_CONFIG.tabName}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/);
            
            if (!jsonMatch) {
                throw new Error('Failed to parse Google Sheets response');
            }

            const json = JSON.parse(jsonMatch[1]);
            const groups = [];

            json.table.rows.forEach((row, index) => {
                const cells = row.c || [];
                const nameCell = cells[1]; // Column B
                const idCell = cells[3];   // Column D

                if (nameCell && nameCell.v) {
                    const name = nameCell.v.trim();
                    let id = null;

                    if (idCell) {
                        id = idCell.v || idCell.f;
                        if (id) {
                            id = id.toString().trim();
                            // וידוא שה-ID תקין
                            if (window.whatsappAPI.validateGroupId(id)) {
                                console.log(`Loading group: ${name} with ID: ${id}`);
                                groups.push({ name, id });
                            } else {
                                console.warn(`Invalid group ID format for group '${name}': ${id}`);
                            }
                        }
                    }
                }
            });

            // מיון קבוצות לפי שם
            this.groups = groups.sort((a, b) => a.name.localeCompare(b.name));
            console.log(`Successfully loaded ${this.groups.length} groups`);

            // רינדור הקבוצות
            this.renderFilteredGroups(this.groups);

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
        if (!container) return;

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
    // טיפול בבחירת קבצים
   handleFileSelect(event) {
       const maxFiles = 10;
       const maxFileSize = 16 * 1024 * 1024; // 16MB
       const newFiles = Array.from(event.target.files);
       
       // בדיקת מספר קבצים
       if (this.files.length + newFiles.length > maxFiles) {
           alert(`ניתן להעלות עד ${maxFiles} קבצים`);
           return;
       }

       // בדיקת גודל קבצים
       for (const file of newFiles) {
           if (file.size > maxFileSize) {
               alert(`הקובץ ${file.name} גדול מדי. הגודל המקסימלי המותר הוא 16MB`);
               return;
           }
       }

       this.files = this.files.concat(newFiles);
       this.renderFilesPreviews();
       this.validateForm();
   }

   // הצגת תצוגה מקדימה של קבצים
   renderFilesPreviews() {
       const container = document.getElementById('image-preview');
       if (!container) return;

       container.innerHTML = this.files.map((file, index) => `
           <div class="file-preview">
               ${file.type.startsWith('image/') 
                   ? `<img src="${URL.createObjectURL(file)}" alt="${file.name}" class="preview-image">`
                   : `<div class="file-icon">📁 ${file.name}</div>`
               }
               <div class="remove-file" onclick="messageManager.removeFile(${index})">×</div>
           </div>
       `).join('');
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
       if (!messageInput) return;

       const message = messageInput.value.trim();
       const totalGroups = this.selectedGroups.size;
       let sent = 0;
       let errors = 0;

       this.isSending = true;
       this.shouldStop = false;
       this.updateUI(true);

       try {
           for (const groupIndex of this.selectedGroups) {
               if (this.shouldStop) break;

               const group = this.groups[groupIndex];
               console.log(`Preparing to send to group: ${group.name} (${group.id})`);

               try {
                   // שליחת הודעת טקסט
                   await window.whatsappAPI.sendMessage(group.id, message);
                   console.log(`Successfully sent message to ${group.name}`);

                   // שליחת קבצים אם יש
                   if (this.files.length > 0) {
                       for (const file of this.files) {
                           const fileUrl = URL.createObjectURL(file);
                           await window.whatsappAPI.sendFile(group.id, '', fileUrl, file.name);
                           URL.revokeObjectURL(fileUrl);
                           console.log(`Successfully sent file ${file.name} to ${group.name}`);
                       }
                   }

                   sent++;
                   this.updateProgress(sent, totalGroups);

                   // המתנה בין הודעות
                   if (!this.shouldStop && sent < totalGroups) {
                       await new Promise(resolve => setTimeout(resolve, API_CONFIG.messageDelay));
                   }
               } catch (error) {
                   console.error(`Error sending to group ${group.name}:`, error);
                   errors++;
               }
           }
       } finally {
           this.isSending = false;
           this.updateUI(false);
           
           if (this.shouldStop) {
               alert('השליחה הופסקה');
           } else {
               const summary = `השליחה הושלמה!\n` +
                             `נשלח בהצלחה: ${sent} קבוצות\n` +
                             `שגיאות: ${errors} קבוצות`;
               alert(summary);
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
           sendButton.textContent = isSending ? 'שולח...' : 'שלח הודעה';
       }

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
       
       if (!messageInput || !sendButton) return false;

       const isValid = messageInput.value.trim().length > 0 && this.selectedGroups.size > 0;
       sendButton.disabled = !isValid;
       return isValid;
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
       console.log('Stopping sending process...');
   }
}

// יצירת אובייקט המנהל והתחלת האפליקציה
const messageManager = new MessageManager();
