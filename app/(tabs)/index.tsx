import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale, verticalScale } from 'react-native-size-matters';

// Context
import { CurrencyProvider } from '../context/CurrencyContext'; // Adjust path if needed

// Screens
import FinanceTracker from '../screens/CalendarScreen';
import SalaryInput from '../screens/SalaryInput';
import SpendTracker from '../screens/SpendScreen';
import ReceiveTracker from '../screens/ReceiveScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen'; // Import SettingsScreen

const Tab = createBottomTabNavigator();

const AppNavigator = () => {
    return (
        <CurrencyProvider>
            <NavigationContainer>
                <Tab.Navigator
                    screenOptions={({ route }) => ({
                        headerShown: true, // Show headers or set specific options per screen
                        tabBarIcon: ({ color, size, focused }) => {
                            let iconName: keyof typeof Ionicons.glyphMap; // Use keyof for type safety

                            switch (route.name) {
                                case 'Dashboard':
                                    iconName = focused ? 'bar-chart' : 'bar-chart-outline';
                                    break;
                                case 'Calendar':
                                    iconName = focused ? 'calendar' : 'calendar-outline';
                                    break;
                                case 'Balance': // Renamed for consistency? Or keep Acc Balance?
                                    iconName = focused ? 'cash' : 'cash-outline';
                                    break;
                                case 'Spend':
                                    iconName = focused ? 'card' : 'card-outline';
                                    break;
                                case 'Receive':
                                    iconName = focused ? 'wallet' : 'wallet-outline';
                                    break;
                                case 'Settings': // Add Settings icon
                                    iconName = focused ? 'settings' : 'settings-outline';
                                    break;
                                default:
                                    iconName = 'alert-circle-outline'; // Fallback icon
                                    break;
                            }
                            // Use moderateScale for responsive icon size
                            return <Ionicons name={iconName} size={moderateScale(size)} color={color} />;
                        },
                        tabBarActiveTintColor: '#4CAF50', // Example active color
                        tabBarInactiveTintColor: 'gray',
                        tabBarLabelStyle: {
                            fontSize: moderateScale(10), // Responsive label size
                        },
                        tabBarStyle: {
                            height: verticalScale(60), // Responsive tab bar height
                            paddingBottom: verticalScale(5),
                        },
                        headerTitleStyle: {
                             fontSize: moderateScale(18), // Responsive header title
                        }
                    })}
                >
                    <Tab.Screen name="Dashboard" component={DashboardScreen} />
                    <Tab.Screen name="Calendar" component={FinanceTracker} />
                    <Tab.Screen name="Balance" component={SalaryInput} options={{ title: 'Balance'}}/>
                    <Tab.Screen name="Spend" component={SpendTracker} />
                    <Tab.Screen name="Receive" component={ReceiveTracker} />
                    <Tab.Screen name="Settings" component={SettingsScreen} />
                </Tab.Navigator>
            </NavigationContainer>
        </CurrencyProvider>
    );
};

export default AppNavigator;