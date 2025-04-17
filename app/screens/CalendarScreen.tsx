import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, Modal, ActivityIndicator, TouchableWithoutFeedback, FlatList // Added FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar, DateData } from 'react-native-calendars';
import { MarkedDates } from 'react-native-calendars/src/types';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';

// Import context and formatting utility
import { useCurrency } from '../context/CurrencyContext'; // Adjust path
import { formatCurrency } from '../utils/formatting'; // Adjust path

// --- Type Definition for Intervals (Consistent with Spend/Receive) ---
type TransactionInterval = 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';

// --- Define Interfaces for Data Structures (Aligned with Spend/Receive) ---
interface TransactionItem {
    id: string; // Added ID
    name: string;
    amount: number;
}
interface RecurringItem extends TransactionItem {
    startDate: string; // ISO Date string 'YYYY-MM-DD' - Replaces day/startMonth/startYear
    interval: TransactionInterval; // Use consistent type, make mandatory
}
interface OneTimeItem extends TransactionItem { // Combined OneTimeSpend and OneTimeIncome
    date: string; // Full date string 'YYYY-MM-DD'
    type: 'spend' | 'income'; // Differentiate one-time types
}

// --- AsyncStorage Keys (Single Source of Truth) ---
const ASYNC_KEYS = {
    balance: 'balance', // Initial Balance Amount (from SalaryInput)
    startDate: 'balanceDate', // Start Date for Balance Calculation (from SalaryInput) - Renamed key for clarity
    recurringBills: 'recurringBills', // Kept separate for potential specific logic later if needed
    recurringIncome: 'recurringIncome',
    oneTimeSpends: 'oneTimeSpends',
    oneTimeIncome: 'oneTimeIncome',
    dotRangeYears: 'dotRangeYears' // For calendar marking range
};

// --- Helper Functions (Ideally move to utils.ts) ---
const parseISODate = (dateString: string): Date | null => {
    try {
        const datePart = dateString?.split('T')[0];
        if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
             console.warn("Invalid date format:", dateString);
             return null; // Return null if format is wrong
        }
        // Using Date.UTC ensures consistency regardless of local timezone when comparing dates
        const date = new Date(Date.UTC(
             parseInt(datePart.substring(0,4)),
             parseInt(datePart.substring(5,7)) - 1, // Month is 0-indexed
             parseInt(datePart.substring(8,10))
        ));

        if (isNaN(date.getTime())) {
            console.warn("Invalid date parsed:", dateString);
            return null;
        }
        return date; // Returns a Date object set to midnight UTC for that day
    } catch (e) {
        console.error("Error parsing date:", dateString, e);
        return null;
    }
};

const getNextOccurrence = (currentUTC: Date, interval: TransactionInterval): Date => {
    // IMPORTANT: Operate on UTC dates to avoid timezone shifts
    const next = new Date(currentUTC);
    switch (interval) {
        case 'weekly':
            next.setUTCDate(next.getUTCDate() + 7);
            break;
        case 'monthly':
            next.setUTCMonth(next.getUTCMonth() + 1);
            break;
        case 'quarterly':
            next.setUTCMonth(next.getUTCMonth() + 3);
            break;
        case 'biannually':
            next.setUTCMonth(next.getUTCMonth() + 6);
            break;
        case 'yearly':
            next.setUTCFullYear(next.getUTCFullYear() + 1);
            break;
    }
    return next;
};


