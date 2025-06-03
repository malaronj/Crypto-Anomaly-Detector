from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal
import numpy as np
from scipy import stats
from datetime import datetime, timedelta
import pandas as pd
from functools import lru_cache

app = FastAPI(title="Crypto Anomaly Detector")

# Enable CORS with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:19000",  # Expo development server
        "http://localhost:19000",   # Expo development server
        "exp://127.0.0.1:19000",   # Expo development client
        "exp://localhost:19000",    # Expo development client
        "*",  # Allow all origins in development
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PriceData(BaseModel):
    timestamp: datetime = Field(..., description="Timestamp of the price point")
    price: float = Field(..., gt=0, description="Price value, must be greater than 0")

    @validator('timestamp')
    def ensure_timezone(cls, v):
        if v.tzinfo is None:
            v = v.replace(tzinfo=None)
        return v

class AnomalyRequest(BaseModel):
    prices: List[PriceData] = Field(..., min_items=2, description="List of price points")
    method: Literal["zscore", "moving_avg", "rate_of_change"] = Field(
        default="zscore",
        description="Anomaly detection method to use"
    )
    window_size: Optional[int] = Field(
        default=20,
        gt=1,
        description="Window size for moving calculations"
    )

    @validator('window_size')
    def validate_window_size(cls, v, values):
        if v is not None:
            prices = values.get('prices', [])
            if v > len(prices):
                v = max(2, min(len(prices) - 1, v))
        return v

    @validator('prices')
    def validate_prices_order(cls, v):
        if len(v) < 2:
            raise ValueError("At least 2 price points are required")
        
        # Verify timestamps are in ascending order
        timestamps = [p.timestamp for p in v]
        if not all(timestamps[i] <= timestamps[i+1] for i in range(len(timestamps)-1)):
            raise ValueError("Price points must be in chronological order")
        
        return v

class AnomalyResponse(BaseModel):
    timestamps: List[datetime]
    prices: List[float]
    is_anomaly: List[bool]
    threshold_values: List[float]
    method: str
    stats: dict = Field(
        default_factory=dict,
        description="Additional statistics about the analysis"
    )

@lru_cache(maxsize=128)
def calculate_zscore(price_tuple: tuple, window_size: int = 20) -> tuple[np.ndarray, np.ndarray]:
    """Cached calculation of z-scores with exponential weighting for better performance"""
    prices = np.array(price_tuple)
    
    # Calculate exponentially weighted mean and std
    weights = np.exp(np.linspace(-1., 0., window_size))
    weights /= weights.sum()
    
    # Use rolling window for local z-scores
    z_scores = np.zeros(len(prices))
    for i in range(window_size, len(prices) + 1):
        window = prices[i - window_size:i]
        weighted_mean = np.sum(window * weights[-len(window):])
        weighted_std = np.sqrt(np.sum(weights[-len(window):] * (window - weighted_mean) ** 2))
        if i < len(prices):
            z_scores[i] = abs((prices[i] - weighted_mean) / weighted_std if weighted_std > 0 else 0)
    
    # Calculate adaptive threshold based on price volatility
    volatility = np.std(np.diff(prices) / prices[:-1])
    adaptive_threshold = max(2.5, min(4.0, 3.0 + volatility * 10))
    
    return z_scores, np.full_like(z_scores, adaptive_threshold)

def detect_zscore_anomalies(prices: List[float], window_size: int = 20) -> tuple[List[bool], dict]:
    """Detect anomalies using enhanced Z-score method with adaptive thresholding"""
    if len(prices) < window_size:
        window_size = max(2, len(prices) - 1)
    
    z_scores, thresholds = calculate_zscore(tuple(prices), window_size)
    is_anomaly = [score > threshold for score, threshold in zip(z_scores, thresholds)]
    
    stats_data = {
        "mean": float(np.mean(prices)),
        "std": float(np.std(prices)),
        "max_zscore": float(np.max(z_scores)),
        "adaptive_threshold": float(thresholds[-1]),
        "volatility": float(np.std(np.diff(prices) / prices[:-1])) if len(prices) > 1 else 0.0,
        "window_size": window_size,
    }
    return is_anomaly, stats_data

