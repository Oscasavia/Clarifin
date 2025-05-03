import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Alert, KeyboardAvoidingView, ScrollView, TouchableOpacity, Linking, Switch, ActivityIndicator, Share } from 'react-native'; // Added TouchableOpacity
import AsyncStorage from '@react-native-async-storage/async-storage';
import DropDownPicker from 'react-native-dropdown-picker';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useCurrency, CURRENCIES, CurrencyCode } from '../context/CurrencyContext'; // Adjust path
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';

// --- Import or Define Permission Request Function ---
// Assume registerForPushNotificationsAsync is defined elsewhere (e.g., utils/notifications.ts)
// and handles the permission request flow.
// import { registerForPushNotificationsAsync } from '../utils/notifications';
// --- OR Define a basic one here for demonstration ---
async function registerForPushNotificationsAsync(): Promise<boolean> {
     if (Platform.OS === 'android') {
        // Setup channel (idempotent)
         await Notifications.setNotificationChannelAsync('default', {
             name: 'default', importance: Notifications.AndroidImportance.MAX,
             vibrationPattern: [0, 250, 250, 250], lightColor: '#FF231F7C',
         });
     }
     const { status: existingStatus } = await Notifications.getPermissionsAsync();
     let finalStatus = existingStatus;
     if (existingStatus !== 'granted') {
         Alert.alert(
             "Permission Required",
             "To enable bill reminders, please grant notification permissions.",
             [ { text: "Cancel", style: "cancel" }, {
                 text: "Grant Permission", onPress: async () => {
                     const { status } = await Notifications.requestPermissionsAsync();
                     finalStatus = status; // This won't update the calling scope directly, complex state mgmt needed
                     if (status !== 'granted') {
                         Alert.alert("Permission Denied", "Reminders cannot be enabled without notification permissions. You can enable them later in your device settings.");
                     } else {
                        Alert.alert("Permission Granted", "Reminders can now be enabled.");
                        // Ideally, re-trigger the state update here, or rely on user toggling again
                     }
                 }
             }]
         );
         // Return false as permission wasn't granted *yet* or was denied
         return false;
     }
     if (finalStatus !== 'granted') {
         // User might have dismissed the Alert without granting or denied via settings earlier
         return false;
     }
     return true; // Permission was already granted
}
// --- End Permission Request Function ---

// --- Assume ASYNC_KEYS is defined centrally or define needed keys here ---
const ASYNC_KEYS = {
    dotRangeYears: 'dotRangeYears',
    // --- NEW Reminder Settings Keys ---
    remindersEnabled: '@settings_reminders_enabled_v1',
    reminderDaysBefore: '@settings_reminders_days_before_v1',
    notificationMappings: '@notification_mappings_v1' // Added for cleanup possibility
};
// --- End ASYNC_KEYS ---

// --- Notification ID Helpers (copied for cleanup possibility) ---
type NotificationMapping = Record<string, string>;
const getStoredNotificationMappings = async (): Promise<NotificationMapping> => {
     try {
         const mappingsJson = await AsyncStorage.getItem(ASYNC_KEYS.notificationMappings);
         return mappingsJson ? JSON.parse(mappingsJson) : {};
     } catch (e) { console.error("Error getting notification mappings:", e); return {}; }
};
const clearStoredNotificationMappings = async (): Promise<void> => {
     try { await AsyncStorage.removeItem(ASYNC_KEYS.notificationMappings); }
     catch (e) { console.error("Error clearing notification mappings:", e); }
};
// --- End Notification ID Helpers ---

// --- NEW: App Specific Constants ---
const APP_NAME = "Clarifin"; // <-- Your App Name (used in share message, etc.)
const PLAY_STORE_PACKAGE = 'com.oscasavia.clarifin'; // <-- IMPORTANT: Replace with your actual package name
const PRIVACY_POLICY_URL = 'https://lovely-unicorn-a7167c.netlify.app'; // <-- IMPORTANT: Replace with your Privacy Policy URL
const TERMS_SERVICE_URL = 'https://cerulean-biscotti-582837.netlify.app'; // <-- IMPORTANT: Replace with your Terms of Service URL (optional)
// --- End App Specific Constants ---

