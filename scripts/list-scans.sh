#!/bin/bash
# List all historical OpenSCAP scans (sorted newest first)

PLUGIN_DIR="/usr/share/cockpit/cockpit-openscap"
SCANS_DIR="${PLUGIN_DIR}/scans"

# Check if scans directory exists
if [ ! -d "${SCANS_DIR}" ]; then
    echo "[]"
    exit 0
fi

# Start JSON array
echo "["

FIRST=true

# Loop through scan directories sorted by name descending (newest first)
for scan_dir in $(ls -1d "${SCANS_DIR}"/*/ 2>/dev/null | sort -r); do
    [ ! -d "${scan_dir}" ] && continue

    SCAN_INFO="${scan_dir}/scan-info.json"
    SCAN_ID=$(basename "${scan_dir}")

    # Skip if no scan-info.json but still show if we have results
    if [ -f "${SCAN_INFO}" ]; then
        TIMESTAMP=$(jq -r '.timestamp' "${SCAN_INFO}" 2>/dev/null || echo "Unknown")
        PROFILE=$(jq -r '.profile' "${SCAN_INFO}" 2>/dev/null || echo "Unknown")
    else
        # Try to derive date from scan ID (format: YYYYMMDD-HHMMSS or similar)
        TIMESTAMP="${SCAN_ID}"
        PROFILE="Unknown"
    fi

    # Only show if we have at least a report or results file
    if [ ! -f "${scan_dir}/report.html" ] && [ ! -f "${scan_dir}/results.xml" ]; then
        continue
    fi

    if [ "${FIRST}" = false ]; then
        echo ","
    fi
    FIRST=false

    # Format date
    DATE_FORMATTED=$(date -d "${TIMESTAMP}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "${TIMESTAMP}")

    cat <<EOF
    {
        "id": "${SCAN_ID}",
        "date": "${DATE_FORMATTED}",
        "profile": "${PROFILE}"
    }
EOF
done

echo ""
echo "]"
