#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""雷鹰战机本地服务器（v12.0）
- 静态文件服务（同 python -m http.server）
- 关页自毁：页面发送 POST /shutdown（sendBeacon）后，4 秒内没有 /ping 保活即退出
- 刷新保活：刷新会重新加载页面并 ping，取消待退出

用法：python server.py [端口]（默认 8765）
"""
import json
import os
import sys
import time
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

STATE = {'shutdown_at': None, 'server': None}
GRACE = 4.0


def schedule_shutdown():
    STATE['shutdown_at'] = time.time() + GRACE


def cancel_shutdown():
    STATE['shutdown_at'] = None


def watchdog():
    """看门狗：shutdown 标记到期且未被 ping 取消 → 退出进程"""
    while True:
        at = STATE['shutdown_at']
        if at is not None and time.time() > at:
            print(f'[server] 页面已关闭，服务器退出 (port {PORT})')
            STATE['server'].shutdown()
            break
        time.sleep(0.2)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass  # 安静模式

    def _json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/ping':
            cancel_shutdown()
            self._json(200, {'ok': True})
            return
        super().do_GET()

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n:
            self.rfile.read(n)
        if self.path == '/shutdown':
            schedule_shutdown()
            self._json(200, {'ok': True})
        else:
            self._json(404, {'ok': False})


def main():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    server.daemon_threads = True
    STATE['server'] = server
    wd = threading.Thread(target=watchdog, daemon=True)
    wd.start()
    print(f'[server] 雷鹰战机 v12.0 已启动 → http://localhost:{PORT}/')
    print('[server] 关闭游戏页面后服务器将自动退出；刷新页面不受影响')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print('[server] 已退出')


if __name__ == '__main__':
    main()
