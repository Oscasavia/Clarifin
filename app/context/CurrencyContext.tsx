import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// Define supported currencies
export type CurrencyCode =
  | 'USD' | 'EUR' | 'GBP' | 'KRW' | 'CNY' | 'INR' | 'KES' | 'UGX'
  | 'JPY' | 'CAD' | 'AUD' | 'NZD' | 'ZAR' | 'NGN' | 'GHS' | 'TZS'
  | 'AED' | 'SAR' | 'BRL' | 'MXN' | 'CHF' | 'SEK' | 'NOK' | 'DKK'
  | 'PKR' | 'LKR' | 'THB' | 'IDR' | 'BDT' | 'RUB' | 'PLN' | 'MYR';

export const CURRENCIES: { code: CurrencyCode; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'UGX', symbol: 'UGX ', name: 'Ugandan Shilling' },

  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },

  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },

  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
];

const ASYNC_STORAGE_CURRENCY_KEY = '@user_currency';

interface CurrencyContextType {
    selectedCurrency: CurrencyCode;
    changeCurrency: (currency: CurrencyCode) => Promise<void>;
    getCurrencySymbol: (code?: CurrencyCode) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
    children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('USD'); // Default currency
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load saved currency on app start
        const loadCurrency = async () => {
            try {
                const savedCurrency = await AsyncStorage.getItem(ASYNC_STORAGE_CURRENCY_KEY);
                if (savedCurrency && CURRENCIES.some(c => c.code === savedCurrency)) {
                    setSelectedCurrency(savedCurrency as CurrencyCode);
                }
            } catch (error) {
                console.error("Failed to load currency from storage", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadCurrency();
    }, []);

    const changeCurrency = useCallback(async (currency: CurrencyCode) => {
        try {
            setSelectedCurrency(currency);
            await AsyncStorage.setItem(ASYNC_STORAGE_CURRENCY_KEY, currency);
        } catch (error) {
            console.error("Failed to save currency to storage", error);
        }
    }, []);

    const getCurrencySymbol = useCallback((code?: CurrencyCode): string => {
        const targetCode = code || selectedCurrency;
        const currencyData = CURRENCIES.find(c => c.code === targetCode);
        return currencyData ? currencyData.symbol : '$'; // Default to '$' if not found
    }, [selectedCurrency]);


    // Avoid rendering children until currency is loaded to prevent inconsistencies
    if (isLoading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loaderText}>Loading currency...</Text>
            </View>
        );
    }

    return (
        <CurrencyContext.Provider value={{ selectedCurrency, changeCurrency, getCurrencySymbol }}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = (): CurrencyContextType => {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
};

const styles = StyleSheet.create({
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
    },
    loaderText: {
      marginTop: 10,
      fontSize: 16,
      color: '#666',
    },
  });