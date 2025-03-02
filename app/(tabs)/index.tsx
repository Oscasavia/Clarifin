import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import FinanceTracker from '../screens/CalendarScreen';
import SalaryInput from '../screens/SalaryInput';
import SpendTracker from '../screens/SpendScreen';
import ReceiveTracker from '../screens/ReceiveScreen';
import DashboardScreen from '../screens/DashboardScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            let iconName;

            switch (route.name) {
              case 'Dashboard':
                iconName = 'bar-chart-outline';
                break;
              case 'Calendar':
                iconName = 'calendar';
                break;
              case 'Acc Balance':
                iconName = 'cash-outline';
                break;
              case 'Spend':
                iconName = 'card-outline';
                break;
              case 'Receive':
                iconName = 'wallet-outline';
                break;
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Calendar" component={FinanceTracker} />
        <Tab.Screen name="Acc Balance" component={SalaryInput} />
        <Tab.Screen name="Spend" component={SpendTracker} />
        <Tab.Screen name="Receive" component={ReceiveTracker} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
