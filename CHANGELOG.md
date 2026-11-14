# Changelog

All notable changes to the OpenSCAP Cockpit Plugin will be documented in this file.

---

## [5.0.1] - 2026-11-12 - BUG FIX

### Fixed: "Show Details" buttons dead in the Remediation Builder

**Root cause:** Cockpit enforces a strict Content Security Policy (CSP) that blocks inline `onclick="..."` event handler attributes. The "Show Details" button on every finding in Tab 2 (Build Remediation) used `onclick="toggleFindingDetails(this)"`, so the browser silently refused to run it and the button did nothing when clicked. The same applied to the error-toast close button. Everything else in the plugin already used `addEventListener`, which is why scans, remediation generation, and all other controls worked fine.

**Fix:** Removed both inline `onclick` handlers and wired the buttons up with `addEventListener` instead (CSP-safe):
- `openscap.js` — the "Show Details" button is now plain markup; `renderFindings()` attaches a click listener to each `.btn-expand` button right after rendering, following the same pattern already used for the finding checkboxes.
- `index.html` — the error-toast close button now has `id="error-close-btn"` instead of an inline handler.
- `openscap.js` — `setupEventListeners()` now wires the error close button to `hideError`.

Reported by Jaco Steyn (Centurion, South Africa) on RHEL 10.2 and Fedora 44. No other behaviour changed.

---

## [5.0.0] - 2025-01-10 - MILESTONE RELEASE

### The Complete Enterprise Security Compliance Solution for Cockpit

After 60+ iterations of development and refinement, we're proud to release version 5.0.0 - a feature-complete, enterprise-ready security compliance tool for Red Hat Enterprise Linux, CentOS, Rocky Linux, AlmaLinux, and Fedora.

### What's in 5.0.0

**5 Fully-Featured Tabs:**

| Tab | Name | Purpose |
|-----|------|---------|
| 1 | Run Scan | Execute OpenSCAP compliance scans with DISA STIG profiles |
| 2 | Build Remediation | Selectively choose which findings to fix, generate custom scripts |
| 3 | Scan History | View all past scans, access reports, results, and scripts |
| 4 | Compliance Dashboard | Beautiful visualizations of compliance trends over time |
| 5 | Scheduled Scans | Automate scans with user-friendly scheduling + diagnostic logs |

**Key Capabilities:**
- One-click security compliance scanning
- Selective remediation builder - fix only what you choose
- Both Bash and Ansible remediation script generation
- Visual compliance dashboard with score trends
- Automated scheduled scans (daily/weekly/monthly)
- Scan history preservation across upgrades
- Master diagnostic log for troubleshooting
- Purge functionality for clean slate
- Professional enterprise UI design

**Designed for All Users:**
- Novice-friendly step-by-step wizards
- No cron expressions - visual schedule picker
- Clear warnings about remediation risks
- Educational intro panel explaining compliance scanning

### Full Feature Summary

#### Tab 1: Run Scan
- Auto-detects OS and available security profiles
- DISA STIG profiles for enterprise compliance
- Real-time progress with animated spinner
- Generates: HTML Report, XCCDF Results, Bash Script, Ansible Playbook
- Files auto-saved to ~/Downloads/ComplianceResults/
- Archive feature preserves old scan results

#### Tab 2: Build Remediation
- View all failed findings from scan
- Filter by severity (High/Medium/Low)
- Filter by fix availability
- Search findings by keyword
- Sort by severity, title, or rule ID
- Select/deselect individual findings
- Generate custom Bash or Ansible scripts
- "Purge All Scans" button for clean slate

#### Tab 3: Scan History
- View all past scans sorted newest first
- Access HTML reports, XCCDF results, scripts
- Persistent across browser sessions
- Preserved during plugin upgrades

#### Tab 4: Compliance Dashboard
- Animated SVG gauge showing latest score
- Score trend indicator (improving/declining)
- Quick stats bar with color-coded metrics
- Score timeline chart with animated bars
- Status breakdown (Pass/Fail/Error/N-A)
- Severity breakdown (High/Medium/Low)
- Sortable/filterable comparison table
- Click any scan to view its report

