#!/bin/bash
# ABC Logistics CRM - Demo Starter

# Get local network IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
PORT=4000

echo ""
echo "========================================="
echo "   ABC Logistics CRM — Demo Mode"
echo "========================================="
echo ""
echo "  Local:   http://localhost:$PORT"
echo "  Network: http://$LOCAL_IP:$PORT"
echo ""
echo "  Demo Logins:"
echo "  ┌─────────────────────────────────────────────┐"
echo "  │ Admin:   admin@abclogistics.com / demo1234  │"
echo "  │ Manager: sarah@abclogistics.com / demo1234  │"
echo "  │ Sales:   james@abclogistics.com / demo1234  │"
echo "  │ Finance: linda@abclogistics.com / demo1234  │"
echo "  └─────────────────────────────────────────────┘"
echo ""
echo "  Share the Network URL with people on the same WiFi"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

cd "$(dirname "$0")/backend"
node src/index.js
