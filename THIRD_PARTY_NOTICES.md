# Third-party notices

Application code is MIT. Dependencies retain their licenses in their packages. No model weights or native binaries are bundled in the repository or web deployment.

- Qwen3-4B: Apache-2.0, official [model](https://huggingface.co/Qwen/Qwen3-4B) and [GGUF artifact](https://huggingface.co/Qwen/Qwen3-4B-GGUF). Bootstrap pins Q4_K_M SHA-256 `7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5` (2,497,280,256 bytes).
- llama.cpp: MIT, [official source](https://github.com/ggml-org/llama.cpp). The Windows CPU runtime is pinned to b10901; bootstrap pins the downloaded archive's SHA-256. Preserve its supplied license files when redistributing binaries.
- The retained Qwen2.5-1.5B baseline used the official Apache-2.0 [GGUF model](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF). Its failed outputs are evaluation data, not bundled weights.
- React, Vite, Zod, decimal.js, Drizzle, Radix, Lucide and Tailwind retain their upstream package licenses. pypdf, openpyxl and httpx retain their Python package licenses.
- Vendored Sites Vite plugin and UI primitives keep their existing MIT notices under `build/` and `vendor/`.
