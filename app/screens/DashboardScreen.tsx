import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl, ScaledSize } from 'react-native'; // Removed TouchableOpacity, DateTimePicker unless needed later
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCurrency } from '../context/CurrencyContext'; // Adjust path
import { formatCurrency } from '../utils/formatting'; // Adjust path
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';

// --- Import Interfaces & Keys (Assume these are defined centrally or copy definitions) ---
type TransactionInterval = 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';

interface TransactionItem {
    id: string;
    name: string;
    amount: number;
}
interface RecurringItem extends TransactionItem {
    startDate: string; // ISO Date string 'YYYY-MM-DD'
    interval: TransactionInterval;
}
interface OneTimeItem extends TransactionItem {
    date: string; // Full date string 'YYYY-MM-DD'
    type: 'spend' | 'income'; // Differentiate one-time types
}

// --- AsyncStorage Keys (Assume defined centrally or copy definition) ---
const ASYNC_KEYS = {
    recurringBills: 'recurringBills',
    recurringIncome: 'recurringIncome',
    oneTimeSpends: 'oneTimeSpends',
    oneTimeIncome: 'oneTimeIncome',
    // Add balance/startDate if needed by dashboard features later
};

// --- Helper Functions (Assume defined centrally or copy definitions) ---
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
        return date;
    } catch (e) { return null; }
};

const getNextOccurrence = (currentUTC: Date, interval: TransactionInterval): Date => {
    const next = new Date(currentUTC);
    switch (interval) {
        case 'weekly': next.setUTCDate(next.getUTCDate() + 7); break;
        case 'monthly': next.setUTCMonth(next.getUTCMonth() + 1); break;
        case 'quarterly': next.setUTCMonth(next.getUTCMonth() + 3); break;
        case 'biannually': next.setUTCMonth(next.getUTCMonth() + 6); break;
        case 'yearly': next.setUTCFullYear(next.getUTCFullYear() + 1); break;
    }
    return next;
};
// --- End Helper Functions ---


