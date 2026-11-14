# OpenSCAP Cockpit Plugin v5.0.1

**The Complete Enterprise Security Compliance Solution for Red Hat Cockpit**

A powerful, user-friendly Cockpit plugin that transforms OpenSCAP security compliance scanning from a command-line chore into an intuitive visual experience. Scan, analyze, remediate, and track your system's security posture - all from your web browser.

![Version](https://img.shields.io/badge/version-5.0.1-blue.svg)
![Platform](https://img.shields.io/badge/platform-RHEL%20%7C%20CentOS%20%7C%20Rocky%20%7C%20Alma%20%7C%20Fedora-red.svg)
![License](https://img.shields.io/badge/license-BSL%201.1-orange.svg)

**GitHub:** https://github.com/RobGenins/cockpit-openscap

---

## What's New in v5.0.1

- **Fixed:** "Show Details" buttons on the Build Remediation page were dead — Cockpit's strict Content Security Policy blocks inline `onclick` handlers. Both inline handlers were rewired to `addEventListener`. Thanks to Jaco Steyn for reporting it (RHEL 10.2, Fedora 44); confirmed working on Fedora 44, RHEL 10.3, and Rocky 10.2.
- **License:** now under the Business Source License 1.1 (see [License](#license) below) — free for personal, educational, and small-scale use; commercial use needs a license.
- **Update check:** the plugin now checks once a day whether a newer version is available and shows a small banner if so. See [Updates & Privacy](#updates--privacy).

## What's New in v5.0.0

This milestone release represents 60+ iterations of development, delivering a feature-complete security compliance tool:

- **5 Fully-Featured Tabs** covering the complete compliance workflow
- **Visual Compliance Dashboard** with animated charts and trend analysis
- **Automated Scheduled Scans** with novice-friendly configuration
- **Selective Remediation Builder** - choose exactly what to fix
- **Enterprise-Quality UI** designed for both experts and beginners

---

## Features at a Glance

| Tab | Feature | Description |
|-----|---------|-------------|
| **1** | Run Scan | One-click DISA STIG compliance scanning |
| **2** | Build Remediation | Select specific findings, generate custom fix scripts |
| **3** | Scan History | Access all past scans, reports, and scripts |
| **4** | Compliance Dashboard | Visual analytics with trends and comparisons |
| **5** | Scheduled Scans | Automate scans + diagnostic log viewer |

### Core Capabilities

- **One-Click Scanning** - Select a profile, click scan, done
- **Selective Remediation** - Fix only what you choose, not everything
- **Dual Script Output** - Both Bash and Ansible playbook generation
- **Visual Dashboard** - Compliance trends at a glance with animated charts
- **Scheduled Automation** - Daily, weekly, or monthly scans
- **Complete History** - All scans preserved and accessible
- **Diagnostic Logs** - Centralized troubleshooting

---

## Tab Breakdown

### Tab 1: Run Scan

**Purpose:** Execute OpenSCAP compliance scans against DISA STIG profiles

- Auto-detects your OS (RHEL, CentOS, Rocky, Alma, Fedora)
- Displays available security profiles for your system
- Real-time progress with animated spinner
- Generates 4 outputs per scan:
  - HTML Report (detailed findings)
  - XCCDF Results (machine-readable XML)
  - Bash Remediation Script
  - Ansible Playbook
- Files auto-saved to `~/Downloads/ComplianceResults/`
- Archive feature preserves previous scan results

### Tab 2: Build Remediation

**Purpose:** Selectively choose which security findings to fix

- View all failed findings from the latest scan
- **Filter by:**
  - Severity (High / Medium / Low)
  - Fix availability (Has fix / No fix available)
  - Search by keyword
- **Sort by:** Severity, Title, or Rule ID
- Select/deselect individual findings with checkboxes
- Select All / Deselect All buttons
- Generate custom Bash script or Ansible playbook with only selected fixes
- **Purge All Scans** button to clear all history and start fresh

### Tab 3: Scan History

**Purpose:** Access all past scans and their outputs

- View all scans sorted newest first
- Each scan shows: Date, Profile, Pass/Fail counts
- Quick access buttons for:
  - View HTML Report
  - Download XCCDF Results
  - Download Bash Script
  - Download Ansible Playbook
- History preserved across plugin upgrades

### Tab 4: Compliance Dashboard

**Purpose:** Visualize compliance trends over time

- **Animated SVG Gauge** - Latest compliance score with color coding
- **Score Trend Indicator** - Improving or declining
- **Quick Stats Bar** - Color-coded metrics at a glance:
  - Total Passed (green)
  - Total Failed (red)
  - High Severity (red, pulsing if critical)
  - Medium Severity (orange)
  - Low Severity (blue)
  - Best Score achieved
- **Score Timeline** - Animated bar chart of scores over time
- **Status Breakdown** - Pass/Fail/Error/Not Applicable distribution
- **Severity Breakdown** - High/Medium/Low failure distribution
- **Comparison Table** - All scans with sorting and filtering

### Tab 5: Scheduled Scans

**Purpose:** Automate compliance scanning + view diagnostic logs

**Schedule Configuration (Novice-Friendly):**
- Step 1: Select security profile from dropdown
- Step 2: Choose frequency with visual cards:
  - Daily (every day)
  - Weekly (pick a day: Sun-Sat)
  - Monthly (pick day: 1st-28th)
- Step 3: Select time with 12-hour AM/PM picker
- Live preview: "Your scan will run: Every Saturday at 3:00 AM"
- No cron expressions needed!

**Diagnostic Log Viewer:**
- Master log at `/var/log/cockpit-openscap/master.log`
- Syntax-highlighted output (errors=red, warnings=yellow, etc.)
- Filter: Last 50/100/200/500 lines
- Refresh and Clear buttons

---

## Installation

### Prerequisites

The installer automatically checks and installs:
- Red Hat Cockpit
- OpenSCAP Scanner
- SCAP Security Guide
- OpenSCAP Utilities
- Ansible (optional)
- xmllint, jq

### Quick Install

```bash
# Download and extract
tar -xzf cockpit-openscap-5.0.1.tar.gz
cd cockpit-openscap

# Install (as root)
sudo ./install.sh
```

Or grab the latest release from GitHub: https://github.com/RobGenins/cockpit-openscap/releases

### Access the Plugin

1. Open browser: `https://your-server:9090`
2. Login with system credentials
3. Click "OpenSCAP" in the navigation menu

---

## File Locations

| Type | Location |
|------|----------|
| Plugin | `/usr/share/cockpit/cockpit-openscap/` |
| Scans | `/usr/share/cockpit/cockpit-openscap/scans/` |
| Master Log | `/var/log/cockpit-openscap/master.log` |
| Scan Logs | `/var/log/cockpit-openscap/scan-{id}.log` |
| User Downloads | `~/Downloads/ComplianceResults/` |

### Scan Directory Structure
```
scans/{scan-id}/
├── results.xml          # XCCDF results
├── report.html          # HTML compliance report
├── remediation.sh       # Bash remediation script
├── remediation.yml      # Ansible playbook
├── scan-info.json       # Scan metadata
└── fixes/               # Pre-extracted individual fixes
    ├── bash/
    └── ansible/
```

---

## Safety Warnings

**Before Running Any Remediation Script:**

1. **CREATE A SNAPSHOT/CHECKPOINT** - VM snapshot, LVM snapshot, or backup
2. **Test in non-production first** - Scripts can break things
3. **Review before running** - Understand what each fix does
4. **Be prepared for lockouts** - SSH, console, and GUI access may be affected
5. **Services may stop** - Some fixes disable services or change configurations

---

## Supported Systems

| Distribution | Versions |
|--------------|----------|
| Red Hat Enterprise Linux | 7, 8, 9 |
| CentOS / CentOS Stream | 7, 8, 9 |
| Rocky Linux | 8, 9 |
| AlmaLinux | 8, 9 |
| Fedora | Recent releases |

---

## Troubleshooting

### Check Logs

```bash
# Master log (all activity)
sudo tail -f /var/log/cockpit-openscap/master.log

# Specific scan log
sudo tail -f /var/log/cockpit-openscap/scan-{id}.log
```

### Common Issues

| Issue | Solution |
|-------|----------|
| No profiles found | `sudo dnf install scap-security-guide` |
| Scan fails to start | Check logs, verify OpenSCAP installed |
| Cannot access Cockpit | Check firewall: `sudo firewall-cmd --list-services` |
| Permission denied | `sudo chmod 755 /usr/share/cockpit/cockpit-openscap/scripts/*.sh` |

### Verify Installation

```bash
which oscap                              # OpenSCAP installed?
oscap --version                          # Version info
ls /usr/share/xml/scap/ssg/content/      # SCAP content available?
sudo systemctl status cockpit.socket     # Cockpit running?
```

---

## Uninstallation

```bash
sudo ./uninstall.sh
```

Or manually:
```bash
sudo rm -rf /usr/share/cockpit/cockpit-openscap
sudo rm -rf /var/log/cockpit-openscap
```

---

## Technical Details

- **Frontend:** Pure JavaScript, CSS, HTML (no frameworks)
- **Backend:** Bash scripts
- **API:** Cockpit's native cockpit.js
- **Privilege Escalation:** cockpit.spawn() with superuser
- **No External Dependencies:** Everything self-contained

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 5.0.1 | 2026-11-12 | Fixed dead "Show Details" buttons (CSP fix); BSL 1.1 license; update check |
| 5.0.0 | 2025-01-10 | Milestone release - feature complete |
| 4.6.x | 2025-01-10 | Tab 5 scheduled scans, diagnostic logs |
| 4.5.x | 2025-01-10 | Tab 4 compliance dashboard |
| 4.4.x | 2025-01-09 | Critical fixes, warnings |
| 4.3.x | 2025-01-07 | Tab 2 remediation builder |
| 4.0.0 | 2025-01-05 | Simplified frontend approach |
| 1.0.0 | 2025-01-05 | Initial release |

See [CHANGELOG.md](CHANGELOG.md) for complete history.

---

## Credits

**Crafted by Rob Genins** ([rgenins@gmail.com](mailto:rgenins@gmail.com))

---

## License

This project is licensed under the **Business Source License 1.1** (see [LICENSE](LICENSE)). In plain words:

- **Free** for personal, educational, and evaluation use, and for non-commercial use.
- **Free** for production use on up to **5 servers** you own or operate for your own internal use.
- **Paid commercial license** required for production use beyond 5 servers, for managed service providers, and for redistributing the plugin as part of a commercial product or service.
- On **12 November 2029**, version 5.0.1 converts to the **Apache License 2.0** (open source) automatically.

**Commercial licensing:** email [rgenins@gmail.com](mailto:rgenins@gmail.com) for pricing. Every commercial license directly funds further development.

## Updates & Privacy

**Update check:** once a day, the plugin fetches a small public file (`version.json`) from this GitHub repository to see whether a newer version exists. If one does, it shows a small banner in the plugin with a link to the release. That is the only network request the plugin makes besides talking to your own server. It sends no personal data, no system information, and no scan results anywhere. The request goes to GitHub's public file server, which does not identify you to the author. You can turn the check off from the banner ("Don't check again") — the plugin keeps working exactly the same.

**How the author knows it's being used:** GitHub shows the author anonymous totals — release downloads, repository views, and clones — and users who email [rgenins@gmail.com](mailto:rgenins@gmail.com) to get update notifications. There is no hidden tracking, no telemetry, and nothing phones home without telling you.

**Get update notifications:** email [rgenins@gmail.com](mailto:rgenins@gmail.com) with the subject "OpenSCAP plugin updates" and you'll be emailed when a new version is out.

---

## Resources

- **OpenSCAP:** https://www.open-scap.org/
- **Cockpit:** https://cockpit-project.org/
- **DISA STIGs:** https://public.cyber.mil/stigs/
- **SCAP Security Guide:** https://github.com/ComplianceAsCode/content