#### Tab 5: Scheduled Scans
- Visual frequency picker (Daily/Weekly/Monthly)
- Day-of-week selector for weekly scans
- Day-of-month selector for monthly scans
- 12-hour time picker with AM/PM
- Live schedule preview
- Master diagnostic log viewer
- Syntax-highlighted log output
- Log filtering (50/100/200/500 lines)

### Technical Highlights
- Pure JavaScript/CSS/HTML + Bash backend
- No external framework dependencies
- Uses Cockpit's native APIs
- Proper privilege escalation via cockpit.spawn()
- Comprehensive error handling
- Logging to /var/log/cockpit-openscap/

### Credits
Crafted by Rob Genins (rgenins@gmail.com)

---

## [4.6.1] - 2025-01-10

### Improved
- **Tab 5: User-friendly scheduler** - Redesigned for novice users:
  - Visual frequency picker: Daily, Weekly, or Monthly cards
  - Day-of-week picker for weekly scans (click the day)
  - Day-of-month dropdown for monthly scans (1st-28th)
  - 12-hour time picker with AM/PM labels
  - Live preview: "Your scan will run: Every Saturday at 3:00 AM"
  - No more cron expressions - intuitive step-by-step wizard
  - Status card shows current schedule in plain English

- **Tab 4: Dashboard animations**:
  - Timeline bars animate in with grow effect
  - Pulsing animation on critical failure count
  - Smoother transitions on hover

---

## [4.6.0] - 2025-01-10

### Added
- **Tab 5: Scheduled Scans (Cron Jobs)** - Automate compliance scanning:
  - Select security profile for scheduled scans
  - Choose frequency: Daily, Weekly, Monthly, or Custom cron expression
  - View current schedule status
  - Enable/disable/remove scheduled scans
  - Scans run automatically and results appear in Tab 3 & 4

- **Master Diagnostic Log** - Centralized troubleshooting:
  - All scan activity logged to `/var/log/cockpit-openscap/master.log`
  - Log viewer in Tab 5 with syntax highlighting
  - Filter by last 50/100/200/500 lines
  - Clear logs option
  - Timestamps, error/warning/success color coding

- **Purge All Scans** - Clean slate option in Tab 2:
  - Red "Purge All Scans" button with confirmation dialog
  - Deletes all scan history, reports, and remediation scripts
  - Clears Tab 3 and Tab 4 data
  - Useful for fresh starts or removing old data

### Changed
- All scripts now log to master log file for unified diagnostics
- Scan results include scheduled scan indicator

---

## [4.5.7] - 2025-01-10

### Fixed
- **CRITICAL: Severity counts now update correctly after remediation** - Dashboard was showing stale severity numbers:
  - Root cause: Script was looking for severity in wrong place (Rule definitions vs rule-result elements)
  - XCCDF stores severity as an attribute on `<rule-result severity="high">`, not in Rule definitions
  - Rewrote severity counting with proper awk parsing of rule-result elements
  - After fixing 5 low severity issues, dashboard now correctly shows 0 low failures
  - High/Medium/Low counts now match actual failed rules

---

## [4.5.6] - 2025-01-10

### Added
- **Credit line in header** - "Crafted by Rob Genins" with email link in page header

---

## [4.5.5] - 2025-01-10

### Changed
- **Score Timeline reduced size** - Timeline chart now more compact:
  - Height reduced from 200px to 120px
  - Bar max height reduced from 160px to 80px
  - Less visual real estate for same information

---

## [4.5.4] - 2025-01-10

### Improved
- **Tab 4 Dashboard visual overhaul** - Professional enterprise-quality design:
  - Animated SVG gauge showing latest compliance score with color coding
  - Gradient accent bars on summary cards
  - Dark blue quick stats bar with color-coded metrics (Passed, Failed, High/Med/Low, Best)
  - Hover animations on cards
  - Open Issues card showing total failures and high-severity count
  - Better visual hierarchy and spacing

