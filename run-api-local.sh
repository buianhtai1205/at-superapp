#!/bin/bash
echo "🚀 Starting Multi-API Dispatcher (Fixed Version)..."

# Khởi tạo venv
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$SCRIPT_DIR/venv" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
fi

export PYTHONUNBUFFERED=1

python3 <<'PYTHON_CODE'
from http.server import HTTPServer, BaseHTTPRequestHandler
import sys
import os
import importlib.util
from urllib.parse import urlparse

# Đường dẫn thư mục api
api_path = os.path.join(os.getcwd(), 'api')
sys.path.insert(0, api_path)

def get_handler_from_file(file_name):
    """Nạp module và lấy class handler"""
    try:
        module_name = file_name.replace('-', '_').replace('.py', '')
        file_path = os.path.join(api_path, file_name)
        
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.handler
    except Exception as e:
        print(f"❌ Lỗi load file {file_name}: {e}")
        return None

class DynamicRouter(BaseHTTPRequestHandler):
    # --- CÁC HÀM TIỆN ÍCH ĐỂ GIẢ LẬP HANDLER THẬT ---
    def _set_headers(self, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def is_authorized(self):
        # Ở local thì mặc định là True để test cho nhanh
        return True

    def do_GET(self):
        path = urlparse(self.path).path
        endpoint = path.strip('/').split('/')[-1]
        target_file = f"{endpoint}.py"
        
        print(f"📩 Request: {path} -> Target: {target_file}")

        if os.path.exists(os.path.join(api_path, target_file)):
            handler_class = get_handler_from_file(target_file)
            if handler_class:
                try:
                    # Chạy hàm do_GET của file API với context của Router hiện tại
                    handler_class.do_GET(self)
                except Exception as e:
                    import traceback
                    print(f"💥 Runtime Error trong {target_file}:")
                    traceback.print_exc()
                    # Trả về lỗi JSON thay vì treo
                    if not self.wfile.closed:
                        self.send_response(500)
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": str(e)}).encode())
            else:
                self.send_error(500, "Could not load handler class")
        else:
            self.send_error(404, f"API {target_file} not found")

def run(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, DynamicRouter)
    print(f"✅ API Dispatcher đang chạy tại: http://localhost:{port}")
    print(f"🔗 Thử: http://localhost:{port}/stock-info?symbol=RKLB")
    print(f"🔗 Thử: http://localhost:{port}/stock-options?symbol=RKLB")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
PYTHON_CODE