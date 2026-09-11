"""Parse in an owned subprocess so cancelled jobs do not leave parsing threads behind."""
import json
import sys
from parse import DocumentError, parse_document

if __name__ == "__main__":
    try:
        if sys.platform != "win32":
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024, 384 * 1024 * 1024))
        result = {"lines": parse_document(sys.argv[1], sys.stdin.buffer.read(512001))}
    except DocumentError as error:
        result = {"error": str(error)}
    except Exception:
        result = {"error": "invalid_document"}
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