// --- Component ---
const FinanceTracker = () => {
    const { selectedCurrency } = useCurrency();

    // State Variables
    const [initialBalance, setInitialBalance] = useState<number>(0);
    const [trackingStartDate, setTrackingStartDate] = useState<string>(''); // Date the initialBalance applies from
    const [adjustedBalance, setAdjustedBalance] = useState<number>(0); // Calculated balance for selectedDate
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('en-CA')); // Default to today 'YYYY-MM-DD'

    const [recurringBills, setRecurringBills] = useState<RecurringItem[]>([]);
    const [recurringIncome, setRecurringIncome] = useState<RecurringItem[]>([]);
    const [oneTimeSpends, setOneTimeSpends] = useState<OneTimeItem[]>([]); // Use combined type
    const [oneTimeIncomes, setOneTimeIncomes] = useState<OneTimeItem[]>([]); // Use combined type

    const [isModalVisible, setModalVisible] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [markedDates, setMarkedDates] = useState<MarkedDates>({});

    // Calendar Control State
    const todayString = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD' format
    const [calendarKey, setCalendarKey] = useState(Date.now());
    const [calendarVisibleMonth, setCalendarVisibleMonth] = useState<string>(todayString);
    // const calendarRef = useRef<typeof Calendar>(null); // Keep if imperative methods needed

    // --- NEW Recurring Item Validation ---
    const isValidRecurring = (item: RecurringItem, dateToCheckUTC: Date): boolean => {
        const itemStartDate = parseISODate(item.startDate);
        if (!itemStartDate) return false; // Invalid item start date

        // Normalize dateToCheck to midnight UTC for comparison
        const checkDateMidnightUTC = new Date(Date.UTC(
            dateToCheckUTC.getUTCFullYear(),
            dateToCheckUTC.getUTCMonth(),
            dateToCheckUTC.getUTCDate()
        ));

        // Check 1: Ensure the date to check is on or after the item's start date
        if (checkDateMidnightUTC < itemStartDate) {
            return false;
        }

        // Check 2: Iterate through occurrences from start date to find a match
        let occurrenceDate = new Date(itemStartDate); // Start from the item's UTC start date

        while (occurrenceDate <= checkDateMidnightUTC) {
            if (occurrenceDate.getTime() === checkDateMidnightUTC.getTime()) {
                return true; // Found a match
            }
            // Move to the next potential occurrence
            const nextOccurrence = getNextOccurrence(occurrenceDate, item.interval);
            // Prevent infinite loops if date doesn't advance (shouldn't happen with getNextOccurrence logic)
             if (nextOccurrence <= occurrenceDate) {
                console.warn("Recurring validation loop stuck for item:", item.id);
                break;
            }
            occurrenceDate = nextOccurrence;
        }

        return false; // No occurrence matched the dateToCheck
    };


    // --- Data Loading ---
    const loadFinanceData = useCallback(async () => {
        console.log("CalendarScreen: Loading finance data...");
        setIsLoading(true);
        try {
             // Fetch all required data using multiGet
             const keysToFetch = [
                 ASYNC_KEYS.balance,
                 ASYNC_KEYS.startDate, // <- This is the effective date of the balance
                 ASYNC_KEYS.recurringBills,
                 ASYNC_KEYS.recurringIncome,
                 ASYNC_KEYS.oneTimeSpends,
                 ASYNC_KEYS.oneTimeIncome
             ];
            const storedValues = await AsyncStorage.multiGet(keysToFetch);
            const dataMap = new Map(storedValues);

            // Set Initial Balance and its Effective Date
            setInitialBalance(parseFloat(dataMap.get(ASYNC_KEYS.balance) || '0'));
            let sDate = dataMap.get(ASYNC_KEYS.startDate);
             if (!sDate || !parseISODate(sDate)) { // Validate date format/existence
                 sDate = new Date().toLocaleDateString('en-CA'); // Default to today
                 await AsyncStorage.setItem(ASYNC_KEYS.startDate, sDate);
                 // If no balance date exists, maybe set balance to 0 too?
                  if (!dataMap.get(ASYNC_KEYS.balance)) {
                      await AsyncStorage.setItem(ASYNC_KEYS.balance, '0');
                      setInitialBalance(0);
                  }
             }
            setTrackingStartDate(sDate); // This is the date the 'initialBalance' is valid from

            // Helper to parse and validate data arrays
             const parseAndValidate = <T extends {id: string}>(key: string, defaultInterval?: TransactionInterval): T[] => {
                const jsonData = dataMap.get(key);
                let data: T[] = [];
                try {
                     data = jsonData ? JSON.parse(jsonData) : [];
                     if (!Array.isArray(data)) data = []; // Ensure it's an array
                 } catch (e) {
                    console.error(`Failed to parse JSON for key ${key}:`, e);
                    data = []; // Default to empty array on parse error
                 }
                 // Basic validation (can be expanded)
                 return data.filter(item => item && typeof item === 'object' && item.id) // Ensure items are objects with IDs
                          .map(item => ({
                              ...item,
                              // Ensure recurring items have a valid interval
                              ...(defaultInterval && !(item as any).interval && { interval: defaultInterval }),
                          })) as T[];
             };

             // Parse and Set Transaction Data
             setRecurringBills(parseAndValidate<RecurringItem>(ASYNC_KEYS.recurringBills, 'monthly'));
             setRecurringIncome(parseAndValidate<RecurringItem>(ASYNC_KEYS.recurringIncome, 'monthly'));

             // Adapt One-Time items to the new combined structure if needed
             // (Assuming they are already stored correctly based on Spend/Receive screens)
             const loadedOneTimeSpends = parseAndValidate<OneTimeItem>(ASYNC_KEYS.oneTimeSpends);
             const loadedOneTimeIncome = parseAndValidate<OneTimeItem>(ASYNC_KEYS.oneTimeIncome);

            // Add 'type' property if loading from old separate keys
            setOneTimeSpends(loadedOneTimeSpends.map(s => ({ ...s, type: 'spend' })));
            setOneTimeIncomes(loadedOneTimeIncome.map(i => ({ ...i, type: 'income' })));


        } catch (error) {
            console.error("Failed to load finance data:", error);
            Alert.alert("Error", "Could not load financial data.");
            // Set defaults on error
            setInitialBalance(0);
            setTrackingStartDate(new Date().toLocaleDateString('en-CA'));
            setRecurringBills([]);
            setRecurringIncome([]);
            setOneTimeSpends([]);
            setOneTimeIncomes([]);
        } finally {
            setIsLoading(false);
            console.log("CalendarScreen: Data loading finished.");
        }
    }, []); // No dependencies needed for initial load function itself


    // Use useFocusEffect for reliable data fetching when the screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadFinanceData();
            // Optional: Return a cleanup function if needed
            return () => {
                console.log("CalendarScreen unfocused");
            };
        }, [loadFinanceData]) // loadFinanceData is memoized
    );

     // --- REVISED Balance Calculation ---
     const calculateAdjustedBalance = useCallback((targetDateStr: string) => {
        if (!trackingStartDate || isLoading) {
            console.log("Balance calculation skipped: prerequisites not met (trackingStartDate, isLoading).");
            return;
        }

        const targetDateUTC = parseISODate(targetDateStr);
        const startDateUTC = parseISODate(trackingStartDate);

        if (!targetDateUTC || !startDateUTC) {
            console.error("Balance calculation failed: Invalid date format for target or start date.");
            setAdjustedBalance(NaN); // Indicate error state
            return;
        }
         console.log(`Calculating balance up to ${targetDateStr} starting from ${trackingStartDate} with initial ${initialBalance}`);


        let currentBalance = initialBalance;

        // --- Process Recurring Items ---
        const processRecurring = (items: RecurringItem[], type: 'income' | 'bill') => {
            items.forEach(item => {
                const itemStartDateUTC = parseISODate(item.startDate);
                if (!itemStartDateUTC || itemStartDateUTC > targetDateUTC) return; // Skip if start date invalid or after target

                let occurrenceDate = new Date(itemStartDateUTC);

                // Iterate occurrences FROM item's start date UP TO the target date
                while (occurrenceDate <= targetDateUTC) {
                     // Important Check: Only add/subtract if the occurrence is *also* on or after the global trackingStartDate
                    if (occurrenceDate >= startDateUTC) {
                        currentBalance += (type === 'income' ? item.amount : -item.amount);
                         // console.log(` -> ${type} ${item.name} on ${occurrenceDate.toLocaleDateString('en-CA')}: ${item.amount}. New Balance: ${currentBalance}`);
                    }

                    const nextOccurrence = getNextOccurrence(occurrenceDate, item.interval);
                     if (nextOccurrence <= occurrenceDate) {
                         console.warn("Recurring calculation loop stuck for item:", item.id);
                         break; // Prevent infinite loop
                     }
                     occurrenceDate = nextOccurrence;
                 }
             });
         };

         processRecurring(recurringIncome, 'income');
         processRecurring(recurringBills, 'bill');

        // --- Process One-Time Items ---
        const processOneTime = (items: OneTimeItem[]) => {
             items.forEach(item => {
                const itemDateUTC = parseISODate(item.date);
                 // Check if item date is valid AND falls within the [trackingStartDate, targetDateUTC] range
                 if (itemDateUTC && itemDateUTC >= startDateUTC && itemDateUTC <= targetDateUTC) {
                    currentBalance += (item.type === 'income' ? item.amount : -item.amount);
                     // console.log(` -> One-time ${item.type} ${item.name} on ${item.date}: ${item.amount}. New Balance: ${currentBalance}`);
                }
            });
        };

         processOneTime(oneTimeIncomes);
         processOneTime(oneTimeSpends);

        setAdjustedBalance(currentBalance);
        console.log(`Final calculated balance for ${targetDateStr}: ${currentBalance}`);

    }, [trackingStartDate, isLoading, initialBalance, recurringIncome, recurringBills, oneTimeIncomes, oneTimeSpends]);


    // --- Effects ---
    // Recalculate balance when relevant data changes or selected date changes
    useEffect(() => {
        if (selectedDate && trackingStartDate && !isLoading) {
            calculateAdjustedBalance(selectedDate);
        } else if (!isLoading) {
             // Handle case where selectedDate or trackingStartDate might be missing after load
             console.log("Skipping balance calculation due to missing selectedDate or trackingStartDate.");
             setAdjustedBalance(initialBalance); // Or perhaps NaN or 0 depending on desired behavior
        }
    }, [selectedDate, trackingStartDate, isLoading, initialBalance, calculateAdjustedBalance]); // Added initialBalance dependency

    // Regenerate marked dates when transaction data or selection changes
    useEffect(() => {
        const runGenerateMarkedDates = async () => {
            if (!isLoading) { // Only run if initial data load is complete
                console.log("Regenerating marked dates...");
                await generateMarkedDates();
            }
        };
        runGenerateMarkedDates();
        // Dependencies: All transaction sources, selectedDate (for highlighting), trackingStartDate (for range), isLoading guard
    }, [recurringBills, recurringIncome, oneTimeSpends, oneTimeIncomes, selectedDate, trackingStartDate, isLoading /* Added dependencies */]);

    // --- Marking Calendar Dates ---
    const generateMarkedDates = async () => {
        let marked: MarkedDates = {};
        const incomeDot = { key: 'income', color: 'green', selectedDotColor: 'darkgreen' }; // Recurring Income
        const billDot = { key: 'bill', color: 'red', selectedDotColor: 'darkred' };       // Recurring Bill
        const spendDot = { key: 'spend', color: 'blue', selectedDotColor: 'darkblue' };   // One-Time Spend
        const getDot = { key: 'get', color: 'pink', selectedDotColor: 'darkpink' };     // One-Time Income

        const addOrUpdateDot = (dateKey: string, dot: { key: string; color: string; selectedDotColor: string }) => {
            if (!marked[dateKey]) {
                marked[dateKey] = { dots: [] };
            }
            if (!Array.isArray(marked[dateKey].dots)) {
                marked[dateKey].dots = [];
            }
            if (!marked[dateKey].dots.some((d: any) => d.key === dot.key)) {
                 marked[dateKey].dots.push(dot);
            }
        };

        if (!trackingStartDate) {
            console.log("Cannot generate marked dates: trackingStartDate is not set.");
            setMarkedDates({});
            return;
        }

        let dotYears = 2; // Default future range
        try {
            const storedDotYears = await AsyncStorage.getItem(ASYNC_KEYS.dotRangeYears);
            if (storedDotYears !== null) {
                const parsedYears = parseInt(storedDotYears, 10);
                if (!isNaN(parsedYears) && parsedYears >= 0) { // Allow 0 years future view
                    dotYears = parsedYears;
                }
            }
        } catch (error) {
            console.error("Failed to read dotRangeYears from AsyncStorage:", error);
        }

        const rangeStartDate = parseISODate(trackingStartDate);
        if (!rangeStartDate) {
            console.error("Cannot generate marked dates: Invalid trackingStartDate.");
            setMarkedDates({});
            return;
        }

        const rangeEndDate = new Date(); // Today (local time)
        rangeEndDate.setFullYear(rangeEndDate.getFullYear() + dotYears);
        // Convert rangeEndDate to UTC midnight for consistent comparison
         const rangeEndDateUTC = new Date(Date.UTC(
            rangeEndDate.getFullYear(),
            rangeEndDate.getMonth(),
            rangeEndDate.getDate()
         ));


        // Combine all items for easier iteration
        const allRecurring = [
             ...recurringIncome.map(i => ({ ...i, type: 'income' as const })),
             ...recurringBills.map(b => ({ ...b, type: 'bill' as const }))
        ];
        const allOneTime = [
             ...oneTimeIncomes, // Already have type: 'income'
             ...oneTimeSpends   // Already have type: 'spend'
        ];

        // --- Mark Recurring Items ---
         allRecurring.forEach(item => {
            const itemStartDateUTC = parseISODate(item.startDate);
             if (!itemStartDateUTC) return; // Skip invalid items

             let occurrenceDate = new Date(itemStartDateUTC);

             // Iterate occurrences from item start date up to the range end date
             while (occurrenceDate <= rangeEndDateUTC) {
                 // Check if occurrence is also within the allowed marking start date (trackingStartDate)
                 if (occurrenceDate >= rangeStartDate) {
                     const dateKey = occurrenceDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
                     addOrUpdateDot(dateKey, item.type === 'income' ? incomeDot : billDot);
                 }

                 const nextOccurrence = getNextOccurrence(occurrenceDate, item.interval);
                 if (nextOccurrence <= occurrenceDate) break; // Prevent infinite loop
                 occurrenceDate = nextOccurrence;
             }
         });

        // --- Mark One-Time Items ---
         allOneTime.forEach(item => {
             const itemDateUTC = parseISODate(item.date);
             // Mark if the date is valid and within the overall range [trackingStartDate, rangeEndDate]
             if (itemDateUTC && itemDateUTC >= rangeStartDate && itemDateUTC <= rangeEndDateUTC) {
                addOrUpdateDot(item.date, item.type === 'income' ? getDot : spendDot);
            }
        });

        // Highlight the selected date *after* processing all dots
        if (selectedDate) {
             if (marked[selectedDate]) {
                 marked[selectedDate].selected = true;
                 marked[selectedDate].selectedColor = '#a9a9a9'; // Keep existing dots
                 if (!marked[selectedDate].dots) marked[selectedDate].dots = []; // Ensure dots array exists
             } else {
                 // If selected date had no dots, mark it just as selected
                 marked[selectedDate] = {
                     selected: true,
                     selectedColor: '#a9a9a9',
                     dots: [] // Initialize dots array
                 };
             }
        }

        setMarkedDates(marked);
    };


    // --- Deletion (Simplified - Assumes deletion happens in Spend/Receive screens) ---
    // If deletion needs to happen *from* the calendar modal, this would need full implementation
    // matching Spend/Receive screens, including identifying item type and using correct AsyncStorage key.
    // For now, we assume deletion triggers a data refresh via useFocusEffect.

    // --- Helper to get transactions FOR the selected date (For Modal Display) ---
    const getTransactionsForSelectedDate = useCallback(() => {
        if (!selectedDate) return { bills: [], income: [], oneTime: [] };

        const selectedDateUTC = parseISODate(selectedDate);
        if (!selectedDateUTC) return { bills: [], income: [], oneTime: [] }; // Invalid date selected


        const todaysRecurringBills = recurringBills.filter(bill =>
            isValidRecurring(bill, selectedDateUTC)
        );

        const todaysRecurringIncome = recurringIncome.filter(inc =>
             isValidRecurring(inc, selectedDateUTC)
        );

         // Combine and filter one-time items for the exact selected date
         const todaysOneTime = [
            ...oneTimeIncomes,
            ...oneTimeSpends
         ].filter(item => item.date === selectedDate);


        return {
            bills: todaysRecurringBills,
            income: todaysRecurringIncome,
            oneTime: todaysOneTime // Combined list for the modal
        };
    }, [selectedDate, recurringBills, recurringIncome, oneTimeIncomes, oneTimeSpends, isValidRecurring]); // Added isValidRecurring dependency

    // Get transactions for the modal
    const { bills: selectedDayBills, income: selectedDayIncome, oneTime: selectedDayOneTime } = getTransactionsForSelectedDate();
    const hasTransactionsOnSelectedDate = selectedDayBills.length > 0 || selectedDayIncome.length > 0 || selectedDayOneTime.length > 0;

    // --- Navigation ---
    const goToCurrentMonth = () => {
        const newTodayString = new Date().toLocaleDateString('en-CA');
        setCalendarVisibleMonth(newTodayString); // Control displayed month
        setSelectedDate(newTodayString); // Select today
        setCalendarKey(Date.now()); // Force re-render if needed
    };

    // --- Render ---
    if (isLoading && !trackingStartDate) { // Show loader only on initial app load before trackingStartDate is set
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text>Loading Finances...</Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Current Balance Card */}
                <View style={styles.balanceCard}>
                    <Ionicons name="wallet-outline" size={moderateScale(35)} color="#4CAF50" />
                    <Text style={styles.cardTitle}>Balance on {selectedDate || 'Select Date'}</Text>
                    <Text style={[styles.cardAmount, isNaN(adjustedBalance) && styles.errorText]}>
                        {isLoading ? <ActivityIndicator color="#4CAF50" /> :
                         selectedDate && !isNaN(adjustedBalance) ? formatCurrency(adjustedBalance, selectedCurrency) :
                         isNaN(adjustedBalance) ? 'Error Calculating' :
                         'N/A'}
                    </Text>
                    <Text style={styles.subText}>Tracking Since: {trackingStartDate || 'Not Set'}</Text>
                </View>

                <TouchableOpacity style={styles.goToTodayButton} onPress={goToCurrentMonth}>
                    <Ionicons name="calendar-outline" size={moderateScale(18)} color="#4CAF50" style={{ marginRight: 5 }} />
                    <Text style={styles.goToTodayButtonText}>Go to Current Month</Text>
                </TouchableOpacity>

                {/* Calendar Component */}
                 <Calendar
                    key={calendarKey}
                    current={calendarVisibleMonth}
                    onDayPress={(day: DateData) => {
                        setSelectedDate(day.dateString);
                        // Optional: Keep the calendar view centered on the selected month
                         // setCalendarVisibleMonth(day.dateString.substring(0, 7) + "-01");
                    }}
                    onMonthChange={(month: DateData) => {
                         setCalendarVisibleMonth(month.dateString);
                    }}
                    markedDates={markedDates}
                    markingType={'multi-dot'}
                    firstDay={1} // Start week on Monday
                    style={styles.calendar}
                    theme={{
                        arrowColor: '#4CAF50',
                        todayTextColor: '#4CAF50',
                        selectedDayBackgroundColor: '#a9a9a9', // Grey selection
                        selectedDayTextColor: '#ffffff',
                        dotColor: 'transparent', // Base dot color (we use custom dots)
                        selectedDotColor: '#ffffff', // Color of dots on selected day (can be overridden by custom dot style)
                        // Font scaling
                        textDayFontSize: moderateScale(14),
                        textMonthFontSize: moderateScale(16),
                        textDayHeaderFontSize: moderateScale(12),
                    }}
                />

                {/* Transactions Section */}
                <View style={styles.transactionsSection}>
                    <Text style={styles.sectionTitle}>Transactions for {selectedDate || 'selected date'}:</Text>

                    {selectedDate && hasTransactionsOnSelectedDate ? (
                        <TouchableOpacity
                            style={styles.viewTransactionsButton}
                            onPress={() => setModalVisible(true)}
                        >
                            <Text style={styles.viewTransactionsText}>View Transactions</Text>
                        </TouchableOpacity>
                    ) : selectedDate ? (
                        <Text style={styles.noTransactionsText}>No transactions recorded for this date.</Text>
                    ) : (
                         <Text style={styles.noTransactionsText}>Select a date to view transactions.</Text>
                    )}
                </View>


                {/* Modal for Transactions */}
                <Modal
                    visible={isModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                        <View style={styles.modalOverlay}>
                             {/* Prevent modal content from closing when touched */}
                            <TouchableWithoutFeedback>
                                <View style={styles.modalContent}>
                                    <Text style={styles.modalTitle}>Transactions for {selectedDate}</Text>
                                    <ScrollView contentContainerStyle={styles.modalScroll}>
                                        {/* Recurring Bills */}
                                        {selectedDayBills.length > 0 && <Text style={styles.subHeader}>Recurring Bills</Text>}
                                        {selectedDayBills.map((bill) => (
                                            <View key={bill.id} style={styles.transactionCard}>
                                                <Text style={styles.expenseText}>{bill.name}: {formatCurrency(bill.amount, selectedCurrency)}</Text>
                                                {/* Add Edit/Delete buttons here if needed, linking to SpendTracker logic */}
                                            </View>
                                        ))}

                                        {/* Recurring Income */}
                                        {selectedDayIncome.length > 0 && <Text style={styles.subHeader}>Recurring Income</Text>}
                                        {selectedDayIncome.map((income) => (
                                            <View key={income.id} style={styles.transactionCard}>
                                                <Text style={styles.incomeText}>{income.name}: {formatCurrency(income.amount, selectedCurrency)}</Text>
                                                 {/* Add Edit/Delete buttons here */}
                                            </View>
                                        ))}

                                        {/* One-Time Transactions */}
                                        {selectedDayOneTime.length > 0 && <Text style={styles.subHeader}>One-Time Transactions</Text>}
                                        {selectedDayOneTime.map((item) => (
                                            <View key={item.id} style={styles.transactionCard}>
                                                 <Text style={item.type === 'income' ? styles.incomeText : styles.expenseText}>
                                                     {item.name}: {formatCurrency(item.amount, selectedCurrency)} ({item.type})
                                                </Text>
                                                 {/* Add Edit/Delete buttons here */}
                                            </View>
                                        ))}

                                        {!hasTransactionsOnSelectedDate && (
                                            <Text style={styles.noTransactionsTextModal}>No transactions found for this date.</Text>
                                        )}

                                    </ScrollView>
                                    <TouchableOpacity style={styles.closeButtonAlt} onPress={() => setModalVisible(false)}>
                                          <Text style={styles.closeButtonTextAlt}>Close</Text>
                                     </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            </ScrollView>
        </GestureHandlerRootView>
    );
};

