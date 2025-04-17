import React, { useState, useCallback, useMemo } from 'react'; // Added useMemo
import {
    View, Text, TextInput, FlatList, Modal, TouchableWithoutFeedback, Keyboard, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView // Added KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'; // Added DateTimePickerEvent
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';

import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/formatting';

// --- Type Definition for Intervals ---
type SpendInterval = 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';
const SPEND_INTERVAL_OPTIONS: SpendInterval[] = ['weekly', 'monthly', 'quarterly', 'biannually', 'yearly'];

// --- Interfaces ---
interface RecurringBillItem {
    id: string;
    name: string;
    amount: number;
    startDate: string; // ISO Date string 'YYYY-MM-DD'
    interval: SpendInterval; // Make interval non-optional & add weekly
}

interface OneTimeSpendItem {
    id: string;
    name: string;
    amount: number;
    date: string; // ISO Date string 'YYYY-MM-DD'
}

// --- AsyncStorage Keys ---
const ASYNC_KEY_RECURRING_BILLS = 'recurringBills';
const ASYNC_KEY_ONE_TIME_SPENDS = 'oneTimeSpends';

// --- Helper Functions (Duplicate from ReceiveTracker or move to utils) ---
const parseISODate = (dateString: string): Date | null => {
    try {
        const datePart = dateString.split('T')[0];
        const date = new Date(datePart + 'T00:00:00');
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

const getNextOccurrence = (current: Date, interval: SpendInterval): Date => {
    const next = new Date(current);
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
// --- Component ---
const SpendTracker = () => {
    const { selectedCurrency } = useCurrency();

    const [spendType, setSpendType] = useState<'recurring' | 'one-time'>('recurring');
    const [recurringBills, setRecurringBills] = useState<RecurringBillItem[]>([]);
    const [oneTimeSpends, setOneTimeSpends] = useState<OneTimeSpendItem[]>([]);

    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    // Removed day state: const [day, setDay] = useState('');
    const [interval, setInterval] = useState<SpendInterval>('monthly'); // Use SpendInterval type
    const [selectedDate, setSelectedDate] = useState(new Date()); // Used for startDate (recurring) and date (one-time)
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [editItemId, setEditItemId] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false); // Main Add/Edit Modal
    const [recurringModalVisible, setRecurringModalVisible] = useState(false); // List Modal
    const [oneTimeModalVisible, setOneTimeModalVisible] = useState(false); // List Modal
    const [isLoading, setIsLoading] = useState(true);


    const loadSpendData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [recurringJson, oneTimeJson] = await AsyncStorage.multiGet([
                ASYNC_KEY_RECURRING_BILLS,
                ASYNC_KEY_ONE_TIME_SPENDS,
            ]);
            // Provide default empty array and ensure interval exists/is valid
             const rData: RecurringBillItem[] = recurringJson[1] ? JSON.parse(recurringJson[1]) : [];
             const validatedRData = rData.map((item: RecurringBillItem) => ({
                 ...item,
                 // Ensure startDate exists (fallback for older data if needed)
                 startDate: item.startDate || new Date().toISOString().split('T')[0],
                 // Ensure interval is valid, default to monthly if missing/invalid
                 interval: SPEND_INTERVAL_OPTIONS.includes(item.interval as SpendInterval) ? item.interval : 'monthly'
             }));

            const oData = oneTimeJson[1] ? JSON.parse(oneTimeJson[1]) : [];
            const validatedOData = oData.map((item: OneTimeSpendItem) => ({
                ...item,
                 // Ensure date exists (fallback for older data if needed)
                 date: item.date || new Date().toISOString().split('T')[0]
            }));

            setRecurringBills(validatedRData);
            setOneTimeSpends(validatedOData);
        } catch (e) {
            Alert.alert('Error', 'Failed to load spend data.');
            console.error("Load Spend Error:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        loadSpendData();
        return () => console.log("SpendScreen unfocused");
    }, [loadSpendData]));

    const validateInputs = (): boolean => {
        const amt = parseFloat(amount);
        if (!name.trim()) {
             Alert.alert('Validation Error', 'Please enter a name for the spend/bill.');
             return false;
        }
        if (isNaN(amt) || amt <= 0) {
             Alert.alert('Validation Error', 'Please enter a valid positive amount.');
             return false;
        }
        // Removed day validation
        return true;
    };

    const saveSpend = async () => {
        if (!validateInputs()) return;
        Keyboard.dismiss();

        const amt = parseFloat(amount);
        const id = editItemId || `${spendType}-${Date.now()}-${Math.random()}`;
        const isoDateString = selectedDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

        try {
            if (spendType === 'recurring') {
                const newItem: RecurringBillItem = {
                    id,
                    name: name.trim(),
                    amount: amt,
                    startDate: isoDateString, // Use selectedDate as startDate
                    interval,
                };
                console.log("Saving Recurring Bill:", newItem);
                const updated = editItemId
                    ? recurringBills.map(b => (b.id === editItemId ? newItem : b))
                    : [...recurringBills, newItem];
                await AsyncStorage.setItem(ASYNC_KEY_RECURRING_BILLS, JSON.stringify(updated));
                setRecurringBills(updated);
            } else { // 'one-time'
                const newItem: OneTimeSpendItem = {
                    id,
                    name: name.trim(),
                    amount: amt,
                    date: isoDateString, // Use selectedDate as the one-time date
                };
                 console.log("Saving One-Time Spend:", newItem);
                const updated = editItemId
                    ? oneTimeSpends.map(s => (s.id === editItemId ? newItem : s))
                    : [...oneTimeSpends, newItem];
                await AsyncStorage.setItem(ASYNC_KEY_ONE_TIME_SPENDS, JSON.stringify(updated));
                setOneTimeSpends(updated);
            }
            resetForm(); // Close modal and clear form on success
        } catch (e) {
            Alert.alert('Error', 'Failed to save spend.');
            console.error("Save Spend Error:", e);
        }
    };

    const editSpend = (item: RecurringBillItem | OneTimeSpendItem, type: 'recurring' | 'one-time') => {
        setSpendType(type);
        setEditItemId(item.id);
        setName(item.name);
        setAmount(item.amount.toString());

        if (type === 'recurring') {
            const rItem = item as RecurringBillItem;
            const startDate = parseISODate(rItem.startDate);
            if (startDate) {
                setSelectedDate(startDate);
            } else {
                setSelectedDate(new Date());
                Alert.alert("Warning", "Could not parse start date for editing. Resetting to today.");
            }
            // Ensure interval is valid
            setInterval(SPEND_INTERVAL_OPTIONS.includes(rItem.interval) ? rItem.interval : 'monthly');
            // Removed day setting: setDay(rItem.date.toString());
        } else { // 'one-time'
            const oItem = item as OneTimeSpendItem;
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

    const deleteSpend = async (id: string, type: 'recurring' | 'one-time') => {
        Alert.alert(
            "Confirm Deletion",
            `Are you sure you want to delete this ${type} spend item?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive",
                    onPress: async () => {
                        try {
                            if (type === 'recurring') {
                                const updated = recurringBills.filter(i => i.id !== id);
                                await AsyncStorage.setItem(ASYNC_KEY_RECURRING_BILLS, JSON.stringify(updated));
                                setRecurringBills(updated);
                            } else {
                                const updated = oneTimeSpends.filter(i => i.id !== id);
                                await AsyncStorage.setItem(ASYNC_KEY_ONE_TIME_SPENDS, JSON.stringify(updated));
                                setOneTimeSpends(updated);
                            }
                        } catch (e) {
                            Alert.alert('Error', 'Failed to delete spend.');
                            console.error("Delete Spend Error:", e);
                        }
                    }
                }
            ]
        );
    };


    const resetForm = () => {
        setName('');
        setAmount('');
        // Removed day reset: setDay('');
        setInterval('monthly'); // Reset interval to default
        setSelectedDate(new Date()); // Reset date to today
        setEditItemId(null);
        setShowDatePicker(false);
        setModalVisible(false); // Close the main modal
    };

    // --- Calculation Logic (using useMemo) ---
    const { recurringTotal, oneTimeTotal, totalExpenses } = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
        const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));

        let calculatedRecurringTotal = 0;
        recurringBills.forEach(item => {
            const itemStartDate = parseISODate(item.startDate);
            if (!itemStartDate || itemStartDate > endOfMonth) {
                return;
            }

            let occurrenceDate = new Date(itemStartDate);

            while (occurrenceDate < startOfMonth) {
                 const nextDate = getNextOccurrence(occurrenceDate, item.interval);
                 if (nextDate <= occurrenceDate) break; // Prevent infinite loop
                 occurrenceDate = nextDate;
            }

            while (occurrenceDate <= endOfMonth) {
                 calculatedRecurringTotal += item.amount;
                 const nextDate = getNextOccurrence(occurrenceDate, item.interval);
                 if (nextDate <= occurrenceDate) break; // Prevent infinite loop
                 occurrenceDate = nextDate;
            }
        });

        const calculatedOneTimeTotal = oneTimeSpends
            .filter(item => {
                const itemDate = parseISODate(item.date);
                // Use UTC methods to compare with UTC start/end dates
                return itemDate && itemDate.getUTCMonth() === currentMonth && itemDate.getUTCFullYear() === currentYear;
            })
            .reduce((sum, item) => sum + item.amount, 0);

        return {
            recurringTotal: calculatedRecurringTotal,
            oneTimeTotal: calculatedOneTimeTotal,
            totalExpenses: calculatedRecurringTotal + calculatedOneTimeTotal,
        };
    }, [recurringBills, oneTimeSpends]); // Recalculate only when spends change


    const handleDateChange = (event: DateTimePickerEvent, selectedDateValue?: Date) => {
        // Handle dismissal on Android potentially
        if (event.type === 'dismissed' && Platform.OS === 'android') {
             setShowDatePicker(false);
             return;
        }
        const currentDate = selectedDateValue || selectedDate;
        setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS
        setSelectedDate(currentDate);
         // Close picker on Android after selecting a date
         if (Platform.OS === 'android') {
             //setShowDatePicker(false); // Might close too soon if user wants to tap "Done" button
        }
    };


    // --- Render Logic ---
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6347" />
                <Text>Loading Spends...</Text>
            </View>
        );
    }

    return (
        // Added KeyboardAvoidingView and TouchableWithoutFeedback for better modal interaction
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
        >
         <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                {/* Summary Card */}
                <View style={styles.spendCard}>
                    <Ionicons name="card-outline" size={moderateScale(40)} color="#FF6347" />
                    <Text style={styles.cardTitle}>Total Expenses This Month</Text>
                    <Text style={styles.cardAmount}>{formatCurrency(totalExpenses, selectedCurrency)}</Text>
                    <Text style={styles.subText}>Recurring: {formatCurrency(recurringTotal, selectedCurrency)}</Text>
                    <Text style={styles.subText}>One-Time: {formatCurrency(oneTimeTotal, selectedCurrency)}</Text>
                </View>

                {/* Add Spend Button */}
                 <TouchableOpacity style={styles.addButton} onPress={() => {
                     setSpendType('recurring'); // Default to recurring when adding
                     resetForm(); // Clear form before opening
                     setModalVisible(true);
                 }}>
                     <Ionicons name="add-circle-outline" size={moderateScale(20)} color="#FF6347" />
                     <Text style={styles.addText}>Add Spend/Bill</Text>
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

                {/* List Modals are below the Add/Edit Modal */}

                {/* --- Add/Edit Spend Modal --- */}
                <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={resetForm}>
                     <TouchableWithoutFeedback onPress={resetForm}>
                         <View style={styles.modalOverlay}>
                             <TouchableWithoutFeedback>
                                 <View style={styles.modalContent}>
                                    {/* Toggle Type within Modal */}
                                     <View style={styles.modalToggleRow}>
                                        <TouchableOpacity
                                            style={[styles.modalToggleBtn, spendType === 'recurring' && styles.activeToggle]}
                                            onPress={() => setSpendType('recurring')}>
                                            <Ionicons name="repeat-outline" size={moderateScale(18)} color={spendType === 'recurring' ? '#D32F2F' : '#555'} />
                                            <Text style={[styles.modalToggleText, spendType === 'recurring' && styles.activeToggleText]}>Recurring</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalToggleBtn, spendType === 'one-time' && styles.activeToggle]}
                                            onPress={() => setSpendType('one-time')}>
                                            <Ionicons name="calendar-number-outline" size={moderateScale(18)} color={spendType === 'one-time' ? '#D32F2F' : '#555'} />
                                            <Text style={[styles.modalToggleText, spendType === 'one-time' && styles.activeToggleText]}>One-Time</Text>
                                        </TouchableOpacity>
                                     </View>

                                    <Text style={styles.modalTitle}>{editItemId ? 'Edit' : 'Add'} {spendType === 'recurring' ? 'Recurring Bill' : 'One-Time Spend'}</Text>

                                    <TextInput style={styles.input} placeholder="Spend/Bill Name (e.g., Rent, Groceries)" value={name} onChangeText={setName} />
                                    <TextInput style={styles.input} placeholder="Amount" value={amount} keyboardType="numeric" onChangeText={setAmount} />

                                    {/* Date Selection */}
                                    <Text style={styles.inputLabel}>{spendType === 'recurring' ? 'Start Date:' : 'Date:'}</Text>
                                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                                        <Text>{selectedDate.toLocaleDateString()}</Text>
                                        <Ionicons name="calendar-outline" size={moderateScale(18)} color="#555" />
                                    </TouchableOpacity>

                                    {/* Show DateTimePicker */}
                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={selectedDate}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={handleDateChange}
                                        />
                                    )}
                                     {/* Android "Done" button */}
                                     {showDatePicker && Platform.OS === 'android' && (
                                        <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.androidPickerDone}>
                                            <Text style={styles.androidPickerDoneText}>Done</Text>
                                        </TouchableOpacity>
                                     )}

                                    {/* Interval Selection (Only for Recurring) */}
                                    {spendType === 'recurring' && (
                                        <>
                                            <Text style={styles.inputLabel}>Repeat Every:</Text>
                                            <View style={styles.intervalContainer}>
                                                {SPEND_INTERVAL_OPTIONS.map(value => (
                                                    <TouchableOpacity
                                                        key={value}
                                                        style={[styles.intervalBtn, interval === value && styles.intervalBtnActive]}
                                                        onPress={() => setInterval(value)}>
                                                        <Text style={[styles.intervalBtnText, interval === value && styles.intervalBtnActiveText]}>
                                                            {value.charAt(0).toUpperCase() + value.slice(1)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </>
                                    )}

                                    <TouchableOpacity style={styles.saveButton} onPress={saveSpend}>
                                        <Text style={styles.saveText}>{editItemId ? 'Update Spend' : 'Save Spend'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                 </View>
                            </TouchableWithoutFeedback>
                        </View>
                     </TouchableWithoutFeedback>
                </Modal>


                {/* --- Recurring Bills Modal List --- */}
                <Modal visible={recurringModalVisible} animationType="slide" transparent onRequestClose={() => setRecurringModalVisible(false)}>
                     <TouchableWithoutFeedback onPress={() => setRecurringModalVisible(false)}>
                         <View style={styles.modalOverlayZ}>
                             <TouchableWithoutFeedback>
                                <View style={styles.modalContentZ}>
                                <Text style={styles.modalTitle}>Recurring Bills</Text>
                                <FlatList
                                    data={recurringBills}
                                    keyExtractor={(item) => item.id}
                                    ListEmptyComponent={<Text style={styles.empty}>No recurring bills added yet.</Text>}
                                    renderItem={({ item }) => (
                                        <View style={styles.itemRowWrap}>
                                            <Text style={styles.itemText} numberOfLines={3}>
                                                {item.name} – {formatCurrency(item.amount, selectedCurrency)}
                                                {'\n'}<Text style={styles.itemDetailText}>Starts: {item.startDate}, Repeats: {item.interval}</Text>
                                            </Text>
                                            <View style={styles.actions}>
                                                <TouchableOpacity onPress={() => {
                                                    setRecurringModalVisible(false);
                                                    editSpend(item, 'recurring');
                                                }}>
                                                    <Ionicons name="pencil" size={moderateScale(20)} color="blue" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => deleteSpend(item.id, 'recurring')}>
                                                    <Ionicons name="trash" size={moderateScale(20)} color="red" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                    style={styles.listScrollView}
                                />
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* --- One-Time Spends Modal List --- */}
                 <Modal visible={oneTimeModalVisible} animationType="slide" transparent onRequestClose={() => setOneTimeModalVisible(false)}>
                     <TouchableWithoutFeedback onPress={() => setOneTimeModalVisible(false)}>
                         <View style={styles.modalOverlayZ}>
                            <TouchableWithoutFeedback>
                                <View style={styles.modalContentZ}>
                                <Text style={styles.modalTitle}>One-Time Spends</Text>
                                <FlatList
                                    data={oneTimeSpends}
                                    keyExtractor={(item) => item.id}
                                    ListEmptyComponent={<Text style={styles.empty}>No one-time spends added yet.</Text>}
                                    renderItem={({ item }) => (
                                        <View style={styles.itemRowWrap}>
                                            <Text style={styles.itemText} numberOfLines={3}>
                                                {item.name} – {formatCurrency(item.amount, selectedCurrency)}
                                                 {'\n'}<Text style={styles.itemDetailText}>Date: {item.date}</Text>
                                            </Text>
                                            <View style={styles.actions}>
                                                <TouchableOpacity onPress={() => {
                                                    setOneTimeModalVisible(false);
                                                    editSpend(item, 'one-time');
                                                 }}>
                                                    <Ionicons name="pencil" size={moderateScale(20)} color="blue" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => deleteSpend(item.id, 'one-time')}>
                                                    <Ionicons name="trash" size={moderateScale(20)} color="red" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                    style={styles.listScrollView}
                                />
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

            </ScrollView>
         </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
};

// --- Styles --- (Adjusted for Spend theme where applicable, added missing styles)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: moderateScale(15),
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    // Spend Card Style
    spendCard: {
        alignItems: 'center',
        backgroundColor: 'white',
        paddingVertical: verticalScale(15),
        paddingHorizontal: moderateScale(20),
        borderRadius: moderateScale(15),
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowRadius: moderateScale(8),
        elevation: 5,
        marginBottom: verticalScale(20),
    },
    cardTitle: {
        fontSize: moderateScale(16),
        color: '#555',
        marginTop: verticalScale(5),
    },
    cardAmount: { // Spend Amount Color
        fontSize: moderateScale(28),
        fontWeight: 'bold',
        color: '#FF6347', // Tomato Red
        marginVertical: verticalScale(5),
    },
    subText: { // Use subText for consistency
        fontSize: moderateScale(14),
        color: '#777',
        marginTop: verticalScale(2),
    },
     // Add Button Style (Spend Theme)
     addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFEBEE', // Lighter red background
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
        fontWeight: 'bold',
        fontSize: moderateScale(15),
        color: '#FF6347', // Match icon color
    },
     // View Buttons Container (Shared Style)
     viewButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: verticalScale(15),
        gap: moderateScale(10),
    },
    viewButton: { // Shared style for view buttons
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#FFCDD2', // Light pink border
        paddingVertical: verticalScale(10),
        paddingHorizontal: moderateScale(10),
        borderRadius: moderateScale(10),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: moderateScale(3),
        shadowOffset: { width: 0, height: verticalScale(1) },
        gap: moderateScale(5),
    },
    viewButtonText: { // Shared style for view button text
        color: '#FF4081',
        fontWeight: 'bold',
        fontSize: moderateScale(13),
    },
     // Item Row Styles (Shared)
     itemRowWrap: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        paddingVertical: verticalScale(10),
        paddingHorizontal: moderateScale(15),
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(8),
        borderWidth: 1,
        borderColor: '#eee',
    },
    itemText: {
        flex: 1,
        fontSize: moderateScale(14),
        color: '#333',
        marginRight: moderateScale(10),
    },
    itemDetailText: {
       fontSize: moderateScale(12),
       color: '#666',
       marginTop: verticalScale(2),
    },
    actions: { // Shared action style
        flexDirection: 'row',
        gap: moderateScale(15),
    },
    empty: { // Shared empty style
        fontStyle: 'italic',
        color: '#777',
        textAlign: 'center',
        marginTop: verticalScale(20),
        fontSize: moderateScale(14),
    },
    // Modal Styles (Shared structure, adapted colors)
    modalOverlay: { // Centered Add/Edit Modal
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: moderateScale(15),
    },
    modalOverlayZ: { // Slide-up List Modal
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: { // Centered Add/Edit Modal Content
        backgroundColor: 'white',
        padding: moderateScale(20),
        borderRadius: moderateScale(15),
        width: '100%',
        maxWidth: 500,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalContentZ: { // Slide-up List Modal Content
        backgroundColor: 'white',
        padding: moderateScale(15),
        borderTopLeftRadius: moderateScale(20),
        borderTopRightRadius: moderateScale(20),
        width: '100%',
        height: '30%',
        maxHeight: '60%',
        paddingBottom: verticalScale(30),
    },
     modalTitle: { // Shared modal title
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        marginBottom: verticalScale(15),
        textAlign: 'center',
        color: '#333',
    },
    // Modal Form Element Styles (Shared)
    inputLabel: {
        fontSize: moderateScale(13),
        color: '#555',
        marginBottom: verticalScale(5),
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        backgroundColor: '#fff',
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(10),
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(12),
        fontSize: moderateScale(14),
    },
    dateInput: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc',
        backgroundColor: '#f8f8f8',
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(12),
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(12),
    },
     androidPickerDone: {
        alignSelf: 'flex-end',
        paddingVertical: verticalScale(5),
        paddingHorizontal: moderateScale(10),
        marginTop: verticalScale(5),
    },
    androidPickerDoneText: {
        color: '#007AFF',
        fontSize: moderateScale(14),
        fontWeight: 'bold',
    },
    // Interval Button Styles (Adapted Theme)
    intervalContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: moderateScale(8),
        marginBottom: verticalScale(15),
    },
    intervalBtn: {
        paddingVertical: verticalScale(8),
        paddingHorizontal: moderateScale(12),
        backgroundColor: '#eee',
        borderRadius: moderateScale(20),
        borderWidth: 1,
        borderColor: '#ddd',
    },
    intervalBtnActive: { // Active Spend Interval
        backgroundColor: '#FFCDD2', // Light Pink/Red
        borderColor: '#EF9A9A',
    },
    intervalBtnText: {
        fontSize: moderateScale(13),
        color: '#333',
    },
    intervalBtnActiveText: { // Active Spend Interval Text
        color: '#C62828', // Darker Red
        fontWeight: 'bold',
    },
    // Save/Cancel Button Styles (Adapted Theme)
    saveButton: { // Spend Save Button
        backgroundColor: '#FF6347', // Tomato Red
        paddingVertical: verticalScale(13),
        borderRadius: moderateScale(10),
        alignItems: 'center',
        marginTop: verticalScale(10),
    },
    saveText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: moderateScale(15),
    },
    cancelButton: {
        paddingVertical: verticalScale(10),
        borderRadius: moderateScale(10),
        alignItems: 'center',
        marginTop: verticalScale(10),
    },
    cancelButtonText: {
        color: '#FF6347', // Tomato Red
        fontWeight: 'bold',
        fontSize: moderateScale(14),
    },
     listScrollView: {
        // Max height handled by modalContentZ
    },
    // Modal Toggle Buttons (Adapted Theme)
    modalToggleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: verticalScale(15),
        backgroundColor: '#f0f0f0',
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
        marginHorizontal: moderateScale(2),
        gap: moderateScale(5),
    },
    activeToggle: { // Active Spend Toggle
        backgroundColor: '#fceded', // Very Light Pink/Red
    },
    modalToggleText: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#555',
    },
    activeToggleText: { // Active Spend Toggle Text
       color: '#D32F2F', // Darker Red
       fontWeight: 'bold',
    },
     // Legacy styles no longer used directly but kept for reference if needed
     toggleRow: {}, // Replaced by modalToggleRow inside modal
     toggleBtn: {}, // Replaced by modalToggleBtn inside modal
     toggleText: {}, // Replaced by modalToggleText inside modal
     sectionTitle: {}, // Titles handled by modalTitle or separate Text components now
     item: {}, // Replaced by itemRowWrap
});

export default SpendTracker;