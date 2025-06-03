import { getCurrentPrice } from './coingeckoApi';

interface PriceData {
  symbol: string;
  price: number;
  change_24h: number;
  volume_24h: number;
  market_cap: number;
}

type PriceCallback = (data: PriceData) => void;
type ErrorCallback = (error: Error) => void;

class PriceUpdateService {
  private subscribers: Map<string, Set<PriceCallback>> = new Map();
  private errorHandlers: Map<string, Set<ErrorCallback>> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private backoffTimeout: NodeJS.Timeout | null = null;
  private currentBackoff: number = 60000; // Start with 60 seconds
  private readonly MAX_BACKOFF = 300000; // Max 5 minutes
  private readonly MIN_BACKOFF = 60000; // Min 60 seconds
  private readonly POLL_INTERVAL = 60000; // 60 seconds default polling
  private isPolling: boolean = false;

  constructor() {
    this.startPolling();
  }

  private async fetchPrices() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const symbols = Array.from(this.subscribers.keys());
      if (symbols.length === 0) {
        this.isPolling = false;
        return;
      }

      // Reset backoff on successful request
      this.currentBackoff = this.MIN_BACKOFF;

      // Batch symbols into groups of 3 to reduce API calls
      for (let i = 0; i < symbols.length; i += 3) {
        const batchSymbols = symbols.slice(i, i + 3);
        try {
          // Wait between batches to avoid rate limits
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          const promises = batchSymbols.map(async symbol => {
            try {
              const data = await getCurrentPrice(symbol, 'USD');
              return { symbol, data, error: null };
            } catch (error) {
              return { symbol, data: null, error };
            }
          });

          const results = await Promise.all(promises);

          results.forEach(({ symbol, data, error }) => {
            if (error) {
              this.notifyError(symbol, error instanceof Error ? error : new Error(String(error)));
            } else if (data) {
              const priceData: PriceData = {
                symbol,
                price: data.rate,
                change_24h: data.change_24h,
                volume_24h: data.volume_24h,
                market_cap: data.market_cap,
              };
              this.notifySubscribers(symbol, priceData);
            }
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
            this.handleRateLimit();
            break;
          }
          console.error('Error fetching batch:', error);
          batchSymbols.forEach(symbol => {
            this.notifyError(symbol, error instanceof Error ? error : new Error(String(error)));
          });
        }
      }
    } catch (error) {
      console.error('Error in fetch prices:', error);
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        this.handleRateLimit();
      }
      this.notifyAllError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isPolling = false;
    }
  }

  private notifySubscribers(symbol: string, data: PriceData) {
    const callbacks = this.subscribers.get(symbol);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in price callback for ${symbol}:`, error);
        }
      });
    }
  }

  private notifyError(symbol: string, error: Error) {
    const handlers = this.errorHandlers.get(symbol);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(error);
        } catch (err) {
          console.error(`Error in error handler for ${symbol}:`, err);
        }
      });
    }
  }

  private notifyAllError(error: Error) {
    Array.from(this.errorHandlers.keys()).forEach(symbol => {
      this.notifyError(symbol, error);
    });
  }

  private handleRateLimit() {
    // Clear existing polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Implement exponential backoff
    this.currentBackoff = Math.min(this.currentBackoff * 2, this.MAX_BACKOFF);
    
    const error = new Error(`Rate limit exceeded. Retrying in ${this.currentBackoff / 1000} seconds.`);
    this.notifyAllError(error);

    // Schedule next poll with backoff
    this.backoffTimeout = setTimeout(() => {
      this.startPolling();
      this.fetchPrices(); // Immediate fetch after backoff
    }, this.currentBackoff);
  }

  private startPolling() {
    if (this.backoffTimeout) {
      clearTimeout(this.backoffTimeout);
      this.backoffTimeout = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.pollingInterval = setInterval(() => {
      this.fetchPrices();
    }, this.POLL_INTERVAL);
  }

  private cleanup() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.backoffTimeout) {
      clearTimeout(this.backoffTimeout);
      this.backoffTimeout = null;
    }
    this.isPolling = false;
  }

  subscribe(symbol: string, callback: PriceCallback, errorHandler?: ErrorCallback) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
      this.errorHandlers.set(symbol, new Set());
      // Fetch initial price immediately
      this.fetchPrices();
    }
    this.subscribers.get(symbol)?.add(callback);
    if (errorHandler) {
      this.errorHandlers.get(symbol)?.add(errorHandler);
    }
  }

  unsubscribe(symbol: string, callback: PriceCallback, errorHandler?: ErrorCallback) {
    const callbacks = this.subscribers.get(symbol);
    const handlers = this.errorHandlers.get(symbol);

    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscribers.delete(symbol);
      }
    }

    if (errorHandler && handlers) {
      handlers.delete(errorHandler);
      if (handlers.size === 0) {
        this.errorHandlers.delete(symbol);
      }
    }

    // If no more subscribers for any symbol, cleanup
    if (this.subscribers.size === 0) {
      this.cleanup();
    }
  }

  disconnect() {
    this.cleanup();
    this.subscribers.clear();
    this.errorHandlers.clear();
  }
}

export const priceUpdateService = new PriceUpdateService(); 