const DashboardScreen = () => {
    const { selectedCurrency } = useCurrency();

    // State for chart data and summary
    const [dailyIncomeData, setDailyIncomeData] = useState<number[]>([]);
    const [dailyExpenseData, setDailyExpenseData] = useState<number[]>([]);
    const [chartLabels, setChartLabels] = useState<string[]>([]);
    const [currentMonthTotals, setCurrentMonthTotals] = useState({ income: 0, expense: 0, net: 0 });
    const [currentMonthYearLabel, setCurrentMonthYearLabel] = useState<string>('');

    // UI State
    const [refreshing, setRefreshing] = useState(false);
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width - moderateScale(30)); // Adjusted padding

    // Helper to ensure data is numeric
    const sanitize = (arr: number[]) => arr.map(v => (typeof v === 'number' && isFinite(v) ? v : 0));

    // --- REVISED Data Loading and Calculation ---
    const loadDashboardData = useCallback(async () => {
        console.log("Dashboard: Loading data...");
        try {
            // Fetch all transaction data
            const keysToFetch = [
                ASYNC_KEYS.recurringIncome,
                ASYNC_KEYS.oneTimeIncome,
                ASYNC_KEYS.recurringBills,
                ASYNC_KEYS.oneTimeSpends
            ];
            const storedValues = await AsyncStorage.multiGet(keysToFetch);
            const dataMap = new Map(storedValues);

            // Helper to parse and validate data arrays (ensure types match)
             const parseAndValidate = <T extends {id: string}>(key: string, itemType?: 'income' | 'spend', defaultInterval?: TransactionInterval): T[] => {
                const jsonData = dataMap.get(key);
                let data: T[] = [];
                try {
                     data = jsonData ? JSON.parse(jsonData) : [];
                     if (!Array.isArray(data)) data = [];
                 } catch (e) {
                    console.error(`Failed to parse JSON for key ${key}:`, e); data = [];
                 }
                 return data.filter(item => item && typeof item === 'object' && item.id)
                          .map(item => ({
                              ...item,
                              // Assign type if loading from separate one-time keys
                              ...(itemType && !(item as any).type && { type: itemType }),
                              // Ensure recurring items have interval
                               ...(defaultInterval && !(item as any).interval && { interval: defaultInterval }),
                          })) as T[];
             };

            const recurringIncome: RecurringItem[] = parseAndValidate<RecurringItem>(ASYNC_KEYS.recurringIncome, undefined, 'monthly');
            const recurringBills: RecurringItem[] = parseAndValidate<RecurringItem>(ASYNC_KEYS.recurringBills, undefined, 'monthly');
             // Assuming one-time items are stored with a 'type' property now
            const oneTimeIncome: OneTimeItem[] = parseAndValidate<OneTimeItem>(ASYNC_KEYS.oneTimeIncome, 'income');
            const oneTimeSpends: OneTimeItem[] = parseAndValidate<OneTimeItem>(ASYNC_KEYS.oneTimeSpends, 'spend');

            // Combine one-time items for easier processing
            const allOneTimeItems = [...oneTimeIncome, ...oneTimeSpends];

            // --- Calculations for the CURRENT month ---
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonthIndex = now.getMonth(); // 0-indexed

            setCurrentMonthYearLabel(now.toLocaleString('default', { month: 'long', year: 'numeric' }));

            const daysInCurrentMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
            const startOfMonthUTC = new Date(Date.UTC(currentYear, currentMonthIndex, 1));
            const endOfMonthUTC = new Date(Date.UTC(currentYear, currentMonthIndex, daysInCurrentMonth, 23, 59, 59, 999));

            // Initialize arrays for daily totals and overall month totals
            const incomeArr = Array(daysInCurrentMonth).fill(0);
            const expenseArr = Array(daysInCurrentMonth).fill(0);
            let monthIncomeTotal = 0;
            let monthExpenseTotal = 0;

            // Process Recurring Income
            recurringIncome.forEach(item => {
                const itemStartDateUTC = parseISODate(item.startDate);
                if (!itemStartDateUTC || itemStartDateUTC > endOfMonthUTC) return;

                let occurrenceDate = new Date(itemStartDateUTC);
                while (occurrenceDate <= endOfMonthUTC) {
                    // Check if the occurrence falls within the *current* month
                    if (occurrenceDate >= startOfMonthUTC) {
                        const dayOfMonth = occurrenceDate.getUTCDate(); // 1-based day
                        if (dayOfMonth >= 1 && dayOfMonth <= daysInCurrentMonth) {
                            incomeArr[dayOfMonth - 1] += item.amount;
                        }
                        monthIncomeTotal += item.amount;
                    }
                    const nextOccurrence = getNextOccurrence(occurrenceDate, item.interval);
                    if (nextOccurrence <= occurrenceDate) break; // Safety break
                    occurrenceDate = nextOccurrence;
                }
            });

            // Process Recurring Bills
            recurringBills.forEach(item => {
                const itemStartDateUTC = parseISODate(item.startDate);
                if (!itemStartDateUTC || itemStartDateUTC > endOfMonthUTC) return;

                let occurrenceDate = new Date(itemStartDateUTC);
                while (occurrenceDate <= endOfMonthUTC) {
                    if (occurrenceDate >= startOfMonthUTC) {
                         const dayOfMonth = occurrenceDate.getUTCDate();
                         if (dayOfMonth >= 1 && dayOfMonth <= daysInCurrentMonth) {
                            expenseArr[dayOfMonth - 1] += item.amount;
                        }
                        monthExpenseTotal += item.amount;
                    }
                    const nextOccurrence = getNextOccurrence(occurrenceDate, item.interval);
                    if (nextOccurrence <= occurrenceDate) break;
                    occurrenceDate = nextOccurrence;
                }
            });

            // Process One-Time Items
            allOneTimeItems.forEach(item => {
                const itemDateUTC = parseISODate(item.date);
                // Check if the item's date falls within the current month
                if (itemDateUTC && itemDateUTC >= startOfMonthUTC && itemDateUTC <= endOfMonthUTC) {
                    const dayOfMonth = itemDateUTC.getUTCDate();
                     if (dayOfMonth >= 1 && dayOfMonth <= daysInCurrentMonth) {
                        if (item.type === 'income') {
                            incomeArr[dayOfMonth - 1] += item.amount;
                        } else { // 'spend'
                            expenseArr[dayOfMonth - 1] += item.amount;
                        }
                    }
                    // Add to monthly totals
                    if (item.type === 'income') {
                        monthIncomeTotal += item.amount;
                    } else {
                        monthExpenseTotal += item.amount;
                    }
                }
            });

            // Finalize data for state update
            const safeDailyIncome = sanitize(incomeArr);
            const safeDailyExpenses = sanitize(expenseArr);
            // Create labels (days 1 to N)
            const labelsArr = Array.from({ length: daysInCurrentMonth }, (_, i) => (i + 1).toString());

            setDailyIncomeData(safeDailyIncome);
            setDailyExpenseData(safeDailyExpenses);
            setChartLabels(labelsArr);
            setCurrentMonthTotals({
                income: monthIncomeTotal,
                expense: monthExpenseTotal,
                net: monthIncomeTotal - monthExpenseTotal
            });
             console.log("Dashboard: Data loaded successfully.");

        } catch (err) {
            console.error("Failed to load or process dashboard data:", err);
             // Set empty state on error
             setDailyIncomeData([]);
             setDailyExpenseData([]);
             setChartLabels([]);
             setCurrentMonthTotals({ income: 0, expense: 0, net: 0 });
             setCurrentMonthYearLabel('Error Loading Data');
        }
    }, []); // No dependencies needed for the load function itself

    // --- Effects ---
    // Update screen width on dimension change
    useEffect(() => {
        const onChange = ({ window }: { window: ScaledSize }) => {
            setScreenWidth(window.width - moderateScale(30)); // Use moderateScale for padding
        };
        const subscription = Dimensions.addEventListener('change', onChange);
        return () => subscription?.remove();
    }, []);

    // Initial load
    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]); // Dependency ensures it runs once memoized function is created

    // Reload on screen focus
    useFocusEffect(
        useCallback(() => {
            loadDashboardData();
        }, [loadDashboardData])
    );

    // Refresh control handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadDashboardData().finally(() => setRefreshing(false)); // Use finally to ensure refreshing stops
    }, [loadDashboardData]);

    // Check if there's any data to display in the chart
    const showEmptyChartMessage = dailyIncomeData.every(val => val === 0) && dailyExpenseData.every(val => val === 0);

    // --- Chart Configuration ---
     const chartConfig = {
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        // backgroundGradientFromOpacity: 0,
        // backgroundGradientToOpacity: 0.5,
        color: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`, // Grid/label color
        labelColor: (opacity = 1) => `rgba(50, 50, 50, ${opacity})`, // Axis label color
        strokeWidth: 2, // optional, default 3
        barPercentage: 0.5,
        useShadowColorFromDataset: false, // optional
        decimalPlaces: 0, // Show whole numbers on axis
        propsForDots: { // Style the dots on the lines
           r: "3", // Radius
           strokeWidth: "1",
           stroke: "#aaaaaa"
       },
        propsForBackgroundLines: { // Style the background grid lines
            stroke: '#e8e8e8', // Lighter grid lines
            strokeDasharray: '', // Solid lines
       },
    };

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Summary Card */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <Ionicons name="stats-chart-outline" size={moderateScale(26)} color="#333" style={styles.icon} />
                    <Text style={styles.title}>Monthly Summary</Text>
                </View>
                <Text style={styles.monthHeader}>{currentMonthYearLabel}</Text>
                <View style={styles.summaryDetails}>
                     <View style={styles.summaryRow}>
                         <Text style={styles.summaryLabel}>💰 Income:</Text>
                         <Text style={[styles.summaryValue, styles.income]}>{formatCurrency(currentMonthTotals.income, selectedCurrency)}</Text>
                     </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>💸 Expenses:</Text>
                        <Text style={[styles.summaryValue, styles.expense]}>{formatCurrency(currentMonthTotals.expense, selectedCurrency)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>🏦 Net:</Text>
                        <Text style={[styles.summaryValue, styles.net]}>{formatCurrency(currentMonthTotals.net, selectedCurrency)}</Text>
                     </View>
                 </View>
            </View>

            {/* Chart Section */}
             <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Daily Activity</Text>
                {showEmptyChartMessage ? (
                    <View style={styles.chartPlaceholder}>
                        <Ionicons name="cloud-offline-outline" size={moderateScale(40)} color="#bbb" />
                        <Text style={styles.placeholderText}>No income or expense data recorded for this month.</Text>
                    </View>
                ) : (
                    <LineChart
                        data={{
                            labels: chartLabels, // Days 1 to N
                            datasets: [
                                {
                                     data: dailyIncomeData,
                                     color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Green for income #4CAF50
                                     strokeWidth: 2,
                                 },
                                {
                                     data: dailyExpenseData,
                                     color: (opacity = 1) => `rgba(255, 99, 71, ${opacity})`, // Tomato for expense #FF6347
                                     strokeWidth: 2,
                                 }
                            ],
                             legend: ["Income", "Expenses"] // Add legend
                        }}
                        width={screenWidth} // Use dynamic screen width
                        height={verticalScale(200)} // Use verticalScale for height
                        chartConfig={chartConfig}
                        bezier // Smooth lines
                        style={styles.chartStyle}
                         // Hide labels/dots if too cluttered
                         withInnerLines={true} // Show subtle inner grid lines
                         withOuterLines={true}
                         withDots={dailyIncomeData.length <= 15} // Show dots only if not too many data points
                         withVerticalLabels={dailyIncomeData.length <= 15} // Show day numbers only if not too many
                         withHorizontalLabels={true}
                         // formatXLabel={(value) => `${value}`} // Show day number if withVerticalLabels is true
                    />
                )}
             </View>

        </ScrollView>
    );
};

// --- Styles --- (Refined for better presentation)
const styles = StyleSheet.create({
    container: {
        padding: moderateScale(15),
        backgroundColor: '#f8f9fa', // Lighter background
        flexGrow: 1,
    },
    summaryCard: {
        backgroundColor: '#ffffff',
        borderRadius: moderateScale(12),
        padding: moderateScale(20),
        marginBottom: verticalScale(20),
        shadowColor: '#000',
        shadowOpacity: 0.08, // Subtle shadow
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowRadius: moderateScale(10),
        elevation: 4, // Slightly more elevation
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center header
        marginBottom: verticalScale(10),
        paddingBottom: verticalScale(10),
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    icon: {
        marginRight: moderateScale(8),
    },
    title: {
        fontSize: moderateScale(20), // Slightly smaller title
        fontWeight: 'bold',
        color: '#343a40' // Darker grey title
    },
    monthHeader: {
        fontSize: moderateScale(16),
        fontWeight: '600', // Semi-bold
        color: '#6c757d', // Medium grey
        marginBottom: verticalScale(15),
        textAlign: 'center',
    },
    summaryDetails: {
         width: '100%', // Take full width
    },
     summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(8),
        paddingVertical: verticalScale(4),
    },
    summaryLabel: {
        fontSize: moderateScale(15),
        color: '#495057', // Dark grey label
        fontWeight: '500',
    },
    summaryValue: {
        fontSize: moderateScale(15),
        fontWeight: 'bold',
    },
    income: { color: '#28a745' }, // Bootstrap success green
    expense: { color: '#dc3545' }, // Bootstrap danger red
    net: { color: '#007bff' }, // Bootstrap primary blue
    chartContainer: {
         backgroundColor: '#ffffff',
         borderRadius: moderateScale(12),
         paddingVertical: verticalScale(15),
         paddingHorizontal: moderateScale(5), // Less horizontal padding for chart
         shadowColor: '#000',
         shadowOpacity: 0.08,
         shadowOffset: { width: 0, height: verticalScale(4) },
         shadowRadius: moderateScale(10),
         elevation: 4,
         alignItems: 'center', // Center chart horizontally
    },
    chartTitle: {
         fontSize: moderateScale(16),
         fontWeight: 'bold',
         color: '#343a40',
         marginBottom: verticalScale(10),
    },
    chartStyle: {
        borderRadius: moderateScale(8), // Match container border radius
        // marginVertical: verticalScale(8), // Removed, handled by container padding
    },
    chartPlaceholder: {
        height: verticalScale(200), // Match chart height
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%', // Take full width within container
        padding: moderateScale(20),
    },
    placeholderText: {
        textAlign: 'center',
        color: '#888',
        marginTop: verticalScale(10),
        fontSize: moderateScale(14)
    },
});

export default DashboardScreen;