// --- Styles --- (Includes styles from original + modal styles, ensure consistency)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        padding: moderateScale(15),
        paddingBottom: verticalScale(30),
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    balanceCard: {
        backgroundColor: 'white',
        padding: moderateScale(20),
        borderRadius: moderateScale(15),
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
        marginBottom: verticalScale(20),
    },
    cardTitle: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#555',
        marginTop: verticalScale(5),
    },
    cardAmount: {
        fontSize: moderateScale(26),
        fontWeight: 'bold',
        color: '#4CAF50',
        marginTop: verticalScale(5),
        minHeight: moderateScale(30), // Ensure space while loading/calculating
    },
    errorText: {
         color: 'orange', // Indicate calculation errors
         fontSize: moderateScale(20),
    },
    subText: { // For Tracking Since date
        fontSize: moderateScale(12),
        color: '#888',
        marginTop: verticalScale(4),
    },
    calendar: {
        borderRadius: moderateScale(15),
        elevation: 3,
        marginBottom: verticalScale(20),
        borderWidth: 1,
        borderColor: '#eee'
    },
    goToTodayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e7f4e8',
        paddingVertical: verticalScale(8),
        paddingHorizontal: moderateScale(15),
        borderRadius: moderateScale(20),
        alignSelf: 'center',
        marginBottom: verticalScale(15),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    goToTodayButtonText: {
        color: '#4CAF50',
        fontSize: moderateScale(14),
        fontWeight: '600',
    },
     transactionsSection: {
        marginTop: verticalScale(10),
        backgroundColor: 'white',
        padding: moderateScale(15),
        borderRadius: moderateScale(10),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    sectionTitle: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        marginBottom: verticalScale(10),
        color: '#333',
    },
    subHeader: {
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        color: '#666',
        marginTop: verticalScale(10),
        marginBottom: verticalScale(5),
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: verticalScale(3),
    },
    viewTransactionsButton: {
        marginTop: verticalScale(10),
        paddingVertical: verticalScale(12),
        paddingHorizontal: moderateScale(20),
        backgroundColor: '#e7f4e8',
        borderRadius: moderateScale(10),
        alignItems: 'center',
        elevation: 2,
    },
    viewTransactionsText: {
        color: '#4CAF50',
        fontSize: moderateScale(15),
        fontWeight: 'bold',
    },
    noTransactionsText: {
        textAlign: 'center',
        marginTop: verticalScale(10),
        fontStyle: 'italic',
        color: '#777',
        fontSize: moderateScale(14),
    },
    noTransactionsTextModal: {
        textAlign: 'center',
        marginTop: verticalScale(20),
        fontStyle: 'italic',
        color: '#777',
        fontSize: moderateScale(14),
    },
    // --- Modal Styles ---
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end', // Position modal at the bottom
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: moderateScale(20),
        paddingBottom: verticalScale(15), // Reduced bottom padding
        borderTopLeftRadius: moderateScale(20),
        borderTopRightRadius: moderateScale(20),
        width: '100%',
        maxHeight: '70%', // Limit height
        elevation: 10,
    },
    modalScroll: {
        paddingBottom: verticalScale(10), // Padding inside scroll view
    },
    modalTitle: {
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        marginBottom: verticalScale(15),
        textAlign: 'center',
        color: '#333',
    },
    transactionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        paddingVertical: verticalScale(12),
        paddingHorizontal: moderateScale(15),
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(7),
        borderWidth: 1,
        borderColor: '#eee',
    },
    incomeText: {
        color: 'green',
        fontWeight: '500',
        fontSize: moderateScale(14),
        flexShrink: 1, // Allow text to wrap if needed
        paddingRight: 10,
    },
    expenseText: {
        color: 'red',
        fontWeight: '500',
        fontSize: moderateScale(14),
        flexShrink: 1, // Allow text to wrap
        paddingRight: 10,
    },
    closeButtonAlt: { // Alternative close button style
         marginTop: verticalScale(15),
         backgroundColor: '#a9a9a9', // Grey button
         paddingVertical: verticalScale(10),
         paddingHorizontal: moderateScale(20),
         borderRadius: moderateScale(10),
         alignItems: 'center',
         alignSelf: 'center', // Center the button
     },
     closeButtonTextAlt: {
         color: 'white',
         fontWeight: 'bold',
         fontSize: moderateScale(15),
     },
     // Remove original closeButton styles if closeButtonAlt is used
     // closeButton: { ... },
     // closeButtonText: { ... },
});

export default FinanceTracker;