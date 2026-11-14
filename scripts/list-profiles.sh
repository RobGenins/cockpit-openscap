#!/bin/bash
# List available OpenSCAP profiles for the system
# v4.0.1 - Fixed profile parsing

PLUGIN_DIR="/usr/share/cockpit/cockpit-openscap"
LOG_DIR="/var/log/cockpit-openscap"
LOG_FILE="${LOG_DIR}/list-profiles-$(date +%Y%m%d).log"

# Ensure log directory exists (ignore errors - may not have permission)
mkdir -p "${LOG_DIR}" 2>/dev/null

# Log function (silently fail if no write permission)
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "${LOG_FILE}" 2>/dev/null || true
}

log "Listing profiles started"

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID}"
    OS_VERSION_ID="${VERSION_ID}"
else
    log "ERROR: Cannot detect OS"
    echo "[]"
    exit 0
fi

log "Detected OS: ${OS_ID} ${OS_VERSION_ID}"

# Determine datastream file based on OS
DATASTREAM=""
SSG_DIR="/usr/share/xml/scap/ssg/content"

case "${OS_ID}" in
    rhel|redhat)
        MAJOR_VERSION=$(echo "${OS_VERSION_ID}" | cut -d. -f1)
        DATASTREAM="${SSG_DIR}/ssg-rhel${MAJOR_VERSION}-ds.xml"
        ;;
    centos)
        MAJOR_VERSION=$(echo "${OS_VERSION_ID}" | cut -d. -f1)
        # CentOS Stream uses RHEL datastream
        if [ -f "${SSG_DIR}/ssg-centos${MAJOR_VERSION}-ds.xml" ]; then
            DATASTREAM="${SSG_DIR}/ssg-centos${MAJOR_VERSION}-ds.xml"
        else
            DATASTREAM="${SSG_DIR}/ssg-rhel${MAJOR_VERSION}-ds.xml"
        fi
        ;;
    fedora)
        DATASTREAM="${SSG_DIR}/ssg-fedora-ds.xml"
        ;;
    rocky)
        MAJOR_VERSION=$(echo "${OS_VERSION_ID}" | cut -d. -f1)
        # Rocky Linux - try rl first, then rhel
        if [ -f "${SSG_DIR}/ssg-rl${MAJOR_VERSION}-ds.xml" ]; then
            DATASTREAM="${SSG_DIR}/ssg-rl${MAJOR_VERSION}-ds.xml"
        else
            DATASTREAM="${SSG_DIR}/ssg-rhel${MAJOR_VERSION}-ds.xml"
        fi
        ;;
    almalinux|alma)
        MAJOR_VERSION=$(echo "${OS_VERSION_ID}" | cut -d. -f1)
        # AlmaLinux - try almalinux first, then rhel
        if [ -f "${SSG_DIR}/ssg-almalinux${MAJOR_VERSION}-ds.xml" ]; then
            DATASTREAM="${SSG_DIR}/ssg-almalinux${MAJOR_VERSION}-ds.xml"
        else
            DATASTREAM="${SSG_DIR}/ssg-rhel${MAJOR_VERSION}-ds.xml"
        fi
        ;;
    *)
        log "ERROR: Unsupported OS: ${OS_ID}"
        echo "[]"
        exit 0
        ;;
esac

log "Using datastream: ${DATASTREAM}"

# Check if datastream exists
if [ ! -f "${DATASTREAM}" ]; then
    log "ERROR: Datastream file not found: ${DATASTREAM}"
    echo "[]"
    exit 0
fi

# Get list of profiles using --profiles flag
# Output format: profile_id:profile_title
PROFILES_OUTPUT=$(oscap info --profiles "${DATASTREAM}" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "${PROFILES_OUTPUT}" ]; then
    log "ERROR: Failed to get profiles from datastream"
    echo "[]"
    exit 0
fi

# Parse profiles into JSON
# Format from oscap info --profiles: "xccdf_org.ssgproject.content_profile_cis:CIS Benchmark Title"
echo "["

FIRST=true
while IFS=: read -r PROFILE_ID TITLE; do
    # Skip empty lines
    [ -z "${PROFILE_ID}" ] && continue

    # Escape any quotes in the title
    TITLE=$(echo "${TITLE}" | sed 's/"/\\"/g')

    # Output JSON object
    if [ "${FIRST}" = false ]; then
        echo ","
    fi
    FIRST=false

    cat <<EOF
    {
        "id": "${PROFILE_ID}",
        "title": "${TITLE}",
        "datastream": "${DATASTREAM}"
    }
EOF
done <<< "${PROFILES_OUTPUT}"

echo ""
echo "]"

log "Profile listing completed"
