import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, FlatList, Modal, TouchableOpacity, StyleSheet
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const ReceiveTracker = ({ navigation}:any) => {
  const [incomeName, setIncomeName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState('');
  const [recurringIncome, setRecurringIncome] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  useEffect(() => {
    loadRecurringIncome();
  }, []);

  useEffect(() => {
    const reloadData = async () => {
      const savedIncome = await AsyncStorage.getItem('recurringIncome');
  
      if (savedIncome) setRecurringIncome(JSON.parse(savedIncome) || []);
    };
  
    const unsubscribe = navigation.addListener('focus', () => {
      reloadData();
    });
  
    return unsubscribe;
  }, [navigation]);

  const loadRecurringIncome = async () => {
    const savedIncome = await AsyncStorage.getItem('recurringIncome');
    if (savedIncome) {
      setRecurringIncome(JSON.parse(savedIncome));
    }
  };

  const saveIncome = async () => {
    if (!incomeName || !incomeAmount || !incomeDate) {
      alert('Please enter all fields');
      return;
    }

    let updatedIncome = [...recurringIncome];
    const newIncome = { name: incomeName, amount: parseFloat(incomeAmount), date: incomeDate };

    if (editIndex !== null) {
      updatedIncome[editIndex] = newIncome; // Update existing entry
    } else {
      updatedIncome.push(newIncome); // Add new entry
    }

    setRecurringIncome(updatedIncome);
    await AsyncStorage.setItem('recurringIncome', JSON.stringify(updatedIncome));

    alert(`${'Recurring Income'} saved successfully!`);
    resetForm();
  };

  const editIncome = (index:any) => {
    setEditIndex(index);
    setIncomeName(recurringIncome[index].name);
    setIncomeAmount(recurringIncome[index].amount.toString());
    setIncomeDate(recurringIncome[index].date.toString());
    setModalVisible(true);
  };

  const deleteIncome = async (index:any) => {
    const updatedIncome = recurringIncome.filter((_, i) => i !== index);
    setRecurringIncome(updatedIncome);
    await AsyncStorage.setItem('recurringIncome', JSON.stringify(updatedIncome));
  };

  const resetForm = () => {
    setIncomeName('');
    setIncomeAmount('');
    setIncomeDate('');
    setEditIndex(null);
    setModalVisible(false);
  };

  const saveToCalendar = async () => {
    await AsyncStorage.setItem('recurringIncome', JSON.stringify(recurringIncome));
  };

  return (
    <View style={styles.container}>
      
      {/* Current Income Card */}
      <View style={styles.incomeCard}>
        <Ionicons name="wallet-outline" size={40} color="#4CAF50" />
        <Text style={styles.cardTitle}>Current Income</Text>
        <Text style={styles.cardAmount}>
          ${recurringIncome.reduce((total, item) => total + item.amount, 0).toFixed(2)}
        </Text>
      </View>

      {/* Add Recurring Income Button */}
      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Ionicons name="add-circle-outline" size={24} color="black" />
        <Text style={styles.addText}>Add Recurring Income</Text>
      </TouchableOpacity>

      {/* List of Recurring Income */}
      <Text style={styles.sectionTitle}>Recurring Income</Text>
      <FlatList
        data={recurringIncome}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.incomeItem}>
            <Text style={styles.incomeText}>
              {item.name}: ${item.amount} on day {item.date}
            </Text>
            <View style={styles.iconContainer}>
              <TouchableOpacity onPress={() => editIncome(index)}>
                <Ionicons name="pencil" size={22} color="#2196F3" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteIncome(index)}>
                <Ionicons name="trash" size={22} color="red" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Modal for Adding Income */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {editIndex !== null ? 'Edit Recurring Income' : 'Add Recurring Income'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Income Source (e.g., Paycheck)"
              value={incomeName}
              onChangeText={setIncomeName}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="numeric"
              value={incomeAmount}
              onChangeText={setIncomeAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Day of Month (e.g., 15)"
              keyboardType="numeric"
              value={incomeDate}
              onChangeText={setIncomeDate}
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveIncome}>
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

export default ReceiveTracker;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  incomeCard: {
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
  cardAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 5,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#d4edda',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  incomeItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    marginBottom: 10,
  },
  incomeText: {
    fontSize: 16,
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
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
