#!/bin/bash
# List all remediation scripts from scans

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

# Loop through scan directories
for scan_dir in "${SCANS_DIR}"/*; do
    if [ -d "${scan_dir}" ]; then
        SCAN_ID=$(basename "${scan_dir}")
        SCAN_INFO="${scan_dir}/scan-info.json"
        
        if [ -f "${SCAN_INFO}" ]; then
            TIMESTAMP=$(jq -r '.timestamp' "${SCAN_INFO}" 2>/dev/null || echo "Unknown")
            PROFILE=$(jq -r '.profile' "${SCAN_INFO}" 2>/dev/null || echo "Unknown")
            DATE_FORMATTED=$(date -d "${TIMESTAMP}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "${TIMESTAMP}")
            
            # Check for Bash script
            BASH_SCRIPT="${scan_dir}/remediation.sh"
            if [ -f "${BASH_SCRIPT}" ]; then
                if [ "${FIRST}" = false ]; then
                    echo ","
                fi
                FIRST=false
                
                cat <<EOF
    {
        "name": "${PROFILE} - Bash Remediation",
        "type": "bash",
        "date": "${DATE_FORMATTED}",
        "path": "/cockpit/@localhost/cockpit-openscap/scans/${SCAN_ID}/remediation.sh",
        "scan_id": "${SCAN_ID}"
    }
EOF
            fi
            
            # Check for Ansible playbook
            ANSIBLE_PLAYBOOK="${scan_dir}/remediation.yml"
            if [ -f "${ANSIBLE_PLAYBOOK}" ]; then
                if [ "${FIRST}" = false ]; then
                    echo ","
                fi
                FIRST=false
                
                cat <<EOF
    {
        "name": "${PROFILE} - Ansible Playbook",
        "type": "ansible",
        "date": "${DATE_FORMATTED}",
        "path": "/cockpit/@localhost/cockpit-openscap/scans/${SCAN_ID}/remediation.yml",
        "scan_id": "${SCAN_ID}"
    }
EOF
            fi
        fi
    fi
done

echo ""
echo "]"
