#!/usr/bin/env python3
"""Generate a SHA-256 hex digest for the web app password gate.

Usage: python scripts/hash_password.py 'your-password'
Paste the output into web config.js as PASSWORD_SHA256.
"""
import hashlib
import sys

if len(sys.argv) != 2:
    print("Usage: python scripts/hash_password.py 'your-password'")
    sys.exit(1)

digest = hashlib.sha256(sys.argv[1].encode()).hexdigest()
print(digest)
