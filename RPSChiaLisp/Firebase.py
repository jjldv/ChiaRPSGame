from firebase_admin import messaging, credentials, initialize_app
from typing import Optional, Dict, Union
import json

class Firebase:
    def __init__(self, credentials_path: str):
        """
        Initialize Firebase with service account credentials.
        
        Args:
            credentials_path: Path to the Firebase service account JSON file
        """
        try:
            cred = credentials.Certificate(credentials_path)
            initialize_app(cred)
            self.initialized = True
        except Exception as e:
            print(f"Error initializing Firebase: {str(e)}")
            self.initialized = False

    async def send_notification(
        self,
        token: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
        additional_data: Optional[Dict] = None
    ) -> Dict[str, Union[bool, str]]:
        if not self.initialized:
            return {
                "success": False,
                "message": "Firebase not properly initialized"
            }

        try:
            data = additional_data or {}
            if action_url:
                data['click_action'] = action_url
                data['url'] = action_url 
           
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=message
                ),
                data=data,
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=message,
                        icon='/static/images/OpenGameThumbnail.jpg'
                    ),
                    headers={
                        'Urgency': 'high'
                    },
                    fcm_options=messaging.WebpushFCMOptions(
                        link=action_url if action_url else None
                    )
                ),
                token=token
            )

            response = messaging.send(message)
            print(f"Successfully sent message: {response}")
            
            return {
                "success": True,
                "message": f"Successfully sent message: {response}"
            }

        except Exception as e:
            print(f"Error sending notification: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending notification: {str(e)}"
            }