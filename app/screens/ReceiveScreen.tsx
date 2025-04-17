import React, { useState, useCallback, useMemo } from 'react'; // Added useMemo
import {
    View, Text, TextInput, FlatList, Modal, TouchableWithoutFeedback, Keyboard, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
// Consider adding date-fns for easier date manipulation if needed:
// import { addWeeks, addMonths, startOfMonth, endOfMonth, isWithinInterval, format, parseISO } from 'date-fns';

import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/formatting';

// --- Type Definition for Intervals ---
type IncomeInterval = 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';
const INTERVAL_OPTIONS: IncomeInterval[] = ['weekly', 'monthly', 'quarterly', 'biannually', 'yearly'];


// --- Interfaces ---
interface RecurringIncomeItem {
    id: string;
    name: string;
    amount: number;
    startDate: string; // ISO Date string 'YYYY-MM-DD'
    interval: IncomeInterval; // Make interval non-optional
}

interface OneTimeIncomeItem {
    id: string;
    name: string;
    amount: number;
    date: string; // ISO Date string 'YYYY-MM-DD'
}

const ASYNC_KEYS = {
    recurringIncome: 'recurringIncome',
    oneTimeIncome: 'oneTimeIncome',
};

// Helper function to parse date string safely
const parseISODate = (dateString: string): Date | null => {
    try {
        // Ensure it's just the date part to avoid timezone issues during parsing
        const datePart = dateString.split('T')[0];
        const date = new Date(datePart + 'T00:00:00'); // Set to midnight UTC
        if (isNaN(date.getTime())) {
            console.warn("Invalid date parsed:", dateString);
            return null;
        }
        return date;
    } catch (e) {
        console.error("Error parsing date:", dateString, e);
        return null;
    }
};

// Helper function to get the next occurrence date
const getNextOccurrence = (current: Date, interval: IncomeInterval): Date => {
    const next = new Date(current); // Clone the date
    switch (interval) {
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        case 'quarterly':
            next.setMonth(next.getMonth() + 3);
            break;
        case 'biannually':
            next.setMonth(next.getMonth() + 6);
            break;
        case 'yearly':
            next.setFullYear(next.getFullYear() + 1);
            break;
    }
    return next;
};

const ReceiveTracker = () => {
    const { selectedCurrency } = useCurrency();

    const [incomeType, setIncomeType] = useState<'recurring' | 'one-time'>('recurring');
    const [recurringIncome, setRecurringIncome] = useState<RecurringIncomeItem[]>([]);
    const [oneTimeIncome, setOneTimeIncome] = useState<OneTimeIncomeItem[]>([]);

    const [incomeName, setIncomeName] = useState('');
    const [incomeAmount, setIncomeAmount] = useState('');
    const [interval, setInterval] = useState<IncomeInterval>('monthly'); // Default interval
    const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Used for start date (recurring) and date (one-time)
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [editItemId, setEditItemId] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [recurringModalVisible, setRecurringModalVisible] = useState(false);
    const [oneTimeModalVisible, setOneTimeModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const loadIncomeData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [recurringJson, oneTimeJson] = await AsyncStorage.multiGet([
                ASYNC_KEYS.recurringIncome,
                ASYNC_KEYS.oneTimeIncome,
            ]);
            // Provide default empty array and ensure interval exists
            const rData: RecurringIncomeItem[] = recurringJson[1] ? JSON.parse(recurringJson[1]) : [];
             const validatedRData = rData.map(item => ({
                 ...item,
                 interval: item.interval || 'monthly' // Assign default if missing
             }));
            const oData = oneTimeJson[1] ? JSON.parse(oneTimeJson[1]) : [];

            setRecurringIncome(validatedRData);
            setOneTimeIncome(oData);
        } catch (error) {
            Alert.alert("Error", "Failed to load income data.");
            console.error("Load Error:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        loadIncomeData();
        return () => console.log("ReceiveScreen unfocused");
    }, [loadIncomeData]));

    const validateInputs = (): boolean => {
        const amount = parseFloat(incomeAmount);
        if (!incomeName.trim()) {
            Alert.alert("Validation Error", "Please enter an income name.");
            return false;
        }
        if (isNaN(amount) || amount <= 0) {
            Alert.alert("Validation Error", "Please enter a valid positive amount.");
            return false;
        }
        // No specific date validation needed here anymore as we use DateTimePicker
        return true;
    };

    const saveIncome = async () => {
        if (!validateInputs()) return;
        Keyboard.dismiss(); // Dismiss keyboard before potentially showing alerts

        const amount = parseFloat(incomeAmount);
        const id = editItemId || `${incomeType}-${Date.now()}-${Math.random()}`;
        const isoDateString = selectedDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

        try {
            if (incomeType === 'recurring') {
                const newItem: RecurringIncomeItem = {
                    id,
                    name: incomeName.trim(),
                    amount,
                    startDate: isoDateString, // Use selectedDate as startDate
                    interval,
                 };
                console.log("Saving Recurring:", newItem);
                const updated = editItemId
                    ? recurringIncome.map(i => (i.id === editItemId ? newItem : i))
                    : [...recurringIncome, newItem];
                await AsyncStorage.setItem(ASYNC_KEYS.recurringIncome, JSON.stringify(updated));
                setRecurringIncome(updated);
            } else { // 'one-time'
                const newItem: OneTimeIncomeItem = {
                    id,
                    name: incomeName.trim(),
                    amount,
                    date: isoDateString, // Use selectedDate as the one-time date
                };
                console.log("Saving One-Time:", newItem);
                const updated = editItemId
                    ? oneTimeIncome.map(i => (i.id === editItemId ? newItem : i))
                    : [...oneTimeIncome, newItem];
                await AsyncStorage.setItem(ASYNC_KEYS.oneTimeIncome, JSON.stringify(updated));
                setOneTimeIncome(updated);
            }
            resetForm(); // Close modal and clear form on success
        } catch (error) {
            Alert.alert("Error", "Could not save income.");
            console.error("Save Error:", error);
        }
    };

    const editIncome = (item: RecurringIncomeItem | OneTimeIncomeItem, type: 'recurring' | 'one-time') => {
        setIncomeType(type);
        setEditItemId(item.id);
        setIncomeName(item.name);
        setIncomeAmount(item.amount.toString());

        if (type === 'recurring') {
            const rItem = item as RecurringIncomeItem;
            const startDate = parseISODate(rItem.startDate);
            if (startDate) {
                setSelectedDate(startDate);
            } else {
                // Fallback if date is invalid - shouldn't happen with proper saving
                setSelectedDate(new Date());
                Alert.alert("Warning", "Could not parse start date for editing. Resetting to today.");
            }
            setInterval(rItem.interval || 'monthly'); // Set interval, default if missing
        } else { // 'one-time'
            const oItem = item as OneTimeIncomeItem;
            const itemDate = parseISODate(oItem.date);
             if (itemDate) {
                setSelectedDate(itemDate);
            } else {
                 setSelectedDate(new Date());
                Alert.alert("Warning", "Could not parse date for editing. Resetting to today.");
            }
        }
        setModalVisible(true); // Open the main add/edit modal
    };

    const deleteIncome = async (id: string, type: 'recurring' | 'one-time') => {
         Alert.alert(
            "Confirm Deletion",
            "Are you sure you want to delete this income item?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive",
                    onPress: async () => {
                        try {
                            if (type === 'recurring') {
                                const updated = recurringIncome.filter(i => i.id !== id);
                                await AsyncStorage.setItem(ASYNC_KEYS.recurringIncome, JSON.stringify(updated));
                                setRecurringIncome(updated);
                            } else {
                                const updated = oneTimeIncome.filter(i => i.id !== id);
                                await AsyncStorage.setItem(ASYNC_KEYS.oneTimeIncome, JSON.stringify(updated));
                                setOneTimeIncome(updated);
                            }
                         } catch (error) {
                            Alert.alert("Error", "Could not delete income.");
                            console.error("Delete Error:", error)
                        }
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setIncomeName('');
        setIncomeAmount('');
        setSelectedDate(new Date()); // Reset date to today
        setInterval('monthly'); // Reset interval to default
        setEditItemId(null);
        setShowDatePicker(false);
        setModalVisible(false); // Close the main modal
    };

    // --- Calculation Logic ---
    const { recurringTotal, oneTimeTotal, totalIncome } = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculate start and end of the current month (midnight UTC)
        const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
        const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)); // End of the last day

        let calculatedRecurringTotal = 0;
        recurringIncome.forEach(item => {
            const itemStartDate = parseISODate(item.startDate);
            if (!itemStartDate || itemStartDate > endOfMonth) {
                // If start date is invalid or after the current month ends, skip
                return;
            }

            let occurrenceDate = new Date(itemStartDate); // Start from the item's start date

            // Find the first occurrence that is relevant for this month
            // Move forward until the occurrence date is within or past the current month start
            while (occurrenceDate < startOfMonth) {
                const nextDate = getNextOccurrence(occurrenceDate, item.interval);
                 // Prevent infinite loop if getNextOccurrence doesn't advance date
                if (nextDate <= occurrenceDate) {
                    console.warn("Potential infinite loop detected for item:", item.id);
                    break;
                 }
                occurrenceDate = nextDate;
             }

             // Now count occurrences within the current month
            while (occurrenceDate <= endOfMonth) {
                 calculatedRecurringTotal += item.amount;
                 const nextDate = getNextOccurrence(occurrenceDate, item.interval);
                 // Prevent infinite loop
                 if (nextDate <= occurrenceDate) {
                    console.warn("Potential infinite loop detected during counting for item:", item.id);
                    break;
                 }
                 occurrenceDate = nextDate;
            }
        });

        const calculatedOneTimeTotal = oneTimeIncome
            .filter(item => {
                const itemDate = parseISODate(item.date);
                return itemDate && itemDate.getUTCMonth() === currentMonth && itemDate.getUTCFullYear() === currentYear;
            })
            .reduce((sum, item) => sum + item.amount, 0);

        return {
            recurringTotal: calculatedRecurringTotal,
            oneTimeTotal: calculatedOneTimeTotal,
            totalIncome: calculatedRecurringTotal + calculatedOneTimeTotal,
        };
    }, [recurringIncome, oneTimeIncome]); // Recalculate only when income lists change

    const handleDateChange = (event: any, selectedDateValue?: Date) => {
        const currentDate = selectedDateValue || selectedDate;
        setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS until dismissed
        setSelectedDate(currentDate);
     };

    // --- Render Logic ---
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text>Loading Income...</Text>
            </View>
        );
    }

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
            <View style={styles.incomeCard}>
                <Ionicons name="wallet-outline" size={moderateScale(40)} color="#4CAF50" />
                <Text style={styles.cardTitle}>Total Income This Month</Text>
                <Text style={styles.cardAmount}>{formatCurrency(totalIncome, selectedCurrency)}</Text>
                <Text style={styles.subInfo}>Recurring: {formatCurrency(recurringTotal, selectedCurrency)}</Text>
                <Text style={styles.subInfo}>One-Time: {formatCurrency(oneTimeTotal, selectedCurrency)}</Text>
            </View>

            {/* Add Income Button */}
             <TouchableOpacity style={styles.addButton} onPress={() => {
                 setIncomeType('recurring'); // Default to recurring when adding
                 resetForm(); // Clear form before opening
                 setModalVisible(true);
             }}>
                 <Ionicons name="add-circle-outline" size={moderateScale(20)} color="#4CAF50" />
                 <Text style={styles.addText}>Add Income</Text>
            </TouchableOpacity>

            {/* View Buttons */}
            <View style={styles.viewButtonsContainer}>
                <TouchableOpacity style={styles.viewButton} onPress={() => setRecurringModalVisible(true)}>
                    <Ionicons name="repeat-outline" size={moderateScale(18)} color="#FF4081"/>
                    <Text style={styles.viewButtonText}>View Recurring</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.viewButton} onPress={() => setOneTimeModalVisible(true)}>
                     <Ionicons name="calendar-number-outline" size={moderateScale(18)} color="#FF4081"/>
                    <Text style={styles.viewButtonText}>View One-Time</Text>
                </TouchableOpacity>
            </View>


            {/* Recurring Income Modal List */}
            <Modal visible={recurringModalVisible} animationType="slide" transparent onRequestClose={() => setRecurringModalVisible(false)}>
                <TouchableWithoutFeedback onPress={() => setRecurringModalVisible(false)}>
                    <View style={styles.modalOverlayZ}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContentZ}>
                            <Text style={styles.modalTitle}>Recurring Income</Text>
                            <FlatList // Use FlatList for better performance
                                data={recurringIncome}
                                keyExtractor={(item) => item.id}
                                ListEmptyComponent={<Text style={styles.empty}>No recurring income added yet.</Text>}
                                renderItem={({ item }) => (
                                    <View style={styles.itemRowWrap}>
                                        <Text style={styles.itemText} numberOfLines={3}>
                                            {item.name} – {formatCurrency(item.amount, selectedCurrency)}
                                            {'\n'}<Text style={styles.itemDetailText}>Starts: {item.startDate}, Repeats: {item.interval}</Text>
                                        </Text>
                                        <View style={styles.actions}>
                                            <TouchableOpacity onPress={() => {
                                                setRecurringModalVisible(false); // Close this modal first
                                                editIncome(item, 'recurring');
                                            }}>
                                                <Ionicons name="pencil" size={moderateScale(20)} color="blue" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => deleteIncome(item.id, 'recurring')}>
                                                <Ionicons name="trash" size={moderateScale(20)} color="red" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                style={styles.listScrollView}
                             />
                             {/* Optional Close Button */}
                              {/* <TouchableOpacity style={styles.closeButton} onPress={() => setRecurringModalVisible(false)}>
                                  <Text style={styles.closeButtonText}>Close</Text>
                              </TouchableOpacity> */}
                          </View>
                         </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* One-Time Income Modal List */}
            <Modal visible={oneTimeModalVisible} animationType="slide" transparent onRequestClose={() => setOneTimeModalVisible(false)}>
                 <TouchableWithoutFeedback onPress={() => setOneTimeModalVisible(false)}>
                    <View style={styles.modalOverlayZ}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContentZ}>
                            <Text style={styles.modalTitle}>One-Time Income</Text>
                            <FlatList // Use FlatList
                                data={oneTimeIncome}
                                keyExtractor={(item) => item.id}
                                ListEmptyComponent={<Text style={styles.empty}>No one-time income added yet.</Text>}
                                renderItem={({ item }) => (
                                    <View style={styles.itemRowWrap}>
                                        <Text style={styles.itemText} numberOfLines={3}>
                                            {item.name} – {formatCurrency(item.amount, selectedCurrency)}
                                            {'\n'}<Text style={styles.itemDetailText}>Date: {item.date}</Text>
                                        </Text>
                                        <View style={styles.actions}>
                                            <TouchableOpacity onPress={() => {
                                                setOneTimeModalVisible(false); // Close this modal first
                                                editIncome(item, 'one-time');
                                             }}>
                                                <Ionicons name="pencil" size={moderateScale(20)} color="blue" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => deleteIncome(item.id, 'one-time')}>
                                                <Ionicons name="trash" size={moderateScale(20)} color="red" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                style={styles.listScrollView}
                            />
                             {/* Optional Close Button */}
                             {/* <TouchableOpacity style={styles.closeButton} onPress={() => setOneTimeModalVisible(false)}>
                                 <Text style={styles.closeButtonText}>Close</Text>
                             </TouchableOpacity> */}
                         </View>
                         </TouchableWithoutFeedback>
                     </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* --- Add/Edit Income Modal --- */}
            <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={resetForm}>
                <TouchableWithoutFeedback onPress={resetForm}>
                     <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                             <View style={styles.modalContent}>
                                {/* Toggle Type within Modal */}
                                <View style={styles.modalToggleRow}>
                                    <TouchableOpacity
                                        style={[styles.modalToggleBtn, incomeType === 'recurring' && styles.activeToggle]}
                                        onPress={() => setIncomeType('recurring')}>
                                        <Ionicons name="repeat-outline" size={moderateScale(18)} color={incomeType === 'recurring' ? '#4CAF50' : '#555'} />
                                        <Text style={[styles.modalToggleText, incomeType === 'recurring' && styles.activeToggleText]}>Recurring</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalToggleBtn, incomeType === 'one-time' && styles.activeToggle]}
                                        onPress={() => setIncomeType('one-time')}>
                                        <Ionicons name="calendar-number-outline" size={moderateScale(18)} color={incomeType === 'one-time' ? '#4CAF50' : '#555'} />
                                        <Text style={[styles.modalToggleText, incomeType === 'one-time' && styles.activeToggleText]}>One-Time</Text>
                                    </TouchableOpacity>
                                </View>

                                 <Text style={styles.modalTitle}>{editItemId ? 'Edit' : 'Add'} {incomeType === 'recurring' ? 'Recurring' : 'One-Time'} Income</Text>

                                <TextInput style={styles.input} placeholder="Income Name (e.g., Salary, Freelance)" value={incomeName} onChangeText={setIncomeName} />
                                <TextInput style={styles.input} placeholder="Amount" value={incomeAmount} keyboardType="numeric" onChangeText={setIncomeAmount} />

                                {/* Date Selection (Used for Start Date or One-Time Date) */}
                                 <Text style={styles.inputLabel}>{incomeType === 'recurring' ? 'Start Date:' : 'Date:'}</Text>
                                <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                                    <Text>{selectedDate.toLocaleDateString()}</Text>
                                     <Ionicons name="calendar-outline" size={moderateScale(18)} color="#555" />
                                </TouchableOpacity>

                                 {/* Show DateTimePicker */}
                                 {showDatePicker && (
                                    <DateTimePicker
                                        value={selectedDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'} // Spinner looks better on iOS modal
                                        onChange={handleDateChange}
                                        // maximumDate={new Date()} // Optional: prevent future dates for one-time?
                                    />
                                )}
                                {/* Conditionally hide picker on Android after selection */}
                                {showDatePicker && Platform.OS === 'android' && (
                                     <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.androidPickerDone}>
                                        <Text style={styles.androidPickerDoneText}>Done</Text>
                                     </TouchableOpacity>
                                )}


                                {/* Interval Selection (Only for Recurring) */}
                                {incomeType === 'recurring' && (
                                    <>
                                        <Text style={styles.inputLabel}>Repeat Every:</Text>
                                        <View style={styles.intervalContainer}>
                                            {INTERVAL_OPTIONS.map(value => (
                                                <TouchableOpacity
                                                    key={value}
                                                    style={[styles.intervalBtn, interval === value && styles.intervalBtnActive]}
                                                    onPress={() => setInterval(value)}>
                                                    <Text style={[styles.intervalBtnText, interval === value && styles.intervalBtnActiveText]}>
                                                        {value.charAt(0).toUpperCase() + value.slice(1)} {/* Capitalize */}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}

                                <TouchableOpacity style={styles.saveButton} onPress={saveIncome}>
                                    <Text style={styles.saveText}>{editItemId ? 'Update Income' : 'Save Income'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
        </TouchableWithoutFeedback>
    );
};

// --- Styles --- (Add or modify styles as needed)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5', // Slightly off-white background
        padding: moderateScale(15),
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    incomeCard: {
        alignItems: 'center',
        backgroundColor: 'white',
        paddingVertical: verticalScale(15),
        paddingHorizontal: moderateScale(20),
        borderRadius: moderateScale(15),
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowRadius: moderateScale(8),
        elevation: 5, // Increased elevation for more pop
        marginBottom: verticalScale(20),
    },
    cardTitle: {
        fontSize: moderateScale(16),
        color: '#555',
        marginTop: verticalScale(5),
    },
    cardAmount: {
        fontSize: moderateScale(28), // Larger amount font
        fontWeight: 'bold',
        color: '#4CAF50', // Consistent green
        marginVertical: verticalScale(5),
    },
    subInfo: {
        fontSize: moderateScale(14),
        color: '#777', // Slightly darker grey
        marginTop: verticalScale(2),
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E8F5E9', // Lighter green background
        paddingVertical: verticalScale(12),
        paddingHorizontal: moderateScale(15),
        borderRadius: moderateScale(10),
        marginBottom: verticalScale(15),
        gap: moderateScale(10),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
        shadowOffset: { width: 0, height: verticalScale(2) },
    },
    addText: {
        // marginLeft: moderateScale(10), // Gap handles spacing
        fontWeight: 'bold',
        fontSize: moderateScale(15),
        color: '#4CAF50', // Match icon color
    },
    viewButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around', // Space out view buttons
        marginBottom: verticalScale(15),
        gap: moderateScale(10),
    },
    viewButton: {
        flex: 1, // Make buttons share space
        flexDirection: 'row', // Icon and text side-by-side
        alignItems: 'center',
        justifyContent: 'center', // Center content within button
        // backgroundColor: '#fce4ec', // Pinkish background
        backgroundColor: '#FFF', // White background like card
        borderWidth: 1,
        borderColor: '#FFCDD2', // Light pink border
        paddingVertical: verticalScale(10),
        paddingHorizontal: moderateScale(10), // Adjust padding
        borderRadius: moderateScale(10),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: moderateScale(3),
        shadowOffset: { width: 0, height: verticalScale(1) },
        gap: moderateScale(5), // Space between icon and text
    },
    viewButtonText: {
        color: '#FF4081', // Pink text
        fontWeight: 'bold',
        fontSize: moderateScale(13), // Slightly smaller text
    },
    sectionTitle: { // This style seems unused in the final layout, but kept for potential future use
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        marginVertical: verticalScale(10),
        color: '#333',
    },
    empty: {
        fontStyle: 'italic',
        color: '#777',
        textAlign: 'center',
        marginTop: verticalScale(20),
        fontSize: moderateScale(14),
    },
    itemRowWrap: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f9f9f9', // Lighter background for items
        paddingVertical: verticalScale(10),
        paddingHorizontal: moderateScale(15),
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(8),
        borderWidth: 1,
        borderColor: '#eee',
    },
    itemText: {
        flex: 1, // Take available space
        fontSize: moderateScale(14),
        color: '#333',
        marginRight: moderateScale(10), // Space before actions
    },
    itemDetailText: { // Style for the secondary line in list items
       fontSize: moderateScale(12),
       color: '#666',
       marginTop: verticalScale(2),
    },
    actions: {
        flexDirection: 'row',
        gap: moderateScale(15), // More space between icons
    },
    modalOverlayZ: { // For list modals (slide up)
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)', // Slightly darker overlay
        justifyContent: 'flex-end',
    },
    modalOverlay: { // For Add/Edit modal (centered)
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: moderateScale(15), // Prevent modal edges touching screen edge
    },
    modalContentZ: { // For list modals (slide up)
        backgroundColor: 'white',
        padding: moderateScale(15), // Consistent padding
        borderTopLeftRadius: moderateScale(20),
        borderTopRightRadius: moderateScale(20),
        width: '100%',
        height: '55%',
        maxHeight: '70%', // Limit height
        paddingBottom: verticalScale(30), // Extra padding at bottom for safe area / home indicator
    },
    modalContent: { // For Add/Edit modal (centered)
        backgroundColor: 'white',
        padding: moderateScale(20),
        borderRadius: moderateScale(15),
        width: '100%', // Use padding on overlay for spacing
        maxWidth: 500, // Max width on larger screens/tablets
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalTitle: {
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        marginBottom: verticalScale(15), // More space below title
        textAlign: 'center',
        color: '#333',
    },
    inputLabel: {
        fontSize: moderateScale(13),
        color: '#555',
        marginBottom: verticalScale(5),
        // marginLeft: moderateScale(2), // Slight indent if needed
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        backgroundColor: '#fff', // Ensure white background
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(10),
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(12), // Consistent spacing
        fontSize: moderateScale(14),
    },
    dateInput: {
        flexDirection: 'row', // Align text and icon horizontally
        justifyContent: 'space-between', // Push text and icon apart
        alignItems: 'center', // Center items vertically
        borderWidth: 1,
        borderColor: '#ccc',
        backgroundColor: '#f8f8f8', // Light background for touchable area
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(12), // Slightly more padding
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(12),
    },
    intervalContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap', // Allow wrapping on smaller screens
        gap: moderateScale(8),
        marginBottom: verticalScale(15),
    },
    intervalBtn: {
        paddingVertical: verticalScale(8),
        paddingHorizontal: moderateScale(12),
        backgroundColor: '#eee',
        borderRadius: moderateScale(20), // Pill shape
        borderWidth: 1,
        borderColor: '#ddd',
    },
    intervalBtnActive: {
        backgroundColor: '#C8E6C9', // Lighter green when active
        borderColor: '#A5D6A7',
    },
     intervalBtnText: {
        fontSize: moderateScale(13),
        color: '#333',
    },
    intervalBtnActiveText: {
        color: '#2E7D32', // Darker green text when active
        fontWeight: 'bold',
    },
    saveButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: verticalScale(13), // Slightly larger save button
        borderRadius: moderateScale(10),
        alignItems: 'center',
        marginTop: verticalScale(10), // Space above save button
    },
    saveText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: moderateScale(15),
    },
    cancelButton: { // Style for the cancel button
        // backgroundColor: '#FF6347', // Example: Tomato color
        paddingVertical: verticalScale(10),
        borderRadius: moderateScale(10),
        alignItems: 'center',
        marginTop: verticalScale(10), // Space below save button
    },
    cancelButtonText: { // Text for the cancel button
        color: '#FF6347', // Tomato color
        fontWeight: 'bold',
        fontSize: moderateScale(14),
    },
    listScrollView: { // Style for the ScrollView within list modals
        // maxHeight: verticalScale(300), // Set max height if needed, but FlatList handles this better
    },
    // Toggle Buttons within Modal
    modalToggleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: verticalScale(15),
        backgroundColor: '#f0f0f0', // Background for the toggle container
        borderRadius: moderateScale(10),
        padding: moderateScale(4),
    },
    modalToggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: verticalScale(8),
        borderRadius: moderateScale(8),
        // backgroundColor: '#eee', // Handled by container
        marginHorizontal: moderateScale(2),
        gap: moderateScale(5),
    },
    activeToggle: { // Style for the active toggle button (used in both places)
        backgroundColor: '#c8facc', // Light green active background
    },
    modalToggleText: {
        fontSize: moderateScale(14),
        fontWeight: '600', // Semi-bold
        color: '#555',
    },
    activeToggleText: { // Style for the active toggle text (used in modal)
       color: '#388E3C', // Darker green text for active
       fontWeight: 'bold',
    },
    androidPickerDone: { // Button to "confirm" date on Android modal picker
        alignSelf: 'flex-end',
        paddingVertical: verticalScale(5),
        paddingHorizontal: moderateScale(10),
        marginTop: verticalScale(5),
    },
    androidPickerDoneText: {
        color: '#007AFF', // iOS blue link color
        fontSize: moderateScale(14),
        fontWeight: 'bold',
    }
});

export default ReceiveTracker;