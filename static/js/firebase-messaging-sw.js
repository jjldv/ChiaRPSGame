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
    const { title, body } = payload.notification;
    const notificationOptions = {
        body,
        icon: '/static/images/OpenGameThumbnail.jpg', 
        data: payload.data
    };

    self.registration.showNotification(title, notificationOptions);
});