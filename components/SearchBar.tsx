import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';

interface SearchBarProps {
  onSearch: (ticker: string) => void;
  placeholder?: string;
}

export function SearchBar({ 
  onSearch,
  placeholder = "Enter crypto ticker (e.g., BTC)"
}: SearchBarProps) {
  const [ticker, setTicker] = useState('');

  const handleSearch = () => {
    if (ticker.trim()) {
      onSearch(ticker.trim().toUpperCase());
      setTicker('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={ticker}
        onChangeText={setTicker}
        placeholder={placeholder}
        placeholderTextColor="#666"
        autoCapitalize="characters"
        returnKeyType="search"
        onSubmitEditing={handleSearch}
      />
      <TouchableOpacity 
        style={styles.button}
        onPress={handleSearch}
      >
        <ThemedText style={styles.buttonText}>Search</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: '#666',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#000',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
}); 