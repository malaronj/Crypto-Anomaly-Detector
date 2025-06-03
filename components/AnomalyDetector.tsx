import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';

export type AnomalyDetectionMethod = 'zscore' | 'mad' | 'iqr';

interface PricePoint {
  timestamp: Date;
  price: number;
}

interface AnomalyDetectorProps {
  historicalPricesUSD: PricePoint[]; // 365-day historical USD prices
  currentLivePriceUSD: number;     // Current live USD price
  onAnomalyDetected: (isCurrentPriceAnomaly: boolean) => void; // Callback with a single boolean
  method: AnomalyDetectionMethod;
}

interface AnalysisStats {
  mean: number;
  std: number;
  maxZscore: number;
  threshold: number;
  volatility: number;
}

export function AnomalyDetector({ historicalPricesUSD, currentLivePriceUSD, onAnomalyDetected, method }: AnomalyDetectorProps) {
  const [stats, setStats] = useState<AnalysisStats | null>(null);

  useEffect(() => {
    if (historicalPricesUSD.length < 2) return;

    const historicalPriceValues = historicalPricesUSD.map(p => p.price);
    let calculatedStats: AnalysisStats;
    let isCurrentPriceAnomalyBasedOnMethod = false;

    switch (method) {
      case 'zscore':
        calculatedStats = detectAnomaliesZScore(historicalPriceValues, currentLivePriceUSD);
        if (calculatedStats.std === 0) {
          isCurrentPriceAnomalyBasedOnMethod = false;
        } else {
          const currentZScore = Math.abs((currentLivePriceUSD - calculatedStats.mean) / calculatedStats.std);
          isCurrentPriceAnomalyBasedOnMethod = currentZScore > calculatedStats.threshold;
        }
        break;
      case 'mad':
        calculatedStats = detectAnomaliesMAD(historicalPriceValues, currentLivePriceUSD);
        // Anomaly if current score_MAD > 3
        // calculatedStats.maxZscore is score_MAD = |livePrice - historicalMedian| / scaledMadSigma
        // calculatedStats.threshold is 3 * scaledMadSigma, but the direct check is score_MAD > 3
        isCurrentPriceAnomalyBasedOnMethod = calculatedStats.maxZscore > 3;
        break;
      case 'iqr':
        calculatedStats = detectAnomaliesIQR(historicalPriceValues, currentLivePriceUSD);
        if (calculatedStats.std === 0) { // IQR is in std field
            isCurrentPriceAnomalyBasedOnMethod = false;
        } else {
            const sortedHistorical = [...historicalPriceValues].sort((a,b) => a-b);
            const q1 = sortedHistorical[Math.floor(sortedHistorical.length * 0.25)];
            const q3 = sortedHistorical[Math.floor(sortedHistorical.length * 0.75)];
            // Anomaly if current price is outside Q1 - 1.5*IQR or Q3 + 1.5*IQR
            // calculatedStats.threshold already stores 1.5 * IQR
            const lowerBound = q1 - calculatedStats.threshold;
            const upperBound = q3 + calculatedStats.threshold;
            isCurrentPriceAnomalyBasedOnMethod = currentLivePriceUSD < lowerBound || currentLivePriceUSD > upperBound;
        }
        break;
      default:
        calculatedStats = detectAnomaliesZScore(historicalPriceValues, currentLivePriceUSD);
        if (calculatedStats.std === 0) {
          isCurrentPriceAnomalyBasedOnMethod = false;
        } else {
          const currentZScore = Math.abs((currentLivePriceUSD - calculatedStats.mean) / calculatedStats.std);
          isCurrentPriceAnomalyBasedOnMethod = currentZScore > calculatedStats.threshold;
        }
    }

    setStats(calculatedStats);
    onAnomalyDetected(isCurrentPriceAnomalyBasedOnMethod);
  }, [historicalPricesUSD, currentLivePriceUSD, method, onAnomalyDetected]);

  // Helper function to calculate median
  function calculateMedian(data: number[]): number {
    if (data.length === 0) return 0;
    const sortedData = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sortedData.length / 2);
    if (sortedData.length % 2 === 0) {
      // Even length: average of two middle elements
      return (sortedData[mid - 1] + sortedData[mid]) / 2;
    } else {
      // Odd length: the middle element
      return sortedData[mid];
    }
  }

  // Z-Score: Max Score is Z-score of the currentLivePriceUSD vs. historical data. Threshold is 2.0.
  function detectAnomaliesZScore(historicalData: number[], livePrice: number): AnalysisStats {
    const mean = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
    const variance = historicalData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / historicalData.length;
    const std = Math.sqrt(variance);
    const zScoreOfLivePrice = std === 0 ? 0 : Math.abs((livePrice - mean) / std);
    const threshold = 2.0; // Fixed threshold for Z-score
    const volatility = std === 0 ? 0 : std / mean;

    return {
      mean,
      std,
      maxZscore: zScoreOfLivePrice,
      threshold,
      volatility
    };
  }

  // MAD: Max Score is (livePrice - historicalMean) / (historicalMAD * 1.4826). Std displayed is (historicalMAD * 1.4826). Threshold for anomaly: abs(livePrice - historicalMean) > 3 * (historicalMAD * 1.4826).
  function detectAnomaliesMAD(historicalData: number[], livePrice: number): AnalysisStats {
    const historicalMean = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
    
    const historicalMedian = calculateMedian(historicalData);
    const absoluteDeviationsFromMedian = historicalData.map(p => Math.abs(p - historicalMedian));
    const rawMad = calculateMedian(absoluteDeviationsFromMedian);
    
    const madScalingFactor = 1.4826;
    const scaledMadSigma = rawMad * madScalingFactor;
    
    // Score calculation: deviation from mean divided by scaled MAD
    const scoreVsScaledMad = scaledMadSigma === 0 ? 0 : Math.abs(livePrice - historicalMean) / scaledMadSigma;
    
    const thresholdForAnomaly = 3.0 * scaledMadSigma;
    const volatility = scaledMadSigma === 0 ? 0 : scaledMadSigma / historicalMean;

    return {
      mean: historicalMean,
      std: scaledMadSigma,
      maxZscore: scoreVsScaledMad,
      threshold: thresholdForAnomaly,
      volatility
    };
  }

  // IQR: 
  // - Max Score = (livePrice - historicalMean) / historicalStandardDeviation.
  // - Std (displayed in UI) = historicalStandardDeviation.
  // - Threshold (displayed in UI & used for anomaly bounds) = 1.5 * historicalRawIQR.
  // - Volatility = historicalStandardDeviation / historicalMean.
  function detectAnomaliesIQR(historicalData: number[], livePrice: number): AnalysisStats {
    const historicalMean = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
    
    const sortedHistorical = [...historicalData].sort((a, b) => a - b);
    const q1 = sortedHistorical[Math.floor(sortedHistorical.length * 0.25)];
    const q3 = sortedHistorical[Math.floor(sortedHistorical.length * 0.75)];
    const rawIQR = q3 - q1;
    
    // Calculate score as deviation from mean divided by IQR
    const scoreVsIQR = rawIQR === 0 ? 0 : Math.abs(livePrice - historicalMean) / rawIQR;
    
    // Threshold is 1.5 * IQR
    const thresholdForAnomalyBounds = 1.5 * rawIQR;
    
    // Calculate standard deviation for display
    const variance = historicalData.reduce((a, b) => a + Math.pow(b - historicalMean, 2), 0) / historicalData.length;
    const historicalStandardDeviation = Math.sqrt(variance);
    
    const volatility = historicalStandardDeviation === 0 ? 0 : historicalStandardDeviation / historicalMean;

    return {
      mean: historicalMean,
      std: historicalStandardDeviation,
      maxZscore: scoreVsIQR,
      threshold: thresholdForAnomalyBounds,
      volatility
    };
  }

  if (!stats) return null;

  const methodDescriptions = {
    zscore: 'Detects outliers using exponentially weighted statistics and adaptive thresholds',
    mad: 'Uses Median Absolute Deviation for robust outlier detection',
    iqr: 'Identifies outliers using Interquartile Range analysis'
  };

  return (
    <View style={styles.container}>
      <View style={styles.methodInfo}>
        <ThemedText style={styles.methodDescription}>
          {methodDescriptions[method]}
        </ThemedText>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Mean:</ThemedText>
          <ThemedText style={styles.statValue}>{stats.mean.toFixed(4)}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Std:</ThemedText>
          <ThemedText style={styles.statValue}>{stats.std.toFixed(4)}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Max Score:</ThemedText>
          <ThemedText style={styles.statValue}>{stats.maxZscore.toFixed(4)}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Threshold:</ThemedText>
          <ThemedText style={styles.statValue}>{stats.threshold.toFixed(4)}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Volatility:</ThemedText>
          <ThemedText style={styles.statValue}>{stats.volatility.toFixed(4)}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  methodInfo: {
    marginBottom: 16,
  },
  methodDescription: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  statsGrid: {
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
}); 