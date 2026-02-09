from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
import math

def safe_float(value):
    if value is None:
        return None
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        if math.isnan(value) or math.isinf(value):
            return None
    return float(value)

def clean_options_data(df):
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

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse URL and query parameters
        parsed_path = urlparse(self.path)
        params = parse_qs(parsed_path.query)
        
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()
        
        # Get symbol from query parameters
        symbol = params.get('symbol', [None])[0]
        
        if not symbol:
            response = {'detail': 'Missing symbol parameter'}
            self.wfile.write(json.dumps(response).encode())
            return
        
        try:
            symbol = symbol.upper().strip()
            ticker = yf.Ticker(symbol)
            expirations = ticker.options
            
            if not expirations or len(expirations) == 0:
                response = {'detail': f'No options data available for {symbol}'}
                self.wfile.write(json.dumps(response).encode())
                return

            nearest_expiration = expirations[0]
            options_chain = ticker.option_chain(nearest_expiration)
            
            if options_chain.calls.empty and options_chain.puts.empty:
                response = {'detail': f'No options contracts found for {symbol}'}
                self.wfile.write(json.dumps(response).encode())
                return
            
            current_price = None
            try:
                info = ticker.info
                current_price = info.get('currentPrice') or info.get('regularMarketPrice')
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

            response = {
                'symbol': symbol,
                'currentPrice': current_price,
                'expirationDate': nearest_expiration,
                'allExpirations': list(expirations),
                'calls': clean_options_data(options_chain.calls),
                'puts': clean_options_data(options_chain.puts),
                'timestamp': datetime.now().isoformat()
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            response = {'detail': f'Error: {str(e)}'}
            self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()