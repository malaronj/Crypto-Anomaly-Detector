const COINGECKO_API_KEY = 'CG-Duq4TNL72XFdTvRsbwiAubVb';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 10000; // 10 seconds

interface CoingeckoApiOptions {
  endpoint: string;
  method?: 'GET' | 'POST';
  params?: Record<string, string>;
}

export class CoingeckoApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'CoingeckoApiError';
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const coingeckoApi = async <T>({ endpoint, method = 'GET', params = {} }: CoingeckoApiOptions): Promise<T> => {
  const url = new URL(`${COINGECKO_BASE_URL}${endpoint}`);
  
  // Add API key to all requests
  const allParams = { ...params, x_cg_demo_api_key: COINGECKO_API_KEY };
  Object.entries(allParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[CoinGecko] Attempt ${attempt}/${MAX_RETRIES} - Fetching:`, url.toString());
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      const responseText = await response.text();
      console.log(`[CoinGecko] Response status:`, response.status);
      console.log(`[CoinGecko] Response headers:`, Object.fromEntries(response.headers.entries()));
      console.log(`[CoinGecko] Response body:`, responseText.substring(0, 200) + '...');

      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after');
        
        if (response.status === 429) {
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          const cappedWaitTime = Math.min(waitTime, MAX_RETRY_DELAY);
          console.log(`[CoinGecko] Rate limited, waiting ${cappedWaitTime}ms before retry`);
          await delay(cappedWaitTime);
          continue;
        }

        throw new CoingeckoApiError(
          `API request failed (${response.status}): ${response.statusText}\nResponse: ${responseText}`,
          response.status
        );
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('[CoinGecko] Failed to parse JSON response:', e);
        throw new CoingeckoApiError(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }

      if (!data) {
        throw new CoingeckoApiError('Empty response received');
      }

      return data;
    } catch (error) {
      lastError = error as Error;
      console.error(`[CoinGecko] Attempt ${attempt} failed:`, error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[CoinGecko] Request timed out');
      }
      
      if (attempt === MAX_RETRIES) {
        throw new CoingeckoApiError(
          `Failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`
        );
      }

      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
      const cappedRetryDelay = Math.min(retryDelay, MAX_RETRY_DELAY);
      await delay(cappedRetryDelay);
    }
  }

  throw new CoingeckoApiError('Failed to fetch data');
};

export const getHistoricalData = async (coinId: string, days: number = 7) => {
  console.log(`[CoinGecko] Getting historical data for ${coinId}, days: ${days}`);
  try {
    const response = await coingeckoApi<any>({
      endpoint: `/coins/${coinId}/market_chart`,
      params: {
        vs_currency: 'usd',
        days: days.toString(),
        interval: 'daily'
      },
    });

    console.log('[CoinGecko] Historical data response:', {
      hasData: !!response?.prices,
      dataPoints: response?.prices?.length,
      sample: response?.prices?.[0],
    });

    if (!response?.prices || !Array.isArray(response.prices)) {
      throw new CoingeckoApiError(`Invalid historical data format: ${JSON.stringify(response).substring(0, 100)}...`);
    }

    const data = response.prices.map(([timestamp, price]: [number, number]) => ({
      timestamp: new Date(timestamp),
      price: price,
    }));

    console.log('[CoinGecko] Processed historical data:', {
      points: data.length,
      firstPoint: data[0],
      lastPoint: data[data.length - 1],
    });

    return data;
  } catch (error) {
    console.error('[CoinGecko] Historical data error:', error);
    throw error;
  }
};

export const getCurrentPrice = async (coinId: string, currency: string = 'usd') => {
  console.log(`[CoinGecko] Getting current price for ${coinId} in ${currency}`);
  try {
    const response = await coingeckoApi<any>({
      endpoint: `/simple/price`,
      params: {
        ids: coinId,
        vs_currencies: currency,
        include_24hr_vol: 'true',
        include_24hr_change: 'true',
        include_market_cap: 'true'
      },
    });

    console.log('[CoinGecko] Current price response:', {
      hasData: !!response?.[coinId],
      data: response?.[coinId],
    });

    if (!response?.[coinId]) {
      throw new CoingeckoApiError(`No price data available for ${coinId}: ${JSON.stringify(response).substring(0, 100)}...`);
    }

    const data = response[coinId];
    const result = {
      rate: data[currency],
      change_24h: data[`${currency}_24h_change`] || 0,
      volume_24h: data[`${currency}_24h_vol`] || 0,
      market_cap: data[`${currency}_market_cap`] || 0,
    };

    console.log('[CoinGecko] Processed current price:', result);
    return result;
  } catch (error) {
    console.error('[CoinGecko] Current price error:', error);
    throw error;
  }
};

export const COIN_ID_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'XRP': 'ripple',
  'DOGE': 'dogecoin',
}; 