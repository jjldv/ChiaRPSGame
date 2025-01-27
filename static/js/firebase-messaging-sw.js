// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBm8-ZK3nY_WhWGol7Cierr6z0qxl7wmeg",
    authDomain: "rpsgame-82b72.firebaseapp.com",
    projectId: "rpsgame-82b72",
    storageBucket: "rpsgame-82b72.firebasestorage.app",
    messagingSenderId: "492521464626",
    appId: "1:492521464626:web:6919d4d7674a08895fad2b",
    measurementId: "G-VH6XHXP92K"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/static/images/OpenGameThumbnail.jpg',
        data: {
            ...payload.data,
            url: payload.fcmOptions?.link || payload.data?.click_action || ''
        },
        tag: 'notification-' + Date.now(), 
        requireInteraction: false 
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
    console.log('Notification click:', event);
    
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({type: 'window'}).then(windowClients => {
            // Revisar si ya hay una ventana abierta y usarla
            for (let client of windowClients) {
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    return client.navigate(url).then(client => client.focus());
                }
            }
            return clients.openWindow(url);
        })
    );
});