// constants/currencies.ts
export interface Currency {
    code: string;
    symbol: string;
    name: string;
  }
  
  export const SUPPORTED_CURRENCIES: Currency[] = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'UGX', symbol: 'UGX ', name: 'Ugandan Shilling' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    // Add more currencies as needed
  ];
  
  export const DEFAULT_CURRENCY: Currency = SUPPORTED_CURRENCIES[0]; // Default to USD