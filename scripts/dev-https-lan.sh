#!/bin/sh
# Start Next.js dev server with HTTPS cert valid for localhost AND LAN IPs.
# Requires: brew install mkcert && mkcert -install
#
# Usage: sh scripts/dev-https-lan.sh
#
# On mobile: install the mkcert root CA on the device, then open
#   https://<LAN_IP>:3000
# To export the CA cert: mkcert -CAROOT  (copy the rootCA.pem to the device)

set -e

CERT_DIR="./temp/certs"
mkdir -p "$CERT_DIR"

# Gather all LAN IPv4 addresses (macOS)
LAN_IPS=$(ifconfig | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}')

if [ -z "$LAN_IPS" ]; then
  echo "No LAN IPs found. Using localhost only."
  LAN_IPS=""
fi

echo "Generating cert for: localhost 127.0.0.1 $LAN_IPS"

# shellcheck disable=SC2086
mkcert -key-file "$CERT_DIR/key.pem" -cert-file "$CERT_DIR/cert.pem" \
  localhost 127.0.0.1 $LAN_IPS

exec npx next dev \
  --experimental-https \
  --experimental-https-key "$CERT_DIR/key.pem" \
  --experimental-https-cert "$CERT_DIR/cert.pem"
