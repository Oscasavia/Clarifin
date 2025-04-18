// // utils/notificationScheduler.ts
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Notifications from 'expo-notifications';
// import { Alert } from 'react-native';
// import { CurrencyCode, useCurrency } from '../context/CurrencyContext'; // Assuming path is correct
// import { formatCurrency } from './formatting'; // Assuming path is correct

// // --- Type Definition for Intervals ---
// export type SpendInterval = 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';
// export const SPEND_INTERVAL_OPTIONS: SpendInterval[] = ['weekly', 'monthly', 'quarterly', 'biannually', 'yearly'];

// // --- Interfaces ---
// export interface RecurringBillItem {
//     id: string;
//     name: string;
//     amount: number;
//     startDate: string; // ISO Date string 'YYYY-MM-DD'
//     interval: SpendInterval;
//     // Optional: Store currency with the bill if needed, otherwise pass during scheduling
//     // currencyCode?: CurrencyCode;
// }

// // --- AsyncStorage Keys ---
// export const ASYNC_KEY_RECURRING_BILLS = 'recurringBills';
// // --- Key for notification mappings ---
// export const ASYNC_KEY_NOTIFICATION_MAPPINGS = '@notification_mappings_v1';
// // --- Keys for Reading Settings ---
// export const ASYNC_KEY_REMINDERS_ENABLED = '@settings_reminders_enabled_v1';
// export const ASYNC_KEY_REMINDER_DAYS_BEFORE = '@settings_reminders_days_before_v1';
// // --- End Keys ---


// // --- Helper Functions ---
// export const parseISODate = (dateString: string): Date | null => {
//     try {
//         const datePart = dateString?.split('T')[0];
//          if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
//              console.warn("Invalid date format for parsing:", dateString);
//              return null;
//          }
//          // Use UTC constructor to avoid timezone issues during parsing
//          const date = new Date(Date.UTC(
//              parseInt(datePart.substring(0, 4), 10),
//              parseInt(datePart.substring(5, 7), 10) - 1, // Month is 0-indexed
//              parseInt(datePart.substring(8, 10), 10)
//          ));
//          if (isNaN(date.getTime())) {
//              console.warn("Invalid date parsed:", dateString);
//              return null;
//          }
//          return date;
//      } catch (e) {
//          console.error("Error parsing date:", dateString, e);
//          return null;
//      }
// };

// export const getNextOccurrence = (currentUTC: Date, interval: SpendInterval): Date => {
//     // Create a new Date object to avoid modifying the original
//     const next = new Date(currentUTC.getTime());
//     switch (interval) {
//         case 'weekly': next.setUTCDate(next.getUTCDate() + 7); break;
//         case 'monthly': next.setUTCMonth(next.getUTCMonth() + 1); break;
//         case 'quarterly': next.setUTCMonth(next.getUTCMonth() + 3); break;
//         case 'biannually': next.setUTCMonth(next.getUTCMonth() + 6); break;
//         case 'yearly': next.setUTCFullYear(next.getUTCFullYear() + 1); break;
//         default:
//             console.warn("Unknown interval in getNextOccurrence:", interval);
//             // Default to monthly to avoid infinite loops if interval is invalid
//             next.setUTCMonth(next.getUTCMonth() + 1);
//             break;
//     }
//     return next;
// };
// // --- End Date Helper Functions ---


// // --- Notification ID Management Helpers ---
// export type NotificationMapping = Record<string, string>;

// export const getStoredNotificationMappings = async (): Promise<NotificationMapping> => {
//     try {
//         const mappingsJson = await AsyncStorage.getItem(ASYNC_KEY_NOTIFICATION_MAPPINGS);
//         return mappingsJson ? JSON.parse(mappingsJson) : {};
//     } catch (e) { console.error("Error getting notification mappings:", e); return {}; }
// };

// export const getStoredNotificationId = async (billId: string): Promise<string | null> => {
//     try {
//         const mappings = await getStoredNotificationMappings();
//         return mappings[billId] || null;
//     } catch (e) {
//         console.error("Error getting stored notification ID:", e);
//         return null;
//     }
// };

