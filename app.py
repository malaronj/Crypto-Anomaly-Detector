import streamlit as st
import pandas as pd
import numpy as np
import ccxt
import plotly.graph_objects as go
from datetime import datetime, timedelta
from sklearn.preprocessing import StandardScaler
from statsmodels.tsa.seasonal import seasonal_decompose
import time

# Set page config
st.set_page_config(
    page_title="Crypto Anomaly Detector",
    layout="wide"
)

# Initialize exchange
exchange = ccxt.binance()

def fetch_ohlcv_data(symbol, timeframe='1m', limit=500):
    """Fetch OHLCV data for a given symbol"""
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        return df
    except Exception as e:
        st.error(f"Error fetching data: {str(e)}")
        return None

def detect_anomalies(data, n_std=3):
    """Detect anomalies using Z-score method"""
    scaler = StandardScaler()
    scaled_close = scaler.fit_transform(data[['close']])
    z_scores = pd.DataFrame(scaled_close, columns=['z_score'], index=data.index)
    
    # Mark anomalies where z-score is beyond n standard deviations
    anomalies = z_scores[abs(z_scores['z_score']) > n_std].index
    return anomalies

def perform_time_series_analysis(data):
    """Perform time series decomposition"""
    try:
        decomposition = seasonal_decompose(data['close'], period=30)
        return decomposition
    except Exception as e:
        st.error(f"Error in time series analysis: {str(e)}")
        return None

# Sidebar
st.sidebar.title("Crypto Anomaly Detector")

# Get available symbols
try:
    markets = exchange.load_markets()
    symbols = [symbol for symbol in markets.keys() if symbol.endswith('/USDT')]
    selected_symbol = st.sidebar.selectbox("Select Cryptocurrency", symbols)
except Exception as e:
    st.error(f"Error loading markets: {str(e)}")
    st.stop()

# Main content
st.title(f"Cryptocurrency Anomaly Detection - {selected_symbol}")

# Initialize session state for streaming
if 'streaming' not in st.session_state:
    st.session_state.streaming = False

# Streaming control
if st.sidebar.button('Start/Stop Streaming'):
    st.session_state.streaming = not st.session_state.streaming

# Analysis parameters
n_std = st.sidebar.slider("Standard Deviations for Anomaly Detection", 2.0, 5.0, 3.0, 0.1)

# Create placeholder for the chart
chart_placeholder = st.empty()
metrics_placeholder = st.empty()

# Main loop for real-time updates
while st.session_state.streaming:
    # Fetch latest data
    df = fetch_ohlcv_data(selected_symbol)
    
    if df is not None:
        # Detect anomalies
        anomalies = detect_anomalies(df, n_std)
        
        # Create price chart with anomalies
        fig = go.Figure()
        
        # Add price line
        fig.add_trace(go.Scatter(
            x=df['timestamp'],
            y=df['close'],
            mode='lines',
            name='Price'
        ))
        
        # Add anomalies as scatter points
        if len(anomalies) > 0:
            fig.add_trace(go.Scatter(
                x=df.loc[anomalies, 'timestamp'],
                y=df.loc[anomalies, 'close'],
                mode='markers',
                name='Anomalies',
                marker=dict(color='red', size=10)
            ))
        
        # Update layout
        fig.update_layout(
            title=f"{selected_symbol} Price with Anomalies",
            xaxis_title="Time",
            yaxis_title="Price (USDT)",
            height=600
        )
        
        # Display the chart
        chart_placeholder.plotly_chart(fig, use_container_width=True)
        
        # Display metrics
        with metrics_placeholder.container():
            col1, col2, col3 = st.columns(3)
            col1.metric("Current Price", f"${df['close'].iloc[-1]:.2f}")
            col2.metric("Number of Anomalies", len(anomalies))
            col3.metric("Price Change %", 
                       f"{((df['close'].iloc[-1] - df['close'].iloc[0]) / df['close'].iloc[0] * 100):.2f}%")
            
            # Perform and display time series analysis
            decomposition = perform_time_series_analysis(df)
            if decomposition:
                st.subheader("Time Series Decomposition")
                
                # Create subplots for decomposition components
                fig_decomp = go.Figure()
                components = ['trend', 'seasonal', 'resid']
                
                for component in components:
                    values = getattr(decomposition, component)
                    fig_decomp.add_trace(go.Scatter(
                        x=df['timestamp'],
                        y=values,
                        name=component.capitalize(),
                        mode='lines'
                    ))
                
                fig_decomp.update_layout(
                    title="Time Series Components",
                    height=400
                )
                st.plotly_chart(fig_decomp, use_container_width=True)
        
    time.sleep(5)  # Update every 5 seconds

# Display static data when not streaming
if not st.session_state.streaming:
    df = fetch_ohlcv_data(selected_symbol)
    if df is not None:
        st.line_chart(df.set_index('timestamp')['close'])
        st.info("Click 'Start/Stop Streaming' to begin real-time analysis") 