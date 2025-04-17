import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Alert, KeyboardAvoidingView, ScrollView, TouchableOpacity } from 'react-native'; // Added TouchableOpacity
import AsyncStorage from '@react-native-async-storage/async-storage';
import DropDownPicker from 'react-native-dropdown-picker';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useCurrency, CURRENCIES, CurrencyCode } from '../context/CurrencyContext'; // Adjust path
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons

// --- Assume ASYNC_KEYS is defined centrally or define needed keys here ---
const ASYNC_KEYS = {
    dotRangeYears: 'dotRangeYears',
};
// --- End ASYNC_KEYS ---


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

    // Effect to sync local currency value with context and load dot range
    useEffect(() => {
        setCurrencyValue(selectedCurrency);

        const loadSettings = async () => {
             try {
                const storedDotRange = await AsyncStorage.getItem(ASYNC_KEYS.dotRangeYears);
                 if (storedDotRange !== null) {
                    const parsedValue = parseInt(storedDotRange, 10);
                     if (!isNaN(parsedValue) && dotPickerItems.some(item => item.value === parsedValue)) {
                        setDotRangeValue(parsedValue);
                     } else {
                         setDotRangeValue(2);
                         await AsyncStorage.setItem(ASYNC_KEYS.dotRangeYears, '2');
                     }
                } else {
                     await AsyncStorage.setItem(ASYNC_KEYS.dotRangeYears, '2');
                     setDotRangeValue(2);
                 }
             } catch (error) {
                 console.error("Failed to load dot range setting:", error);
                 Alert.alert("Error", "Could not load calendar range setting.");
                 setDotRangeValue(2);
            }
        };

        loadSettings();
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

    // Close other picker when one opens
     const onCurrencyOpen = useCallback(() => {
        setDotPickerOpen(false);
    }, []);

    const onDotRangeOpen = useCallback(() => {
         setCurrencyPickerOpen(false);
    }, []);

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
});

export default SettingsScreen;