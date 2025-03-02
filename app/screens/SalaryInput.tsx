import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const SalaryInput = () => {
  const [balance, setBalance] = useState('');

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    const savedBalance = await AsyncStorage.getItem('balance');
    if (savedBalance) setBalance(savedBalance);
  };

  const saveBalance = async () => {
    if (!balance) {
      alert('Please enter a balance amount.');
      return;
    }
    await AsyncStorage.setItem('balance', balance);
    alert('Balance saved successfully!');
  };

  return (
    <View style={styles.container}>
      {/* Balance Display Card */}
      <View style={styles.balanceCard}>
        <Ionicons name="cash-outline" size={40} color="#4CAF50" />
        <Text style={styles.balanceText}>Current Balance</Text>
        <Text style={styles.balanceAmount}>${balance || '0.00'}</Text>
      </View>

      {/* Input Section */}
      <Text style={styles.label}>Enter New Balance:</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Enter balance amount"
        value={balance}
        onChangeText={setBalance}
      />

      {/* Save Button */}
      <TouchableOpacity style={styles.button} onPress={saveBalance}>
        <Text style={styles.buttonText}>SAVE BALANCE</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    backgroundColor: '#fff',
    padding: 25,
    width: '90%',
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
    marginBottom: 20,
  },
  balanceText: {
    fontSize: 18,
    color: '#666',
    marginTop: 5,
    fontWeight: 'bold',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    width: '90%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
    width: '90%',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default SalaryInput;