const SettingsScreen = () => {
    const { selectedCurrency, changeCurrency } = useCurrency();

    // Currency Picker State
    const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
    const [currencyValue, setCurrencyValue] = useState<CurrencyCode>(selectedCurrency);
    const [currencyItems, setCurrencyItems] = useState(() =>
        CURRENCIES.map(currency => ({
            label: `${currency.name} (${currency.symbol})`,
            value: currency.code,
        }))
    );

    // --- NEW: Get App Version ---
    const appVersion = Application.nativeApplicationVersion;
    const buildVersion = Application.nativeBuildVersion;
    // --- End App Version ---

    // Dot Range Picker State
    const [dotPickerOpen, setDotPickerOpen] = useState(false);
    const [dotRangeValue, setDotRangeValue] = useState<number>(2);
    const [dotPickerItems, setDotPickerItems] = useState([
        { label: 'Current Year Only', value: 0 },
        { label: '1 Year Ahead', value: 1 },
        { label: '2 Years Ahead', value: 2 },
        { label: '5 Years Ahead', value: 5 },
        { label: '10 Years Ahead', value: 10 },
    ]);

    // --- NEW --- State for Help Section Visibility
    const [helpVisible, setHelpVisible] = useState(false);

    // --- NEW Reminder State ---
    const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true); // Combined loading state
    const [remindersEnabled, setRemindersEnabled] = useState<boolean>(false);
    const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(1); // Default days
    const [reminderDaysPickerOpen, setReminderDaysPickerOpen] = useState<boolean>(false);
    const reminderDaysItems = [
        { label: '1 Day Before', value: 1 },
        { label: '2 Days Before', value: 2 },
        { label: '3 Days Before', value: 3 },
        { label: '5 Days Before', value: 5 },
        { label: '7 Days Before', value: 7 },
    ];
    // --- End Reminder State ---

    // --- PAYPAL DONATION LINK ---
    // V V V --- REPLACE THIS WITH YOUR ACTUAL PAYPAL.ME LINK --- V V V
    const donationUrl = "https://paypal.me/oscasavia"; // <--- IMPORTANT!
    // ^ ^ ^ --- REPLACE THIS WITH YOUR ACTUAL PAYPAL.ME LINK --- ^ ^ ^

    // --- NEW: CONTACT EMAIL ---
    // V V V --- REPLACE THIS WITH YOUR ACTUAL SUPPORT EMAIL --- V V V
    const contactEmail = "oscasavia@gmail.com"; // <--- IMPORTANT!
    // ^ ^ ^ --- REPLACE THIS WITH YOUR ACTUAL SUPPORT EMAIL --- ^ ^ ^

    // Effect to sync local currency value with context and load dot range
    // --- Load All Settings ---
    useEffect(() => {
        const loadAllSettings = async () => {
            setIsLoadingSettings(true);
            try {
                // Dot Range
                const storedDotRange = await AsyncStorage.getItem(ASYNC_KEYS.dotRangeYears);
                if (storedDotRange !== null) { /* ... load dot range logic ... */ }
                else { await AsyncStorage.setItem(ASYNC_KEYS.dotRangeYears, '2'); setDotRangeValue(2); }

                // Reminders Enabled
                const storedRemindersEnabled = await AsyncStorage.getItem(ASYNC_KEYS.remindersEnabled);
                setRemindersEnabled(storedRemindersEnabled === 'true'); // Convert string to boolean

                // Reminder Days Before
                const storedReminderDays = await AsyncStorage.getItem(ASYNC_KEYS.reminderDaysBefore);
                if (storedReminderDays !== null) {
                    const days = parseInt(storedReminderDays, 10);
                    if (!isNaN(days) && reminderDaysItems.some(item => item.value === days)) {
                        setReminderDaysBefore(days);
                    } else { setReminderDaysBefore(1); } // Default if invalid
                } else { setReminderDaysBefore(1); } // Default if not set

            } catch (error) {
                console.error("Failed to load settings:", error);
                Alert.alert("Error", "Could not load some settings.");
                // Set safe defaults
                setDotRangeValue(2);
                setRemindersEnabled(false);
                setReminderDaysBefore(1);
            } finally {
                setIsLoadingSettings(false);
            }
        };

        setCurrencyValue(selectedCurrency); // Sync currency from context
        loadAllSettings();
    }, [selectedCurrency]);

    // Callback for changing dot range
    const updateDotRange = useCallback(async (value: number | null) => {
        if (value === null) return;
        try {
            setDotRangeValue(value);
            await AsyncStorage.setItem(ASYNC_KEYS.dotRangeYears, value.toString());
         } catch (error) {
             console.error("Failed to save dot range setting:", error);
             Alert.alert("Error", "Could not save calendar range setting.");
         }
    }, []);

    // Callback for changing currency
    const handleCurrencyChange = useCallback((value: CurrencyCode | null) => {
         if (value) {
            setCurrencyValue(value);
            changeCurrency(value);
         }
    }, [changeCurrency]);

    // --- NEW Reminder Handlers ---
    const handleRemindersEnabledChange = useCallback(async (isEnabled: boolean) => {
        setRemindersEnabled(isEnabled); // Update UI immediately
        try {
            await AsyncStorage.setItem(ASYNC_KEYS.remindersEnabled, isEnabled.toString());
            if (isEnabled) {
                // Request permissions only if enabling
                const permissionGranted = await registerForPushNotificationsAsync();
                if (!permissionGranted) {
                    // Permission denied or user cancelled prompt, revert the switch state
                    setRemindersEnabled(false);
                    await AsyncStorage.setItem(ASYNC_KEYS.remindersEnabled, 'false');
                    // Alert handled within register function
                }
            } else {
                // --- Optional: Cancel all scheduled notifications when disabled ---
                console.log("Reminders disabled. Cancelling all scheduled notifications...");
                try {
                    // Method 1: Cancel all app's notifications (simpler but broader)
                    // await Notifications.cancelAllScheduledNotificationsAsync();

                    // Method 2: Cancel only known bill reminders (more precise)
                    const mappings = await getStoredNotificationMappings();
                    const promises = Object.values(mappings).map(notifId =>
                         Notifications.cancelScheduledNotificationAsync(notifId).catch(e => console.warn(`Failed to cancel ${notifId}`, e)) // Catch individual errors
                    );
                    await Promise.all(promises);
                    await clearStoredNotificationMappings(); // Clear our tracking data
                    console.log("Cancelled known scheduled reminders and cleared mappings.");

                } catch(e) {
                     console.error("Error cancelling notifications on disable:", e);
                }
                // ---------------------------------------------------------------
            }
        } catch (error) {
            console.error("Failed to save reminder enabled state:", error);
            Alert.alert("Error", "Could not save reminder preference.");
            setRemindersEnabled(!isEnabled); // Revert UI on save error
        }
    }, []);

    const handleReminderDaysChange = useCallback(async (value: number | null) => {
        if (value === null || isNaN(value)) return;
        setReminderDaysBefore(value); // Update UI
        try {
            await AsyncStorage.setItem(ASYNC_KEYS.reminderDaysBefore, value.toString());
        } catch (error) {
            console.error("Failed to save reminder days preference:", error);
            Alert.alert("Error", "Could not save reminder days preference.");
            // Optional: Revert state if needed
        }
    }, []);
    // --- End Reminder Handlers ---

    // Close other picker when one opens
     const onCurrencyOpen = useCallback(() => {
        setDotPickerOpen(false);
    }, []);

    const onDotRangeOpen = useCallback(() => {
         setCurrencyPickerOpen(false);
    }, []);

    const onReminderDaysOpen = useCallback(() => { setCurrencyPickerOpen(false); setDotPickerOpen(false); }, []);

    // --- Handler for Donate Button ---
    const handleDonatePress = useCallback(async (): Promise<void> => {
        // Check if the link can be opened
        const supported: boolean = await Linking.canOpenURL(donationUrl);

        if (supported) {
            try {
                 // Open the link
                await Linking.openURL(donationUrl);
            } catch (err) {
                 Alert.alert('Error', 'Could not open the donation link.');
                 console.error("Failed to open donation URL:", err);
            }
        } else {
            Alert.alert('Error', `Cannot open this URL: ${donationUrl}`);
        }
    }, [donationUrl]); // Dependency on donationUrl (though it's constant here)

    // --- NEW: Handler for Contact Button ---
    const handleContactPress = useCallback(async (): Promise<void> => {
        // --- Customize the subject line ---
        const subject = "Feedback/Bug Report for Clarifin"; // <--- IMPORTANT: Replace [Your App Name]
        const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`;

        // Check if the link can be opened
        const supported: boolean = await Linking.canOpenURL(mailtoUrl);

        if (supported) {
            try {
                // Open the link
                await Linking.openURL(mailtoUrl);
            } catch (err) {
                Alert.alert('Error', 'Could not open your email client.');
                console.error("Failed to open mailto URL:", err);
            }
        } else {
            // Handle cases where mailto links aren't supported (rare on mobile)
            Alert.alert('Error', `It looks like your device doesn't have an email app configured.\n\nPlease send your feedback to: ${contactEmail}`);
            // Alternative: Show the email address for manual copying
            // Alert.alert('Contact Us', `Please send your feedback to: ${contactEmail}`);
        }
    }, [contactEmail]); // Dependency on contactEmail

    // --- NEW: Generic Link Opener ---
    const openLink = useCallback(async (url: string): Promise<void> => {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            try {
                await Linking.openURL(url);
            } catch (err) {
                Alert.alert('Error', 'Could not open the link.');
                console.error("Failed to open URL:", err);
            }
        } else {
            Alert.alert('Error', `Cannot open this URL: ${url}`);
        }
    }, []);

    // --- NEW: Handler for Rate App --- (Android Only)
    const handleRateApp = useCallback(async (): Promise<void> => {
        const url = `market://details?id=${PLAY_STORE_PACKAGE}`;
        // Note: `Linking.canOpenURL` might return false for `market://` on some emulators/devices without Play Store.
        // It's generally safe to attempt opening directly on release builds for Android.
        try {
            await Linking.openURL(url);
        } catch (err) {
            // Fallback to web URL if market link fails
            const webUrl = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;
            const supportedWeb = await Linking.canOpenURL(webUrl);
            if(supportedWeb) {
                await Linking.openURL(webUrl);
            } else {
                Alert.alert('Error', 'Could not open the Play Store link.');
                console.error("Failed to open Play Store URL:", err);
            }
        }
    }, []); // No dependency needed if PLAY_STORE_PACKAGE is constant

    // --- NEW: Handler for Share App --- (Android Only)
    const handleShareApp = useCallback(async (): Promise<void> => {
        try {
            const playStoreLink = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;
            await Share.share({
                // Title is optional, used in some share targets
                title: `Share ${APP_NAME}`,
                // Message is the main content shared
                message: `Check out ${APP_NAME}, a helpful app for tracking finances!\n${playStoreLink}`,
                // URL is primarily for iOS, but doesn't hurt to include
                url: playStoreLink
            });
        } catch (error: any) {
            Alert.alert('Error', 'Could not share the app at this moment.');
            console.error("Share App Error:", error.message);
        }
    }, []); // No dependency needed if constants are used

    // Show loading indicator while settings load
    if (isLoadingSettings) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loaderText}>Loading Settings...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.keyboardAvoidingContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
            >
                {/* Setting Card 1: Currency */}
                <View style={[styles.settingCard, { zIndex: currencyPickerOpen ? 3000 : 1 }]}>
                    <Text style={styles.label}>Preferred Currency</Text>
                    <DropDownPicker
                        open={currencyPickerOpen}
                        value={currencyValue}
                        items={currencyItems}
                        setOpen={setCurrencyPickerOpen}
                        setValue={setCurrencyValue}
                        setItems={setCurrencyItems}
                        onChangeValue={handleCurrencyChange}
                        onOpen={onCurrencyOpen}
                        style={styles.dropdownStyle}
                        dropDownContainerStyle={styles.dropdownContainer}
                        listMode="SCROLLVIEW"
                        scrollViewProps={{ nestedScrollEnabled: true }}
                        placeholder="Select a currency"
                         searchable={true}
                         searchPlaceholder="Search currency..."
                        zIndex={3000}
                        zIndexInverse={1000}
                    />
                </View>

                {/* Setting Card 2: Dot Range */}
                <View style={[styles.settingCard, { zIndex: dotPickerOpen ? 2000 : 0 }]}>
                    <Text style={styles.label}>Calendar Dot Range (Future Years)</Text>
                    <DropDownPicker
                        open={dotPickerOpen}
                        value={dotRangeValue}
                        items={dotPickerItems}
                        setOpen={setDotPickerOpen}
                        setValue={setDotRangeValue}
                        setItems={setDotPickerItems}
                        onChangeValue={updateDotRange}
                        onOpen={onDotRangeOpen}
                        style={styles.dropdownStyle}
                        dropDownContainerStyle={styles.dropdownContainer}
                        listMode="SCROLLVIEW"
                        scrollViewProps={{ nestedScrollEnabled: true }}
                        placeholder="Select range"
                        zIndex={2000}
                        zIndexInverse={2000}
                    />
                     <Text style={styles.infoText}>
                        How far ahead calendar dots for recurring items are shown.
                    </Text>
                </View>

                {/* --- NEW: Reminder Settings Card ---
                <View style={[styles.settingCard, { zIndex: reminderDaysPickerOpen ? 2000 : 1 }]}>
                     <View style={styles.settingsRow}>
                         <Text style={styles.label}>Enable Bill Reminders</Text>
                         <Switch
                             trackColor={{ false: "#767577", true: "#81b0ff" }}
                             thumbColor={remindersEnabled ? "#4CAF50" : "#f4f3f4"}
                             ios_backgroundColor="#3e3e3e"
                             onValueChange={handleRemindersEnabledChange}
                             value={remindersEnabled}
                         />
                     </View>
                     <View style={styles.horizontalLine} />
                     {remindersEnabled && ( // Only show days picker if reminders are enabled
                         <View style={styles.subSettingContainer}>
                             <Text style={styles.subLabel}>Remind Me:</Text>
                              <DropDownPicker
                                 open={reminderDaysPickerOpen}
                                 value={reminderDaysBefore}
                                 items={reminderDaysItems}
                                 setOpen={setReminderDaysPickerOpen}
                                 setValue={(val) => {
                                    if (val !== null && typeof val === 'number') {
                                      setReminderDaysBefore(val); // update local state
                                      handleReminderDaysChange(val); // trigger persistence side-effect
                                    }
                                  }}
                                 setItems={() => {}} // setItems not needed if list is static
                                 onOpen={onReminderDaysOpen}
                                 // onChangeValue={handleReminderDaysChange} // Use setValue callback above
                                 style={styles.dropdownStyle}
                                 dropDownContainerStyle={styles.dropdownContainer}
                                 placeholder="Select days before"
                                 listMode="SCROLLVIEW" // Keep consistent
                                 zIndex={2000}
                                 zIndexInverse={3000} // Must be lower than Dot Range's zIndexInverse if above it visually
                             />
                         </View>
                    )}
                    <Text style={styles.infoText}>
                        {remindersEnabled
                           ? "Get notifications before recurring bills are due."
                           : "Enable to receive notifications for upcoming bills."}
                    </Text>
                 </View> */}

                {/* --- Donate Card (Using PayPal) --- */}
                <View style={styles.settingCard}>
                    <View style={styles.donateHeader}>
                         <Ionicons name="logo-paypal" size={moderateScale(22)} color="#00457C" style={{ marginRight: moderateScale(8)}} />
                        <Text style={styles.label}>Support the App</Text>
                    </View>
                    <Text style={styles.donateText}>
                        If you find this app helpful, please consider supporting its development with a donation via PayPal. Every little bit helps keep the app running and improving!
                    </Text>
                    <TouchableOpacity style={styles.donateButton} onPress={handleDonatePress}>
                        <Text style={styles.donateButtonText}>Donate with PayPal</Text>
                    </TouchableOpacity>
                </View>
                {/* --- End Donate Card --- */}

                 {/* --- NEW: How to Use Section --- */}
                 <View style={styles.settingCard}>
                     {/* Header Touchable to Toggle Visibility */}
                     <TouchableOpacity
                        style={styles.helpHeader}
                        onPress={() => setHelpVisible(!helpVisible)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.label}>How to Use This App</Text>
                        <Ionicons
                            name={helpVisible ? "chevron-up-outline" : "chevron-down-outline"}
                            size={moderateScale(22)}
                            color="#343a40"
                        />
                    </TouchableOpacity>

                     {/* Collapsible Content */}
                     {helpVisible && (
                        <View style={styles.helpContent}>
                            <Text style={styles.helpTextItem}>
                                <Text style={styles.helpBold}>1. Balance Screen:</Text> Set your starting account balance and the date it applies from. This is crucial for calculations.
                            </Text>
                             <Text style={styles.helpTextItem}>
                                <Text style={styles.helpBold}>2. Receive/Spend Screens:</Text> Add recurring income/bills (e.g., Salary, Rent) and one-time transactions. Define start dates and frequency (weekly, monthly, etc.) for recurring items.
                            </Text>
                             <Text style={styles.helpTextItem}>
                                <Text style={styles.helpBold}>3. Calendar Screen:</Text> Tap any date to see the calculated balance *up to that day*. View specific transactions for the selected date in the modal. Dots indicate transaction activity.
                            </Text>
                             <Text style={styles.helpTextItem}>
                                <Text style={styles.helpBold}>4. Dashboard Screen:</Text> View a summary of your total income, expenses, and net balance for the *current* month, plus a daily activity chart.
                            </Text>
                             <Text style={styles.helpTextItem}>
                                <Text style={styles.helpBold}>5. Settings Screen:</Text> Change currency and calendar dot range here.
                            </Text>
                        </View>
                    )}
                 </View>
                 {/* --- End How to Use Section --- */}
                 {/* --- NEW: Contact & Feedback Section --- */}
                <View style={styles.settingCard}>
                    <View style={styles.contactHeader}>
                        {/* Use an appropriate icon */}
                        <Ionicons name="mail-outline" size={moderateScale(22)} color="#343a40" style={{ marginRight: moderateScale(8)}} />
                        <Text style={styles.label}>Contact & Feedback</Text>
                    </View>
                    <Text style={styles.contactText}>
                        Found an issue/bug, have a suggestion, or need help? Tap the button below to send an email. Your feedback is valuable!
                    </Text>
                    <TouchableOpacity style={styles.contactButton} onPress={handleContactPress}>
                        <Text style={styles.contactButtonText}>Send Feedback Email</Text>
                    </TouchableOpacity>
                </View>
                {/* --- End Contact & Feedback Section --- */}

                {/* --- NEW: Support & Share Card --- */}
                <View style={styles.settingCard}>
                    <Text style={styles.cardHeader}>Support & Share</Text>
                    {/* Rate App Row */}
                    <TouchableOpacity style={styles.settingRow} onPress={handleRateApp} activeOpacity={0.7}>
                        <Ionicons name="star-outline" size={moderateScale(20)} color="#FFC107" style={styles.settingRowIcon} />
                        <Text style={styles.settingRowText}>Rate Clarifin on Play Store</Text>
                        <Ionicons name="chevron-forward-outline" size={moderateScale(18)} color="#6c757d" />
                    </TouchableOpacity>

                    {/* Share App Row */}
                    <TouchableOpacity style={styles.settingRow} onPress={handleShareApp} activeOpacity={0.7}>
                        <Ionicons name="share-social-outline" size={moderateScale(20)} color="#007bff" style={styles.settingRowIcon} />
                        <Text style={styles.settingRowText}>Share App with Friends</Text>
                        <Ionicons name="chevron-forward-outline" size={moderateScale(18)} color="#6c757d" />
                    </TouchableOpacity>
                    {/* You can optionally move the Donate and Contact sections here if you prefer grouping */}
                </View>
                {/* --- End Support & Share Card --- */}
                {/* --- NEW: About This App Card --- */}
            <View style={styles.settingCard}>
                 <Text style={styles.cardHeader}>About This App</Text>
                 {/* App Version Row (Not Touchable) */}
                 <View style={styles.settingRow}>
                    <Ionicons name="information-circle-outline" size={moderateScale(20)} color="#17a2b8" style={styles.settingRowIcon} />
                    <Text style={styles.settingRowText}>Version: {appVersion} (Build {buildVersion})</Text>
                    {/* No chevron needed */}
                 </View>

                 {/* Privacy Policy Row */}
                 <TouchableOpacity style={styles.settingRow} onPress={() => openLink(PRIVACY_POLICY_URL)} activeOpacity={0.7}>
                    <Ionicons name="shield-checkmark-outline" size={moderateScale(20)} color="#6f42c1" style={styles.settingRowIcon} />
                    <Text style={styles.settingRowText}>Privacy Policy</Text>
                    <Ionicons name="chevron-forward-outline" size={moderateScale(18)} color="#6c757d" />
                 </TouchableOpacity>

                 {/* Terms of Service Row (Optional - remove if you don't have one) */}
                 {TERMS_SERVICE_URL && ( // Only show if URL is defined
                    <TouchableOpacity style={styles.settingRow} onPress={() => openLink(TERMS_SERVICE_URL)} activeOpacity={0.7}>
                        <Ionicons name="document-text-outline" size={moderateScale(20)} color="#fd7e14" style={styles.settingRowIcon} />
                        <Text style={styles.settingRowText}>Terms of Service</Text>
                        <Ionicons name="chevron-forward-outline" size={moderateScale(18)} color="#6c757d" />
                    </TouchableOpacity>
                 )}

                 {/* Acknowledgements (Optional) - You can link to a separate screen or URL */}
                 {/* <TouchableOpacity style={styles.settingRow} onPress={() =>} activeOpacity={0.7}>
                    <Ionicons name="library-outline" size={moderateScale(20)} color="#20c997" style={styles.settingRowIcon} />
                    <Text style={styles.settingRowText}>Acknowledgements</Text>
                    <Ionicons name="chevron-forward-outline" size={moderateScale(18)} color="#6c757d" />
                 </TouchableOpacity> */}
            </View>
            {/* --- End About This App Card --- */}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    keyboardAvoidingContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContainer: {
        padding: moderateScale(15),
        paddingBottom: verticalScale(40),
        flexGrow: 1,
    },
    settingCard: {
        backgroundColor: '#ffffff',
        padding: moderateScale(18),
        borderRadius: moderateScale(10),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.08,
        shadowRadius: moderateScale(5),
        elevation: 3,
        marginBottom: verticalScale(20),
    },
    label: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#343a40',
        flex: 1, // Allow label to take space in help header
        marginBottom: 0,
        marginRight: moderateScale(10),
         // Remove marginBottom here, apply to container or header instead
    },
    dropdownStyle: {
        borderColor: '#ced4da',
        backgroundColor: '#ffffff',
        borderRadius: moderateScale(8),
        // Add margin top if label margin bottom is removed
        marginTop: verticalScale(5),
    },
    dropdownContainer: {
        borderColor: '#ced4da',
        backgroundColor: '#ffffff',
        borderRadius: moderateScale(8),
    },
    infoText: {
         fontSize: moderateScale(12),
         color: '#6c757d',
         marginTop: verticalScale(10),
         fontStyle: 'italic',
         textAlign: 'center',
    },
    // --- Donate Card Styles ---
    donateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(10),
    },
    donateText: {
        fontSize: moderateScale(13.5),
        color: '#495057',
        lineHeight: moderateScale(19),
        marginBottom: verticalScale(15),
        textAlign: 'center',
    },
    donateButton: {
        backgroundColor: '#0070BA', // PayPal blue
        paddingVertical: verticalScale(12),
        paddingHorizontal: moderateScale(20),
        borderRadius: moderateScale(8),
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    donateButtonText: {
        color: '#ffffff',
        fontSize: moderateScale(15),
        fontWeight: 'bold',
    },
    // --- NEW Styles for Settings Cards/Rows ---
    cardHeader: { // Style for the titles like "Support & Share", "About This App"
        fontSize: moderateScale(17),
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: verticalScale(15),
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: verticalScale(8),
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: verticalScale(12), // More vertical padding for easier touch
        // Add border if you want separators between rows
        // borderBottomWidth: 1,
        // borderBottomColor: '#f0f0f0',
    },
    settingRowIcon: {
        marginRight: moderateScale(15), // Space between icon and text
    },
    settingRowText: {
        flex: 1, // Allow text to take remaining space
        fontSize: moderateScale(14.5),
        color: '#495057',
    },
    // --- End NEW Styles ---
    // --- NEW Help Section Styles ---
    helpHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(5), // Add margin below header only if content is visible
    },
    helpContent: {
        marginTop: verticalScale(10), // Add space above content when visible
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: verticalScale(10),
    },
    helpTextItem: {
        fontSize: moderateScale(13.5),
        color: '#495057', // Slightly darker than infoText
        marginBottom: verticalScale(10),
        lineHeight: moderateScale(19), // Improve readability
    },
     helpBold: {
        fontWeight: 'bold',
        color: '#343a40', // Match label color
    },
    // --- End Help Section Styles ---
    // --- NEW Contact Section Styles (Add these) ---
    contactHeader: { // Similar structure to donateHeader
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(10),
    },
    contactText: { // Similar style to donateText
        fontSize: moderateScale(13.5),
        color: '#495057',
        lineHeight: moderateScale(19),
        marginBottom: verticalScale(15),
        textAlign: 'center',
    },
    contactButton: { // Similar style to donateButton, adjust color if desired
        backgroundColor: '#6c757d', // Example: Bootstrap secondary/grey color
        // Or use a brand color: backgroundColor: '#4CAF50',
        paddingVertical: verticalScale(12),
        paddingHorizontal: moderateScale(20),
        borderRadius: moderateScale(8),
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    contactButtonText: { // Same as donateButtonText
        color: '#ffffff',
        fontSize: moderateScale(15),
        fontWeight: 'bold',
    },
    // --- End Contact Section Styles ---
    loaderContainer: { // Added loader style
        flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa',
    },
    loaderText: { // Added loader text style
         marginTop: 10, fontSize: moderateScale(16), color: '#666',
    },
    settingsRow: { // Style for rows with label + control (like the Switch)
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(10), // Add some space below the row
    },
    subSettingContainer: { // Container for the days dropdown when enabled
        marginTop: verticalScale(15),
        marginBottom: verticalScale(5),
        // Removed borderTop, rely on spacing
    },
    subLabel: { // Label specific to the sub-setting (days dropdown)
         fontSize: moderateScale(14),
         fontWeight: '500',
         color: '#495057',
         marginBottom: verticalScale(5),
    },
    horizontalLine: {
        height: 1,
        backgroundColor: '#ddd',
        marginVertical: verticalScale(0),
      },
    //  label: { // Adjusted label style
    //      fontSize: moderateScale(16),
    //      fontWeight: '600',
    //      color: '#343a40',
    //      flex: 1, // Keep flex: 1 for alignment in rows
    //      marginRight: moderateScale(10), // Add margin to separate from Switch/Control
    //      // marginBottom: 0, // Remove bottom margin if using settingsRow margin
    //  },
});

export default SettingsScreen;