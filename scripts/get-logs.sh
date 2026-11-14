#!/bin/bash
# get-logs.sh - Get master log file contents
# Part of OpenSCAP Cockpit Plugin v4.6.0
# Usage: get-logs.sh [lines] [clear]

LINES="${1:-50}"
ACTION="${2}"

LOG_FILE="/var/log/cockpit-openscap/master.log"
LOG_DIR="/var/log/cockpit-openscap"

# Ensure log directory exists
mkdir -p "${LOG_DIR}" 2>/dev/null
chmod 755 "${LOG_DIR}" 2>/dev/null

# Create log file if it doesn't exist
if [ ! -f "${LOG_FILE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] LOG: Master log file created" > "${LOG_FILE}"
    chmod 644 "${LOG_FILE}"
fi

# Clear logs if requested
if [ "${ACTION}" = "clear" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] LOG: Logs cleared by user" > "${LOG_FILE}"
    echo "Logs cleared"
    exit 0
fi

# Output last N lines
if [ -f "${LOG_FILE}" ]; then
    tail -n "${LINES}" "${LOG_FILE}"
else
    echo "No log file found"
fi
