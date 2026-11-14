#!/bin/bash
# Simply return the scan info - no parsing needed, OpenSCAP did everything

SCAN_ID="$1"
PLUGIN_DIR="/usr/share/cockpit/cockpit-openscap"
SCAN_DIR="${PLUGIN_DIR}/scans/${SCAN_ID}"
SCAN_INFO="${SCAN_DIR}/scan-info.json"

# Check if scan info exists
if [ ! -f "${SCAN_INFO}" ]; then
    echo '{"error": "Scan results not found"}'
    exit 1
fi

# Return the scan info JSON (OpenSCAP generated all the scores in the HTML)
cat "${SCAN_INFO}"
