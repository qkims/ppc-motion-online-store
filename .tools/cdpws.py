"""Minimal Chrome DevTools Protocol client over a hand-rolled WebSocket.

No third-party modules on this machine (no `websockets`, no `websocket-client`),
and CDP screenshots cannot be taken any other way -- `--screenshot` fires at
load-complete, which is before an animation freeze can settle, and
`--virtual-time-budget` hangs on this build.  So: raw socket, RFC6455 by hand.

Only what CDP needs: text frames, client-masked outbound, fragmentation and
64-bit lengths inbound (a deviceScaleFactor-3 screenshot is several MB of
base64 and WILL arrive fragmented), ping/pong kept alive.
"""
import base64, json, os, socket, struct, urllib.request

class WS:
    def __init__(self, url, timeout=30):
        assert url.startswith("ws://"), url
        rest = url[5:]
        hostport, _, path = rest.partition("/")
        host, _, port = hostport.partition(":")
        self.s = socket.create_connection((host, int(port or 80)), timeout=timeout)
        self.s.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\n"
               "Upgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            c = self.s.recv(4096)
            if not c: raise RuntimeError("handshake closed: %r" % buf)
            buf += c
        head, _, tail = buf.partition(b"\r\n\r\n")
        if b"101" not in head.split(b"\r\n")[0]:
            raise RuntimeError("handshake refused: %r" % head.split(b"\r\n")[0])
        self.rx = bytearray(tail)
        self._id = 0

    # -- framing -------------------------------------------------------------
    def _need(self, n):
        while len(self.rx) < n:
            c = self.s.recv(65536)
            if not c: raise RuntimeError("socket closed mid-frame")
            self.rx += c

    def _frame(self):
        self._need(2)
        b0, b1 = self.rx[0], self.rx[1]
        fin, op, masked, ln = b0 & 0x80, b0 & 0x0F, b1 & 0x80, b1 & 0x7F
        off = 2
        if ln == 126:
            self._need(4); ln = struct.unpack(">H", self.rx[2:4])[0]; off = 4
        elif ln == 127:
            self._need(10); ln = struct.unpack(">Q", self.rx[2:10])[0]; off = 10
        if masked:
            self._need(off + 4); mk = bytes(self.rx[off:off+4]); off += 4
        self._need(off + ln)
        pay = bytes(self.rx[off:off+ln])
        del self.rx[:off+ln]
        if masked:
            pay = bytes(b ^ mk[i & 3] for i, b in enumerate(pay))
        return fin, op, pay

    def _send(self, payload, op=1):
        n = len(payload)
        h = bytearray([0x80 | op])
        if n < 126:      h.append(0x80 | n)
        elif n < 65536:  h.append(0x80 | 126); h += struct.pack(">H", n)
        else:            h.append(0x80 | 127); h += struct.pack(">Q", n)
        mk = os.urandom(4); h += mk
        self.s.sendall(bytes(h) + bytes(b ^ mk[i & 3] for i, b in enumerate(payload)))

    def recv(self):
        """One complete text message, reassembling fragments."""
        while True:
            fin, op, pay = self._frame()
            if op == 0x9: self._send(pay, op=0xA); continue      # ping -> pong
            if op == 0xA: continue                                # pong
            if op == 0x8: raise RuntimeError("server closed")
            chunks = [pay]
            while not fin:
                fin, op2, p2 = self._frame()
                if op2 in (0x9, 0xA): continue
                chunks.append(p2)
            return json.loads(b"".join(chunks).decode())

    # -- CDP -----------------------------------------------------------------
    def call(self, method, **params):
        self._id += 1
        mid = self._id
        self._send(json.dumps({"id": mid, "method": method, "params": params}).encode())
        while True:
            m = self.recv()
            if m.get("id") == mid:
                if "error" in m: raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})

    def close(self):
        try: self._send(b"", op=8)
        except Exception: pass
        try: self.s.close()
        except Exception: pass

def targets(port):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=10) as r:
        return json.load(r)

def version(port):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=10) as r:
        return json.load(r)
