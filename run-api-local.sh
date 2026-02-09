#!/bin/bash
# Local testing script - runs Python HTTP server directly

echo "🚀 Starting Stock Options API server..."
echo "📍 API will be available at: http://localhost:8000/stock-options?symbol=RKLB"
echo "⛔ Press Ctrl+C to stop"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Activate virtual environment if exists
if [ -d "$SCRIPT_DIR/venv" ]; then
    echo "✅ Activating virtual environment..."
    source "$SCRIPT_DIR/venv/bin/activate"
fi

# Check if required packages are installed
python3 -c "import yfinance, pandas, numpy" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Missing required packages. Installing..."
    pip install yfinance pandas numpy
fi

# Run the server using Python's http.server with our handler
python3 <<'PYTHON_CODE'
from http.server import HTTPServer
import sys
import os

# Add api directory to Python path
api_path = os.path.join(os.path.dirname(__file__), 'api')
sys.path.insert(0, api_path)

# Import handler from stock-options.py
# Since the filename has a hyphen, we need to use importlib
import importlib.util
spec = importlib.util.spec_from_file_location("stock_options", os.path.join(api_path, "stock-options.py"))
stock_options = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stock_options)

# Get the handler class
handler = stock_options.handler

def run(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, handler)
    print(f'✅ Server started successfully!')
    print(f'🌐 Listening on http://0.0.0.0:{port}')
    print(f'📊 Local: http://localhost:{port}/stock-options?symbol=AAPL')
    print(f'📊 Network: http://127.0.0.1:{port}/stock-options?symbol=RKLB')
    print()
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\n👋 Shutting down server...')
        httpd.shutdown()
        print('✅ Server stopped')

if __name__ == '__main__':
    run()
PYTHON_CODE