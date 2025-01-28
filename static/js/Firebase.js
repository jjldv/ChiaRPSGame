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

            this.setupForegroundMessaging();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
        }
    }
    setupForegroundMessaging() {
        // Importar onMessage de firebase/messaging
        import('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging.js')
            .then(({ onMessage }) => {
                onMessage(this.messaging, (payload) => {
                    console.log('Received foreground message:', payload);
                    
                    if (Notification.permission === 'granted') {
                        const url = payload.fcmOptions?.link || payload.data?.click_action || payload.data?.url || '';
                        
                        const notification = new Notification(payload.notification.title, {
                            body: payload.notification.body,
                            icon: '/static/images/OpenGameThumbnail.jpg',
                            data: {
                                ...payload.data,
                                url: url
                            },
                            tag: 'notification-' + Date.now(),
                            requireInteraction: false
                        });
    
                        notification.onclick = () => {
                            notification.close();
                            
                            if (url) {
                                try {
                                    const newWindow = window.open(url, '_blank');
                                    if (newWindow === null) {
                                        window.location.href = url;
                                    }
                                } catch (error) {
                                    console.error('Error opening URL:', error);
                                    window.location.href = url;
                                }
                            }
                        };
                    }
                });
            })
            .catch(error => {
                console.error('Error setting up foreground messaging:', error);
            });
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