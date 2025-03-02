import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, Modal, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const SpendTracker = ({navigation}:any) => {
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDate, setBillDate] = useState(new Date());
  const [billDay, setBillDay] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurringBills, setRecurringBills] = useState([]);
  const [oneTimeSpends, setOneTimeSpends] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('recurring');
  const [editIndex, setEditIndex] = useState(null); // Track index for editing
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    loadSpendData();
  }, []);

  useEffect(() => {
    const reloadData = async () => {
      const savedBills = await AsyncStorage.getItem('recurringBills');
      const savedSpends = await AsyncStorage.getItem('oneTimeSpends');
  
      if (savedBills) setRecurringBills(JSON.parse(savedBills) || []);
      if (savedSpends) setOneTimeSpends(JSON.parse(savedSpends) || []);
    };
  
    const unsubscribe = navigation.addListener('focus', () => {
      reloadData();
    });
  
    return unsubscribe;
  }, [navigation]);

  const loadSpendData = async () => {
    const savedBills = await AsyncStorage.getItem('recurringBills');
    const savedSpends = await AsyncStorage.getItem('oneTimeSpends');
    if (savedBills) setRecurringBills(JSON.parse(savedBills));
    if (savedSpends) setOneTimeSpends(JSON.parse(savedSpends));
  };

  const saveSpend = async () => {
    if (!billName || !billAmount) {
      alert('Please enter all fields');
      return;
    }

    if (modalType === 'recurring') {
      if (!billDay || isNaN(parseInt(billDay)) || parseInt(billDay) < 1 || parseInt(billDay) > 31) {
        alert('Please enter a valid day (1-31) for recurring bills.');
        return;
      }
      let updatedBills = [...recurringBills];
      const newBill = { name: billName, amount: parseFloat(billAmount), date: billDay };
      
      if (editIndex !== null) {
        updatedBills[editIndex] = newBill; // Update existing entry
      } else {
        updatedBills.push(newBill); // Add new entry
      }

      setRecurringBills(updatedBills);
      await AsyncStorage.setItem('recurringBills', JSON.stringify(updatedBills));
    } else {
      const formattedDate = billDate.toISOString().split('T')[0]; // Ensure the date is formatted correctly
      let updatedSpends = [...oneTimeSpends];
      const newSpend = { name: billName, amount: parseFloat(billAmount), date: formattedDate };

      if (editIndex !== null) {
        updatedSpends[editIndex] = newSpend;
      } else {
        updatedSpends.push(newSpend);
      }

      setOneTimeSpends(updatedSpends);
      await AsyncStorage.setItem('oneTimeSpends', JSON.stringify(updatedSpends));
    }

    alert(`${modalType === 'recurring' ? 'Recurring bill' : 'One-time spend'} saved successfully!`);
    resetForm();
  };

  const editSpend = (type, index) => {
    setEditIndex(index);
    setModalType(type);
    if (type === 'recurring') {
      setBillName(recurringBills[index].name);
      setBillAmount(recurringBills[index].amount.toString());
      setBillDay(recurringBills[index].date.toString());
    } else {
      setBillName(oneTimeSpends[index].name);
      setBillAmount(oneTimeSpends[index].amount.toString());
      setBillDate(new Date(oneTimeSpends[index].date));
    }
    setModalVisible(true);
  };

  const deleteSpend = async (type, index) => {
    // const updatedBills = recurringBills.filter((_, i) => i !== index);
    // setRecurringBills(updatedBills);
    // await AsyncStorage.setItem('recurringBills', JSON.stringify(updatedBills));
    if (type === 'recurring') {
      const updatedBills = recurringBills.filter((_, i) => i !== index);
      setRecurringBills(updatedBills);
      await AsyncStorage.setItem('recurringBills', JSON.stringify(updatedBills));
    } else {
      const updatedSpends = oneTimeSpends.filter((_, i) => i !== index);
      setOneTimeSpends(updatedSpends);
      await AsyncStorage.setItem('oneTimeSpends', JSON.stringify(updatedSpends));
    }
  };

  const resetForm = () => {
    setBillName('');
    setBillAmount('');
    setBillDay('');
    setBillDate(new Date());
    setEditIndex(null);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Total Expenses Card */}
      <View style={styles.expenseCard}>
        <Ionicons name="card" size={40} color="red" />
        <Text style={styles.cardTitle}>Total Expenses</Text>
        <Text style={styles.expenseAmount}>
          ${recurringBills.reduce((total, item) => total + item.amount, 0).toFixed(2)}
        </Text>
      </View>

      {/* Add Recurring Bill Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => { setModalType('recurring'); setModalVisible(true); }}>
          <Ionicons name="add-circle-outline" size={24} color="black" />
          <Text style={styles.addText}>Add Recurring Bill</Text>
      </TouchableOpacity>

      {/* Add One-Time Spend Button */}
      <TouchableOpacity
        style={styles.addButtonOne}
        onPress={() => { setModalType('one-time'); setModalVisible(true); }}>
          <Ionicons name="add-circle-outline" size={24} color="black" />
          <Text style={styles.addText}>Add One-Time Spend</Text>
      </TouchableOpacity>

      {/* List of Recurring Bills */}
      <Text style={styles.sectionTitle}>Recurring Bills</Text>
      <FlatList
        data={recurringBills}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.billItem}>
            <Text style={styles.billText}>
              {item.name}: ${item.amount} on day {item.date}
            </Text>
            <View style={styles.iconContainer}>
              <TouchableOpacity onPress={() => editSpend('recurring', index)}>
                <Ionicons name="pencil" size={22} color="#2196F3" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteSpend('recurring', index)}>
                <Ionicons name="trash" size={22} color="red" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 4, }}>One-Time Spends</Text>
      <FlatList
        data={oneTimeSpends}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.billItem}>
            <Text style={styles.billText}>
              {item.name}: ${item.amount} on {item.date}
            </Text>
            <View style={styles.iconContainer}>
              <TouchableOpacity onPress={() => editSpend('one-time', index)}>
                <Ionicons name="pencil" size={22} color="#2196F3" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteSpend('one-time', index)}>
                  <Ionicons name="trash" size={22} color="red" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 10, width: '80%', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              {modalType === 'recurring' ? 'Edit Recurring Bill' : 'Edit One-Time Spend'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Name (e.g., Netflix)"
              value={billName}
              onChangeText={setBillName}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="numeric"
              value={billAmount}
              onChangeText={setBillAmount}
            />

            {modalType === 'one-time' ? (
              <>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)} style={styles.input}
              >
                {/* <Text>Select Date: {billDate.toISOString().split('T')[0]}</Text> */}
                <Text>{billDate ? billDate.toDateString() : 'Select Date'}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={billDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false); // Hide picker after selecting a date
                    if (selectedDate) {
                      setBillDate(selectedDate); // Update billDate state
                    }
                  }}
                />
              )}
              </>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Day (1-31)"
                keyboardType="numeric"
                value={billDay}
                onChangeText={setBillDay}
              />
            )}

            <TouchableOpacity style={styles.saveButton} onPress={saveSpend}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
  expenseCard: {
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
    marginTop: 5,
  },
  expenseAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'red',
    marginTop: 5,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#f8d7da',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addButtonOne: {
    flexDirection: 'row',
    backgroundColor: '#cce5ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  billItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    marginBottom: 10,
  },
  billText: {
    fontSize: 16,
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  billCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    padding: 8,
    marginVertical: 10,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButton: {
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: 'red',
    fontSize: 16,
    marginTop: 10,
  },
});

export default SpendTracker;
