#!/usr/bin/env bash
# shellcheck shell=bash
# Resolve primary ACCESS_IP (RFC1918 / LAN first) for CORS and CSP; optional PUBLIC_IP for extra CORS + logging.
# Optional env: WARDEN_ACCESS_IP (override), WARDEN_UI_PORT (default 8088 for CORS list).
# Sets: ACCESS_IP, PUBLIC_IP, CORS_ORIGIN (export)

warden_detect_private_ipv4() {
  local ip
  if command -v ip >/dev/null 2>&1; then
    while read -r ip; do
      [[ -z "$ip" ]] && continue
      ip="${ip%%/*}"
      [[ "$ip" =~ ^127\. ]] && continue
      if [[ "$ip" =~ ^10\. ]] || [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || [[ "$ip" =~ ^192\.168\. ]]; then
        echo "$ip"
        return 0
      fi
    done < <(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}')
  fi
  for ip in $(hostname -I 2>/dev/null); do
    ip="${ip%%/*}"
    [[ "$ip" =~ ^127\. ]] && continue
    if [[ "$ip" =~ ^10\. ]] || [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || [[ "$ip" =~ ^192\.168\. ]]; then
      echo "$ip"
      return 0
    fi
  done
  return 1
}

warden_detect_outbound_src_ipv4() {
  local ip
  if command -v ip >/dev/null 2>&1; then
    ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')
    [[ -n "$ip" ]] && echo "$ip" && return 0
  fi
  return 1
}

warden_detect_first_global_ipv4() {
  local ip
  if command -v ip >/dev/null 2>&1; then
    while read -r ip; do
      [[ -z "$ip" ]] && continue
      ip="${ip%%/*}"
      [[ "$ip" =~ ^127\. ]] && continue
      echo "$ip"
      return 0
    done < <(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}')
  fi
  for ip in $(hostname -I 2>/dev/null); do
    ip="${ip%%/*}"
    [[ "$ip" =~ ^127\. ]] && continue
    echo "$ip"
    return 0
  done
  return 1
}

warden_fetch_public_ipv4() {
  local out
  if command -v curl >/dev/null 2>&1; then
    out=$(curl -s --connect-timeout 8 --max-time 15 ifconfig.me 2>/dev/null || curl -s --connect-timeout 8 --max-time 15 icanhazip.com 2>/dev/null || curl -s --connect-timeout 8 --max-time 15 ipinfo.io/ip 2>/dev/null || true)
  elif command -v wget >/dev/null 2>&1; then
    out=$(wget -qO- -T 15 "https://ifconfig.me" 2>/dev/null || wget -qO- -T 15 "https://icanhazip.com" 2>/dev/null || wget -qO- -T 15 "https://ipinfo.io/ip" 2>/dev/null || true)
  fi
  out="${out//$'\r'/}"
  out="${out//$'\n'/}"
  echo "${out}"
}

# Args: ui_port (e.g. 8088)
warden_resolve_access_ips_and_cors() {
  local ui_port="${1:-8088}"
  if [[ -n "${WARDEN_ACCESS_IP:-}" ]]; then
    ACCESS_IP="${WARDEN_ACCESS_IP}"
  elif private_ip=$(warden_detect_private_ipv4); then
    ACCESS_IP="$private_ip"
  elif outbound=$(warden_detect_outbound_src_ipv4); then
    ACCESS_IP="$outbound"
  elif first=$(warden_detect_first_global_ipv4); then
    ACCESS_IP="$first"
  else
    ACCESS_IP="localhost"
  fi
  [[ -z "$ACCESS_IP" ]] && ACCESS_IP="localhost"

  PUBLIC_IP="$(warden_fetch_public_ipv4)"
  [[ -z "$PUBLIC_IP" ]] && PUBLIC_IP="$ACCESS_IP"

  CORS_ORIGIN="http://${ACCESS_IP}:${ui_port},http://127.0.0.1:${ui_port},http://localhost:${ui_port},http://localhost:5173,http://${ACCESS_IP},http://localhost"
  if [[ -n "$PUBLIC_IP" && "$PUBLIC_IP" != "$ACCESS_IP" && "$PUBLIC_IP" != "localhost" ]]; then
    CORS_ORIGIN="${CORS_ORIGIN},http://${PUBLIC_IP}:${ui_port},http://${PUBLIC_IP}"
  fi

  export ACCESS_IP PUBLIC_IP CORS_ORIGIN
}
