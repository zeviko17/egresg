class WhatsAppAPI {
    constructor(config) {
        this.config = config;
    }

    // פונקציה לשליחת הודעת טקסט
    async sendMessage(groupId, message) {
        // כתובת URL לשליחת הודעת טקסט
        const url = 'https://7103.api.greenapi.com/waInstance7103962196/sendMessage/64e3bf31b17246f1957f8935b45f7fb5dc5517ee029d41fbae';

        const payload = {
            chatId: groupId,
            message: message
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // פונקציה לשליחת קובץ עם כיתוב
    async sendFile(groupId, message, fileUrl, fileName) {
        // כתובת URL לשליחת קובץ
        const url = 'https://7103.api.greenapi.com/waInstance7103962196/sendFileByUrl/64e3bf31b17246f1957f8935b45f7fb5dc5517ee029d41fbae';

        const payload = {
            chatId: groupId,
            urlFile: fileUrl,
            fileName: fileName,
            caption: message
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error sending file:', error);
            throw error;
        }
    }
}

// יצוא המחלקה לשימוש בקבצים אחרים
export default WhatsAppAPI;