---

## [4.5.3] - 2025-01-10

### Fixed
- **Tab 4 Dashboard now finds scans** - Fixed two bugs preventing dashboard from loading:
  - Now looks for `results.xml` (correct name) instead of `xccdf-results.xml`
  - Fixed directory pattern to match all scan ID formats (e.g., `2026-01-10T19-44-50-754Z`)

---

## [4.5.2] - 2025-01-10

### Fixed
- **Scan history preserved on upgrade** - Installing a new version keeps all existing scans
  - Scans backed up to /tmp before upgrade, restored after
  - Shows count of preserved scans during install
  - No more lost scan history when updating the plugin

---

## [4.5.1] - 2025-01-10

### Fixed
- **Tab 3 now shows all scans** - Scan History displays every scan, sorted newest first
  - Previously could miss scans without scan-info.json
  - Now shows any scan with report.html or results.xml

---

## [4.5.0] - 2025-01-10

### Added
- **Tab 4: Compliance Dashboard** - Beautiful visualization of scan data over time:
  - Summary cards: Latest Score, Score Trend, Total Scans, Best Score
  - Score Timeline chart with color-coded bars (green=excellent to red=critical)
  - Status Breakdown bar showing pass/fail/error/N/A distribution
  - Severity Breakdown with horizontal bars for High/Medium/Low failures
  - Comparison Table with all scans, sortable and searchable
  - Filter by profile, sort by date/score/failures
  - Hover tooltips on timeline bars
  - Click "Report" button to view any historical scan report
- **New backend script**: `parse-scan-metrics.sh` extracts metrics from XCCDF files

### Fixed
- **Tab 1 state persistence** - No longer need to refresh browser after running remediation
  - Tab properly refreshes state when returning to it
  - Scan button re-enabled when appropriate
  - Results persist across tab switches

---

## [4.4.3] - 2025-01-10

### Fixed
- **CRITICAL: Custom remediation scripts now run ALL fixes** - Previously stopped on first failure:
  - Root cause: `set -e` in generated scripts caused immediate exit on any error
  - Individual fix failures (e.g., service not installed) would abort entire script
  - User reported 270 fixes selected but only ~60 applied before script exited
  - Solution: Removed `set -e`, wrapped each fix in error handling
  - Each fix now runs in subshell with if/then/else to catch failures
  - Script continues even when individual fixes fail
  - Added FIXES_ATTEMPTED and FIXES_FAILED counters
  - Summary displayed at end showing success/failure counts
  - Same fix applied to generate-custom-ansible.sh

---

## [4.4.2] - 2025-01-10

### Added
- **chmod instruction** - Users now instructed to make scripts executable:
  - Tab 1: Shows `chmod +x` before running full remediation
  - Tab 2: Shows `chmod +x` in step-by-step instructions
  - Added "Copy script to target system if needed" step for users working across systems

### Changed
- Tab 1 now shows 3 options: View Report, Run Full Remediation, Build Custom Script

---

## [4.4.1] - 2025-01-09

### Fixed
- **Archive now works correctly** - All old scan files moved to Archive:
  - Archives ALL files matching: report-*.html, xccdf-results-*.xml, remediation-*.sh, playbook-*.yml, custom-*.sh/yml
  - Previous logic only archived exact filename matches (never triggered due to unique timestamps)
  - Now archives before copying new files, not per-file
  - Old files get timestamp suffix: `filename.20250109-165500.bak`

---

## [4.4.0] - 2025-01-09

### Added
- **CRITICAL WARNING boxes** - Prominent red warnings in both Tab 1 and Tab 2:
  - "CREATE A SNAPSHOT/CHECKPOINT FIRST!"
  - Warning about lockouts - SSH, console, GUI access may be disabled
  - Warning about broken functionality - services may stop working
  - Advice to test in non-production first
  - Advice to review each fix before applying

### Fixed
- **Removed auto-open HTML report** - Was unreliable in Cockpit context
  - Now instructs user to open file manually from Downloads folder
  - Command provided: `firefox ~/Downloads/ComplianceResults/report-*.html`

