import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, ScrollView, Modal, ToastAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';

const FinanceTracker = ({ navigation}) => {
  const [salary, setSalary] = useState(0);
  const [initialBalance, setInitialBalance] = useState(0);
  const [adjustedBalance, setAdjustedBalance] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [dailyTransactions, setDailyTransactions] = useState({});
  const [recurringBills, setRecurringBills] = useState([]);
  const [recurringIncome, setRecurringIncome] = useState([]);
  const [oneTimeSpends, setOneTimeSpends] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  // const [markedDates, setMarkedDates] = useState({});

  useEffect(() => {
    loadFinanceData();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      calculateAdjustedBalance(selectedDate);
    }
  }, [selectedDate, initialBalance, salary, recurringBills, recurringIncome, oneTimeSpends]);

  useEffect(() => {
    generateMarkedDates();
  }, [recurringBills, recurringIncome, oneTimeSpends]);

  useEffect(() => {
    const reloadData = async () => {
      const savedBills = await AsyncStorage.getItem('recurringBills');
      const savedIncome = await AsyncStorage.getItem('recurringIncome');
      const savedSpends = await AsyncStorage.getItem('oneTimeSpends');
  
      if (savedBills) setRecurringBills(JSON.parse(savedBills) || []);
      if (savedIncome) setRecurringIncome(JSON.parse(savedIncome) || []);
      if (savedSpends) setOneTimeSpends(JSON.parse(savedSpends) || []);
    };
  
    const unsubscribe = navigation.addListener('focus', () => {
      reloadData();
    });
  
    return unsubscribe;
  }, [navigation]);

  const loadFinanceData = async () => {
    const savedSalary = await AsyncStorage.getItem('salary');
    const savedBalance = await AsyncStorage.getItem('balance');
    const savedTransactions = await AsyncStorage.getItem('transactions');
    const savedBills = await AsyncStorage.getItem('recurringBills');
    const savedIncome = await AsyncStorage.getItem('recurringIncome');
    const savedOneTimeSpends = await AsyncStorage.getItem('oneTimeSpends');
    const savedStartDate = await AsyncStorage.getItem('startDate');

    if (savedSalary) setSalary(parseFloat(savedSalary));
    if (savedBalance) setInitialBalance(parseFloat(savedBalance));
    if (savedTransactions) setDailyTransactions(JSON.parse(savedTransactions) || {});
    if (savedBills) setRecurringBills(JSON.parse(savedBills) || []);
    if (savedIncome) setRecurringIncome(JSON.parse(savedIncome) || []);
    if (savedOneTimeSpends) setOneTimeSpends(JSON.parse(savedOneTimeSpends) || []);

    if (savedStartDate) {
      setStartDate(savedStartDate);
    } else {
      const today = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem('startDate', today);
      setStartDate(today);
    }
  };

  const generateMarkedDates = () => {
    let marked = {};
  
    const currentYear = new Date().getFullYear();
    const futureYears = 5; // Define how many years ahead to mark
    const months = Array.from({ length: 12 }, (_, i) => i + 1); // [1, 2, 3, ..., 12]
  
    // Recurring Income (Green Dot)
    recurringIncome.forEach((income) => {
      for (let year = currentYear; year <= currentYear + futureYears; year++) {
        months.forEach((month) => {
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(income.date).padStart(2, '0')}`;
          if (!marked[dateKey]) {
            marked[dateKey] = { dots: [{ color: 'green' }] };
          } else if (!marked[dateKey].dots.some(dot => dot.color === 'green')) {
            marked[dateKey].dots.push({ color: 'green' });
          }
        });
      }
    });
  
    // Recurring Bills (Red Dot)
    recurringBills.forEach((bill) => {
      for (let year = currentYear; year <= currentYear + futureYears; year++) {
        months.forEach((month) => {
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(bill.date).padStart(2, '0')}`;
          if (!marked[dateKey]) {
            marked[dateKey] = { dots: [{ color: 'red' }] };
          } else if (!marked[dateKey].dots.some(dot => dot.color === 'red')) {
            marked[dateKey].dots.push({ color: 'red' });
          }
        });
      }
    });
  
    // One-Time Spends (Blue Dot) - These are already date-specific
    oneTimeSpends.forEach((spend) => {
      const dateKey = spend.date;
      if (!marked[dateKey]) {
        marked[dateKey] = { dots: [{ color: 'blue' }] };
      } else if (!marked[dateKey].dots.some(dot => dot.color === 'blue')) {
        marked[dateKey].dots.push({ color: 'blue' });
      }
    });
  
    // Highlight the selected date
    if (selectedDate) {
      marked[selectedDate] = {
        // ...marked[selectedDate], // Preserve existing dots
        selected: true,
        selectedColor: 'grey',
      };
    }
  
    return marked;
  };

  const calculateAdjustedBalance = (date) => {
    let [year, month, day] = date.split('-').map(Number);
    if (!startDate) return;
    let [startYear, startMonth] = startDate.split('-').map(Number);

    let newBalance = initialBalance;

    for (let y = startYear; y <= year; y++) {
      for (let m = (y === startYear ? startMonth : 1); m <= (y === year ? month : 12); m++) {
        recurringBills.forEach((bill) => {
          if (bill.date <= day || y > startYear || m > startMonth) {
            newBalance -= bill.amount;
          }
        });

        recurringIncome.forEach((income) => {
          if (income.date <= day || y > startYear || m > startMonth) {
            newBalance += income.amount;
          }
        });

        oneTimeSpends.forEach((spend) => {
          if (spend.date === date) {
            newBalance -= spend.amount;
          }
        });
      }
    }
    setAdjustedBalance(newBalance.toFixed(2));
  };

  const deleteTransaction = async (type, item) => {
    let updatedList;
    if (type === 'bill') {
      updatedList = recurringBills.filter(bill => bill !== item);
      setRecurringBills(updatedList);
      await AsyncStorage.setItem('recurringBills', JSON.stringify(updatedList));
    } else if (type === 'income') {
      updatedList = recurringIncome.filter(income => income !== item);
      setRecurringIncome(updatedList);
      await AsyncStorage.setItem('recurringIncome', JSON.stringify(updatedList));
    } else if (type === 'one-time') {
      updatedList = oneTimeSpends.filter(spend => spend !== item);
      setOneTimeSpends(updatedList);
      await AsyncStorage.setItem('oneTimeSpends', JSON.stringify(updatedList));
    }

    calculateAdjustedBalance(selectedDate);
  };

  const confirmDeleteTransaction = (type, item) => {
    Alert.alert(
      `Delete ${type === 'bill' ? 'Recurring Bill' : type === 'income' ? 'Recurring Income' : 'One-Time Spend'}`,
      `Are you sure you want to delete ${item.name} of $${item.amount}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: () => deleteTransaction(type, item),
          style: "destructive"
        }
      ]
    );
  };

  // Check if there are transactions for the selected date
  const hasTransactions = () => {
    if (!selectedDate) return false;
  
    return (
      recurringBills.some((bill) => parseInt(bill.date) === parseInt(selectedDate.split('-')[2])) ||
      recurringIncome.some((income) => parseInt(income.date) === parseInt(selectedDate.split('-')[2])) ||
      oneTimeSpends.some((spend) => spend.date === selectedDate)
    );
  };

  return (
    <View style={styles.container}>
      {/* Current Balance Card */}
      <View style={styles.balanceCard}>
        <Ionicons name="wallet-outline" size={40} color="#4CAF50" />
        <Text style={styles.cardTitle}>Account Balance</Text>
        <Text style={styles.cardAmount}>${adjustedBalance}</Text>
      </View>

      {/* Calendar Component */}
      <Calendar
        onDayPress={(day) => setSelectedDate(day.dateString)}
        // markedDates={{ [selectedDate]: { selected: true } }}
        markedDates={generateMarkedDates()}
        markingType={'multi-dot'} // Enable multi-dot marking
        minDate={startDate}
        style={styles.calendar}
      />

      <Text style={styles.sectionTitle}>Transactions for {selectedDate}:</Text>

      {/* Conditionally show the View Transactions button */}
      {selectedDate && hasTransactions() ? (
        <TouchableOpacity
          style={styles.viewTransactionsButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.viewTransactionsText}>View Transactions</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noTransactionsText}>No transactions for this date.</Text>
      )}

      {/* Modal for Transactions */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Transactions for {selectedDate}</Text>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
              {recurringBills.map((bill, index) => (
                parseInt(bill.date) == parseInt(selectedDate.split('-')[2]) && (
                  <View key={index} style={styles.transactionCard}>
                    <Text style={styles.expenseText}>{bill.name}: ${bill.amount}</Text>
                    <TouchableOpacity onPress={() => confirmDeleteTransaction('bill', bill)}>
                      <Ionicons name="trash" size={22} color="red" />
                    </TouchableOpacity>
                  </View>
                )
              ))}

              {recurringIncome.map((income, index) => (
                parseInt(income.date) == parseInt(selectedDate.split('-')[2]) && (
                  <View key={index} style={styles.transactionCard}>
                    <Text style={styles.incomeText}>{income.name}: ${income.amount}</Text>
                    <TouchableOpacity onPress={() => confirmDeleteTransaction('income', income)}>
                      <Ionicons name="trash" size={22} color="red" />
                    </TouchableOpacity>
                  </View>
                )
              ))}

              {oneTimeSpends.map((spend, index) => (
                spend.date === selectedDate && (
                  <View key={index} style={styles.transactionCard}>
                    <Text style={styles.expenseText}>{spend.name}: ${spend.amount}</Text>
                    <TouchableOpacity onPress={() => confirmDeleteTransaction('one-time', spend)}>
                      <Ionicons name="trash" size={22} color="red" />
                    </TouchableOpacity>
                  </View>
                )
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  balanceCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 5,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  cardAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  calendar: {
    borderRadius: 15,
    elevation: 3,
  },
  transactionsContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 3,
  },
  incomeText: {
    color: 'green',
    fontWeight: 'bold',
    fontSize: 15,
  },
  expenseText: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 15,
  },
  selectDateText: {
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  viewTransactionsButton: {
    marginTop: 10,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
  },
  viewTransactionsText: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    width: '90%',
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: 'red',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noTransactionsText: {},
});

export default FinanceTracker;