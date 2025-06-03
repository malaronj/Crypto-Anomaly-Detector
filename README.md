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
- Uses standard deviation from the mean to detect outliers
- Points beyond ±3 standard deviations are flagged as anomalies
- Best for normally distributed price movements

### 2. Moving Average Deviation
- Compares current price to moving average
- Flags points that deviate significantly from the trend
- Good for detecting sudden price movements

### 3. Rate of Change
- Monitors percentage change between consecutive points
- Identifies rapid price changes
- Effective for detecting sudden spikes or drops

## Environment Variables

Create a `.env` file in the root directory with:

```
COINMARKETCAP_API_KEY=your_api_key_here
```

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
  "threshold_values": [3.0],
  "method": "zscore"
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
