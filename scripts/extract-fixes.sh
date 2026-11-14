#!/bin/bash
# extract-fixes.sh - Extract individual fixes from remediation scripts
# Part of OpenSCAP Cockpit Plugin v4.2.7
# Run once after scan to enable fast custom script generation

SCAN_ID="$1"
SCAN_DIR="/usr/share/cockpit/cockpit-openscap/scans/${SCAN_ID}"
BASH_SCRIPT="${SCAN_DIR}/remediation.sh"
ANSIBLE_SCRIPT="${SCAN_DIR}/remediation.yml"
FIXES_DIR="${SCAN_DIR}/fixes"

# Validate
if [ -z "${SCAN_ID}" ]; then
    echo "Error: Scan ID required" >&2
    exit 1
fi

if [ ! -d "${SCAN_DIR}" ]; then
    echo "Error: Scan directory not found" >&2
    exit 1
fi

# Create fixes directory
mkdir -p "${FIXES_DIR}/bash" "${FIXES_DIR}/ansible"

# Extract Bash fixes (if remediation.sh exists)
if [ -f "${BASH_SCRIPT}" ]; then
    awk '
    BEGIN { in_section = 0; current_rule = ""; content = "" }

    # Start of a rule section
    /^#.*xccdf_org\.ssgproject\.content_rule_[a-zA-Z0-9_-]+/ {
        # Save previous section if we had one
        if (current_rule != "" && content != "") {
            outfile = fixes_dir "/bash/" current_rule ".sh"
            print content > outfile
            close(outfile)
        }

        # Extract rule ID from comment
        match($0, /xccdf_org\.ssgproject\.content_rule_[a-zA-Z0-9_-]+/)
        current_rule = substr($0, RSTART, RLENGTH)
        content = $0 "\n"
        in_section = 1
        next
    }

    # Accumulate content for current section
    in_section {
        content = content $0 "\n"
    }

    END {
        # Save last section
        if (current_rule != "" && content != "") {
            outfile = fixes_dir "/bash/" current_rule ".sh"
            print content > outfile
            close(outfile)
        }
    }
    ' fixes_dir="${FIXES_DIR}" "${BASH_SCRIPT}"

    # Count extracted bash fixes
    BASH_COUNT=$(ls -1 "${FIXES_DIR}/bash/"*.sh 2>/dev/null | wc -l)
    echo "Extracted ${BASH_COUNT} Bash fixes"
fi

# Extract Ansible fixes (if remediation.yml exists)
if [ -f "${ANSIBLE_SCRIPT}" ]; then
    awk '
    BEGIN { in_task = 0; current_rule = ""; content = ""; task_indent = "" }

    # Start of a task with xccdf rule name
    /^[[:space:]]*- name:.*xccdf_org\.ssgproject\.content_rule_/ {
        # Save previous task if we had one
        if (current_rule != "" && content != "") {
            outfile = fixes_dir "/ansible/" current_rule ".yml"
            print content > outfile
            close(outfile)
        }

        # Extract rule ID
        match($0, /xccdf_org\.ssgproject\.content_rule_[a-zA-Z0-9_-]+/)
        current_rule = substr($0, RSTART, RLENGTH)

        # Get the indentation
        match($0, /^[[:space:]]*/)
        task_indent = substr($0, RSTART, RLENGTH)

        content = $0 "\n"
        in_task = 1
        next
    }

    # New task starts (same or less indentation with "- name:")
    in_task && /^[[:space:]]*- name:/ {
        # Check if this is at same or higher level (end of our task)
        match($0, /^[[:space:]]*/)
        new_indent = substr($0, RSTART, RLENGTH)
        if (length(new_indent) <= length(task_indent)) {
            # Save previous task
            if (current_rule != "" && content != "") {
                outfile = fixes_dir "/ansible/" current_rule ".yml"
                print content > outfile
                close(outfile)
            }
            current_rule = ""
            content = ""
            in_task = 0
        }
    }

    # Accumulate content for current task
    in_task {
        content = content $0 "\n"
    }

    END {
        # Save last task
        if (current_rule != "" && content != "") {
            outfile = fixes_dir "/ansible/" current_rule ".yml"
            print content > outfile
            close(outfile)
        }
    }
    ' fixes_dir="${FIXES_DIR}" "${ANSIBLE_SCRIPT}"

    # Count extracted ansible fixes
    ANSIBLE_COUNT=$(ls -1 "${FIXES_DIR}/ansible/"*.yml 2>/dev/null | wc -l)
    echo "Extracted ${ANSIBLE_COUNT} Ansible fixes"
fi

# Create an index file listing all available fixes
{
    echo "{"
    echo "  \"scan_id\": \"${SCAN_ID}\","
    echo "  \"extracted\": \"$(date -Iseconds)\","
    echo "  \"bash_fixes\": ["
    first=true
    if ls "${FIXES_DIR}/bash/"*.sh >/dev/null 2>&1; then
        for f in "${FIXES_DIR}/bash/"*.sh; do
            [ -f "$f" ] || continue
            rule=$(basename "$f" .sh)
            [ "$first" = true ] && first=false || echo ","
            echo -n "    \"${rule}\""
        done
    fi
    echo ""
    echo "  ],"
    echo "  \"ansible_fixes\": ["
    first=true
    if ls "${FIXES_DIR}/ansible/"*.yml >/dev/null 2>&1; then
        for f in "${FIXES_DIR}/ansible/"*.yml; do
            [ -f "$f" ] || continue
            rule=$(basename "$f" .yml)
            [ "$first" = true ] && first=false || echo ","
            echo -n "    \"${rule}\""
        done
    fi
    echo ""
    echo "  ]"
    echo "}"
} > "${FIXES_DIR}/index.json"

echo "Fix extraction complete"
exit 0
