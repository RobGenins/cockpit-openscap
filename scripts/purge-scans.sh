#!/bin/bash
# purge-scans.sh - Delete all scan data
# Part of OpenSCAP Cockpit Plugin v4.6.0

SCANS_DIR="/usr/share/cockpit/cockpit-openscap/scans"
LOG_FILE="/var/log/cockpit-openscap/master.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PURGE: $1" >> "${LOG_FILE}" 2>/dev/null
}

# Count scans before purge
SCAN_COUNT=0
if [ -d "${SCANS_DIR}" ]; then
    SCAN_COUNT=$(find "${SCANS_DIR}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
fi

if [ "${SCAN_COUNT}" -eq 0 ]; then
    echo '{"status": "success", "message": "No scans to delete", "deleted": 0}'
    exit 0
fi

log "Purging ${SCAN_COUNT} scan(s)..."

# Remove all scan directories
rm -rf "${SCANS_DIR:?}"/*

# Verify deletion
REMAINING=$(find "${SCANS_DIR}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)

if [ "${REMAINING}" -eq 0 ]; then
    log "Successfully purged ${SCAN_COUNT} scan(s)"
    echo "{\"status\": \"success\", \"message\": \"All scans deleted\", \"deleted\": ${SCAN_COUNT}}"
else
    log "ERROR: Failed to purge all scans. ${REMAINING} remaining."
    echo "{\"status\": \"error\", \"message\": \"Failed to delete all scans\", \"remaining\": ${REMAINING}}"
    exit 1
fi
