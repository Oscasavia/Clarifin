import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableWithoutFeedback, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Keyboard
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// Import context and formatting utility
import { useCurrency } from '../context/CurrencyContext'; // Adjust path if needed
import { formatCurrency } from '../utils/formatting'; // Adjust path if needed

// --- Use Consolidated AsyncStorage Keys ---
const ASYNC_KEYS = {
    balance: 'balance', // Renamed from ASYNC_KEY_BALANCE
    startDate: 'balanceDate', // Renamed from ASYNC_KEY_BALANCE_DATE
    // Include other keys if this screen needs them, but it likely doesn't
};

// --- Helper Function (copied from FinanceTracker - ideally move to utils.ts) ---
const parseISODate = (dateString: string): Date | null => {
    try {
        const datePart = dateString?.split('T')[0];
        if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
         const date = new Date(Date.UTC(
             parseInt(datePart.substring(0,4)),
             parseInt(datePart.substring(5,7)) - 1,
             parseInt(datePart.substring(8,10))
        ));
        if (isNaN(date.getTime())) return null;
        return date; // Returns a Date object set to midnight UTC
    } catch (e) { return null; }
};


// --- Component ---
const SalaryInput = () => {
    const { selectedCurrency } = useCurrency();

    // State for the input field - store balance as a string for input flexibility
    const [balanceInput, setBalanceInput] = useState<string>('');
    const [trackingStartDate, setTrackingStartDate] = useState<Date>(new Date()); // Renamed from balanceDate
    const [showDatePicker, setShowDatePicker] = useState(false);
    // State to hold the currently saved balance for display
    const [savedBalance, setSavedBalance] = useState<string | null>(null);
    const [savedStartDate, setSavedStartDate] = useState<string | null>(null); // Store saved date string
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // --- Data Handling ---
    const loadStoredData = useCallback(async () => {
        console.log("BalanceScreen: Loading stored balance and start date...");
        setIsLoading(true);
        try {
            // Use consolidated keys
            const storedBalance = await AsyncStorage.getItem(ASYNC_KEYS.balance);
            const storedDateStr = await AsyncStorage.getItem(ASYNC_KEYS.startDate);

            if (storedBalance !== null) {
                setSavedBalance(storedBalance);
                setBalanceInput(storedBalance); // Pre-fill input
            } else {
                setSavedBalance('0'); // Default display
                setBalanceInput(''); // Keep input empty if nothing saved? Or '0'? User preference. Let's use empty.
            }

            if (storedDateStr) {
                 const parsedDate = parseISODate(storedDateStr); // Use UTC parser
                 if (parsedDate) {
                     // Convert UTC date back to local time for DatePicker if needed, or keep as UTC
                     // Keeping Date object as is (which represents a UTC time) should work with DateTimePicker
                     setTrackingStartDate(parsedDate);
                     setSavedStartDate(storedDateStr); // Store the raw string 'YYYY-MM-DD'
                 } else {
                     // Handle invalid stored date
                     console.warn("Invalid start date found in storage:", storedDateStr);
                     setTrackingStartDate(new Date()); // Default to today local
                     setSavedStartDate(new Date().toLocaleDateString('en-CA'));
                 }
            } else {
                 // No date saved, default to today
                 setTrackingStartDate(new Date()); // Default to today local
                 setSavedStartDate(new Date().toLocaleDateString('en-CA'));
            }

        } catch (error) {
            console.error("Failed to load balance/start date:", error);
            Alert.alert("Error", "Could not load saved balance data.");
            setSavedBalance('0');
            setBalanceInput('');
            setTrackingStartDate(new Date());
            setSavedStartDate(new Date().toLocaleDateString('en-CA'));
        } finally {
             setIsLoading(false);
        }
    }, []);

    // Use useFocusEffect for reliable data loading
    useFocusEffect(
         useCallback(() => {
              loadStoredData();
              return () => console.log("BalanceScreen unfocused");
         }, [loadStoredData])
    );

    // --- Save Balance ---
    const saveBalanceAndDate = async () => {
        Keyboard.dismiss();
        // Validate the input
        const balanceValue = balanceInput.trim().replace(/,/g, ''); // Remove commas before parsing
        const balanceNum = parseFloat(balanceValue);

        if (balanceValue === '' || isNaN(balanceNum)) {
            Alert.alert('Invalid Input', 'Please enter a valid number for the balance.');
            return;
        }

        // Format the selected date to 'YYYY-MM-DD' using UTC methods to avoid timezone issues
         const startDateString = trackingStartDate.toLocaleDateString('en-CA');

        // Confirmation step
        Alert.alert(
            "Confirm Balance Update",
            `Set starting balance to ${formatCurrency(balanceNum, selectedCurrency)} effective from ${startDateString}? \n\nWARNING: This will reset calculations from this date.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    style: "destructive", // Make confirmation destructive as it affects calculations
                    onPress: async () => {
                         try {
                            // Save using consolidated keys
                            await AsyncStorage.multiSet([
                                [ASYNC_KEYS.balance, balanceValue], // Save the raw string input
                                [ASYNC_KEYS.startDate, startDateString]
                            ]);
                            setSavedBalance(balanceValue); // Update display
                            setSavedStartDate(startDateString); // Update display
                            Alert.alert('Success', 'Starting balance and date saved successfully!');
                            // Optionally clear input or keep it, current behavior keeps it
                        } catch (error) {
                            console.error("Failed to save balance/start date:", error);
                            Alert.alert("Error", "Could not save the balance data. Please try again.");
                        }
                    }
                }
            ]
        );
    };

     // --- Date Picker Handler ---
     const handleDateChange = (event: DateTimePickerEvent, selectedDateValue?: Date) => {
         setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS until done
         if (selectedDateValue) {
             // Ensure the date object reflects the selected day at midnight UTC
             const newDateUTC = new Date(Date.UTC(
                 selectedDateValue.getFullYear(),
                 selectedDateValue.getMonth(),
                 selectedDateValue.getDate()
             ));
             setTrackingStartDate(newDateUTC);
         }
         // On Android, the picker closes itself on selection or dismissal.
         // The 'Done' button below is for iOS only essentially.
     };

    // --- Render Helper for Formatted Balance ---
    const renderFormattedBalance = () => {
        if (isLoading) {
            return <ActivityIndicator size="small" color="#4CAF50" style={styles.balanceAmount} />; // Inline loader
        }
        if (savedBalance === null || isNaN(parseFloat(savedBalance))) {
             return <Text style={styles.balanceAmount}>{formatCurrency(0, selectedCurrency)}</Text>;
        }
         const balanceNum = parseFloat(savedBalance);
         return <Text style={styles.balanceAmount}>{formatCurrency(balanceNum, selectedCurrency)}</Text>;
    };


    // --- Render ---
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingContainer}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                 <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.container}>
                        {/* Balance Display Card */}
                        <View style={styles.balanceCard}>
                            <Ionicons name="cash-outline" size={moderateScale(40)} color="#4CAF50" />
                            <Text style={styles.balanceText}>Current Saved Balance</Text>
                             {renderFormattedBalance()}
                             <Text style={styles.dateText}>Effective From: {savedStartDate ? new Date(savedStartDate+'T00:00:00').toLocaleDateString() : 'Not Set'}</Text>
                        </View>

                        {/* Input Section */}
                        <View style={styles.inputSection}>
                            <Text style={styles.label}>Set New Starting Balance:</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                placeholder={`Enter starting balance amount (${selectedCurrency})`}
                                placeholderTextColor="#888"
                                value={balanceInput}
                                onChangeText={setBalanceInput}
                            />
                            <Text style={styles.label}>Effective Start Date:</Text>
                            <TouchableOpacity
                                style={styles.dateInputTrigger}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={styles.dateInputText}>
                                     {trackingStartDate.toLocaleDateString()}
                                </Text>
                                <Ionicons name="calendar-outline" size={moderateScale(20)} color="#555" />
                            </TouchableOpacity>

                            {/* DateTimePicker Modal */}
                             {showDatePicker && (
                                 // On iOS, wrap picker and Done button in a view if needed for styling/layout
                                <View>
                                    <DateTimePicker
                                        value={trackingStartDate} // Use the state Date object
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={handleDateChange}
                                        // maximumDate={new Date()} // Optional: Prevent future start dates?
                                    />
                                    {Platform.OS === 'ios' && ( // Only show Done button on iOS
                                        <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.iosPickerDoneButton}>
                                            <Text style={styles.iosPickerDoneButtonText}>Done</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity style={styles.button} onPress={saveBalanceAndDate}>
                            <Text style={styles.buttonText}>SAVE BALANCE & DATE</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableWithoutFeedback>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// --- Styles --- (Mostly reused, added dateText, adjusted picker styles)
const styles = StyleSheet.create({
    keyboardAvoidingContainer: {
        flex: 1,
        backgroundColor: '#F4F4F4',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: verticalScale(20),
    },
    container: {
        width: '90%',
        alignItems: 'center',
        paddingBottom: 20, // Add padding to ensure button is visible above keyboard
    },
    balanceCard: {
        backgroundColor: '#fff',
        paddingVertical: verticalScale(20),
        paddingHorizontal: moderateScale(25),
        width: '100%',
        borderRadius: moderateScale(15),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: verticalScale(5) },
        shadowRadius: moderateScale(8),
        elevation: 5,
        marginBottom: verticalScale(30),
    },
    balanceText: {
        fontSize: moderateScale(17),
        color: '#555',
        marginTop: verticalScale(8),
        fontWeight: '600',
    },
    balanceAmount: {
        fontSize: moderateScale(30),
        fontWeight: 'bold',
        color: '#4CAF50',
        marginTop: verticalScale(5),
         minHeight: moderateScale(35), // Ensure space even when loading
         marginBottom: verticalScale(5),
    },
    dateText: { // Style for the effective date display
         fontSize: moderateScale(13),
         color: '#777',
         marginTop: verticalScale(4),
    },
     inputSection: {
        width: '100%',
        marginBottom: verticalScale(20),
    },
    label: {
        fontSize: moderateScale(15),
        fontWeight: 'bold',
        alignSelf: 'flex-start',
        marginBottom: verticalScale(8),
        color: '#333',
        marginLeft: moderateScale(5),
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: moderateScale(10),
        paddingVertical: verticalScale(12),
        paddingHorizontal: moderateScale(15),
        fontSize: moderateScale(16),
        backgroundColor: '#fff',
        marginBottom: verticalScale(15), // Increased margin
    },
    dateInputTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: verticalScale(12),
        paddingHorizontal: moderateScale(15),
        borderRadius: moderateScale(8),
        borderWidth: 1,
        borderColor: '#ccc',
        backgroundColor: '#fff',
        marginBottom: verticalScale(10), // Margin below date trigger
    },
    dateInputText: {
        fontSize: moderateScale(15),
        color: '#333',
    },
     iosPickerDoneButton: { // Style for the 'Done' button on iOS date picker
         alignSelf: 'flex-end', // Position button to the right
         paddingVertical: verticalScale(8),
         paddingHorizontal: moderateScale(15),
         marginTop: verticalScale(10), // Space above button
     },
     iosPickerDoneButtonText: {
         color: '#007AFF', // Standard iOS blue link color
         fontSize: moderateScale(16),
         fontWeight: 'bold',
     },
    button: {
        backgroundColor: '#4CAF50',
        paddingVertical: verticalScale(14),
        paddingHorizontal: moderateScale(30),
        borderRadius: moderateScale(10),
        alignItems: 'center',
        width: '100%',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowRadius: moderateScale(3),
        marginTop: verticalScale(10), // Add margin above button
    },
    buttonText: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        color: '#fff',
        textTransform: 'uppercase',
    },
});

export default SalaryInput;