// export const storeNotificationId = async (billId: string, notificationId: string): Promise<void> => {
//      try {
//          const mappings = await getStoredNotificationMappings();
//          mappings[billId] = notificationId;
//          await AsyncStorage.setItem(ASYNC_KEY_NOTIFICATION_MAPPINGS, JSON.stringify(mappings));
//          console.log(`Stored notification mapping: ${billId} -> ${notificationId}`);
//      } catch (e) {
//          console.error("Error storing notification ID:", e);
//      }
// };

// export const removeStoredNotificationId = async (billId: string): Promise<void> => {
//      try {
//          const mappings = await getStoredNotificationMappings();
//          if (mappings[billId]) {
//              delete mappings[billId];
//              await AsyncStorage.setItem(ASYNC_KEY_NOTIFICATION_MAPPINGS, JSON.stringify(mappings));
//              console.log(`Removed notification mapping for bill: ${billId}`);
//          }
//      } catch (e) {
//          console.error("Error removing stored notification ID:", e);
//      }
// };

// export const clearStoredNotificationMappings = async (): Promise<void> => {
//     try { await AsyncStorage.removeItem(ASYNC_KEY_NOTIFICATION_MAPPINGS); }
//     catch (e) { console.error("Error clearing notification mappings:", e); }
// };
// // --- End Notification ID Helpers ---


// // --- Notification Cancellation Helper ---
// export const cancelNotificationForBill = async (billId: string): Promise<void> => {
//     const notificationId = await getStoredNotificationId(billId);
//     if (notificationId) {
//         try {
//             await Notifications.cancelScheduledNotificationAsync(notificationId);
//             console.log(`Cancelled reminder for bill ${billId} (Notification ID: ${notificationId})`);
//             await removeStoredNotificationId(billId); // Clean up mapping
//         } catch (e) {
//             console.warn(`Could not cancel notification ${notificationId} for bill ${billId}:`, e);
//             // Still attempt to remove mapping even if cancel fails
//             await removeStoredNotificationId(billId);
//         }
//     } else {
//          console.log(`No stored notification ID found for bill ${billId} to cancel.`);
//     }
// };


// // --- Notification Scheduling Helper (Modified for Rescheduling) ---
// /**
//  * Schedules the *next* upcoming reminder for a recurring bill.
//  * If scheduleAfterDate is provided, it finds the first occurrence strictly *after* that date.
//  * If a notification already exists for this bill, it's cancelled first.
//  */
// export const scheduleBillReminder = async (
//     bill: RecurringBillItem,
//     currencyCode: CurrencyCode, // Pass currency explicitly
//     scheduleAfterDate?: Date // Optional: Date after which to schedule the *next* reminder
// ): Promise<void> => {

//     let remindersEnabled = false;
//     let daysBefore = 1;
//     try {
//         const enabledStr = await AsyncStorage.getItem(ASYNC_KEY_REMINDERS_ENABLED);
//         remindersEnabled = enabledStr === 'true';

//         const daysStr = await AsyncStorage.getItem(ASYNC_KEY_REMINDER_DAYS_BEFORE);
//         if (daysStr !== null) {
//             const parsedDays = parseInt(daysStr, 10);
//             if (!isNaN(parsedDays) && parsedDays >= 0) {
//                  daysBefore = parsedDays;
//             }
//         }
//         // TODO: Read reminder time preference if implemented
//     } catch (e) {
//         console.error("Failed to read reminder settings, using defaults.", e);
//     }
//     const REMINDER_HOUR = 9; // TODO: Replace with stored preference (UTC hour)
//     const REMINDER_MINUTE = 0; // TODO: Replace with stored preference

//     if (!remindersEnabled) {
//         console.log(`Reminders are disabled, skipping schedule for ${bill.name}.`);
//         // Ensure any *existing* reminder is cancelled if user disables the feature
//         await cancelNotificationForBill(bill.id); // Use the dedicated cancel function
//         return;
//     }

//     const startDate = parseISODate(bill.startDate);
//     if (!startDate) {
//         console.error(`Cannot schedule reminder for ${bill.name}, invalid start date.`);
//         return;
//     }