### Changed
- Tab 1 instructions updated to show "View the HTML report first" as Option A
- Tab 2 warning box now uses critical-warning style (red, prominent)

---

## [4.3.9] - 2025-01-07

### Changed
- **Auto-copy all files after scan** - No more manual downloads:
  - HTML report, XCCDF results, Bash script, and Ansible playbook all auto-saved
  - HTML report automatically opens in browser
  - Removed download links from Tab 1
- **Tab 1 now shows clear instructions** after scan:
  - Lists all files saved to ~/Downloads/ComplianceResults/
  - Shows command to run full remediation script
  - Button to go directly to Tab 2 for custom script building
- **Tab 2 shows run instructions** after generating custom script:
  - File location displayed clearly
  - Step-by-step instructions for reviewing and running script
  - Warning about reviewing scripts before running

### Removed
- Green success toast (replaced with inline instructions)
- Download links in Tab 1 (files auto-saved now)
- "Click to download" button in Tab 2 (replaced with instructions)

---

## [4.3.8] - 2025-01-07

### Added
- **Automatic file archiving** - Before saving new files:
  - Creates `~/Downloads/ComplianceResults/Archive/` folder
  - Moves existing files to Archive with timestamp (e.g., `report.html.20250107-191530.bak`)
  - Prevents accidental overwriting of previous results
- **Step-by-step user guide** - New intro panel with:
  - 4-step visual guide for novice users
  - Clear instructions for each phase (scan, review, build, apply)
  - File location reference showing where all outputs are saved
  - Tips for safely applying remediation scripts

### Improved
- Success message now shows shorter path: `~/Downloads/ComplianceResults/filename`

---

## [4.3.7] - 2025-01-07

### Added
- **HTML report also saved to Downloads** - View Full Report now:
  - Opens report in browser (as before)
  - Also saves copy to ~/Downloads/ComplianceResults/
- **Scan ID in all filenames** - Easy to identify which scan files belong to:
  - `report-{scanId}.html`
  - `xccdf-results-{scanId}.xml`
  - `remediation-{scanId}.sh`
  - `playbook-{scanId}.yml`
  - `custom-remediation-{timestamp}.sh`
- **Scan ID displayed** in scan history list

---

## [4.3.6] - 2025-01-07

### Fixed
- **File ownership** - Downloaded files now owned by user, not root:
  - Gets current username from environment
  - Runs `chown user:user` after copying file
  - Files are readable/writable by user without sudo

---

## [4.3.5] - 2025-01-07

