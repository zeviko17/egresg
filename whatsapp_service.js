// CONFIG
const API_CONFIG = {
   instanceId: '7103962196',
   token: '64e3bf31b17246f1957f8935b45f7fb5dc5517ee029d41fbae',
   baseUrl: 'https://7103.api.greenapi.com/waInstance/',
   
   endpoints: {
       sendMessage: 'sendMessage',
       sendFile: 'sendFileByUrl',
       sendVideo: 'sendFileByUpload'
   },
   messageDelay: 10000
};

// WhatsApp API Class
class WhatsAppAPI {
   constructor(config) {
       this.config = config;
   }

   async testConnection() {
       try {
           console.log('Testing WhatsApp connection...');
           const testChatId = '120363291001444894@g.us';
           const testMessage = 'בדיקת חיבור';
           await this.sendMessage(testChatId, testMessage);
           console.log('Connection test successful!');
           return true;
       } catch (error) {
           console.error('Connection test failed:', error);
           return false;
       }
   }

   async sendMessage(groupId, message) {
       const url = `${this.config.baseUrl}${this.config.instanceId}/${this.config.endpoints.sendMessage}/${this.config.token}`;
       
       const payload = {
           chatId: groupId.includes('@') ? groupId : `${groupId}@g.us`,
           message: message
       };

       try {
           console.log('Sending message to:', groupId, 'with payload:', payload);
           const response = await fetch(url, {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json'
               },
              mode: 'no-cors',
               body: JSON.stringify(payload)
           });

           if (!response.ok) {
               throw new Error(`HTTP error! status: ${response.status}`);
           }

           console.log('Message sent successfully');
           return true;

       } catch (error) {
           console.error('Error sending message:', error);
           throw error;
       }
   }

   async sendFile(groupId, message, fileUrl, fileName) {
       const url = `${this.config.baseUrl}${this.config.instanceId}/${this.config.endpoints.sendFile}/${this.config.token}`;
       
       const chatId = groupId.includes('@') ? groupId : `${groupId}@g.us`;
       
       const payload = {
           chatId: chatId,
           urlFile: fileUrl,
           fileName: fileName,
           caption: message
       };

       try {
           console.log('Sending file to:', groupId, 'with payload:', payload);
           const response = await fetch(url, {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json'
               },
              mode: 'no-cors',
               body: JSON.stringify(payload)
           });

           if (!response.ok) {
               throw new Error(`HTTP error! status: ${response.status}`);
           }

           console.log('File sent successfully');
           return true;

       } catch (error) {
           console.error('Error sending file:', error);
           throw error;
       }
   }

   async sendTextMessage(chatId, messageText) {
       const sendMessageUrl = `${API_CONFIG.baseUrl}${API_CONFIG.instanceId}/${API_CONFIG.endpoints.sendMessage}/${API_CONFIG.token}`;

       const payload = {
           chatId: chatId,
           message: messageText
       };

       try {
           console.log('Sending message to:', chatId);
           const response = await fetch(sendMessageUrl, {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json'
               },
               body: JSON.stringify(payload)
           });

           if (!response.ok) {
               throw new Error(`HTTP error! status: ${response.status}`);
           }

           const data = await response.json();
           console.log('Response:', data);
           return data;

       } catch (error) {
           console.error('Error sending message:', error);
           throw error;
       }
   }

   // עזרה בפורמט של מזהה קבוצה
   validateGroupId(groupId) {
       if (!groupId) return false;
       
       // אם זה כבר בפורמט מלא
       if (groupId.includes('@')) {
           return groupId;
       }

       // בדיקה אם זה ID של קבוצה
       if (groupId.startsWith('1203')) {
           return `${groupId}@g.us`;
       }

       // בדיקה אם זה מספר טלפון
       if (groupId.startsWith('972')) {
           return `${groupId}@s.whatsapp.net`;
       }

       return false;
   }

   // ניהול שגיאות
   handleError(error, context) {
       const errorMessage = {
           error: true,
           context: context,
           message: error.message,
           timestamp: new Date().toISOString()
       };

       console.error('WhatsApp API Error:', errorMessage);
       return errorMessage;
   }
}

// יצירת instance של ה-API
const whatsappAPI = new WhatsAppAPI(API_CONFIG);

// בדיקת חיבור בטעינה
document.addEventListener('DOMContentLoaded', async () => {
   try {
       await whatsappAPI.testConnection();
   } catch (error) {
       console.error('Initial connection test failed:', error);
   }
});

// ייצוא ה-API לשימוש בקבצים אחרים
window.whatsappAPI = whatsappAPI;
