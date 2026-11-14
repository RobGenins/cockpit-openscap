#!/bin/bash
# Run OpenSCAP scan and generate remediation scripts

# Arguments
DATASTREAM="$1"
PROFILE_ID="$2"
SCAN_ID="$3"

PLUGIN_DIR="/usr/share/cockpit/cockpit-openscap"
SCANS_DIR="${PLUGIN_DIR}/scans"
SCAN_DIR="${SCANS_DIR}/${SCAN_ID}"
LOG_DIR="/var/log/cockpit-openscap"
LOG_FILE="${LOG_DIR}/scan-${SCAN_ID}.log"
MASTER_LOG="${LOG_DIR}/master.log"

# Ensure directories exist
mkdir -p "${SCAN_DIR}"
mkdir -p "${LOG_DIR}"

# Log function - logs to both scan-specific and master log
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] SCAN: $1"
    echo "${msg}" | tee -a "${LOG_FILE}"
    echo "${msg}" >> "${MASTER_LOG}"
}

# Progress function
progress() {
    echo "PROGRESS:$1:$2"
    log "Progress: $1% - $2"
}

log "=========================================="
log "OpenSCAP Scan Started"
log "Scan ID: ${SCAN_ID}"
log "Datastream: ${DATASTREAM}"
log "Profile: ${PROFILE_ID}"
log "=========================================="

# Validate inputs
if [ -z "${DATASTREAM}" ] || [ -z "${PROFILE_ID}" ] || [ -z "${SCAN_ID}" ]; then
    log "ERROR: Missing required arguments"
    exit 1
fi

if [ ! -f "${DATASTREAM}" ]; then
    log "ERROR: Datastream file not found: ${DATASTREAM}"
    exit 1
fi

# File paths
RESULTS_XML="${SCAN_DIR}/results.xml"
REPORT_HTML="${SCAN_DIR}/report.html"
REMEDIATION_BASH="${SCAN_DIR}/remediation.sh"
REMEDIATION_ANSIBLE="${SCAN_DIR}/remediation.yml"
SCAN_INFO="${SCAN_DIR}/scan-info.json"

progress 20 "Running security scan..."

# Run the scan
log "Executing oscap scan..."
oscap xccdf eval \
    --profile "${PROFILE_ID}" \
    --results "${RESULTS_XML}" \
    --report "${REPORT_HTML}" \
    "${DATASTREAM}" >> "${LOG_FILE}" 2>&1

SCAN_EXIT_CODE=$?

if [ ${SCAN_EXIT_CODE} -eq 0 ] || [ ${SCAN_EXIT_CODE} -eq 2 ]; then
    log "Scan completed (exit code: ${SCAN_EXIT_CODE})"
    progress 60 "Scan completed, generating reports..."
else
    log "ERROR: Scan failed with exit code ${SCAN_EXIT_CODE}"
    exit 1
fi

# Check if results exist
if [ ! -f "${RESULTS_XML}" ]; then
    log "ERROR: Results file not created"
    exit 1
fi

if [ ! -f "${REPORT_HTML}" ]; then
    log "ERROR: HTML report not created"
    exit 1
fi

progress 70 "Generating Bash remediation script..."

# Generate Bash remediation script (to separate temp file first)
log "Generating Bash remediation script..."
TEMP_BASH=$(mktemp)
oscap xccdf generate fix \
    --profile "${PROFILE_ID}" \
    --fix-type bash \
    --output "${TEMP_BASH}" \
    "${RESULTS_XML}" >> "${LOG_FILE}" 2>&1

if [ $? -eq 0 ] && [ -f "${TEMP_BASH}" ] && [ -s "${TEMP_BASH}" ]; then
    # Move to final location
    mv "${TEMP_BASH}" "${REMEDIATION_BASH}"
    chmod 755 "${REMEDIATION_BASH}"
    log "Bash remediation script generated successfully"
else
    rm -f "${TEMP_BASH}"
    log "WARNING: Failed to generate Bash remediation script"
fi

progress 85 "Generating Ansible remediation playbook..."

# Generate Ansible remediation playbook (to separate temp file first)
log "Generating Ansible remediation playbook..."
TEMP_ANSIBLE=$(mktemp)
oscap xccdf generate fix \
    --profile "${PROFILE_ID}" \
    --fix-type ansible \
    --output "${TEMP_ANSIBLE}" \
    "${RESULTS_XML}" >> "${LOG_FILE}" 2>&1

if [ $? -eq 0 ] && [ -f "${TEMP_ANSIBLE}" ] && [ -s "${TEMP_ANSIBLE}" ]; then
    # Move to final location
    mv "${TEMP_ANSIBLE}" "${REMEDIATION_ANSIBLE}"
    chmod 644 "${REMEDIATION_ANSIBLE}"
    log "Ansible remediation playbook generated successfully"
else
    rm -f "${TEMP_ANSIBLE}"
    log "WARNING: Failed to generate Ansible remediation playbook"
fi

progress 90 "Extracting individual fixes for fast generation..."

# Extract individual fixes for fast custom script generation
bash "${PLUGIN_DIR}/scripts/extract-fixes.sh" "${SCAN_ID}" >> "${LOG_FILE}" 2>&1

progress 95 "Saving scan information..."

# Save scan info (no score calculation - it's in the HTML report)
cat > "${SCAN_INFO}" <<EOF
{
    "id": "${SCAN_ID}",
    "timestamp": "$(date -Iseconds)",
    "profile": "${PROFILE_ID}",
    "datastream": "${DATASTREAM}",
    "files": {
        "results_xml": "${RESULTS_XML}",
        "report_html": "${REPORT_HTML}",
        "remediation_bash": "${REMEDIATION_BASH}",
        "remediation_ansible": "${REMEDIATION_ANSIBLE}"
    }
}
EOF

log "Scan information saved"
log "All scores and statistics are in the HTML report"

progress 100 "Scan complete!"

log "=========================================="
log "OpenSCAP Scan Completed Successfully"
log "Results: ${SCAN_DIR}"
log "=========================================="

exit 0
