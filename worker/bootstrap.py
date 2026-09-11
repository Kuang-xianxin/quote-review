"""Download pinned local model/runtime artifacts. No account or API key required."""
import argparse
import hashlib
import os
from pathlib import Path
import time
import zipfile
import httpx

MODEL_URL = "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf"
MODEL_SHA256 = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
RUNTIME_URL = "https://github.com/ggml-org/llama.cpp/releases/download/b10901/llama-b10901-bin-win-cpu-x64.zip"
RUNTIME_SHA256 = "6c803e4c7cc9e10c26e80701f913ecf4500cdf8144600440126a3c53889091a1"


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def download(url, path, expected):
    if path.exists() and digest(path) == expected:
        print('Verified existing', path.name, flush=True)
        return
    partial = path.with_suffix(path.suffix + '.partial')
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        with client.stream('GET', url) as response:
            response.raise_for_status()
            size, tick = 0, time.monotonic()
            with partial.open('wb') as destination:
                for chunk in response.iter_bytes(4 * 1024 * 1024):
                    destination.write(chunk); size += len(chunk)
                    if time.monotonic() - tick > 10:
                        print(path.name, round(size / 1e6), 'MB', flush=True); tick = time.monotonic()
    if digest(partial) != expected:
        raise RuntimeError('Download hash mismatch; the artifact was not installed')
    partial.replace(path)
    print('Verified', path.name, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--directory', default='.runtime'); args = parser.parse_args()
    directory = Path(args.directory).resolve(); directory.mkdir(parents=True, exist_ok=True)
    download(MODEL_URL, directory / 'Qwen3-4B-Q4_K_M.gguf', MODEL_SHA256)
    if os.name == 'nt':
        archive = directory / 'llama-b10901.zip'
        download(RUNTIME_URL, archive, RUNTIME_SHA256)
        destination = directory / 'llama'; destination.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive) as source:
            for member in source.infolist():
                if not (destination / member.filename).resolve().is_relative_to(destination):
                    raise RuntimeError('Unsafe archive path')
            for member in source.infolist():
                target = destination / member.filename
                if not member.is_dir() and target.is_file() and digest(target) == hashlib.sha256(source.read(member)).hexdigest():
                    continue
                source.extract(member, destination)
        print('Ready. Run python worker/run.py from the project root.')
    else:
        print('Model ready. Install llama.cpp b10901 for your platform; pass --llama /absolute/path/to/llama-server.')
