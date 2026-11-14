#!/bin/bash
# parse-scan-metrics.sh - Extract metrics from all XCCDF scan results
# Part of OpenSCAP Cockpit Plugin v4.5.7
# Outputs JSON array of scan metrics for dashboard visualization

SCANS_DIR="/usr/share/cockpit/cockpit-openscap/scans"

# Start JSON array
echo "["

FIRST=true

# Find all scan directories, sorted by date (newest first)
for SCAN_DIR in $(ls -1td "${SCANS_DIR}"/*/ 2>/dev/null | head -50); do
    [ ! -d "${SCAN_DIR}" ] && continue

    SCAN_ID=$(basename "${SCAN_DIR}")
    # Try both possible filenames for XCCDF results
    XCCDF_FILE="${SCAN_DIR}/results.xml"
    [ ! -f "${XCCDF_FILE}" ] && XCCDF_FILE="${SCAN_DIR}/xccdf-results.xml"
    SCAN_INFO="${SCAN_DIR}/scan-info.json"

    [ ! -f "${XCCDF_FILE}" ] && continue

    # Get scan info
    PROFILE="Unknown"
    SCAN_DATE=""
    if [ -f "${SCAN_INFO}" ]; then
        PROFILE=$(grep -o '"profile"[[:space:]]*:[[:space:]]*"[^"]*"' "${SCAN_INFO}" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/' | head -1)
        SCAN_DATE=$(grep -o '"timestamp"[[:space:]]*:[[:space:]]*"[^"]*"' "${SCAN_INFO}" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/' | head -1)
    fi

    # If no scan date, try to get from directory timestamp
    if [ -z "${SCAN_DATE}" ]; then
        # Convert scan ID (YYYYMMDD-HHMMSS) to readable date
        if [[ "${SCAN_ID}" =~ ^([0-9]{4})([0-9]{2})([0-9]{2})-([0-9]{2})([0-9]{2})([0-9]{2})$ ]]; then
            SCAN_DATE="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}-${BASH_REMATCH[3]} ${BASH_REMATCH[4]}:${BASH_REMATCH[5]}:${BASH_REMATCH[6]}"
        else
            SCAN_DATE="${SCAN_ID}"
        fi
    fi

    # Extract score from XCCDF using TestResult score element
    SCORE=$(grep -o 'score[^>]*>[0-9.]*' "${XCCDF_FILE}" 2>/dev/null | grep -o '[0-9.]*$' | head -1)
    [ -z "${SCORE}" ] && SCORE="0"

    # Count results by status using awk for better performance
    read PASS FAIL ERROR NOTAPPLICABLE NOTCHECKED NOTSELECTED INFORMATIONAL UNKNOWN <<< $(awk '
    BEGIN { pass=0; fail=0; error=0; notapplicable=0; notchecked=0; notselected=0; informational=0; unknown=0 }
    /<result>pass<\/result>/ { pass++ }
    /<result>fail<\/result>/ { fail++ }
    /<result>error<\/result>/ { error++ }
    /<result>notapplicable<\/result>/ { notapplicable++ }
    /<result>notchecked<\/result>/ { notchecked++ }
    /<result>notselected<\/result>/ { notselected++ }
    /<result>informational<\/result>/ { informational++ }
    /<result>unknown<\/result>/ { unknown++ }
    END { print pass, fail, error, notapplicable, notchecked, notselected, informational, unknown }
    ' "${XCCDF_FILE}")

    # Default values if not found
    PASS=${PASS:-0}
    FAIL=${FAIL:-0}
    ERROR=${ERROR:-0}
    NOTAPPLICABLE=${NOTAPPLICABLE:-0}
    NOTCHECKED=${NOTCHECKED:-0}
    NOTSELECTED=${NOTSELECTED:-0}
    INFORMATIONAL=${INFORMATIONAL:-0}
    UNKNOWN=${UNKNOWN:-0}

    # Calculate totals
    TOTAL_CHECKED=$((PASS + FAIL + ERROR))
    TOTAL_RULES=$((TOTAL_CHECKED + NOTAPPLICABLE + NOTCHECKED + INFORMATIONAL + UNKNOWN))

    # Count failed rules by severity
    # Severity is an attribute on the <rule-result> element itself
    # e.g., <rule-result idref="..." severity="high" ...>
    read HIGH_FAIL MEDIUM_FAIL LOW_FAIL <<< $(awk '
    BEGIN { high=0; medium=0; low=0; sev="medium"; in_rule_result=0 }
    /<rule-result/ {
        in_rule_result=1
        sev="medium"
        # Extract severity attribute from rule-result element
        if (match($0, /severity="[^"]*"/)) {
            s = substr($0, RSTART+10, RLENGTH-11)
            sev = s
        }
    }
    /<result>fail<\/result>/ {
        if (in_rule_result) {
            if (sev == "high") high++
            else if (sev == "low") low++
            else medium++
        }
    }
    /<\/rule-result>/ {
        in_rule_result=0
    }
    END { print high, medium, low }
    ' "${XCCDF_FILE}")

    # Default values if awk failed
    HIGH_FAIL=${HIGH_FAIL:-0}
    MEDIUM_FAIL=${MEDIUM_FAIL:-0}
    LOW_FAIL=${LOW_FAIL:-0}

    # Output JSON object
    if [ "${FIRST}" = "true" ]; then
        FIRST=false
    else
        echo ","
    fi

    cat << EOF
  {
    "scanId": "${SCAN_ID}",
    "date": "${SCAN_DATE}",
    "profile": "${PROFILE}",
    "score": ${SCORE},
    "pass": ${PASS},
    "fail": ${FAIL},
    "error": ${ERROR},
    "notApplicable": ${NOTAPPLICABLE},
    "notChecked": ${NOTCHECKED},
    "notSelected": ${NOTSELECTED},
    "informational": ${INFORMATIONAL},
    "unknown": ${UNKNOWN},
    "totalChecked": ${TOTAL_CHECKED},
    "totalRules": ${TOTAL_RULES},
    "highFail": ${HIGH_FAIL},
    "mediumFail": ${MEDIUM_FAIL},
    "lowFail": ${LOW_FAIL}
  }
EOF

done

echo ""
echo "]"
