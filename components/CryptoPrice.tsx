import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COIN_ID_MAP, getCurrentPrice, getHistoricalData } from '../services/coingeckoApi';
import { AnomalyDetectionMethod, AnomalyDetector } from './AnomalyDetector';
import { ThemedText } from './ThemedText';

interface PriceData {
  price: number;
  change_24h: number;
  volume_24h: number;
  market_cap: number;
}

interface PriceHistory {
  timestamp: Date;
  price: number;
}

interface CryptoPriceProps {
  baseAsset?: string;
  quoteAsset?: string;
  refreshInterval?: number;
}

const CRYPTO_NAMES: Record<string, string> = {
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'SOL': 'Solana',
  'XRP': 'Ripple',
  'DOGE': 'Dogecoin',
};

function formatNumber(value: number, options: { minimumFractionDigits?: number; maximumFractionDigits?: number; compact?: boolean } = {}): string {
  const { minimumFractionDigits = 2, maximumFractionDigits = 2, compact = false } = options;
  
  if (compact) {
    if (value >= 1e9) {
      return formatNumber(value / 1e9) + 'B';
    }
    if (value >= 1e6) {
      return formatNumber(value / 1e6) + 'M';
    }
    if (value >= 1e3) {
      return formatNumber(value / 1e3) + 'K';
    }
  }
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits,
  });
  
  return formatter.format(value);
}

