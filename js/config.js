const API_CONFIG = {
    instanceId: '7103962196',
    token: '64e3bf31b17246f1957f8935b45f7fb5dc5517ee029d41fbae',
    baseUrl: 'https://7103.api.greenapi.com/waInstance',
    
    endpoints: {
        sendMessage: 'sendMessage',
        sendFile: 'sendFileByUrl',
        sendVideo: 'sendFileByUpload'
    },

    // זמן המתנה בין הודעות (10 שניות)
    messageDelay: 10000
};

// הגדרות Google Sheets
const SHEETS_CONFIG = {
    sheetId: '10IkkOpeD_VoDpqMN23QFxGyuW0_p0TZx4NpWNcMN-Ss',
    tabName: 'קבוצות להודעות'
};
