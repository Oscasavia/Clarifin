import { CurrencyCode } from '../context/CurrencyContext'; // Adjust path if needed

/**
 * Formats a number as a currency string based on the provided currency code.
 * Uses Intl.NumberFormat for locale-aware formatting.
 *
 * @param amount The number to format.
 * @param currency The currency code (e.g., 'USD', 'UGX').
 * @returns A formatted currency string (e.g., "$1,234.56", "UGX 5,000"). Returns empty string if amount is null/undefined.
 */
export const formatCurrency = (amount: number | null | undefined, currency: CurrencyCode): string => {
    if (amount === null || amount === undefined) {
        return ''; // Or return '0.00' formatted based on currency? Decide based on UX.
    }

    try {
        // Use Intl.NumberFormat for better localization and currency handling
        // Note: Displaying the currency code (like 'UGX') might be better than a symbol for clarity,
        // especially for less common currencies. Adjust 'style' and 'currencyDisplay' as needed.
        return new Intl.NumberFormat(undefined, { // Use user's locale settings
            style: 'currency',
            currency: currency,
            currencyDisplay: 'symbol', // 'code' (USD), 'symbol' ($), 'name' (US dollars)
        }).format(amount);
    } catch (error) {
        console.error(`Error formatting currency ${currency}:`, error);
        // Fallback formatting if Intl fails or currency code is invalid
        const symbol = currency === 'UGX' ? 'UGX ' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
        return `${symbol}${amount.toFixed(2)}`;
    }
};