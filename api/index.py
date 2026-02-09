from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
import math

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def safe_float(value):
    """Convert numpy/pandas NaN, inf, -inf to None for JSON compliance"""
    if value is None:
        return None
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        if math.isnan(value) or math.isinf(value):
            return None
    return float(value)

def clean_options_data(df):
    """Clean and filter options dataframe for API response"""
    if df.empty:
        return []
    
    columns_to_keep = [
        'contractSymbol', 'strike', 'lastPrice', 'bid', 'ask',
        'volume', 'openInterest', 'impliedVolatility', 'inTheMoney'
    ]
    
    existing_cols = [c for c in columns_to_keep if c in df.columns]
    df = df[existing_cols].copy()
    
    records = df.to_dict('records')
    
    cleaned_records = []
    for record in records:
        cleaned_record = {}
        for key, value in record.items():
            if key == 'contractSymbol':
                cleaned_record[key] = str(value) if value is not None else None
            elif key == 'inTheMoney':
                cleaned_record[key] = bool(value) if pd.notna(value) else False
            else:
                cleaned_record[key] = safe_float(value)
        cleaned_records.append(cleaned_record)
    
    return cleaned_records

@app.get("/api")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "Stock Options API is running"
    }

@app.get("/api/stock-options")
async def get_options(symbol: str):
    """Get stock options data for a given symbol"""
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing 'symbol' parameter")
    
    symbol = symbol.upper().strip()
    
    try:
        ticker = yf.Ticker(symbol)
        
        expirations = ticker.options
        if not expirations or len(expirations) == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"No options data available for {symbol}"
            )

        nearest_expiration = expirations[0]
        options_chain = ticker.option_chain(nearest_expiration)
        
        if options_chain.calls.empty and options_chain.puts.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No options contracts found for {symbol}"
            )
        
        current_price = None
        try:
            info = ticker.info
            current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        except:
            pass
        
        if current_price is None:
            try:
                current_price = ticker.fast_info.get('lastPrice')
            except:
                pass
        
        if current_price is None:
            try:
                hist = ticker.history(period='1d')
                if not hist.empty:
                    current_price = hist['Close'].iloc[-1]
            except:
                pass
        
        current_price = safe_float(current_price) or 0

        return {
            'symbol': symbol,
            'currentPrice': current_price,
            'expirationDate': nearest_expiration,
            'allExpirations': list(expirations),
            'calls': clean_options_data(options_chain.calls),
            'puts': clean_options_data(options_chain.puts),
            'timestamp': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching options data: {str(e)}"
        )