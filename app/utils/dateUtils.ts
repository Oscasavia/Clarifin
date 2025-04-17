import { addMonths, addYears, format, parseISO, addDays } from 'date-fns';

export const parseISODate = (dateString: string): Date | null => {
  try {
    return parseISO(dateString);
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
};

type Interval = 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';

export const getNextOccurrence = (current: Date, interval: Interval): Date => {
  switch (interval) {
    case 'weekly':
      return addDays(current, 7);
    case 'monthly':
      return addMonths(current, 1);
    case 'quarterly':
      return addMonths(current, 3);
    case 'biannually':
      return addMonths(current, 6);
    case 'yearly':
      return addYears(current, 1);
    default:
      return addMonths(current, 1); // Default to monthly
  }
};

export const formatISODate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};