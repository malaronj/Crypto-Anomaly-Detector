import { CryptoPrice } from '@/components/CryptoPrice';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function CryptoDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen 
        options={{
          title: `${ticker}/USD`,
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <ThemedText style={styles.headerButtonText}>← Back</ThemedText>
            </TouchableOpacity>
          ),
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
          headerShadowVisible: false,
        }} 
      />
      
      <View style={styles.content}>
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Current Price</ThemedText>
          <CryptoPrice 
            baseAsset={ticker}
            quoteAsset="USD"
            refreshInterval={60000}
          />
        </View>

        <View style={styles.infoContainer}>
          <ThemedText style={styles.infoTitle}>About {ticker}</ThemedText>
          <View style={styles.infoCard}>
            <ThemedText style={styles.infoText}>
              Real-time market data provided by CoinMarketCap API.
              Prices are updated every minute to ensure accuracy.
            </ThemedText>
          </View>
          
          <View style={styles.legendCard}>
            <ThemedText style={styles.legendTitle}>Legend:</ThemedText>
            <View style={styles.legendItem}>
              <ThemedText style={styles.upTrend}>↑</ThemedText>
              <ThemedText style={styles.legendText}>Price increase in last 24h</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <ThemedText style={styles.downTrend}>↓</ThemedText>
              <ThemedText style={styles.legendText}>Price decrease in last 24h</ThemedText>
            </View>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  headerButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#2196F3',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  infoContainer: {
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  legendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  upTrend: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  downTrend: {
    color: '#f44336',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 