def detect_moving_avg_anomalies(prices: List[float], window: int = 20, threshold: float = 2.0) -> tuple[List[bool], List[float], dict]:
    """Detect anomalies using Enhanced Moving Average Deviation with Bollinger Bands"""
    if len(prices) < window:
        window = max(2, len(prices) - 1)
    
    df = pd.Series(prices)
    
    # Calculate exponential moving average for more responsive tracking
    ema = df.ewm(span=window, adjust=False).mean()
    
    # Calculate Bollinger Bands
    rolling_std = df.rolling(window=window, min_periods=2, center=True).std()
    upper_band = ema + (rolling_std * threshold)
    lower_band = ema - (rolling_std * threshold)
    
    # Calculate relative strength index (RSI) with adaptive window
    delta = df.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window, min_periods=2).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window, min_periods=2).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    
    # Detect anomalies using both Bollinger Bands and RSI
    is_anomaly = ((df > upper_band) | (df < lower_band)) & ((rsi > 70) | (rsi < 30))
    
    stats_data = {
        "avg_deviation": float(df.sub(ema).abs().mean()),
        "max_deviation": float(df.sub(ema).abs().max()),
        "upper_band": float(upper_band.iloc[-1]),
        "lower_band": float(lower_band.iloc[-1]),
        "current_rsi": float(rsi.iloc[-1]),
        "window_size": window,
    }
    
    return is_anomaly.fillna(False).tolist(), ema.tolist(), stats_data

def detect_rate_of_change_anomalies(prices: List[float], window: int = 20, threshold: float = 0.05) -> tuple[List[bool], List[float], dict]:
    """Detect anomalies using Enhanced Rate of Change with momentum indicators"""
    if len(prices) < window:
        window = max(2, len(prices) - 1)
    
    df = pd.Series(prices)
    
    # Calculate multiple timeframe ROC with adaptive windows
    short_window = max(2, window // 4)
    medium_window = max(2, window // 2)
    
    roc_short = df.pct_change(periods=1)
    roc_medium = df.pct_change(periods=short_window)
    roc_long = df.pct_change(periods=medium_window)
    
    # Calculate momentum using MACD-like indicator with adaptive spans
    ema_short = df.ewm(span=max(2, min(12, window)), adjust=False).mean()
    ema_long = df.ewm(span=max(3, min(26, window)), adjust=False).mean()
    macd = ema_short - ema_long
    signal = macd.ewm(span=max(2, min(9, window)), adjust=False).mean()
    
    # Combine signals for anomaly detection
    volatility = roc_short.rolling(window=window, min_periods=2).std()
    adaptive_threshold = threshold * (1 + volatility)
    
    is_anomaly = (
        (abs(roc_short) > adaptive_threshold) &
        (abs(roc_medium) > adaptive_threshold * 0.8) &
        (abs(macd - signal) > abs(signal) * 0.5)
    )
    
    stats_data = {
        "max_change": float(roc_short.abs().max()),
        "avg_change": float(roc_short.abs().mean()),
        "volatility": float(volatility.iloc[-1]),
        "macd": float(macd.iloc[-1]),
        "signal": float(signal.iloc[-1]),
        "adaptive_threshold": float(adaptive_threshold.iloc[-1]),
        "window_size": window,
    }
    
    return is_anomaly.fillna(False).tolist(), roc_short.fillna(0).tolist(), stats_data

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_msg = str(exc)
    status_code = 500
    
    if isinstance(exc, ValueError):
        status_code = 400
    elif isinstance(exc, HTTPException):
        status_code = exc.status_code
    
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": error_msg,
            "type": type(exc).__name__,
            "path": str(request.url)
        }
    )

@app.post("/detect-anomalies")
async def detect_anomalies(request: AnomalyRequest) -> AnomalyResponse:
    try:
        prices = [p.price for p in request.prices]
        timestamps = [p.timestamp for p in request.prices]
        
        if not prices or len(prices) < 2:
            raise ValueError("At least 2 price points are required")
            
        if request.window_size and len(prices) < request.window_size:
            raise ValueError(f"Not enough price points for window size {request.window_size}")
        
        if request.method == "zscore":
            is_anomaly, stats_data = detect_zscore_anomalies(prices, request.window_size or 20)
            threshold_values = [stats_data["adaptive_threshold"]] * len(prices)
        elif request.method == "moving_avg":
            is_anomaly, threshold_values, stats_data = detect_moving_avg_anomalies(
                prices, request.window_size or 20
            )
        else:  # rate_of_change
            is_anomaly, threshold_values, stats_data = detect_rate_of_change_anomalies(
                prices, request.window_size or 20
            )

        # Ensure all lists have the same length
        if len(is_anomaly) != len(prices) or len(threshold_values) != len(prices):
            raise ValueError("Internal error: Mismatched lengths in analysis results")

        return AnomalyResponse(
            timestamps=timestamps,
            prices=prices,
            is_anomaly=is_anomaly,
            threshold_values=threshold_values,
            method=request.method,
            stats=stats_data
        )
    except Exception as e:
        if isinstance(e, ValueError):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 