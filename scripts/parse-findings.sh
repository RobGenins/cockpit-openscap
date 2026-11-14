#!/bin/bash
# parse-findings.sh - Parse XCCDF results and extract failed/error findings
# Part of OpenSCAP Cockpit Plugin v4.2.5
# Optimized for performance - single pass awk parsing

SCAN_ID="$1"
SCAN_DIR="/usr/share/cockpit/cockpit-openscap/scans/${SCAN_ID}"
RESULTS_FILE="${SCAN_DIR}/results.xml"
BASH_REMEDIATION="${SCAN_DIR}/remediation.sh"
ANSIBLE_REMEDIATION="${SCAN_DIR}/remediation.yml"
SCAN_INFO="${SCAN_DIR}/scan-info.json"

# Validate input
if [ -z "${SCAN_ID}" ]; then
    echo '{"error": "Scan ID required", "findings": [], "summary": {"total_findings": 0}}'
    exit 1
fi

if [ ! -f "${RESULTS_FILE}" ]; then
    echo '{"error": "Results file not found", "findings": [], "summary": {"total_findings": 0}}'
    exit 1
fi

# Get profile name from scan-info.json if available
PROFILE_NAME=""
if [ -f "${SCAN_INFO}" ]; then
    PROFILE_NAME=$(grep -o '"profile"[[:space:]]*:[[:space:]]*"[^"]*"' "${SCAN_INFO}" 2>/dev/null | sed 's/.*"profile"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "")
fi

# Check if remediation files exist and have content
BASH_EXISTS=false
ANSIBLE_EXISTS=false
[ -f "${BASH_REMEDIATION}" ] && [ -s "${BASH_REMEDIATION}" ] && BASH_EXISTS=true
[ -f "${ANSIBLE_REMEDIATION}" ] && [ -s "${ANSIBLE_REMEDIATION}" ] && ANSIBLE_EXISTS=true

# Use awk for fast parsing of the XML
# Note: In XCCDF, Rule definitions come BEFORE rule-result elements
# So we store all Rule titles, then match them to failed rule-results
awk -v profile="${PROFILE_NAME}" -v scan_id="${SCAN_ID}" \
    -v bash_exists="${BASH_EXISTS}" -v ansible_exists="${ANSIBLE_EXISTS}" \
    -v bash_file="${BASH_REMEDIATION}" -v ansible_file="${ANSIBLE_REMEDIATION}" '
BEGIN {
    in_rule_result = 0
    in_rule = 0
    in_title = 0
    title_buffer = ""
}

# ============== RULE DEFINITIONS (appear first in file) ==============
# Track Rule definitions to store titles
/<Rule / && /id="/ {
    in_rule = 1
    current_rule_id = ""
    current_rule_title = ""
    if (match($0, /id="[^"]*"/)) {
        current_rule_id = substr($0, RSTART+4, RLENGTH-5)
    }
}

# Capture title - handle both single and multi-line
in_rule && /<title/ {
    in_title = 1
    title_buffer = ""
    # Check if title is on same line
    if (match($0, /<title[^>]*>([^<]*)<\/title>/)) {
        # Single line title
        sub(/.*<title[^>]*>/, "", $0)
        sub(/<\/title>.*/, "", $0)
        current_rule_title = $0
        in_title = 0
    } else if (match($0, /<title[^>]*>/)) {
        # Multi-line title start
        sub(/.*<title[^>]*>/, "", $0)
        title_buffer = $0
    }
}

in_title && !/<title/ {
    if (/<\/title>/) {
        sub(/<\/title>.*/, "", $0)
        title_buffer = title_buffer " " $0
        current_rule_title = title_buffer
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_rule_title)
        in_title = 0
    } else {
        title_buffer = title_buffer " " $0
    }
}

/<\/Rule>/ {
    if (in_rule && current_rule_id != "") {
        # Store title for this rule ID
        all_titles[current_rule_id] = current_rule_title
    }
    in_rule = 0
    in_title = 0
}

