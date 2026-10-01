#!/usr/bin/env python3
"""Serve a Next.js static export for local/tunnel previews, without dependencies.

    python3 scripts/serve-static-preview.py --directory out --port 3107

This is a development preview server, not an internet-facing production server.
HTML and unversioned files revalidate; fingerprinted Next assets are immutable.
Gzip bodies are cached in bounded memory and refreshed when a file changes.
"""

import argparse
from collections import OrderedDict
from email.utils import parsedate_to_datetime
import gzip
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import os
from pathlib import Path
import re
import threading
from urllib.parse import unquote, urlsplit


class GzipCache:
    def __init__(self, limit=64 * 1024 * 1024):
        self.limit = limit
        self.size = 0
        self.entries = OrderedDict()
        self.lock = threading.Lock()

    def get(self, path, stat, stream):
        key = (str(path), stat.st_ino, stat.st_mtime_ns, stat.st_size)
        with self.lock:
            if key in self.entries:
                self.entries.move_to_end(key)
                return self.entries[key]
        body = gzip.compress(stream.read(), compresslevel=5, mtime=0)
        if len(body) <= self.limit:
            with self.lock:
                # Another request can finish compressing the same file first.
                if key in self.entries:
                    return self.entries[key]
                while self.entries and self.size + len(body) > self.limit:
                    self.size -= len(self.entries.popitem(last=False)[1])
                self.entries[key] = body
                self.size += len(body)
        return body


def quality(header, encoding):
    values = {}
    for item in header.lower().split(','):
        name, *parameters = item.strip().split(';')
        weight = 1.0
        for parameter in parameters:
            if parameter.strip().startswith('q='):
                try:
                    weight = float(parameter.strip()[2:])
                except ValueError:
                    weight = 0.0
        values[name] = weight if 0 <= weight <= 1 else 0.0
    if encoding in values:
        return values[encoding]
    if encoding == 'identity':
        return 0.0 if values.get('*') == 0 else 1.0
    return values.get('*', 0.0)


class PreviewHandler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'StaticPreview/1.0'
    timeout = 30
    # Avoid delayed small responses when reusing HTTP/1.1 connections.
    disable_nagle_algorithm = True
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.wasm': 'application/wasm'}

    def resolve_file(self):
        decoded = unquote(urlsplit(self.path).path, errors='strict')
        if '\x00' in decoded or '\\' in decoded:
            return None
        parts = [part for part in decoded.split('/') if part not in ('', '.')]
        if '..' in parts:
            return None
        root = Path(self.directory).resolve()
        path = root.joinpath(*parts).resolve()
        candidates = [path]
        if path != root:
            # Next exports /learn/os as learn/os.html alongside its child folder.
            candidates.append(path.with_name(path.name + '.html'))
        candidates.append(path / 'index.html')
        for candidate in candidates:
            resolved = candidate.resolve()
            if resolved.is_relative_to(root) and resolved.is_file():
                return resolved
        return None

    def send_head(self):
        try:
            path = self.resolve_file()
            if path is None:
                self.send_error(404, 'File not found')
                return None
            stream = path.open('rb')
        except (OSError, ValueError, UnicodeError):
            self.send_error(404, 'File not found')
            return None

        try:
            stat = os.fstat(stream.fileno())
            content_type = self.guess_type(str(path))
            encoding = self.headers.get('Accept-Encoding', '')
            compressible = (content_type.startswith('text/') or content_type in {
                'application/javascript', 'application/json', 'application/wasm',
                'application/xml', 'image/svg+xml'})
            use_gzip = quality(encoding, 'gzip') > 0 and (
                (compressible and 512 <= stat.st_size <= 64 * 1024 * 1024)
                or quality(encoding, 'identity') == 0)
            if not use_gzip and quality(encoding, 'identity') == 0:
                self.send_error(406, 'No acceptable content encoding')
                stream.close()
                return None

            variant = 'gzip' if use_gzip else 'identity'
            etag = f'W/"{stat.st_ino:x}-{stat.st_mtime_ns:x}-{stat.st_size:x}-{variant}"'
            relative = path.relative_to(Path(self.directory).resolve())
            parts = relative.parts
            fingerprinted = (parts[:2] == ('_next', 'static') and (
                re.search(r'(?:^|[-.])[a-f0-9]{8,}(?=\.)', path.name)
                or (len(parts) == 4 and parts[3] in ('_buildManifest.js', '_ssgManifest.js'))))
            cache_control = 'public, max-age=31536000, immutable' if fingerprinted else 'no-cache'
            not_modified = False
            match = self.headers.get('If-None-Match')
            if match is not None:
                not_modified = any(tag.strip() == '*' or tag.strip().removeprefix('W/') == etag.removeprefix('W/') for tag in match.split(','))
            elif self.headers.get('If-Modified-Since'):
                try:
                    date = parsedate_to_datetime(self.headers['If-Modified-Since'])
                    not_modified = date.tzinfo is not None and int(stat.st_mtime) <= date.timestamp()
                except (ValueError, TypeError, OverflowError):
                    pass

            if not_modified:
                self.send_response(304)
                self.send_header('ETag', etag)
                self.send_header('Cache-Control', cache_control)
                self.send_header('Vary', 'Accept-Encoding')
                self.end_headers()
                stream.close()
                return None

            length = stat.st_size
            if use_gzip:
                body = self.server.gzip_cache.get(path, stat, stream)
                stream.close()
                stream = io.BytesIO(body)
                length = len(body)
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(length))
            self.send_header('Last-Modified', self.date_time_string(stat.st_mtime))
            self.send_header('ETag', etag)
            self.send_header('Cache-Control', cache_control)
            self.send_header('Vary', 'Accept-Encoding')
            if use_gzip:
                self.send_header('Content-Encoding', 'gzip')
            self.end_headers()
            return stream
        except Exception:
            stream.close()
            raise

    def end_headers(self):
        if getattr(self, 'error_response', False):
            self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def send_error(self, *args, **kwargs):
        # Base handler supplies an accurate Content-Length for GET and HEAD.
        self.close_connection = True
        self.error_response = True
        try:
            super().send_error(*args, **kwargs)
        finally:
            self.error_response = False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'out')
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=3107)
    args = parser.parse_args()
    directory = args.directory.resolve()
    if not directory.is_dir():
        parser.error(f'Export directory does not exist: {directory}. Run the site build first.')

    def handler(*values, **options):
        return PreviewHandler(*values, directory=str(directory), **options)

    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        server.gzip_cache = GzipCache()
        print(f'Serving {directory} at http://{args.bind}:{server.server_port} (HTTP/1.1 + gzip)', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