export function CryptoPrice({ baseAsset = 'BTC', quoteAsset = 'USD', refreshInterval }: CryptoPriceProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [priceHistoryUSD, setPriceHistoryUSD] = useState<PriceHistory[]>([]);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detectionMethod, setDetectionMethod] = useState<AnomalyDetectionMethod>('zscore');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const getCoinId = useCallback((symbol: string) => {
    const coinId = COIN_ID_MAP[symbol.toUpperCase()];
    if (!coinId) {
      throw new Error(`Unsupported cryptocurrency: ${symbol}`);
    }
    return coinId;
  }, []);

  const loadData = useCallback(async () => {
    try {
      console.log(`[CryptoPrice] Loading data for ${baseAsset}, attempt: ${loadAttempt + 1}`);
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);

      const coinId = getCoinId(baseAsset);
      console.log(`[CryptoPrice] Resolved coin ID: ${coinId}`);
      
      // Fetch current price in USD and historical data in USD
      const [currentUsdPriceData, historicalDataUsd] = await Promise.all([
        getCurrentPrice(coinId, 'usd'), // Fetch current price in USD
        getHistoricalData(coinId, 365) 
      ]);

      console.log('[CryptoPrice] Data loaded successfully:', {
        currentUsdPrice: currentUsdPriceData.rate,
        historicalPoints: historicalDataUsd.length
      });
      // Add specific log for historical data length per asset
      console.log(`[CryptoPrice] Historical data for ${baseAsset} (${coinId}): ${historicalDataUsd.length} points fetched for 365 days request.`);

      setPriceData({ // Store USD data directly
        price: currentUsdPriceData.rate,
        change_24h: currentUsdPriceData.change_24h,
        volume_24h: currentUsdPriceData.volume_24h,
        market_cap: currentUsdPriceData.market_cap,
      });
      
      setPriceHistoryUSD(historicalDataUsd);

      setError(null);
      setLastUpdateTime(new Date());
      setIsInitialLoad(false);
    } catch (err) {
      console.error('[CryptoPrice] Failed to load data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      
      // Keep existing data if we have it
      if (!priceData) {
        setPriceData(null);
        setPriceHistoryUSD([]);
      }
      
      // Schedule a retry if we haven't tried too many times
      if (loadAttempt < 2) { // Try up to 3 times total
        console.log(`[CryptoPrice] Scheduling retry ${loadAttempt + 2}/3`);
        const retryDelay = Math.pow(2, loadAttempt) * 1000; // Exponential backoff
        setTimeout(() => {
          setLoadAttempt(prev => prev + 1);
        }, retryDelay);
      }
    } finally {
      setLoading(false);
    }
  }, [baseAsset, getCoinId, loadAttempt, priceData, isInitialLoad]);

  // Load data when component mounts or when loadAttempt changes
  useEffect(() => {
    loadData();
  }, [loadData, loadAttempt]);

  // Set up polling for price updates
  useEffect(() => {
    const pollInterval = 60000; // 1 minute
    let timeoutId: NodeJS.Timeout;

    const schedulePoll = () => {
      timeoutId = setTimeout(async () => {
        await loadData();
        schedulePoll(); // Schedule next poll after current one completes
      }, pollInterval);
    };

    if (!error) {
      schedulePoll();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loadData, error]);

  const handleAnomalyDetection = useCallback((isCurrentPriceAnomaly: boolean) => {
    setIsAnomaly(isCurrentPriceAnomaly);
  }, []);

  // Show loading screen only on initial load with no data
  if (loading && !priceData && isInitialLoad) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <ThemedText style={styles.loadingText}>
          Loading {baseAsset} data{loadAttempt > 0 ? ` (Attempt ${loadAttempt + 1}/3)` : ''}...
        </ThemedText>
      </View>
    );
  }

  // Show error state only if we have no data at all
  if (error && !priceData) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setLoadAttempt(0); // Reset attempt counter on manual retry
            loadData();
          }}
        >
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  if (!priceData) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <ThemedText style={styles.errorText}>No data available</ThemedText>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setLoadAttempt(0); // Reset attempt counter on manual retry
            loadData();
          }}
        >
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[
          styles.priceHeader, 
          isAnomaly && styles.anomalyHeader,
          error && styles.errorHeader, // Add visual indicator for error while showing stale data
          loading && styles.updatingHeader // Visual indicator for ongoing update
        ]} 
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.priceContainer}>
          <View>
            <ThemedText style={styles.cryptoSymbol}>
              {baseAsset} - {CRYPTO_NAMES[baseAsset]}
            </ThemedText>
            <View style={styles.priceRow}>
              <ThemedText style={styles.price}>
                {formatNumber(priceData.price)}
              </ThemedText>
              {loading && !isInitialLoad && (
                <ActivityIndicator 
                  size="small" 
                  color="#2196F3" 
                  style={styles.updateIndicator}
                />
              )}
            </View>
            {error && (
              <ThemedText style={styles.stalePriceWarning}>
                Update failed: {error}
              </ThemedText>
            )}
            {lastUpdateTime && (
              <ThemedText style={styles.lastUpdate}>
                Updated: {lastUpdateTime.toLocaleTimeString()}
              </ThemedText>
            )}
          </View>
          <ThemedText style={[
            styles.change,
            priceData.change_24h > 0 ? styles.positive : styles.negative
          ]}>
            {priceData.change_24h > 0 ? '↑' : '↓'} 
            {Math.abs(priceData.change_24h).toFixed(2)}%
          </ThemedText>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.detailsContainer}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>24h Volume</ThemedText>
              <ThemedText style={styles.statValue}>
                {formatNumber(priceData.volume_24h, { minimumFractionDigits: 0, maximumFractionDigits: 0, compact: true })}
              </ThemedText>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Market Cap</ThemedText>
              <ThemedText style={styles.statValue}>
                {formatNumber(priceData.market_cap, { minimumFractionDigits: 0, maximumFractionDigits: 0, compact: true })}
              </ThemedText>
            </View>
          </View>

          {priceHistoryUSD.length >= 2 && priceData && priceData.price !== null && (
            <View style={styles.anomalySection}>
              <ThemedText style={styles.sectionTitle}>Anomaly Detection</ThemedText>
              <View style={styles.methodSelector}>
                <TouchableOpacity 
                  style={[
                    styles.methodButton,
                    detectionMethod === 'zscore' && styles.methodButtonActive
                  ]}
                  onPress={() => setDetectionMethod('zscore')}
                >
                  <ThemedText style={[
                    styles.methodButtonText,
                    detectionMethod === 'zscore' && styles.methodButtonTextActive
                  ]}>
                    Z-Score
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.methodButton,
                    detectionMethod === 'mad' && styles.methodButtonActive
                  ]}
                  onPress={() => setDetectionMethod('mad')}
                >
                  <ThemedText style={[
                    styles.methodButtonText,
                    detectionMethod === 'mad' && styles.methodButtonTextActive
                  ]}>
                    MAD
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.methodButton,
                    detectionMethod === 'iqr' && styles.methodButtonActive
                  ]}
                  onPress={() => setDetectionMethod('iqr')}
                >
                  <ThemedText style={[
                    styles.methodButtonText,
                    detectionMethod === 'iqr' && styles.methodButtonTextActive
                  ]}>
                    IQR
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <AnomalyDetector
                currentLivePriceUSD={priceData.price}
                historicalPricesUSD={priceHistoryUSD}
                onAnomalyDetected={handleAnomalyDetection}
                method={detectionMethod}
              />
            </View>
          )}

          <TouchableOpacity 
            style={styles.hideButton}
            onPress={() => setExpanded(false)}
          >
            <ThemedText style={styles.hideButtonText}>
              Hide Details
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  errorText: {
    color: '#ff0000',
    textAlign: 'center',
  },
  priceHeader: {
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  anomalyHeader: {
    backgroundColor: '#fff3cd',
  },
  detailsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  change: {
    fontSize: 16,
    marginLeft: 8,
  },
  positive: {
    color: '#4caf50',
  },
  negative: {
    color: '#f44336',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#eee',
    marginHorizontal: 16,
  },
  anomalySection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  methodSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  methodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  methodButtonActive: {
    backgroundColor: '#2196F3',
  },
  methodButtonText: {
    fontSize: 14,
    color: '#666',
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  hideButton: {
    marginTop: 16,
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  hideButtonText: {
    color: '#666',
    fontSize: 14,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  errorHeader: {
    backgroundColor: '#fff3cd',
  },
  stalePriceWarning: {
    color: '#ff0000',
    fontSize: 12,
  },
  lastUpdate: {
    color: '#666',
    fontSize: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  updateIndicator: {
    marginLeft: 8,
  },
  updatingHeader: {
    opacity: 0.8,
  },
  cryptoSymbol: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
}); 