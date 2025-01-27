class Firebase {
    constructor() {
        this.messaging = null;
        this.initialized = false;
        this.vapidKey = "BGswd_ksMJLjic8gJWyFSgKUqk5ySjNk-CJJK-rKYMckbtEVHKIvuIPsTNqWPM4UyKAezpWgPAycKQNX7WGNxiM";
        this.firebaseConfig = {
            apiKey: "AIzaSyBm8-ZK3nY_WhWGol7Cierr6z0qxl7wmeg",
            authDomain: "rpsgame-82b72.firebaseapp.com",
            projectId: "rpsgame-82b72",
            storageBucket: "rpsgame-82b72.firebasestorage.app",
            messagingSenderId: "492521464626",
            appId: "1:492521464626:web:6919d4d7674a08895fad2b",
            measurementId: "G-VH6XHXP92K"
        };
        this.init();
    }

    async init() {
        try {
            const { initializeApp, getMessaging } = window.firebaseModules;
            const app = initializeApp(this.firebaseConfig);
            this.messaging = getMessaging(app);
            this.initialized = true;
        } catch (error) {
            console.error("Error initializing Firebase:", error);
        }
    }

    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const { getToken } = window.firebaseModules;
                const token = await getToken(this.messaging, {
                    vapidKey: this.vapidKey 
                });
                return token;
            } else {
                throw new Error('Notification permission denied');
            }
        } catch (error) {
            console.error("Error requesting notification permission:", error);
            throw error;
        }
    }
    async checkPermissionStatus() {
        if (!('Notification' in window)) {
            return {
                isEnabled: false,
                reason: 'notifications-not-supported'
            };
        }

        const permission = Notification.permission;
        const { getToken } = window.firebaseModules;
        
        if (permission === 'granted') {
            try {
                const currentToken = await getToken(this.messaging, {
                    vapidKey: this.vapidKey 
                });
                
                return {
                    isEnabled: true,
                    token: currentToken
                };
            } catch (error) {
                console.error('Error getting token:', error);
                return {
                    isEnabled: true,
                    error: 'token-error'
                };
            }
        }

        return {
            isEnabled: false,
            reason: permission
        };
    }

    async refreshToken() {
        try {
            const { getToken } = window.firebaseModules;
            const newToken = await getToken(this.messaging, {
                vapidKey: this.vapidKey 
            });
            return newToken;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw error;
        }
    }
}