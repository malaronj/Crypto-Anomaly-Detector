# Crypto Anomaly Detector

A real-time cryptocurrency price tracking application with advanced anomaly detection capabilities.

## Features

- Real-time cryptocurrency price tracking
- Multiple anomaly detection methods:
  - Z-Score Analysis (±3σ threshold)
  - Moving Average Deviation (±2σ deviation)
  - Rate of Change Detection (5% threshold)
- Interactive method selection
- Visual anomaly highlighting
- Detailed price statistics (24h volume, market cap)
- Support for multiple cryptocurrencies
- CAD currency display

## Setup

### Backend (Python FastAPI)

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Start the backend server:
```bash
uvicorn app:app --reload
```

### Frontend (React Native)

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

## Anomaly Detection Methods

### 1. Z-Score Method
- Uses standard deviation from the mean to detect outliers.
- Employs an **adaptive threshold** (typically between 2.5 and 4.0 standard deviations, adjusted based on price volatility) rather than a fixed value.
- Incorporates **exponential weighting** in calculations to give more relevance to recent data points.
- Best for normally distributed price movements but adapts to local volatility.

### 2. Moving Average Deviation
- Compares current price to an **Exponential Moving Average (EMA)** for more responsive trend tracking.
- Uses **Bollinger Bands** (typically ±2 standard deviations from EMA, but configurable) to identify significant deviations.
- Combines Bollinger Band breakouts with **Relative Strength Index (RSI)** (anomalies flagged if RSI is >70 or <30 during a breakout) for improved signal accuracy.
- Good for detecting sudden price movements relative to the recent trend and momentum.

### 3. Rate of Change
- Monitors percentage change between data points.
- Uses an **adaptive threshold** (base default is 5%, adjusted by local price volatility).
- Analyzes **multiple Rate of Change (ROC) timeframes** (short, medium, long) and incorporates a **MACD-like indicator** to confirm momentum.
- Effective for detecting sudden spikes or drops confirmed by momentum indicators.

## Environment Variables

*(Note: The backend API currently does not require any environment variables to run. The `COINMARKETCAP_API_KEY` mentioned previously might be used by the frontend or for planned features related to fetching market data, but is not used by the anomaly detection endpoints.)*

## API Endpoints

### POST /detect-anomalies
Detects price anomalies using specified method.

Request body:
```json
{
  "prices": [
    {
      "timestamp": "2023-11-20T12:00:00Z",
      "price": 50000.00
    }
  ],
  "method": "zscore",
  "window_size": 20
}
```

Response:
```json
{
  "timestamps": ["2023-11-20T12:00:00Z"],
  "prices": [50000.00],
  "is_anomaly": [false],
  "threshold_values": [3.2], /* Example: adaptive z-score threshold or EMA value */
  "method": "zscore",
  "stats": { /* Dictionary containing additional statistics from the analysis */
    "mean": 49500.00,
    "std": 500.00,
    "max_zscore": 1.5,
    "adaptive_threshold": 3.2,
    "volatility": 0.015,
    "window_size": 20
    /* Other stats may be present depending on the method */
  }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