### Changed
- **Download saves to ~/Downloads/ComplianceResults/** - Simpler, more reliable:
  - Files copied directly to user's Downloads/ComplianceResults folder
  - Creates folder if it doesn't exist
  - Green success toast shows exact file path
  - No more browser download quirks to deal with

---

## [4.3.4] - 2025-01-07

### Fixed
- **Download function rewritten** - New reliable download approach:
  - Copies file to /tmp first (avoids Cockpit superuser file read issues)
  - Sets permissions to 644 for user access
  - Reads from /tmp without superuser requirement
  - Fallback message shows file location if download still fails

---

## [4.3.3] - 2025-01-07

### Improved
- **Script generation feedback** - Better verification and user feedback:
  - Verifies generated file exists before showing download button
  - Shows file size in download button (e.g., "Bash Script (45KB)")
  - Console logging for debugging
  - Error message if file creation fails

---

## [4.3.2] - 2025-01-07

### Fixed
- **Custom remediation script download** - Downloads now work properly
  - Changed `superuser: 'try'` to `superuser: 'require'` in downloadFile function
  - Files in root-owned directories now accessible
  - Added debug logging for troubleshooting

---

## [4.3.1] - 2025-01-07

### Fixed
- **Download button in Remediation Builder** - "Click to download" button now works
  - Changed from anchor with onclick to button with addEventListener
  - Uses data attributes for reliable event handling

---

## [4.3.0] - 2025-01-07

### Tested
- **Fresh system deployment verified** - Clean install on remote system successful

### Changed
- **Improved install.sh** - Complete rewrite for cleaner, more robust installation:
  - Better prerequisite detection and installation (added xmllint, jq checks)
  - Color-coded output with timestamps
  - Proper logging to `/var/log/cockpit-openscap/`
  - Correct directory permissions (755 for scripts/scans directories)
  - Cleaner installation messaging
  - Version displayed in completion message

### Fixed
- **Tab 3 Scan History links** - All buttons now work correctly:
  - Rewrote displayScanHistory to use event listeners instead of inline onclick
  - Exposed functions to window object for global access
  - View HTML Report, XCCDF Results, Bash Script, and Ansible links all functional
- **Large file downloads** - XCCDF results (18MB+) now handled properly:
  - Files >5MB are copied to /tmp for user access
  - Clear message provided with file location

---

## [4.2.7] - 2025-01-06

### Fixed
- **Script generation was taking 8+ minutes** - Complete architecture redesign:
  - New `extract-fixes.sh` parses remediation scripts ONCE after scan completes
  - Individual fixes stored as separate files in `scans/{id}/fixes/bash/` and `scans/{id}/fixes/ansible/`
  - Generation now INSTANT (< 1 second) - just concatenates pre-extracted files
  - `generate-custom-bash.sh` and `generate-custom-ansible.sh` rewritten
- **Removed "Critical" from severity filter** - STIG profile only has High/Medium/Low

### Changed
- `run-scan.sh` now calls `extract-fixes.sh` after generating remediation scripts
- Generation scripts fallback to extraction if fixes not pre-extracted (for old scans)

---

## [4.2.6] - 2025-01-06

### Fixed
- **Generate Bash Script button not working** - Multiple fixes:
  - Fixed file permissions on remediation.sh (chmod 755 instead of +x)
  - Changed from `superuser: 'try'` to `superuser: 'require'` for file access
  - Added button feedback ("Generating...") during script creation
  - Auto-downloads the generated file after creation
  - Better error messages shown via toast notification

### Added
- **Tab 2 auto-loads latest scan** - Can now go directly to Tab 2:
  - If no scan was run in current session, automatically loads most recent scan from history
  - If no scans exist, shows message directing user to Tab 1
  - No need to run a scan first just to build remediation from previous scan

---

## [4.2.5] - 2025-01-06

### Fixed
- **CRITICAL: Remediation Builder showing "System is Compliant" when not compliant**
  - Completely rewrote `parse-findings.sh` with optimized awk-based XML parsing
  - Previous version failed because XML parsing assumed single-line elements
  - New version correctly parses multi-line XCCDF rule-result elements
  - Now finds all 286 failed rules (was finding 0)
  - Performance: processes full XCCDF results in ~4 seconds vs minutes
  - Properly extracts rule titles from Rule definitions

---

## [4.2.4] - 2025-01-06

### Fixed
- **Error toast still showing as empty red bar** - Fixed JavaScript visibility toggle
  - Changed from `style.display` to `classList.add/remove('visible')`
  - CSS `!important` declarations now properly honored
  - Toast only appears when an actual error occurs
- **Profile font size** - Reduced from 18px to 14px for better readability

---

## [4.2.3] - 2025-01-06

### Fixed
- **Error modal showing on load** - Replaced Bootstrap modal with simple toast notification
  - Removed Bootstrap modal markup that was visible by default
  - New error toast appears at bottom of screen
  - Auto-hides after 8 seconds
  - Close button to dismiss manually
  - Non-intrusive red notification bar

---

## [4.2.2] - 2025-01-06

### Fixed
- **Complete tab redesign** - Removed Bootstrap-style tabs, implemented custom system
  - New `.tab-nav` and `.tab-btn` classes for tab buttons
  - New `.tab-panel` class for content panels
  - Simple `data-tab` attribute for targeting
  - Reliable JavaScript switching without Bootstrap dependencies
  - Clean visual design with bottom border indicator

---

## [4.2.1] - 2025-01-06

### Fixed
- **Tabs not showing** - Added JavaScript tab navigation handler
  - Bootstrap JS not loaded, so manual tab switching implemented
  - Tabs now properly switch between panes on click
- **HTML report corruption** - Simplified remediation script generation
  - Removed header/footer injection that could cause issues
  - Remediation scripts now generated to temp files first, then moved
  - Ensures HTML report remains untouched after initial creation

---

## [4.2.0] - 2025-01-06

### Added
- **Tab 2: Selective Remediation Builder** - Major new feature allowing users to:
  - View all failed/error findings from a scan
  - Filter findings by severity, status, fix availability, and search
  - Sort findings by severity, title, or rule ID
  - Select/deselect individual findings for remediation
  - Generate custom Bash scripts containing only selected fixes
  - Generate custom Ansible playbooks containing only selected fixes
  - Download generated scripts directly from the UI

### New Backend Scripts
- `scripts/parse-findings.sh` - Parses XCCDF results and extracts failed findings
- `scripts/generate-custom-bash.sh` - Creates custom Bash remediation scripts
- `scripts/generate-custom-ansible.sh` - Creates custom Ansible playbooks

### Changed
- Renamed tabs for clearer workflow: "1. Run Scan", "2. Build Remediation", "Scan History"
- Removed old "Remediation Scripts" tab (functionality replaced by builder)

---

## [4.1.0] - 2025-01-06

### Added
- **Introduction panel** - Educational content for new users explaining:
  - What security compliance scanning is
  - Common standards (DISA STIG, CIS, PCI-DSS)
  - Why regular scanning matters (regulatory compliance, risk reduction, audit readiness)
  - Recommended scanning frequency

### Changed
- **Enterprise UI redesign** - More professional, subtle appearance
  - Removed large blue buttons, replaced with cleaner styled buttons
  - New output links with icon and description layout
  - Muted color palette with better typography
  - Improved scan completion banner (compact, professional)
- **HTML report rendering** - Fixed CSS/styling loss in reports
  - Now reads files as binary to preserve encoding
  - Proper charset declaration in blob URL

### Fixed
- **HTML reports displaying without formatting** - Binary read preserves original OpenSCAP styling

---

## [4.0.9] - 2025-01-06

### Fixed
- **Progress spinner showing on page load** - Applied same CSS `!important` fix as results container
  - Progress container now hidden with `display: none !important`
  - Uses `.visible` class to show during active scan
  - Removed inline styles from HTML (CSS handles visibility)

---

## [4.0.8] - 2025-01-06

### Changed
- **Improved scan progress feedback** - Replaced static progress bar with animated spinner
  - CSS keyframe animation for smooth rotation
  - Dynamic status text updates during scan phases
  - More informative user experience during long scans
- **Redesigned HTML report button** - New card-style design
  - Gradient blue background with hover effects
  - Icon, title, description, and arrow indicator
  - More prominent and professional appearance
- **Simplified results UI** - Removed remediation script download buttons
  - Bash and Ansible remediation files still generated
  - Only HTML report card and XCCDF results link shown
  - Cleaner, less cluttered interface

---

## [4.0.7] - 2025-01-06

### Fixed
- **HTML report links not working** - Now uses Cockpit's file API (cockpit.file().read())
  - Cockpit doesn't serve dynamically created files through URL paths
  - Reports now open using blob URLs created from file content
  - Downloads work using same blob URL approach
- **Profile font size** - Reduced from 24px to 18px

---

## [4.0.6] - 2025-01-06

### Fixed
- **HTML report links not working** - Changed URL format to `/cockpit/cockpit-openscap/scans/...`
  - Previous relative paths weren't being served by Cockpit
  - Now using absolute paths with Cockpit's package URL format

---

## [4.0.5] - 2025-01-06

### Changed
- **Profile list UI simplified** - Profiles now display as a simple list with radio buttons
  - 24px font size for profile names
  - Radio button to the left of each profile
  - Cleaner, more compact layout

---

## [4.0.4] - 2025-01-06

### Fixed
- **Scan results showing on page load** - Used CSS `!important` and class-based visibility toggle
  - `.results-container` now hidden with `display: none !important`
  - JS adds `.visible` class to show results (overrides with `display: block !important`)
  - Fixes browser caching issues that kept results visible

---

## [4.0.3] - 2025-01-06

### Fixed
- **Tab panes all visible** - Added missing CSS for Bootstrap-style tabs (`.tab-pane` hidden by default, `.tab-pane.active` visible)
- **Scan results showing on page load** - Tab CSS now properly hides inactive content

---

## [4.0.2] - 2025-01-06

### Fixed
- **File links not working** - Changed URL paths from absolute `/cockpit/@localhost/cockpit-openscap/...` to relative `scans/...` paths
  - HTML report, XCCDF results, and remediation script links now work correctly
  - Fixed in both current scan results and scan history views

---

## [4.0.1] - 2025-01-06

### Fixed
- **Critical: manifest.json format** - Changed from deprecated `"menu"` section to `"tools"` section
  - Modern Cockpit (v250+) requires plugins to use `"tools"` section to appear in menu
  - Removed unnecessary fields (`version`, `name`, `description`, `requires`)
  - Added keyword search support for better discoverability
- **Critical: list-profiles.sh parsing** - Fixed profile parsing to correctly handle `oscap info --profiles` output format
  - Original script expected Title:/Id: format but oscap outputs `id:title` format
  - Profiles now correctly populate in the UI dropdown
  - Added fallback to RHEL datastream for CentOS/Rocky/Alma if OS-specific file not found
- Removed malformed `{logs,scans,scripts,remediation}` directory from package (brace expansion bug)
- Fixed logging to silently fail if user lacks write permission to log directory
- **UI bug: Previous scan results** - Now hides "Scan Completed Successfully" message when starting a new scan

### Technical Details
The original manifest used this format (incorrect):
```json
{
    "menu": {
        "index": { "label": "OpenSCAP" }
    }
}
```

Fixed to match Cockpit's expected format:
```json
{
    "tools": {
        "index": {
            "label": "OpenSCAP",
            "keywords": [{ "matches": ["openscap", "security", ...] }]
        }
    }
}
```

## [4.0.0] - 2025-01-05

### Changed - Major Simplification
- **Simplified to pure frontend approach** - No longer recalculating scores or parsing XML
- OpenSCAP's HTML reports contain all scores and statistics - we just link to them
- Removed all score calculation code (was reinventing the wheel)
- Removed XML parsing for statistics (OpenSCAP already did this)
- Removed statistics display from UI (OpenSCAP's HTML report has everything)
- Simplified `run-scan.sh` to just run OpenSCAP commands
- Simplified `openscap.js` to just display file links
- Updated all documentation to reflect "simple frontend" philosophy

### Added
- VERSION file
- CHANGELOG file
- Clear documentation explaining we're just a frontend to OpenSCAP

### Improved
- Reduced package size from 18KB to 17KB
- Cleaner, more maintainable code
- Fewer dependencies (removed xmllint requirement for score extraction)
- Faster - no XML parsing overhead
- More reliable - we just run OpenSCAP, don't second-guess it

### Philosophy
This version embraces the principle: "Don't reinvent the wheel, just make it easier to roll."
OpenSCAP does compliance scanning perfectly. We provide a web UI to run it and organize the output files.

## [1.0.0] - 2025-01-05

### Added - Initial Release
- System detection (RHEL/CentOS/Fedora/Rocky/AlmaLinux)
- Security profile selection based on detected OS
- Automated scanning with progress tracking
- HTML report generation (via OpenSCAP)
- XCCDF results storage
- Bash remediation script generation (via OpenSCAP)
- Ansible playbook generation (via OpenSCAP)
- Scan history viewing
- Comprehensive logging
- Automated prerequisite installation
- Tabbed web interface
- File organization by timestamp
