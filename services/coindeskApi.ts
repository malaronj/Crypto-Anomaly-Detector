import { Platform } from 'react-native';

// Use CORS proxy for web development
const CORS_PROXY = Platform.select({
  web: 'https://cors-anywhere.herokuapp.com/',
  default: '',
});

const COINDESK_BASE_URL = `${CORS_PROXY}https://api.coindesk.com/v1`;

interface CoindeskApiOptions {
  endpoint: string;
  method?: 'GET' | 'POST';
  params?: Record<string, string>;
}

export class CoindeskApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'CoindeskApiError';
  }
}

export const coindeskApi = async <T>({ endpoint, method = 'GET', params = {} }: CoindeskApiOptions): Promise<T> => {
  const url = new URL(`${COINDESK_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  try {
    console.log('Fetching from URL:', url.toString());
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('API Response not OK:', {
        status: response.status,
        statusText: response.statusText,
        url: url.toString(),
      });
      if (response.status === 429) {
        throw new CoindeskApiError('Rate limit exceeded. Please try again later.', response.status);
      }
      throw new CoindeskApiError(`API request failed: ${response.statusText}`, response.status);
    }

    const data = await response.json();
    return data;
  } catch (error: unknown) {
    console.error('API Call failed:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      url: url.toString(),
    });
    if (error instanceof CoindeskApiError) {
      throw error;
    }
    throw new CoindeskApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getHistoricalData = async (symbol: string, days: number = 365) => {
  // Only support BTC for now as that's all CoinDesk API provides
  if (symbol.toUpperCase() !== 'BTC') {
    throw new CoindeskApiError(`Historical data only available for BTC. Requested: ${symbol}`);
  }

  // Calculate the end date (today) and start date (days ago)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days); // Use current date as reference

  const response = await coindeskApi<any>({
    endpoint: '/bpi/historical/close.json',
    params: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      currency: 'USD'
    },
  });

  if (!response.bpi) {
    throw new CoindeskApiError('No historical data available');
  }

  // Transform the data into our expected format
  const historicalData = Object.entries(response.bpi).map(([date, price]) => ({
    timestamp: new Date(date),
    price: price as number,
  }));

  return historicalData;
};

export const getCurrentPrice = async (symbol: string = 'BTC', currency: string = 'USD') => {
  // Only support BTC for now as that's all CoinDesk API provides
  if (symbol.toUpperCase() !== 'BTC') {
    throw new CoindeskApiError(`Price data only available for BTC. Requested: ${symbol}`);
  }

  const response = await coindeskApi<any>({
    endpoint: '/bpi/currentprice.json',
  });

  const quote = response.bpi[currency];
  if (!quote) {
    throw new CoindeskApiError(`No price data available for ${symbol}/${currency}`);
  }

  return {
    rate: quote.rate_float,
    change_24h: 0, // CoinDesk API doesn't provide this directly
    volume_24h: 0, // CoinDesk API doesn't provide this
    market_cap: 0, // CoinDesk API doesn't provide this
  };
}; 