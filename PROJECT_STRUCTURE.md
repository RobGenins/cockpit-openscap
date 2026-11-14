# OpenSCAP Cockpit Plugin - Project Structure

## Overview
A complete Red Hat Cockpit plugin for OpenSCAP security compliance scanning with automated remediation.

## Directory Structure

```
cockpit-openscap/
├── README.md                      # Complete documentation
├── QUICKSTART.md                  # Quick installation guide
├── install.sh                     # Automated installation script
├── uninstall.sh                   # Uninstallation script
├── manifest.json                  # Cockpit plugin manifest
├── index.html                     # Main UI (tabbed interface)
├── openscap.js                    # JavaScript functionality
├── openscap.css                   # Styling
├── scripts/                       # Backend shell scripts
│   ├── list-profiles.sh          # List available security profiles
│   ├── run-scan.sh               # Execute OpenSCAP scan
│   ├── parse-results.sh          # Parse scan results to JSON
│   ├── list-scans.sh             # List scan history
│   └── list-remediations.sh      # List remediation scripts
├── logs/                          # Created during install (logs directory)
├── scans/                         # Created during install (scan results)
└── remediation/                   # Created during install (remediation scripts)
```

## Installation Target Structure

After installation, files are deployed to:

```
/usr/share/cockpit/cockpit-openscap/
├── manifest.json
├── index.html
├── openscap.js
├── openscap.css
├── scripts/
│   ├── list-profiles.sh
│   ├── run-scan.sh
│   ├── parse-results.sh
│   ├── list-scans.sh
│   └── list-remediations.sh
├── scans/                         # Scan results stored here
│   └── {scan-id}/
│       ├── results.xml
│       ├── report.html
│       ├── remediation.sh
│       ├── remediation.yml
│       └── scan-info.json
├── logs/                          # Application logs
└── remediation/                   # Additional remediation scripts
```

## Log Files

```
/var/log/cockpit-openscap/
├── install-YYYYMMDD-HHMMSS.log   # Installation logs
├── scan-{scan-id}.log             # Individual scan logs
└── list-profiles-YYYYMMDD.log     # Profile listing logs
```

## Key Files Explained

### Frontend Files

**manifest.json**
- Cockpit plugin configuration
- Defines plugin name, version, menu entry

**index.html**
- Main user interface
- Three tabs: Local Scan, Scan Results, Remediation Scripts
- Bootstrap-based responsive design

**openscap.js**
- Handles all UI interactions
- Communicates with backend scripts via Cockpit API
- Progress tracking, result display, file downloads

**openscap.css**
- Custom styling for the interface
- Statistics cards, progress bars, profile cards
- Responsive design for mobile/desktop

### Backend Scripts

**install.sh**
- Checks prerequisites (Cockpit, OpenSCAP, SCAP Security Guide, etc.)
- Installs missing packages automatically
- Sets up directories and permissions
- Configures firewall if needed
- Creates detailed installation logs

**scripts/list-profiles.sh**
- Detects operating system from /etc/os-release
- Finds appropriate SCAP Security Guide datastream
- Lists available security profiles
- Returns JSON for frontend consumption

**scripts/run-scan.sh**
- Executes OpenSCAP scan with selected profile
- Generates HTML report and XCCDF results
- Creates Bash remediation script
- Creates Ansible remediation playbook
- Tracks progress and logs all operations
- Stores results with timestamp

**scripts/parse-results.sh**
- Reads scan results JSON
- Returns statistics (pass/fail/error counts, score)
- Used by frontend to display results

**scripts/list-scans.sh**
- Scans the scans directory
- Returns JSON array of all historical scans
- Includes dates, profiles, scores

**scripts/list-remediations.sh**
- Lists all generated remediation scripts
- Returns both Bash and Ansible scripts
- Organized by scan

**uninstall.sh**
- Removes plugin files
- Optionally removes logs
- Safe uninstallation with prompts

## User Interface Flow

### Tab 1: Local Scan
1. Page loads → Detect system info
2. Load available profiles → User selects profile
3. User clicks "Start Scan" → Progress bar shows status
4. Scan completes → Display statistics (pass/fail/error/score)
5. Show links to:
   - HTML Report (view in browser)
   - XCCDF Results (download XML)
   - Bash Remediation Script (download .sh)
   - Ansible Playbook (download .yml)

### Tab 2: Scan Results  
- List all historical scans
- Show date, profile, score for each
- Links to view reports and download scripts

### Tab 3: Remediation Scripts
- List all generated remediation scripts
- Separated by type (Bash/Ansible)
- Download links for each

## Data Flow

```
User Action (UI)
    ↓
openscap.js (Frontend)
    ↓
cockpit.spawn() → Shell Script (Backend)
    ↓
OpenSCAP CLI Tools
    ↓
Results Stored in /usr/share/cockpit/cockpit-openscap/scans/
    ↓
JSON Response → Frontend
    ↓
Display Results to User
```

## Prerequisites Automatically Installed

1. **cockpit** - Web-based server management interface
2. **openscap-scanner** - OpenSCAP command-line tool
3. **scap-security-guide** - Security compliance profiles
4. **openscap-utils** - Additional OpenSCAP utilities
5. **ansible** (optional) - For Ansible playbook generation

Additional system tools required:
- xmllint (from libxml2)
- jq (JSON processor)
- bash 4.0+

## Security Features

- All operations logged for audit trail
- Remediation scripts include warnings
- 10-second countdown before execution
- Clear documentation of changes
- Test/review recommendations
- Proper permission handling

## Generated Remediation Scripts

### Bash Script Features
- Header with warnings and usage instructions
- 10-second abort countdown
- Error handling with set -e
- Detailed logging of actions
- Completion summary
- Reboot recommendations

### Ansible Playbook Features
- YAML format for infrastructure as code
- Metadata with generation timestamp
- Warnings in comments
- Usage instructions
- Compatible with Ansible 2.9+

## Supported Profiles (Examples)

Profiles vary by OS, but commonly include:
- Standard System Security Profile
- PCI-DSS v3.2.1 Control Baseline
- DISA STIG (Security Technical Implementation Guide)
- CIS Benchmarks
- HIPAA Security Rule Profile
- NIST 800-53 Controls

## Browser Compatibility

- Firefox (recommended)
- Chrome/Chromium
- Safari
- Edge

## Network Requirements

- Port 9090 (Cockpit web interface)
- HTTPS enabled
- Local network or VPN access

## Performance Notes

- Scan time: 5-15 minutes depending on profile
- CPU usage: Moderate during scan
- Disk space: ~10MB per scan result
- Memory: ~100MB during active scan

## Future Enhancements (Potential)

- Remote scanning capability
- Scheduled scans with cron integration
- Email notifications for scan completion
- Compliance trend graphs over time
- Multi-profile comparison
- Remediation rollback capability
- Integration with configuration management tools

## Version

Current Version: 4.0.0
Release Date: 2025-01-05

**Version 4.0.0 Changes:**
- Simplified to pure frontend approach
- Removed score calculation (OpenSCAP does this)
- Removed XML parsing (not needed)
- Thin wrappers around OpenSCAP commands
- Cleaner, more maintainable code

## License

This plugin is provided as-is for use with Red Hat Cockpit and OpenSCAP.
Compatible with OpenSCAP's licenses and SCAP Security Guide's licenses.
