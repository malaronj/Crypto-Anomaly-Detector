import { CryptoPrice } from '@/components/CryptoPrice';
import { SearchBar } from '@/components/SearchBar';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Stack, router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

// Top 5 cryptocurrencies to show
const TOP_CRYPTOS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'];

export default function HomeScreen() {
  const handleSearch = (ticker: string) => {
    router.push(`/crypto/${ticker}`);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Crypto Anomaly Detector',
          headerShown: true,
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
          headerShadowVisible: false,
        }} 
      />
      
      <View style={styles.searchContainer}>
        <SearchBar 
          onSearch={handleSearch}
          placeholder="Search any crypto ticker..."
        />
        <ThemedText style={styles.subtitle}>
          Real-time cryptocurrency prices in USD
        </ThemedText>
      </View>

      <View style={styles.listHeader}>
        <ThemedText style={styles.listTitle}>Top Cryptocurrencies</ThemedText>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {TOP_CRYPTOS.map((crypto, index) => (
          <View key={crypto} style={styles.cryptoCard}>
            <CryptoPrice 
              baseAsset={crypto}
              quoteAsset="USD"
              refreshInterval={120000}
            />
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchContainer: {
    backgroundColor: '#ffffff',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  cryptoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
}); 