//     // --- Calculate next occurrence and trigger date (using 'daysBefore' and 'scheduleAfterDate') ---
//     let nextOccurrenceUTC = new Date(startDate.getTime()); // Start from the bill's start date

//     // Determine the reference date for finding the next occurrence
//     // If scheduleAfterDate is given (rescheduling), use it. Otherwise, use today.
//     const referenceDateUTC = scheduleAfterDate ? new Date(scheduleAfterDate.getTime()) : new Date();
//     referenceDateUTC.setUTCHours(0, 0, 0, 0); // Use UTC start of the reference day

//     // Find the first occurrence that is strictly AFTER the reference date
//     while (nextOccurrenceUTC <= referenceDateUTC) {
//         const nextTry = getNextOccurrence(nextOccurrenceUTC, bill.interval);
//         // Safety break: If interval calculation doesn't advance the date, stop
//         if (nextTry <= nextOccurrenceUTC) {
//             console.error(`Stuck calculating next occurrence for bill ${bill.id}. Interval: ${bill.interval}, Current Date: ${nextOccurrenceUTC.toISOString()}`);
//             return;
//         }
//         nextOccurrenceUTC = nextTry;
//     }

//     // Now nextOccurrenceUTC holds the date of the next occurrence *after* the reference date

//     const reminderTriggerUTC = new Date(nextOccurrenceUTC.getTime());
//     reminderTriggerUTC.setUTCDate(reminderTriggerUTC.getUTCDate() - daysBefore);
//     reminderTriggerUTC.setUTCHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0); // Set reminder time in UTC
//     const triggerDate = new Date(reminderTriggerUTC.getTime()); // This is the absolute time instance

//     // Check if the calculated trigger time is in the past (could happen with short intervals/long daysBefore)
//      if (triggerDate <= new Date()) {
//         console.log(`Calculated reminder date for ${bill.name} (${triggerDate.toISOString()}) is in the past relative to now. Skipping scheduling this occurrence.`);
//         // Cancel any existing notification just in case state is inconsistent
//         await cancelNotificationForBill(bill.id);
//         return;
//     }

//     const notificationContent = {
//         title: 'Upcoming Bill Reminder', // Keep titles concise
//         body: `Reminder: "${bill.name}" (${formatCurrency(bill.amount, currencyCode)}) due around ${nextOccurrenceUTC.toLocaleDateString()}.`, // Using device locale for display date
//         data: {
//             billId: bill.id,
//             screen: 'SpendTracker', // For potential navigation
//             currencyCode: currencyCode, // Include currency for rescheduling
//             // Optional: Store the occurrence date if needed elsewhere
//             // occurrenceDateISO: nextOccurrenceUTC.toISOString()
//         },
//         sound: 'default', // Or use a custom sound file
//     };

//     try {
//         // --- Cancel existing notification FIRST ---
//         const existingNotificationId = await getStoredNotificationId(bill.id);
//         if (existingNotificationId) {
//             try {
//                 await Notifications.cancelScheduledNotificationAsync(existingNotificationId);
//                 console.log(`Cancelled existing reminder for ${bill.name} (ID: ${existingNotificationId}) before rescheduling.`);
//                 // No need to remove mapping here, storeNotificationId below will overwrite it
//             } catch(e) {
//                 console.warn(`Could not cancel previous notification ${existingNotificationId}:`, e);
//             }
//         }
//         // -----------------------------------------

//         const notificationId = await Notifications.scheduleNotificationAsync({
//             content: notificationContent,
//             trigger: triggerDate, // Use the Date object directly
//         });
//         console.log(`Scheduled reminder for ${bill.name} (ID: ${notificationId}) to trigger at ${triggerDate.toISOString()} (UTC) / ${triggerDate.toString()} (local)`);

//         // --- Store the new notificationId ---
//         await storeNotificationId(bill.id, notificationId);
//         // ------------------------------------

//     } catch (error) {
//         console.error(`Failed to schedule notification for ${bill.name}:`, error);
//         Alert.alert('Scheduling Error', `Could not schedule reminder for ${bill.name}.`);
//     }
// };