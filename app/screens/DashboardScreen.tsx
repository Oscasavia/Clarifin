import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PieChart } from 'react-native-chart-kit';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 400;

const DashboardScreen = () => {
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);

  const loadData = async () => {
    console.log("Loading Dashboard Data...");

    const savedIncome = await AsyncStorage.getItem('recurringIncome');
    const savedBills = await AsyncStorage.getItem('recurringBills');
    const savedSpends = await AsyncStorage.getItem('oneTimeSpends');

    let totalIncome = 0;
    let totalExpenses = 0;
    let spendCategories = {};

    if (savedIncome) {
      JSON.parse(savedIncome).forEach((income) => {
        totalIncome += parseFloat(income.amount);
      });
    }

    if (savedBills) {
      JSON.parse(savedBills).forEach((bill) => {
        totalExpenses += parseFloat(bill.amount);
        spendCategories[bill.name] = (spendCategories[bill.name] || 0) + bill.amount;
      });
    }

    if (savedSpends) {
      JSON.parse(savedSpends).forEach((spend) => {
        totalExpenses += parseFloat(spend.amount);
        spendCategories[spend.name] = (spendCategories[spend.name] || 0) + spend.amount;
      });
    }

    setIncome(totalIncome);
    setExpenses(totalExpenses);
    setNetBalance(totalIncome - totalExpenses);

    const pieData = Object.keys(spendCategories).map((key) => ({
      name: key,
      amount: spendCategories[key],
      color: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 1)`,
      legendFontColor: '#333',
      legendFontSize: isSmallScreen ? 14 : 16,
    }));

    setChartData(pieData);
    setExpenseBreakdown(pieData);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  return (
    <Animated.View entering={FadeIn.duration(800)} style={styles.container}>
      
      {/* Monthly Summary Card - Stays at the Top */}
      <View style={styles.card}>
        <View style={styles.summaryHeader}>
          <Ionicons name="bar-chart" size={30} color="#333" style={styles.icon} />
          <Text style={styles.title}>Monthly Summary</Text>
        </View>
        <Text style={styles.stat}>💰 Income: <Text style={styles.income}>${income.toFixed(2)}</Text></Text>
        <Text style={styles.stat}>💸 Expenses: <Text style={styles.expense}>${expenses.toFixed(2)}</Text></Text>
        <Text style={[styles.stat, { color: netBalance >= 0 ? 'green' : 'red' }]}>
          🏦 Net Balance: ${netBalance.toFixed(2)}
        </Text>
      </View>

      {/* Expense Breakdown Card */}
      {chartData.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Expense Breakdown</Text>
          <PieChart
            data={chartData}
            width={screenWidth * 0.95}
            height={isSmallScreen ? 160 : 300} 
            chartConfig={{
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor={'amount'}
            backgroundColor={'transparent'}
            paddingLeft={isSmallScreen ? '5' : '20'}
            absolute
          />
        </View>
      )}

    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    padding: 25, 
    borderRadius: 20,
    width: '95%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginBottom: 20, 
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: isSmallScreen ? 22 : 26, 
    fontWeight: 'bold',
  },
  stat: {
    fontSize: isSmallScreen ? 18 : 20, 
    marginVertical: 5,
    fontWeight: '600',
  },
  income: {
    color: 'green',
    fontWeight: 'bold',
  },
  expense: {
    color: 'red',
    fontWeight: 'bold',
  },
  chartContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    width: '95%',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
//   breakdownContainer: {
//     marginTop: 15,
//     width: '100%',
//     paddingHorizontal: 10,
//   },
//   breakdownItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 8,
//   },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  breakdownText: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '500',
  },
});

export default DashboardScreen;
