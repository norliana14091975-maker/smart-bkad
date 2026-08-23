#!/bin/bash
# Skrip verifikasi fitur pengaturan: menunggu server lalu menjalankan uji
# API + browser UI secara berurutan.
set -x
cd /home/z/my-project

# 1. Tunggu server siap (maks 90 detik)
for i in $(seq 1 90); do
  code=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://localhost:3000/api/settings 2>/dev/null)
  if [ "$code" = "200" ]; then echo "SERVER READY (attempt $i)"; break; fi
  sleep 1
done
[ "$code" = "200" ] || { echo "SERVER NOT READY"; exit 1; }

# 2. Uji API settings
echo "=== API TESTS ==="
curl -s http://localhost:3000/api/settings | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('GET settings:', d['appName'], '|', d['appTitle'])"

curl -s -c /tmp/ck.txt -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' -o /dev/null
echo "login: $?"

curl -s -b /tmp/ck.txt -X PUT http://localhost:3000/api/admin/settings -H 'Content-Type: application/json' -d '{"appName":"KEUANGAN DKI","appTitle":"Dashboard Keuangan DKI Jakarta","brandText":"BPKD PROVINSI DKI JAKARTA","brandSubtext":"Badan Pengelola Keuangan","footerText":"Uji footer kustom 2026"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('PUT settings:', d.get('data',{}).get('appName'), '|', d.get('data',{}).get('brandText'))"

echo "=== upload logo ==="
curl -s -b /tmp/ck.txt -X POST http://localhost:3000/api/admin/settings/logo -F "file=@/tmp/test-logo.png" | head -c 200
echo ""
echo "=== upload favicon ==="
curl -s -b /tmp/ck.txt -X POST http://localhost:3000/api/admin/settings/favicon -F "file=@/tmp/test-favicon.png" | head -c 200
echo ""
echo "=== unauthenticated PUT must fail ==="
curl -s -X PUT http://localhost:3000/api/admin/settings -H 'Content-Type: application/json' -d '{"appName":"HACK"}'
echo ""
ls -la public/uploads/ 2>/dev/null

# 3. Verifikasi layout metadata server-side (title + favicon di HTML)
echo "=== HTML head check ==="
curl -s http://localhost:3000/ | rg -o '<title>[^<]*</title>' | head -1
curl -s http://localhost:3000/ | rg -o '<link rel="icon"[^>]*>' | head -1

echo "=== SELESAI API ==="
