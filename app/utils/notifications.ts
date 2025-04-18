// utils/notifications.ts or App.tsx
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';

// Standard notification handler setup (important for foreground notifications)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, // You can customize sound
    shouldSetBadge: false, // You can customize badge count
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Permission Required', 'Failed to get permission for notifications. Please enable them in your device settings to receive reminders.');
    return;
  }

  // Note: Getting the ExpoPushToken is for *Push* Notifications, not strictly needed
  // for *local* scheduled notifications, but often done in the same flow.
  // If you ONLY need local, you can technically skip the getToken part.
  try {
      // Use the new V2 token method
      const expoPushToken = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // Use environment variable
      });
      token = expoPushToken.data;
      console.log('Expo Push Token:', token);
  } catch (e) {
      console.error("Failed to get Expo Push Token", e);
       Alert.alert('Error', 'Could not retrieve identifier for notifications.');
  }


  return token; // Or just return undefined/boolean if only checking permission status
}

// --- In your App.tsx ---
// useEffect(() => {
//   registerForPushNotificationsAsync(); // Call on app load
//   // Handle notification interactions (e.g., tapping a notification)
//   const notificationListener = Notifications.addNotificationReceivedListener(notification => {
//     console.log("Notification Received:", notification);
//   });
//   const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
//     console.log("Notification Response:", response);
//     // Handle tap here, e.g., navigate to relevant screen
//   });
//   return () => {
//      Notifications.removeNotificationSubscription(notificationListener);
//      Notifications.removeNotificationSubscription(responseListener);
//   };
// }, []);