#!/bin/bash
# Servicio local de monitoreo-web en macOS (launchd) + Cloudflare Tunnel.
#
#   ./scripts/servicio.sh instalar     compila y deja app + túnel corriendo siempre
#   ./scripts/servicio.sh reiniciar    recompila y reinicia la app (tras cambiar código)
#   ./scripts/servicio.sh estado       muestra si están corriendo y la URL pública
#   ./scripts/servicio.sh url          imprime la URL pública del túnel
#   ./scripts/servicio.sh logs         sigue los logs de la app
#   ./scripts/servicio.sh detener      detiene ambos (vuelven al reiniciar sesión)
#   ./scripts/servicio.sh desinstalar  quita ambos servicios
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/monitoreo-web"
APP_LABEL="com.brian.monitoreo-web"
TUNNEL_LABEL="com.brian.monitoreo-web.tunnel"
PORT="${PORT:-3100}"
DOMAIN="gui/$(id -u)"

NODE_BIN="$(command -v node)"
CLOUDFLARED_BIN="$(command -v cloudflared || true)"

write_app_plist() {
  cat > "$AGENTS_DIR/$APP_LABEL.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$APP_LABEL</string>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$PROJECT_DIR/node_modules/next/dist/bin/next</string>
    <string>start</string>
    <string>-p</string><string>$PORT</string>
    <!-- Solo localhost: desde afuera se entra únicamente por el túnel. -->
    <string>-H</string><string>127.0.0.1</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PATH</key><string>$(dirname "$NODE_BIN"):/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/app.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/app.log</string>
</dict>
</plist>
EOF
}

write_tunnel_plist() {
  cat > "$AGENTS_DIR/$TUNNEL_LABEL.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$TUNNEL_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$CLOUDFLARED_BIN</string>
    <string>tunnel</string>
    <string>--no-autoupdate</string>
    <string>--url</string><string>http://127.0.0.1:$PORT</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/tunnel.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/tunnel.log</string>
</dict>
</plist>
EOF
}

load() { launchctl bootstrap "$DOMAIN" "$AGENTS_DIR/$1.plist"; }
unload() {
  launchctl bootout "$DOMAIN/$1" 2>/dev/null || true
  # bootout es asíncrono: esperar a que el servicio desaparezca antes de volver a cargarlo.
  for _ in $(seq 1 50); do
    launchctl print "$DOMAIN/$1" >/dev/null 2>&1 || return 0
    sleep 0.2
  done
}
running() { launchctl print "$DOMAIN/$1" 2>/dev/null | grep -q "state = running"; }

tunnel_url() {
  grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" 2>/dev/null | tail -1
}

case "${1:-}" in
  instalar)
    [ -n "$CLOUDFLARED_BIN" ] || { echo "Falta cloudflared: brew install cloudflared"; exit 1; }
    [ -f "$PROJECT_DIR/.env.local" ] || { echo "Falta .env.local (ver .env.example)"; exit 1; }
    mkdir -p "$AGENTS_DIR" "$LOG_DIR"
    (cd "$PROJECT_DIR" && npm run build)
    unload "$APP_LABEL"; unload "$TUNNEL_LABEL"
    : > "$LOG_DIR/tunnel.log"
    write_app_plist; write_tunnel_plist
    load "$APP_LABEL"; load "$TUNNEL_LABEL"
    echo "Instalado. Local: http://localhost:$PORT"
    echo "La URL pública tarda unos segundos: ./scripts/servicio.sh url"
    ;;
  reiniciar)
    (cd "$PROJECT_DIR" && npm run build)
    launchctl kickstart -k "$DOMAIN/$APP_LABEL"
    echo "App reiniciada: http://localhost:$PORT"
    ;;
  estado)
    running "$APP_LABEL" && echo "App:   corriendo  → http://localhost:$PORT" || echo "App:   detenida (ver $LOG_DIR/app.log)"
    running "$TUNNEL_LABEL" && echo "Túnel: corriendo  → $(tunnel_url)/login" || echo "Túnel: detenido (ver $LOG_DIR/tunnel.log)"
    ;;
  url)
    url="$(tunnel_url)"
    [ -n "$url" ] && echo "$url/login" || echo "Todavía no hay URL; esperá unos segundos (log: $LOG_DIR/tunnel.log)"
    ;;
  logs)
    tail -f "$LOG_DIR/app.log"
    ;;
  detener)
    unload "$APP_LABEL"; unload "$TUNNEL_LABEL"
    echo "Detenidos. Vuelven al iniciar sesión o con: ./scripts/servicio.sh instalar"
    ;;
  desinstalar)
    unload "$APP_LABEL"; unload "$TUNNEL_LABEL"
    rm -f "$AGENTS_DIR/$APP_LABEL.plist" "$AGENTS_DIR/$TUNNEL_LABEL.plist"
    echo "Servicios quitados (los logs quedan en $LOG_DIR)"
    ;;
  *)
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
