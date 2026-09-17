#!/bin/bash
################################################################################
# Ensure nginx is managed by systemd and listening.
#
# Handles the common post-failed-update state:
#   - systemctl says nginx is inactive/failed
#   - but an orphan master still holds :80/:443/:13306
#   - so "systemctl start nginx" fails with "Address already in use"
#
# Usage:
#   bash scripts/ensure-nginx-running.sh           # exit 0/1
#   bash scripts/ensure-nginx-running.sh --warn     # never exit non-zero
# Sourced (log/warn/error from caller):
#   source scripts/ensure-nginx-running.sh && ensure_nginx_running
################################################################################

ensure_nginx_ports_free_or_owned() {
    # Return 0 if ports look free OR held by nginx we can see; 1 if held by something else.
    local holders
    holders="$(ss -tlnp 2>/dev/null | grep -E ':(80|443|13306)\b' || true)"
    if [ -z "$holders" ]; then
        return 0
    fi
    if echo "$holders" | grep -q 'nginx'; then
        return 0
    fi
    # Occupied but not nginx — do not kill unknown processes
    return 1
}

stop_orphan_nginx() {
    # Prefer /run (systemd), fall back to /var/run (legacy / symlink)
    local pidfile=""
    for f in /run/nginx.pid /var/run/nginx.pid; do
        if [ -f "$f" ]; then
            pidfile="$f"
            break
        fi
    done
    local pid=""

    if [ -n "$pidfile" ]; then
        pid="$(tr -d '[:space:]' < "$pidfile" 2>/dev/null || true)"
    fi

    # nginx -s quit ONLY works when the pidfile exists. After failed updates the
    # pidfile is often gone while workers still hold :80/:443 — skip quit then
    # and signal processes directly.
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        nginx -s quit 2>/dev/null || kill -QUIT "$pid" 2>/dev/null || true
    fi

    if pgrep -x nginx >/dev/null 2>&1; then
        pkill -QUIT -x nginx 2>/dev/null || true
    fi

    # Also signal any nginx PIDs still holding our listen ports (ss may see
    # workers even when the master name differs slightly)
    local ss_pids
    ss_pids="$(ss -tlnp 2>/dev/null | grep -E ':(80|443|13306)\b' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
    if [ -n "$ss_pids" ]; then
        local p
        for p in $ss_pids; do
            if [ -r "/proc/$p/comm" ] && grep -qx nginx "/proc/$p/comm" 2>/dev/null; then
                kill -QUIT "$p" 2>/dev/null || true
            fi
        done
    fi

    if ! pgrep -x nginx >/dev/null 2>&1 && [ -z "$(ss -tlnp 2>/dev/null | grep -E ':(80|443|13306)\b' | grep nginx || true)" ]; then
        rm -f /run/nginx.pid /var/run/nginx.pid 2>/dev/null || true
        return 0
    fi

    # Wait up to ~5s for graceful exit
    local i
    for i in 1 2 3 4 5 6 7 8 9 10; do
        if ! pgrep -x nginx >/dev/null 2>&1; then
            rm -f /run/nginx.pid /var/run/nginx.pid 2>/dev/null || true
            return 0
        fi
        sleep 0.5
    done

    # Still alive — TERM then KILL
    pkill -TERM -x nginx 2>/dev/null || true
    sleep 1
    if pgrep -x nginx >/dev/null 2>&1; then
        pkill -KILL -x nginx 2>/dev/null || true
        sleep 0.5
    fi
    rm -f /run/nginx.pid /var/run/nginx.pid 2>/dev/null || true
}

_ensure_nginx_log() {
    if declare -F log >/dev/null 2>&1; then
        log "$1"
    else
        echo "[ensure-nginx] $1"
    fi
}

_ensure_nginx_warn() {
    if declare -F warn >/dev/null 2>&1; then
        warn "$1"
    else
        echo "[ensure-nginx WARN] $1" >&2
    fi
}

ensure_nginx_running() {
    local strict="${1:-strict}" # strict | warn

    if ! command -v nginx >/dev/null 2>&1; then
        _ensure_nginx_warn "nginx binary not found"
        [ "$strict" = "warn" ] && return 0
        return 1
    fi

    if ! nginx -t >/dev/null 2>&1; then
        _ensure_nginx_warn "nginx -t failed — refusing to start/reload"
        [ "$strict" = "warn" ] && return 0
        return 1
    fi

    if systemctl is-active --quiet nginx 2>/dev/null; then
        if systemctl reload nginx 2>/dev/null; then
            _ensure_nginx_log "✓ Nginx reloaded"
            return 0
        fi
        _ensure_nginx_warn "systemctl reload nginx failed — attempting restart"
        if systemctl restart nginx 2>/dev/null; then
            _ensure_nginx_log "✓ Nginx restarted"
            return 0
        fi
        _ensure_nginx_warn "systemctl restart nginx failed"
        [ "$strict" = "warn" ] && return 0
        return 1
    fi

    # Inactive/failed unit — clear orphans holding listen sockets, then start
    if pgrep -x nginx >/dev/null 2>&1; then
        _ensure_nginx_warn "nginx processes exist while systemd unit is inactive — stopping orphans"
        stop_orphan_nginx
    elif ! ensure_nginx_ports_free_or_owned; then
        _ensure_nginx_warn "ports 80/443/13306 are in use by a non-nginx process — cannot auto-recover"
        [ "$strict" = "warn" ] && return 0
        return 1
    else
        # Ports may still show in-use from a race; check ss for nginx without pgrep match
        local holders
        holders="$(ss -tlnp 2>/dev/null | grep -E ':(80|443|13306)\b' || true)"
        if [ -n "$holders" ] && echo "$holders" | grep -q nginx; then
            _ensure_nginx_warn "listen sockets held by nginx — stopping orphans"
            stop_orphan_nginx
        fi
    fi

    # Reset failed unit state so start is clean
    systemctl reset-failed nginx 2>/dev/null || true

    if systemctl start nginx 2>/dev/null; then
        _ensure_nginx_log "✓ Nginx started"
        return 0
    fi

    # One more orphan pass if start failed (classic Address already in use)
    _ensure_nginx_warn "systemctl start nginx failed — clearing orphans and retrying once"
    stop_orphan_nginx
    systemctl reset-failed nginx 2>/dev/null || true
    if systemctl start nginx 2>/dev/null; then
        _ensure_nginx_log "✓ Nginx started after orphan cleanup"
        return 0
    fi

    _ensure_nginx_warn "Failed to start nginx. Check: systemctl status nginx; journalctl -u nginx -n 50; ss -tlnp | grep -E ':(80|443|13306)'"
    [ "$strict" = "warn" ] && return 0
    return 1
}

# Run when executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    MODE="strict"
    if [[ "${1:-}" == "--warn" ]]; then
        MODE="warn"
    fi
    ensure_nginx_running "$MODE"
    exit $?
fi
