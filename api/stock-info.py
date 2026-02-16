from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
import yfinance as yf
import os
from datetime import datetime

ALLOWED_ORIGIN = os.environ.get('VITE_APP_URL', 'http://localhost:3000')

class handler(BaseHTTPRequestHandler):
    def _set_headers(self, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_OPTIONS(self):
        self._set_headers(200)

    def is_authorized(self):
        if 'localhost' in ALLOWED_ORIGIN or not ALLOWED_ORIGIN:
            return True
        origin = self.headers.get('Origin')
        referer = self.headers.get('Referer')
        if (origin and origin.startswith(ALLOWED_ORIGIN)) or (referer and referer.startswith(ALLOWED_ORIGIN)):
            return True
        return False
        
    def do_GET(self):
        try:
            if not self.is_authorized():
                self.send_response(403)
                self.end_headers()
                return

            parsed_path = urlparse(self.path)
            params = parse_qs(parsed_path.query)
            symbol = params.get('symbol', [None])[0]
            
            if not symbol:
                self._set_headers(400)
                self.wfile.write(json.dumps({'error': 'Missing symbol'}).encode())
                return
            
            ticker = yf.Ticker(symbol.upper())
            
            # --- TỐI ƯU HÓA Ở ĐÂY ---
            # Thay vì ticker.info (rất chậm), ta lấy giá từ history trước
            hist = ticker.history(period="1d")
            if hist.empty:
                self._set_headers(404)
                self.wfile.write(json.dumps({'error': 'Symbol not found'}).encode())
                return

            current_price = float(hist['Close'].iloc[-1])
            prev_close = float(ticker.fast_info.get('previousClose', current_price))
            
            change = current_price - prev_close
            percent_change = (change / prev_close) * 100 if prev_close != 0 else 0

            # Chỉ lấy các thông tin cơ bản từ fast_info để tránh bị treo
            fast = ticker.fast_info
            
            stock_data = {
                'symbol': symbol.upper(),
                'name': symbol.upper(), # fast_info không có longName, muốn lấy phải dùng info (chấp nhận chậm)
                'currentPrice': current_price,
                'currency': fast.get('currency', 'USD'),
                'change': round(change, 3),
                'percentChange': round(percent_change, 2),
                'marketCap': fast.get('market_cap'),
                'dayHigh': fast.get('day_high'),
                'dayLow': fast.get('day_low'),
                'timestamp': datetime.now().isoformat()
            }
            
            self._set_headers(200)
            self.wfile.write(json.dumps(stock_data).encode())
            
        except Exception as e:
            print(f"❌ Error in stock-info: {str(e)}") # Hiện log lỗi tại terminal local
            self._set_headers(500)
            self.wfile.write(json.dumps({'error': str(e)}).encode())