from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
import math
import os

ALLOWED_ORIGIN = os.environ.get('VITE_APP_URL', 'http://localhost:3000')

def safe_float(value):
    """Convert NaN/inf to None for JSON compliance"""
    if value is None:
        return None
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        if math.isnan(value) or math.isinf(value):
            return None
    return float(value)

def safe_int(value):
    """Convert to int or None"""
    if value is None or pd.isna(value):
        return None
    try:
        return int(value)
    except:
        return None

def clean_options_data(df, expiration_date):
    """Clean options dataframe and add expiration date"""
    if df.empty:
        return []
    
    # Important columns for options trading
    columns_to_keep = [
        'contractSymbol',      # Contract identifier
        'strike',              # Strike price (critical)
        'lastPrice',           # Last traded price (critical)
        'bid',                 # Bid price (for buying)
        'ask',                 # Ask price (for selling)
        'change',              # Price change
        'percentChange',       # Percentage change
        'volume',              # Trading volume (liquidity indicator)
        'openInterest',        # Open interest (liquidity indicator)
        'impliedVolatility',   # IV (critical for pricing)
        'inTheMoney',          # ITM status (critical)
        'lastTradeDate',       # When last traded
    ]
    
    existing_cols = [c for c in columns_to_keep if c in df.columns]
    df = df[existing_cols].copy()
    records = df.to_dict('records')
    
    cleaned_records = []
    for record in records:
        cleaned_record = {
            'expirationDate': expiration_date,  # Add expiration to each contract
        }
        
        for key, value in record.items():
            if key == 'contractSymbol':
                cleaned_record[key] = str(value) if value is not None else None
            elif key == 'inTheMoney':
                cleaned_record[key] = bool(value) if pd.notna(value) else False
            elif key in ['volume', 'openInterest']:
                cleaned_record[key] = safe_int(value)
            elif key == 'lastTradeDate':
                # Convert timestamp to ISO string
                if pd.notna(value):
                    try:
                        cleaned_record[key] = pd.Timestamp(value).isoformat()
                    except:
                        cleaned_record[key] = str(value)
                else:
                    cleaned_record[key] = None
            else:
                cleaned_record[key] = safe_float(value)
        
        cleaned_records.append(cleaned_record)
    
    return cleaned_records

def calculate_days_to_expiration(expiration_date_str):
    """Calculate days remaining until expiration"""
    try:
        exp_date = datetime.strptime(expiration_date_str, '%Y-%m-%d')
        days = (exp_date - datetime.now()).days
        return max(0, days)  # Don't return negative days
    except:
        return None

class handler(BaseHTTPRequestHandler):
    
    def _set_headers(self, status_code=200):
        """Set response headers with CORS"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight requests"""
        self._set_headers(200)
    
    def is_authorized(self):
        """
        BƯỚC 2: Kiểm tra Referer/Origin từ Header gửi lên
        Đây là lớp bảo vệ thứ 2 để chặn requests từ Postman/Curl/Python script
        """
        # Nếu đang chạy localhost để test thì luôn cho qua
        if 'localhost' in ALLOWED_ORIGIN:
            return True

        origin = self.headers.get('Origin')
        referer = self.headers.get('Referer')
        
        # Logic: Request BẮT BUỘC phải có Origin hoặc Referer khớp với domain của bạn
        if origin and origin.startswith(ALLOWED_ORIGIN):
            return True
        if referer and referer.startswith(ALLOWED_ORIGIN):
            return True
            
        return False
        
    def do_GET(self):
        """Handle GET requests"""
        try:
            # --- KIỂM TRA BẢO MẬT ---
            if not self.is_authorized():
                self.send_response(403) # Forbidden
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {'error': 'Forbidden: Access denied from this origin.'}
                self.wfile.write(json.dumps(response).encode())
                return
            # ------------------------

            parsed_path = urlparse(self.path)
            params = parse_qs(parsed_path.query)
            
            symbol = params.get('symbol', [None])[0]
            expiration = params.get('expiration', [None])[0]  # Optional: specific expiration
            
            if not symbol:
                self._set_headers(400)
                response = {'error': 'Missing symbol parameter'}
                self.wfile.write(json.dumps(response).encode())
                return
            
            symbol = symbol.upper().strip()
            ticker = yf.Ticker(symbol)
            
            # Get all expiration dates
            all_expirations = ticker.options
            if not all_expirations or len(all_expirations) == 0:
                self._set_headers(404)
                response = {'error': f'No options data available for {symbol}'}
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Use specified expiration or default to nearest
            target_expiration = expiration if expiration in all_expirations else all_expirations[0]
            
            # Get options chain for target expiration
            options_chain = ticker.option_chain(target_expiration)
            
            if options_chain.calls.empty and options_chain.puts.empty:
                self._set_headers(404)
                response = {'error': f'No options contracts found for {symbol}'}
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Get current stock price
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
            
            # Format expiration dates with additional info
            expiration_options = []
            for exp_date in all_expirations:
                days_to_exp = calculate_days_to_expiration(exp_date)
                expiration_options.append({
                    'date': exp_date,
                    'daysToExpiration': days_to_exp,
                    'label': f"{exp_date} ({days_to_exp} days)" if days_to_exp is not None else exp_date
                })
            
            # Build response
            response = {
                'symbol': symbol,
                'currentPrice': current_price,
                'selectedExpiration': target_expiration,
                'expirationOptions': expiration_options,
                'calls': clean_options_data(options_chain.calls, target_expiration),
                'puts': clean_options_data(options_chain.puts, target_expiration),
                'timestamp': datetime.now().isoformat()
            }
            
            self._set_headers(200)
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            self._set_headers(500)
            response = {'error': f'Internal server error: {str(e)}'}
            self.wfile.write(json.dumps(response).encode())