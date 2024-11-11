class WhatsAppAPI {
    constructor(config) {
        this.config = config;
    }

    async sendMessage(groupId, message) {
        const url = `${this.config.baseUrl}${this.config.instanceId}/${this.config.endpoints.sendMessage}/${this.config.token}`;
        
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

    async sendFile(groupId, message, fileUrl, fileName) {
        const url = `${this.config.baseUrl}${this.config.instanceId}/${this.config.endpoints.sendFile}/${this.config.token}`;
        
        const payload = {
            chatId: groupId,
            caption: message,
            urlFile: fileUrl,
            fileName: fileName
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