# ============== RULE-RESULT ELEMENTS (appear later in file) ==============
/<rule-result / {
    in_rule_result = 1
    current_idref = ""
    current_severity = "medium"
    current_result = ""

    # Extract idref
    if (match($0, /idref="[^"]*"/)) {
        current_idref = substr($0, RSTART+7, RLENGTH-8)
    }
    # Extract severity
    if (match($0, /severity="[^"]*"/)) {
        current_severity = substr($0, RSTART+10, RLENGTH-11)
    }
}

# Get result value
in_rule_result && /<result>/ {
    line = $0
    gsub(/<[^>]*>/, "", line)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
    current_result = line
}

/<\/rule-result>/ {
    # Only store fail or error results
    if (in_rule_result && (current_result == "fail" || current_result == "error")) {
        failed_rules[current_idref] = 1
        rule_severity[current_idref] = tolower(current_severity)
        rule_result[current_idref] = current_result
    }
    in_rule_result = 0
}

END {
    # Counters
    total = 0; critical = 0; high = 0; medium = 0; low = 0
    with_bash = 0; with_ansible = 0; with_any = 0; manual_only = 0
    first_finding = 1

    # Start JSON output
    print "{"
    print "  \"scan_id\": \"" scan_id "\","
    print "  \"profile\": \"" profile "\","
    print "  \"findings\": ["

    # Output all findings
    for (rule_id in failed_rules) {
        severity = rule_severity[rule_id]
        result = rule_result[rule_id]
        title = all_titles[rule_id]
        if (title == "") title = rule_id

        # Escape special characters for JSON
        gsub(/\\/, "\\\\", title)
        gsub(/"/, "\\\"", title)
        gsub(/\t/, " ", title)
        gsub(/\r/, "", title)

        # Check fix availability
        has_bash = "false"
        has_ansible = "false"

        if (bash_exists == "true") {
            cmd = "grep -q \"" rule_id "\" \"" bash_file "\" 2>/dev/null && echo yes || echo no"
            cmd | getline result_check
            close(cmd)
            if (result_check == "yes") has_bash = "true"
        }

        if (ansible_exists == "true") {
            cmd = "grep -q \"" rule_id "\" \"" ansible_file "\" 2>/dev/null && echo yes || echo no"
            cmd | getline result_check
            close(cmd)
            if (result_check == "yes") has_ansible = "true"
        }

        # Update counters
        total++
        if (severity == "critical") critical++
        else if (severity == "high") high++
        else if (severity == "medium") medium++
        else low++

        if (has_bash == "true") with_bash++
        if (has_ansible == "true") with_ansible++
        if (has_bash == "true" || has_ansible == "true") with_any++
        else manual_only++

        # Output finding JSON
        if (!first_finding) print ","
        first_finding = 0

        print "    {"
        print "      \"rule_id\": \"" rule_id "\","
        print "      \"title\": \"" title "\","
        print "      \"severity\": \"" severity "\","
        print "      \"result\": \"" result "\","
        print "      \"description\": \"\","
        print "      \"has_bash_fix\": " has_bash ","
        print "      \"has_ansible_fix\": " has_ansible
        print "    }"
    }

    # Close findings array and add summary
    print ""
    print "  ],"
    print "  \"summary\": {"
    print "    \"total_findings\": " total ","
    print "    \"critical_count\": " critical ","
    print "    \"high_count\": " high ","
    print "    \"medium_count\": " medium ","
    print "    \"low_count\": " low ","
    print "    \"with_bash_fix\": " with_bash ","
    print "    \"with_ansible_fix\": " with_ansible ","
    print "    \"with_any_fix\": " with_any ","
    print "    \"manual_only\": " manual_only
    print "  }"
    print "}"
}
' "${RESULTS_FILE}"

exit 0
