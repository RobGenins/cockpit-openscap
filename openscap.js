/*
 * OpenSCAP Cockpit Plugin JavaScript
 * Version 5.0.1 - Simple Frontend to OpenSCAP
 *
 * This plugin is a thin frontend that runs OpenSCAP commands
 * and provides easy access to OpenSCAP-generated files.
 * We don't recalculate scores or parse results - OpenSCAP does that perfectly.
 *
 * License: Business Source License 1.1 - see LICENSE file.
 * Free for personal, educational, non-commercial use and production use on
 * up to 5 servers. Commercial use beyond that needs a license:
 * rgenins@gmail.com. Converts to Apache 2.0 on 2029-11-12.
 */

const cockpit = window.cockpit;

// Plugin version (must match VERSION and version.json)
const PLUGIN_VERSION = '5.0.1';
// Public file in this repo that reports the latest release. The update check
// below fetches it at most once a day. It sends no personal data anywhere;
// see README "Updates & Privacy". Turn it off from the update banner.
const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/RobGenins/cockpit-openscap/main/version.json';
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
let systemInfo = null;
let selectedProfile = null;
let currentScanId = null;

// Tab 2: Remediation Builder State
const builderState = {
    scanId: null,
    profile: null,
    findings: [],
    selections: new Map(),
    filters: {
        severity: 'all',
        status: 'all',
        availability: 'all',
        searchTerm: ''
    },
    sortBy: 'severity'
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('OpenSCAP Plugin initialized');
    detectSystemInfo();
    setupEventListeners();
    setupTabNavigation();
    setupPurgeButton();
    setupUpdateBanner();

    // Update check must never break the plugin: any failure is silent.
    try { checkForUpdates(); } catch (e) { /* ignore */ }

    // Expose functions globally for inline onclick handlers
    window.openReport = openReport;
    window.downloadFile = downloadFile;
    window.hideError = hideError;
    window.toggleFindingDetails = toggleFindingDetails;
});

// --- Update check (opt-out, once a day, silent on any failure) ---
function checkForUpdates() {
    try {
        if (window.localStorage) {
            if (window.localStorage.getItem('openscap_update_check') === 'off') return;
            const last = parseInt(window.localStorage.getItem('openscap_update_checked_at') || '0', 10);
            if (Date.now() - last < UPDATE_CHECK_INTERVAL_MS) return;
        }
        const controller = new AbortController();
        const timer = setTimeout(function() { controller.abort(); }, 5000);
        fetch(UPDATE_CHECK_URL, { signal: controller.signal, cache: 'no-store' })
            .then(function(r) { clearTimeout(timer); return r.json(); })
            .then(function(data) {
                try {
                    if (window.localStorage) window.localStorage.setItem('openscap_update_checked_at', String(Date.now()));
                    if (!data || !data.version) return;
                    if (compareVersions(data.version, PLUGIN_VERSION) > 0) {
                        showUpdateBanner(data.version, data.release_url);
                    }
                } catch (e) { /* never break the plugin */ }
            })
            .catch(function() { /* offline, blocked, or no network: silently skip */ });
    } catch (e) { /* never break the plugin */ }
}

function compareVersions(a, b) {
    const pa = String(a).split('.').map(function(x) { return parseInt(x, 10) || 0; });
    const pb = String(b).split('.').map(function(x) { return parseInt(x, 10) || 0; });
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d;
    }
    return 0;
}

function showUpdateBanner(version, url) {
    const banner = document.getElementById('update-banner');
    if (!banner) return;
    const link = document.getElementById('update-banner-link');
    if (link) {
        link.textContent = 'Version ' + version + ' is available — get it here';
        if (url) link.href = url;
    }
    banner.style.display = 'flex';
}

function setupUpdateBanner() {
    document.getElementById('update-banner-dismiss')?.addEventListener('click', function() {
        const banner = document.getElementById('update-banner');
        if (banner) banner.style.display = 'none';
    });
    document.getElementById('update-banner-optout')?.addEventListener('click', function() {
        try {
            if (window.localStorage) window.localStorage.setItem('openscap_update_check', 'off');
        } catch (e) { /* ignore */ }
        const banner = document.getElementById('update-banner');
        if (banner) banner.style.display = 'none';
    });
}

// Setup tab navigation
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-tab');

            // Remove active from all buttons and panels
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            // Activate clicked button and target panel
            this.classList.add('active');
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }

            // Load content for specific tabs
            if (targetId === 'local-scan') {
                refreshTab1State();
            } else if (targetId === 'remediation-builder') {
                loadRemediationBuilder();
            } else if (targetId === 'results') {
                loadScanHistory();
            } else if (targetId === 'dashboard') {
                loadDashboard();
            } else if (targetId === 'cron-jobs') {
                loadCronTab();
            }
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('start-scan-btn')?.addEventListener('click', startScan);
    document.getElementById('new-scan-btn')?.addEventListener('click', resetScanForm);
    document.getElementById('error-close-btn')?.addEventListener('click', hideError);
    document.getElementById('goto-tab2-btn')?.addEventListener('click', () => {
        // Switch to Tab 2
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        document.querySelector('[data-tab="remediation-builder"]').classList.add('active');
        document.getElementById('remediation-builder').classList.add('active');
        loadRemediationBuilder();
    });

    // Tab 2: Remediation Builder event listeners
    setupBuilderEventListeners();
}

// Setup Tab 2 event listeners
function setupBuilderEventListeners() {
    // Filter controls
    document.getElementById('filter-search')?.addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('filter-severity')?.addEventListener('change', applyFilters);
    document.getElementById('filter-status')?.addEventListener('change', applyFilters);
    document.getElementById('filter-availability')?.addEventListener('change', applyFilters);
    document.getElementById('filter-sort')?.addEventListener('change', applyFilters);

    // Selection controls
    document.getElementById('btn-select-all')?.addEventListener('click', selectAllVisible);
    document.getElementById('btn-deselect-all')?.addEventListener('click', deselectAllVisible);
    document.getElementById('btn-clear-filters')?.addEventListener('click', clearFilters);

    // Generation buttons
    document.getElementById('btn-generate-bash')?.addEventListener('click', generateBashScript);
    document.getElementById('btn-generate-ansible')?.addEventListener('click', generateAnsiblePlaybook);
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Detect system information
function detectSystemInfo() {
    console.log('Detecting system information...');
    
    const file = cockpit.file('/etc/os-release');
    file.read()
        .then(content => {
            systemInfo = parseOSRelease(content);
            displaySystemInfo();
            loadProfiles();
        })
        .catch(error => {
            console.error('Error reading system info:', error);
            showError('Failed to detect system information');
        });
}

// Parse /etc/os-release file
function parseOSRelease(content) {
    const info = {};
    const lines = content.split('\n');
    
    lines.forEach(line => {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (match) {
            const key = match[1];
            let value = match[2];
            // Remove quotes
            value = value.replace(/^["']|["']$/g, '');
            info[key] = value;
        }
    });
    
    return info;
}

// Display system information
function displaySystemInfo() {
    const container = document.getElementById('system-info');
    
    const html = `
        <div class="system-details">
            <table class="table">
                <tr>
                    <th>Operating System:</th>
                    <td>${systemInfo.NAME || 'Unknown'}</td>
                </tr>
                <tr>
                    <th>Version:</th>
                    <td>${systemInfo.VERSION || 'Unknown'}</td>
                </tr>
                <tr>
                    <th>ID:</th>
                    <td>${systemInfo.ID || 'Unknown'}</td>
                </tr>
                <tr>
                    <th>Version ID:</th>
                    <td>${systemInfo.VERSION_ID || 'Unknown'}</td>
                </tr>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

// Load available profiles based on system
function loadProfiles() {
    console.log('Loading profiles for system:', systemInfo.ID);
    
    // Execute script to get available profiles
    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/list-profiles.sh'],
        { superuser: 'try' })
        .then(output => {
            const profiles = JSON.parse(output);
            displayProfiles(profiles);
        })
        .catch(error => {
            console.error('Error loading profiles:', error);
            showError('Failed to load security profiles');
        });
}

// Display available profiles
function displayProfiles(profiles) {
    const container = document.getElementById('profile-selection');

    if (profiles.length === 0) {
        container.innerHTML = `
            <div class="alert alert-warning">
                No security profiles found for this system.
            </div>
        `;
        return;
    }

    let html = '<div class="profile-list">';

    profiles.forEach(profile => {
        html += `
            <div class="profile-item">
                <input type="radio" name="profile" id="profile-${profile.id}"
                       value="${profile.id}" data-datastream="${profile.datastream}"
                       data-profile-name="${profile.title}">
                <label for="profile-${profile.id}">${profile.title}</label>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
    
    // Add event listeners to radio buttons
    document.querySelectorAll('input[name="profile"]').forEach(radio => {
        radio.addEventListener('change', function() {
            selectedProfile = {
                id: this.value,
                datastream: this.dataset.datastream,
                title: this.dataset.profileName
            };
            document.getElementById('scan-controls').style.display = 'block';
        });
    });
}

// Start scan
function startScan() {
    if (!selectedProfile) {
        showError('Please select a security profile');
        return;
    }

    console.log('Starting scan with profile:', selectedProfile);

    // Hide any previous results and show progress
    document.getElementById('scan-results').classList.remove('visible');
    document.getElementById('start-scan-btn').disabled = true;
    document.getElementById('scan-progress').classList.add('visible');

    updateProgress('Initializing security scan...');

    // Generate scan ID
    currentScanId = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Execute scan script
    const args = [
        'bash',
        '/usr/share/cockpit/cockpit-openscap/scripts/run-scan.sh',
        selectedProfile.datastream,
        selectedProfile.id,
        currentScanId
    ];
    
    const proc = cockpit.spawn(args, { superuser: 'require', err: 'message' });
    
    let output = '';
    
    proc.stream(data => {
        output += data;
        console.log('Scan output:', data);

        // Parse progress if available
        if (data.includes('PROGRESS:')) {
            const match = data.match(/PROGRESS:(\d+):(.+)/);
            if (match) {
                updateProgress(match[2]);
            }
        }
    });

    proc.then(() => {
        updateProgress('Finalizing results...');
        setTimeout(() => {
            displayScanResults();
        }, 500);
    })
    .catch(error => {
        console.error('Scan error:', error);
        showError('Scan failed: ' + error);
        resetScanForm();
    });
}

// Update progress status
function updateProgress(status) {
    document.getElementById('scan-status').textContent = status;
}

// Display scan results and auto-copy all files to Downloads
function displayScanResults() {
    // Hide progress, show results
    document.getElementById('scan-progress').classList.remove('visible');

    const resultsContainer = document.getElementById('scan-results');
    resultsContainer.classList.add('visible');

    // Update completion time
    const now = new Date();
    document.getElementById('scan-completion-time').textContent =
        now.toLocaleDateString() + ' at ' + now.toLocaleTimeString();

    const basePath = `/usr/share/cockpit/cockpit-openscap/scans/${currentScanId}`;

    // Auto-copy all files to Downloads folder
    copyAllScanFiles(basePath, currentScanId);

    // Note: Auto-opening HTML in browser removed - unreliable in Cockpit context
    // User instructed to open file manually from Downloads folder
}

// Copy all scan files to Downloads folder automatically
function copyAllScanFiles(basePath, scanId) {
    const files = [
        { src: `${basePath}/report.html`, dest: `report-${scanId}.html` },
        { src: `${basePath}/results.xml`, dest: `xccdf-results-${scanId}.xml` },
        { src: `${basePath}/remediation.sh`, dest: `remediation-${scanId}.sh` },
        { src: `${basePath}/remediation.yml`, dest: `playbook-${scanId}.yml` }
    ];

    // Archive old files first, then copy new ones
    archiveOldFiles(() => {
        files.forEach(file => {
            downloadFile(file.src, file.dest);
        });
    });
}

// Open HTML report in browser (no download, just view)
function openReportInBrowser(filePath) {
    cockpit.file(filePath, { binary: true, superuser: 'require' }).read()
        .then(content => {
            const blob = new Blob([content], { type: 'text/html; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        })
        .catch(err => {
            console.error('Error reading report:', err);
            showError('Unable to open report: ' + err.message);
        });
}

// Legacy function for compatibility
function openReport(filePath, filename) {
    downloadFile(filePath, filename);
    openReportInBrowser(filePath);
    return false;
}

// Download file - copy to user's Downloads/ComplianceResults folder
function downloadFile(filePath, filename) {
    console.log('downloadFile called:', filePath, filename);

    // Get user info and home directory
    cockpit.spawn(['bash', '-c', 'echo "$HOME:$USER"'])
        .then(info => {
            const parts = info.trim().split(':');
            const homeDir = parts[0];
            const userName = parts[1];
            const destDir = `${homeDir}/Downloads/ComplianceResults`;
            const archiveDir = `${destDir}/Archive`;
            const destPath = `${destDir}/${filename}`;

            // Create directories and copy file
            cockpit.spawn(['mkdir', '-p', archiveDir])
                .then(() => {
                    return cockpit.spawn(['cp', filePath, destPath], { superuser: 'require' });
                })
                .then(() => {
                    return cockpit.spawn(['chown', `${userName}:${userName}`, destPath], { superuser: 'require' });
                })
                .then(() => {
                    return cockpit.spawn(['chmod', '644', destPath], { superuser: 'require' });
                })
                .then(() => {
                    console.log('Saved:', destPath);
                })
                .catch(err => {
                    console.error('Copy error:', err);
                    showError(`Failed to copy file: ${err.message}`);
                });
        })
        .catch(err => {
            console.error('Home dir error:', err);
            showError('Could not determine home directory');
        });
    return false;
}

// Archive old files before saving new scan results
function archiveOldFiles(callback) {
    cockpit.spawn(['bash', '-c', 'echo "$HOME:$USER"'])
        .then(info => {
            const parts = info.trim().split(':');
            const homeDir = parts[0];
            const userName = parts[1];
            const destDir = `${homeDir}/Downloads/ComplianceResults`;
            const archiveDir = `${destDir}/Archive`;

            // Move all existing scan files to Archive
            cockpit.spawn(['bash', '-c', `
                mkdir -p "${archiveDir}"
                cd "${destDir}" 2>/dev/null || exit 0
                timestamp=$(date +%Y%m%d-%H%M%S)
                for f in report-*.html xccdf-results-*.xml remediation-*.sh playbook-*.yml custom-remediation-*.sh custom-playbook-*.yml; do
                    if [ -f "$f" ]; then
                        mv "$f" "${archiveDir}/\${f}.\${timestamp}.bak"
                    fi
                done
                chown -R ${userName}:${userName} "${archiveDir}" 2>/dev/null
            `])
            .then(() => {
                console.log('Old files archived');
                if (callback) callback();
            })
            .catch(err => {
                console.log('Archive warning:', err.message);
                if (callback) callback();
            });
        });
}

// Show success message (green toast) - brief notification
function showSuccess(message) {
    console.log('Success:', message);
    // Don't show toast for auto-saves, only log
}

// Reset scan form
function resetScanForm() {
    document.getElementById('scan-results').classList.remove('visible');
    document.getElementById('scan-progress').classList.remove('visible');
    document.getElementById('start-scan-btn').disabled = false;
    selectedProfile = null;
    currentScanId = null;

    // Reset radio buttons
    document.querySelectorAll('input[name="profile"]').forEach(radio => {
        radio.checked = false;
    });

    document.getElementById('scan-controls').style.display = 'none';
}

// Refresh Tab 1 state when returning to it
function refreshTab1State() {
    // If a scan is in progress, don't change anything
    const progressVisible = document.getElementById('scan-progress')?.classList.contains('visible');
    if (progressVisible) return;

    // If results are visible and we have a currentScanId, keep showing them
    // This allows users to see their most recent scan results
    const resultsVisible = document.getElementById('scan-results')?.classList.contains('visible');
    if (resultsVisible && currentScanId) return;

    // Make sure scan button is enabled if no scan in progress
    const scanBtn = document.getElementById('start-scan-btn');
    if (scanBtn) scanBtn.disabled = false;

    // If user has selected a profile, make sure controls are visible
    if (selectedProfile) {
        document.getElementById('scan-controls').style.display = 'block';
    }
}

// Load scan history
function loadScanHistory() {
    const container = document.getElementById('scan-history');
    container.innerHTML = '<p>Loading scan history...</p>';
    
    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/list-scans.sh'],
        { superuser: 'try' })
        .then(output => {
            const scans = JSON.parse(output);
            displayScanHistory(scans);
        })
        .catch(error => {
            console.error('Error loading scan history:', error);
            container.innerHTML = '<div class="alert alert-warning">No scan history available</div>';
        });
}

// Display scan history
function displayScanHistory(scans) {
    const container = document.getElementById('scan-history');

    if (scans.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No scans found</div>';
        return;
    }

    let html = '<div class="list-group">';

    scans.forEach(scan => {
        const basePath = `/usr/share/cockpit/cockpit-openscap/scans/${scan.id}`;
        html += `
            <div class="list-group-item">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${scan.profile}</h5>
                    <small>${scan.date}</small>
                </div>
                <p class="mb-1">Scan ID: ${scan.id}</p>
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-primary btn-report" data-path="${basePath}/report.html" data-filename="report-${scan.id}.html">View HTML Report</button>
                    <button type="button" class="btn btn-outline-secondary btn-download" data-path="${basePath}/results.xml" data-filename="xccdf-results-${scan.id}.xml">XCCDF Results</button>
                    <button type="button" class="btn btn-outline-success btn-download" data-path="${basePath}/remediation.sh" data-filename="remediation-${scan.id}.sh">Bash Script</button>
                    <button type="button" class="btn btn-outline-success btn-download" data-path="${basePath}/remediation.yml" data-filename="playbook-${scan.id}.yml">Ansible</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Attach event listeners for report buttons (opens AND saves)
    container.querySelectorAll('.btn-report').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const path = this.getAttribute('data-path');
            const filename = this.getAttribute('data-filename');
            console.log('Opening report:', path);
            openReport(path, filename);
        });
    });

    // Attach event listeners for download buttons
    container.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const path = this.getAttribute('data-path');
            const filename = this.getAttribute('data-filename');
            console.log('Downloading:', path, filename);
            downloadFile(path, filename);
        });
    });
}

// Show error message
function showError(message) {
    console.error('Error:', message);
    const toast = document.getElementById('error-toast');
    const msgEl = document.getElementById('error-message');
    if (toast && msgEl) {
        msgEl.textContent = message;
        toast.classList.add('visible');
        // Auto-hide after 8 seconds
        setTimeout(hideError, 8000);
    }
}

// Hide error message
function hideError() {
    const toast = document.getElementById('error-toast');
    if (toast) {
        toast.classList.remove('visible');
    }
}

// ============================================================================
// TAB 2: REMEDIATION BUILDER
// ============================================================================

// Load Remediation Builder when tab is clicked
function loadRemediationBuilder() {
    console.log('Loading Remediation Builder, currentScanId:', currentScanId);

    // If we have a scan ID from Tab 1 (current session), use it
    if (currentScanId) {
        if (builderState.scanId !== currentScanId) {
            builderState.scanId = currentScanId;
            builderState.profile = selectedProfile?.title || 'Unknown';
            loadFindings();
        }
        return;
    }

    // Otherwise, try to load the latest scan from history
    showBuilderState('loading');

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/list-scans.sh'],
        { superuser: 'try' })
        .then(output => {
            const scans = JSON.parse(output);
            if (scans.length > 0) {
                // Use the most recent scan (first in the sorted list)
                const latestScan = scans[0];
                builderState.scanId = latestScan.id;
                builderState.profile = latestScan.profile || 'Unknown';
                console.log('Loading latest scan from history:', latestScan.id);
                loadFindings();
            } else {
                showBuilderState('no-scan');
            }
        })
        .catch(error => {
            console.error('Error loading scan history:', error);
            showBuilderState('no-scan');
        });
}

// Show different builder states
function showBuilderState(state) {
    document.getElementById('builder-no-scan').style.display = state === 'no-scan' ? 'block' : 'none';
    document.getElementById('builder-loading').style.display = state === 'loading' ? 'block' : 'none';
    document.getElementById('builder-content').style.display = state === 'content' ? 'block' : 'none';
    document.getElementById('builder-compliant').style.display = state === 'compliant' ? 'block' : 'none';
}

// Load findings from backend
function loadFindings() {
    showBuilderState('loading');

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/parse-findings.sh', builderState.scanId],
        { superuser: 'require' })
        .then(output => {
            const data = JSON.parse(output);
            builderState.findings = data.findings || [];
            builderState.profile = data.profile || builderState.profile;

            // Update scan info display
            document.getElementById('builder-scan-info').innerHTML =
                `<span>Scan: ${builderState.scanId}</span> | <span>Profile: ${builderState.profile}</span>`;

            if (builderState.findings.length === 0) {
                showBuilderState('compliant');
                return;
            }

            // Initialize selections - auto-select findings with automated fixes
            builderState.selections.clear();
            builderState.findings.forEach(finding => {
                const hasAutoFix = finding.has_bash_fix || finding.has_ansible_fix;
                builderState.selections.set(finding.rule_id, hasAutoFix);
            });

            showBuilderState('content');
            applyFilters();
        })
        .catch(error => {
            console.error('Error loading findings:', error);
            showBuilderState('no-scan');
            showError('Failed to load scan findings. Please check logs at /var/log/cockpit-openscap/');
        });
}

// Apply filters and re-render
function applyFilters() {
    // Read filter values
    builderState.filters.searchTerm = document.getElementById('filter-search')?.value || '';
    builderState.filters.severity = document.getElementById('filter-severity')?.value || 'all';
    builderState.filters.status = document.getElementById('filter-status')?.value || 'all';
    builderState.filters.availability = document.getElementById('filter-availability')?.value || 'all';
    builderState.sortBy = document.getElementById('filter-sort')?.value || 'severity';

    const filtered = getFilteredFindings();
    renderFindings(filtered);
    updateCounts(filtered);
}

// Get filtered findings based on current filters
function getFilteredFindings() {
    let filtered = [...builderState.findings];

    // Apply severity filter
    if (builderState.filters.severity !== 'all') {
        filtered = filtered.filter(f => f.severity === builderState.filters.severity);
    }

    // Apply status filter
    if (builderState.filters.status !== 'all') {
        filtered = filtered.filter(f => f.result === builderState.filters.status);
    }

    // Apply availability filter
    if (builderState.filters.availability === 'auto') {
        filtered = filtered.filter(f => f.has_bash_fix || f.has_ansible_fix);
    } else if (builderState.filters.availability === 'manual') {
        filtered = filtered.filter(f => !f.has_bash_fix && !f.has_ansible_fix);
    }

    // Apply search filter
    if (builderState.filters.searchTerm) {
        const term = builderState.filters.searchTerm.toLowerCase();
        filtered = filtered.filter(f =>
            f.title.toLowerCase().includes(term) ||
            f.rule_id.toLowerCase().includes(term)
        );
    }

    // Apply sorting
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (builderState.sortBy === 'severity') {
        filtered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    } else if (builderState.sortBy === 'title') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (builderState.sortBy === 'rule_id') {
        filtered.sort((a, b) => a.rule_id.localeCompare(b.rule_id));
    }

    return filtered;
}

// Render findings list
function renderFindings(findings) {
    const container = document.getElementById('findings-list');
    const emptyFilter = document.getElementById('findings-empty-filter');

    if (findings.length === 0) {
        container.innerHTML = '';
        emptyFilter.style.display = 'block';
        return;
    }

    emptyFilter.style.display = 'none';

    let html = '';
    findings.forEach(finding => {
        const isSelected = builderState.selections.get(finding.rule_id) || false;
        const hasAutoFix = finding.has_bash_fix || finding.has_ansible_fix;
        const fixType = finding.has_bash_fix && finding.has_ansible_fix ? 'Bash + Ansible' :
                       finding.has_bash_fix ? 'Bash' :
                       finding.has_ansible_fix ? 'Ansible' : 'Manual';

        html += `
            <div class="finding-card ${isSelected ? 'selected' : ''}" data-rule-id="${finding.rule_id}">
                <div class="finding-header">
                    <label class="finding-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} data-rule-id="${finding.rule_id}">
                        <span class="checkmark"></span>
                    </label>
                    <span class="severity-badge severity-${finding.severity}">${finding.severity}</span>
                    <span class="finding-title">${escapeHtml(finding.title)}</span>
                </div>
                <div class="finding-meta">
                    <span class="rule-id">${finding.rule_id}</span>
                    <span class="result-badge result-${finding.result}">${finding.result}</span>
                    <span class="fix-indicator ${hasAutoFix ? 'auto' : 'manual'}">
                        ${hasAutoFix ? '&#10003; ' + fixType + ' fix available' : '&#9888; Manual remediation required'}
                    </span>
                </div>
                <div class="finding-details collapsed">
                    <p>${escapeHtml(finding.description) || 'No description available.'}</p>
                </div>
                <button class="btn-expand">Show Details</button>
            </div>
        `;
    });

    container.innerHTML = html;

    // Add checkbox event listeners
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const ruleId = this.dataset.ruleId;
            builderState.selections.set(ruleId, this.checked);
            this.closest('.finding-card').classList.toggle('selected', this.checked);
            updateSelectionCounts();
        });
    });

    // Add expand/collapse event listeners (CSP-safe: Cockpit blocks inline
    // onclick handlers, so wire the buttons up here instead)
    container.querySelectorAll('.btn-expand').forEach(button => {
        button.addEventListener('click', function() {
            toggleFindingDetails(this);
        });
    });
}

// Toggle finding details
function toggleFindingDetails(btn) {
    const details = btn.previousElementSibling;
    const isCollapsed = details.classList.contains('collapsed');
    details.classList.toggle('collapsed');
    btn.textContent = isCollapsed ? 'Hide Details' : 'Show Details';
}

// Update all counts
function updateCounts(filtered) {
    const total = builderState.findings.length;
    const displayed = filtered.length;
    const autoCount = builderState.findings.filter(f => f.has_bash_fix || f.has_ansible_fix).length;
    const manualCount = builderState.findings.filter(f => !f.has_bash_fix && !f.has_ansible_fix).length;

    document.getElementById('display-count').textContent = `Showing ${displayed} of ${total} findings`;
    document.getElementById('auto-count').textContent = autoCount;
    document.getElementById('manual-count').textContent = manualCount;
    document.getElementById('total-count').textContent = total;

    updateSelectionCounts();
}

// Update selection counts
function updateSelectionCounts() {
    let selectedCount = 0;
    let selectedWithFix = 0;

    builderState.selections.forEach((isSelected, ruleId) => {
        if (isSelected) {
            selectedCount++;
            const finding = builderState.findings.find(f => f.rule_id === ruleId);
            if (finding && (finding.has_bash_fix || finding.has_ansible_fix)) {
                selectedWithFix++;
            }
        }
    });

    document.getElementById('selected-count').textContent = selectedCount;
    document.getElementById('selected-with-fix').textContent = `(${selectedWithFix} with automated fixes)`;
}

// Select all visible findings
function selectAllVisible() {
    const filtered = getFilteredFindings();
    filtered.forEach(finding => {
        builderState.selections.set(finding.rule_id, true);
    });
    applyFilters();
}

// Deselect all visible findings
function deselectAllVisible() {
    const filtered = getFilteredFindings();
    filtered.forEach(finding => {
        builderState.selections.set(finding.rule_id, false);
    });
    applyFilters();
}

// Clear all filters
function clearFilters() {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-severity').value = 'all';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-availability').value = 'all';
    applyFilters();
}

// Generate custom Bash script
function generateBashScript() {
    const selectedRuleIds = getSelectedRuleIdsWithFix('bash');

    if (selectedRuleIds.length === 0) {
        showError('Please select at least one finding with a Bash fix available.');
        return;
    }

    // Show generating feedback
    const btn = document.getElementById('btn-generate-bash');
    const originalText = btn.textContent;
    btn.textContent = 'Generating...';
    btn.disabled = true;

    const jsonInput = JSON.stringify({ rule_ids: selectedRuleIds });
    console.log('Generating Bash script for', selectedRuleIds.length, 'rules');

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/generate-custom-bash.sh',
        builderState.scanId, jsonInput], { superuser: 'require' })
        .then(output => {
            console.log('Generate script output:', output);
            const filePath = output.trim();
            if (filePath && filePath.startsWith('/')) {
                const filename = filePath.split('/').pop();
                // Verify file exists and get size
                cockpit.spawn(['stat', '-c', '%s', filePath], { superuser: 'require' })
                    .then(sizeStr => {
                        const size = parseInt(sizeStr.trim(), 10);
                        console.log('Generated file size:', size, 'bytes');
                        addDownloadLink(filename, filePath, `Bash Script (${Math.round(size/1024)}KB)`);
                        // Auto-download the file
                        downloadFile(filePath, filename);
                    })
                    .catch(err => {
                        console.error('File not created:', err);
                        showError('Script file was not created. Check server logs.');
                    });
            } else {
                showError('Script generation failed: ' + output);
            }
        })
        .catch(error => {
            console.error('Error generating Bash script:', error);
            showError('Failed to generate Bash script: ' + error.message);
        })
        .finally(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        });
}

// Generate custom Ansible playbook
function generateAnsiblePlaybook() {
    const selectedRuleIds = getSelectedRuleIdsWithFix('ansible');

    if (selectedRuleIds.length === 0) {
        showError('Please select at least one finding with an Ansible fix available.');
        return;
    }

    // Show generating feedback
    const btn = document.getElementById('btn-generate-ansible');
    const originalText = btn.textContent;
    btn.textContent = 'Generating...';
    btn.disabled = true;

    const jsonInput = JSON.stringify({ rule_ids: selectedRuleIds });
    console.log('Generating Ansible playbook for', selectedRuleIds.length, 'rules');

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/generate-custom-ansible.sh',
        builderState.scanId, jsonInput], { superuser: 'require' })
        .then(output => {
            console.log('Generate playbook output:', output);
            const filePath = output.trim();
            if (filePath && filePath.startsWith('/')) {
                const filename = filePath.split('/').pop();
                // Verify file exists and get size
                cockpit.spawn(['stat', '-c', '%s', filePath], { superuser: 'require' })
                    .then(sizeStr => {
                        const size = parseInt(sizeStr.trim(), 10);
                        console.log('Generated file size:', size, 'bytes');
                        addDownloadLink(filename, filePath, `Ansible Playbook (${Math.round(size/1024)}KB)`);
                        // Auto-download the file
                        downloadFile(filePath, filename);
                    })
                    .catch(err => {
                        console.error('File not created:', err);
                        showError('Playbook file was not created. Check server logs.');
                    });
            } else {
                showError('Playbook generation failed: ' + output);
            }
        })
        .catch(error => {
            console.error('Error generating Ansible playbook:', error);
            showError('Failed to generate Ansible playbook: ' + error.message);
        })
        .finally(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        });
}

// Get selected rule IDs that have the specified fix type
function getSelectedRuleIdsWithFix(fixType) {
    const ruleIds = [];

    builderState.selections.forEach((isSelected, ruleId) => {
        if (isSelected) {
            const finding = builderState.findings.find(f => f.rule_id === ruleId);
            if (finding) {
                if (fixType === 'bash' && finding.has_bash_fix) {
                    ruleIds.push(ruleId);
                } else if (fixType === 'ansible' && finding.has_ansible_fix) {
                    ruleIds.push(ruleId);
                }
            }
        }
    });

    return ruleIds;
}

// Show instructions for generated script
function addDownloadLink(filename, filePath, type) {
    const section = document.getElementById('download-section');
    const container = document.getElementById('download-links');

    section.style.display = 'block';

    // Clear previous content and show instructions
    container.innerHTML = `
        <div class="script-instructions">
            <h5>✓ Script Generated Successfully!</h5>

            <div class="critical-warning">
                <h4>⚠️ STOP - BEFORE RUNNING THIS SCRIPT:</h4>
                <ul>
                    <li><strong>CREATE A VM SNAPSHOT OR BACKUP NOW!</strong></li>
                    <li>This script may disable SSH, lock you out, or break services</li>
                    <li>Review each change in the script before running</li>
                    <li>Test on non-production systems first</li>
                </ul>
            </div>

            <p><strong>File saved to:</strong></p>
            <code>~/Downloads/ComplianceResults/${filename}</code>

            <p style="margin-top: 16px;"><strong>To run this script:</strong></p>
            <ol>
                <li>Create a snapshot/backup first!</li>
                <li>Copy script to target system if needed</li>
                <li>Make it executable: <code>chmod +x ${filename}</code></li>
                <li>Review the script: <code>cat ${filename}</code></li>
                <li>Run it: <code>sudo ./${filename}</code></li>
                <li>Some fixes require a reboot</li>
                <li>Re-scan to verify improvements</li>
            </ol>
        </div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// TAB 4: COMPLIANCE DASHBOARD
// ============================================================================

// Dashboard State
const dashboardState = {
    scans: [],
    filteredScans: [],
    profileFilter: 'all',
    sortBy: 'date-desc',
    searchTerm: ''
};

// Load Dashboard when tab is clicked
function loadDashboard() {
    console.log('Loading Compliance Dashboard');
    showDashboardState('loading');
    setupDashboardEventListeners();

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/parse-scan-metrics.sh'],
        { superuser: 'require' })
        .then(output => {
            try {
                dashboardState.scans = JSON.parse(output);
                console.log('Loaded', dashboardState.scans.length, 'scans for dashboard');

                if (dashboardState.scans.length === 0) {
                    showDashboardState('no-data');
                    return;
                }

                populateProfileFilter();
                applyDashboardFilters();
                showDashboardState('content');
            } catch (e) {
                console.error('Failed to parse dashboard data:', e);
                showDashboardState('no-data');
            }
        })
        .catch(error => {
            console.error('Error loading dashboard:', error);
            showDashboardState('no-data');
        });
}

// Setup Dashboard Event Listeners
function setupDashboardEventListeners() {
    document.getElementById('refresh-dashboard')?.addEventListener('click', loadDashboard);
    document.getElementById('dashboard-profile-filter')?.addEventListener('change', applyDashboardFilters);
    document.getElementById('dashboard-sort')?.addEventListener('change', applyDashboardFilters);
    document.getElementById('dashboard-search')?.addEventListener('input', debounce(applyDashboardFilters, 300));
}

// Show different dashboard states
function showDashboardState(state) {
    document.getElementById('dashboard-loading').style.display = state === 'loading' ? 'block' : 'none';
    document.getElementById('dashboard-no-data').style.display = state === 'no-data' ? 'block' : 'none';
    document.getElementById('dashboard-content').style.display = state === 'content' ? 'block' : 'none';
}

// Populate profile filter dropdown
function populateProfileFilter() {
    const select = document.getElementById('dashboard-profile-filter');
    const profiles = [...new Set(dashboardState.scans.map(s => s.profile))];

    select.innerHTML = '<option value="all">All Profiles</option>';
    profiles.forEach(profile => {
        select.innerHTML += `<option value="${escapeHtml(profile)}">${escapeHtml(profile)}</option>`;
    });
}

// Apply dashboard filters
function applyDashboardFilters() {
    dashboardState.profileFilter = document.getElementById('dashboard-profile-filter')?.value || 'all';
    dashboardState.sortBy = document.getElementById('dashboard-sort')?.value || 'date-desc';
    dashboardState.searchTerm = document.getElementById('dashboard-search')?.value?.toLowerCase() || '';

    // Filter scans
    let filtered = [...dashboardState.scans];

    if (dashboardState.profileFilter !== 'all') {
        filtered = filtered.filter(s => s.profile === dashboardState.profileFilter);
    }

    if (dashboardState.searchTerm) {
        filtered = filtered.filter(s =>
            s.scanId.toLowerCase().includes(dashboardState.searchTerm) ||
            s.profile.toLowerCase().includes(dashboardState.searchTerm) ||
            s.date.toLowerCase().includes(dashboardState.searchTerm)
        );
    }

    // Sort scans
    switch (dashboardState.sortBy) {
        case 'date-desc':
            filtered.sort((a, b) => b.scanId.localeCompare(a.scanId));
            break;
        case 'date-asc':
            filtered.sort((a, b) => a.scanId.localeCompare(b.scanId));
            break;
        case 'score-desc':
            filtered.sort((a, b) => b.score - a.score);
            break;
        case 'score-asc':
            filtered.sort((a, b) => a.score - b.score);
            break;
        case 'fail-desc':
            filtered.sort((a, b) => b.fail - a.fail);
            break;
        case 'fail-asc':
            filtered.sort((a, b) => a.fail - b.fail);
            break;
    }

    dashboardState.filteredScans = filtered;
    renderDashboard();
}

// Render the complete dashboard
function renderDashboard() {
    const scans = dashboardState.filteredScans;
    if (scans.length === 0) return;

    renderSummaryCards(scans);
    renderScoreTimeline(scans);
    renderStatusBreakdown(scans[0]); // Latest scan
    renderSeverityBreakdown(scans[0]); // Latest scan
    renderComparisonTable(scans);
}

// Render summary cards
function renderSummaryCards(scans) {
    const latest = scans[0];
    const previous = scans.length > 1 ? scans[1] : null;
    const bestScan = [...scans].sort((a, b) => b.score - a.score)[0];

    // Animated Gauge for Latest Score
    const gaugeValue = document.getElementById('gauge-value');
    const gaugeFill = document.getElementById('gauge-fill');
    if (gaugeValue && gaugeFill) {
        gaugeValue.textContent = latest.score.toFixed(0) + '%';
        // Calculate stroke-dashoffset (126 is full arc length, 0 is empty)
        const offset = 126 - (latest.score / 100) * 126;
        gaugeFill.style.strokeDashoffset = offset;
        gaugeFill.className = 'gauge-fill ' + getScoreClass(latest.score).replace('score-', '');
    }
    document.getElementById('latest-date').textContent = formatDate(latest.date);

    // Score Trend
    if (previous) {
        const change = latest.score - previous.score;
        const trendEl = document.getElementById('score-trend');
        const trendIcon = document.getElementById('trend-icon');

        if (change > 0) {
            trendEl.textContent = '+' + change.toFixed(1) + '%';
            trendEl.className = 'card-value positive';
            trendIcon.textContent = '📈';
        } else if (change < 0) {
            trendEl.textContent = change.toFixed(1) + '%';
            trendEl.className = 'card-value negative';
            trendIcon.textContent = '📉';
        } else {
            trendEl.textContent = '0%';
            trendEl.className = 'card-value neutral';
            trendIcon.textContent = '➡️';
        }
        document.getElementById('trend-detail').textContent = 'vs previous scan';
    } else {
        document.getElementById('score-trend').textContent = 'N/A';
        document.getElementById('score-trend').className = 'card-value neutral';
        document.getElementById('trend-detail').textContent = 'First scan';
    }

    // Total Scans
    document.getElementById('total-scans').textContent = scans.length;
    if (scans.length > 1) {
        const firstDate = formatDateShort(scans[scans.length - 1].date);
        const lastDate = formatDateShort(scans[0].date);
        document.getElementById('scan-range').textContent = `${firstDate} - ${lastDate}`;
    } else {
        document.getElementById('scan-range').textContent = formatDateShort(scans[0].date);
    }

    // Open Issues (total failures)
    const totalIssues = latest.fail + latest.error;
    document.getElementById('total-issues').textContent = totalIssues;
    document.getElementById('issues-detail').textContent = `${latest.highFail} high severity`;

    // Quick Stats Row
    document.getElementById('stat-pass').textContent = latest.pass;
    document.getElementById('stat-fail').textContent = latest.fail;
    document.getElementById('stat-high').textContent = latest.highFail;
    document.getElementById('stat-medium').textContent = latest.mediumFail;
    document.getElementById('stat-low').textContent = latest.lowFail;
    document.getElementById('stat-best').textContent = bestScan.score.toFixed(0) + '%';
}

// Render score timeline chart
function renderScoreTimeline(scans) {
    const container = document.getElementById('score-timeline');

    // Show last 20 scans (oldest to newest for timeline)
    const timelineScans = [...scans].slice(0, 20).reverse();
    const maxHeight = 80; // pixels - compact view

    let html = '';
    timelineScans.forEach((scan, index) => {
        const height = Math.max(20, (scan.score / 100) * maxHeight);
        const scoreClass = getScoreClass(scan.score);
        const shortDate = formatDateShort(scan.date);

        html += `
            <div class="timeline-bar-container">
                <div class="timeline-bar ${scoreClass}" style="height: ${height}px;">
                    <div class="bar-tooltip">
                        <strong>${scan.score.toFixed(1)}%</strong><br>
                        ${scan.date}<br>
                        Pass: ${scan.pass} | Fail: ${scan.fail}
                    </div>
                </div>
                <span class="timeline-bar-score">${scan.score.toFixed(0)}%</span>
                <span class="timeline-bar-label">${shortDate}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Get score class for color coding
function getScoreClass(score) {
    if (score >= 90) return 'score-excellent';
    if (score >= 75) return 'score-good';
    if (score >= 50) return 'score-fair';
    if (score >= 25) return 'score-poor';
    return 'score-critical';
}

// Render status breakdown (pass/fail/error bar)
function renderStatusBreakdown(scan) {
    const total = scan.pass + scan.fail + scan.error + scan.notApplicable;
    if (total === 0) return;

    const passPercent = (scan.pass / total) * 100;
    const failPercent = (scan.fail / total) * 100;
    const errorPercent = (scan.error / total) * 100;
    const otherPercent = 100 - passPercent - failPercent - errorPercent;

    // Status bar
    const statusBar = document.getElementById('status-bar');
    statusBar.innerHTML = `
        ${passPercent > 0 ? `<div class="status-segment pass" style="flex: ${passPercent};">${scan.pass}</div>` : ''}
        ${failPercent > 0 ? `<div class="status-segment fail" style="flex: ${failPercent};">${scan.fail}</div>` : ''}
        ${errorPercent > 0 ? `<div class="status-segment error" style="flex: ${errorPercent};">${scan.error}</div>` : ''}
        ${otherPercent > 0 ? `<div class="status-segment other" style="flex: ${otherPercent};">${scan.notApplicable}</div>` : ''}
    `;

    // Legend
    const legend = document.getElementById('status-legend');
    legend.innerHTML = `
        <div class="legend-item">
            <div class="legend-color pass"></div>
            <span class="legend-value">${scan.pass}</span>
            <span class="legend-label">Pass</span>
        </div>
        <div class="legend-item">
            <div class="legend-color fail"></div>
            <span class="legend-value">${scan.fail}</span>
            <span class="legend-label">Fail</span>
        </div>
        <div class="legend-item">
            <div class="legend-color error"></div>
            <span class="legend-value">${scan.error}</span>
            <span class="legend-label">Error</span>
        </div>
        <div class="legend-item">
            <div class="legend-color other"></div>
            <span class="legend-value">${scan.notApplicable}</span>
            <span class="legend-label">N/A</span>
        </div>
    `;
}

// Render severity breakdown (horizontal bars)
function renderSeverityBreakdown(scan) {
    const container = document.getElementById('severity-breakdown');
    const maxFail = Math.max(scan.highFail, scan.mediumFail, scan.lowFail, 1);

    container.innerHTML = `
        <div class="severity-row">
            <span class="severity-label high">High</span>
            <div class="severity-bar-bg">
                <div class="severity-bar-fill high" style="width: ${(scan.highFail / maxFail) * 100}%;">
                    ${scan.highFail > 0 ? scan.highFail : ''}
                </div>
            </div>
            <span class="severity-count">${scan.highFail}</span>
        </div>
        <div class="severity-row">
            <span class="severity-label medium">Medium</span>
            <div class="severity-bar-bg">
                <div class="severity-bar-fill medium" style="width: ${(scan.mediumFail / maxFail) * 100}%;">
                    ${scan.mediumFail > 0 ? scan.mediumFail : ''}
                </div>
            </div>
            <span class="severity-count">${scan.mediumFail}</span>
        </div>
        <div class="severity-row">
            <span class="severity-label low">Low</span>
            <div class="severity-bar-bg">
                <div class="severity-bar-fill low" style="width: ${(scan.lowFail / maxFail) * 100}%;">
                    ${scan.lowFail > 0 ? scan.lowFail : ''}
                </div>
            </div>
            <span class="severity-count">${scan.lowFail}</span>
        </div>
    `;
}

// Render comparison table
function renderComparisonTable(scans) {
    const tbody = document.getElementById('comparison-tbody');

    let html = '';
    scans.forEach((scan, index) => {
        const previous = scans[index + 1];
        let changeHtml = '<span class="change-badge neutral">--</span>';

        if (previous) {
            const change = scan.score - previous.score;
            if (change > 0) {
                changeHtml = `<span class="change-badge positive">+${change.toFixed(1)}%</span>`;
            } else if (change < 0) {
                changeHtml = `<span class="change-badge negative">${change.toFixed(1)}%</span>`;
            } else {
                changeHtml = '<span class="change-badge neutral">0%</span>';
            }
        }

        const scoreClass = getScoreClass(scan.score);

        html += `
            <tr>
                <td>${escapeHtml(scan.date)}</td>
                <td>${escapeHtml(scan.profile)}</td>
                <td class="score-cell ${scoreClass}">${scan.score.toFixed(1)}%</td>
                <td>${changeHtml}</td>
                <td>${scan.pass}</td>
                <td>${scan.fail}</td>
                <td><span class="severity-pill high">${scan.highFail}</span></td>
                <td><span class="severity-pill medium">${scan.mediumFail}</span></td>
                <td><span class="severity-pill low">${scan.lowFail}</span></td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-report-dash" data-scan-id="${scan.scanId}">Report</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // Add event listeners for report buttons
    tbody.querySelectorAll('.btn-report-dash').forEach(btn => {
        btn.addEventListener('click', function() {
            const scanId = this.dataset.scanId;
            const reportPath = `/usr/share/cockpit/cockpit-openscap/scans/${scanId}/report.html`;
            openReportInBrowser(reportPath);
        });
    });
}

// Format date for display
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateStr;
    }
}

// Format date short (for timeline)
function formatDateShort(dateStr) {
    if (!dateStr) return '?';
    try {
        const date = new Date(dateStr);
        return (date.getMonth() + 1) + '/' + date.getDate();
    } catch (e) {
        // Try to extract from scan ID format YYYYMMDD-HHMMSS
        if (dateStr.match(/^\d{8}-/)) {
            return dateStr.substring(4, 6) + '/' + dateStr.substring(6, 8);
        }
        return dateStr.substring(0, 5);
    }
}

// ============================================================================
// PURGE SCANS FUNCTIONALITY
// ============================================================================

function setupPurgeButton() {
    document.getElementById('btn-purge-scans')?.addEventListener('click', confirmPurgeScans);
}

function confirmPurgeScans() {
    // Create confirmation dialog
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <h3>⚠️ Purge All Scans?</h3>
            <p>This will permanently delete ALL scan data including reports, results, and remediation scripts. This action cannot be undone.</p>
            <p><strong>Tab 3 and Tab 4 will show no data after this.</strong></p>
            <div class="confirm-buttons">
                <button class="btn btn-outline" id="cancel-purge">Cancel</button>
                <button class="btn btn-danger" id="confirm-purge">Yes, Delete All</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('cancel-purge').addEventListener('click', () => {
        overlay.remove();
    });

    document.getElementById('confirm-purge').addEventListener('click', () => {
        overlay.remove();
        purgeAllScans();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function purgeAllScans() {
    const btn = document.getElementById('btn-purge-scans');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Deleting...';
    btn.disabled = true;

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/purge-scans.sh'],
        { superuser: 'require' })
        .then(output => {
            try {
                const result = JSON.parse(output);
                if (result.status === 'success') {
                    // Reset builder state
                    builderState.scanId = null;
                    builderState.findings = [];
                    builderState.selections.clear();
                    currentScanId = null;

                    // Update UI
                    showBuilderState('no-scan');
                    document.getElementById('builder-scan-info').innerHTML = '<span>No scan loaded</span>';

                    // Show success message
                    showSuccess(`Deleted ${result.deleted} scan(s)`);
                    alert(`Successfully deleted ${result.deleted} scan(s). Tab 3 and Tab 4 will now show no data.`);
                } else {
                    showError(result.message || 'Failed to purge scans');
                }
            } catch (e) {
                showError('Failed to parse purge response');
            }
        })
        .catch(error => {
            console.error('Purge error:', error);
            showError('Failed to purge scans: ' + error.message);
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

// ============================================================================
// TAB 5: SCHEDULED SCANS (CRON JOBS)
// ============================================================================

let cronProfiles = [];
let cronEventListenersSetup = false;

function loadCronTab() {
    console.log('Loading Cron Tab');
    loadCronProfiles();
    loadCronStatus();
    loadLogs();
    if (!cronEventListenersSetup) {
        setupCronEventListeners();
        cronEventListenersSetup = true;
    }
    updateSchedulePreview();
}

function setupCronEventListeners() {
    // Frequency radio buttons
    document.querySelectorAll('input[name="frequency"]').forEach(radio => {
        radio.addEventListener('change', handleFrequencyChange);
    });

    // Weekday picker
    document.querySelectorAll('input[name="weekday"]').forEach(radio => {
        radio.addEventListener('change', updateSchedulePreview);
    });

    // Month day picker
    document.getElementById('monthday')?.addEventListener('change', updateSchedulePreview);

    // Time picker
    document.getElementById('scan-hour')?.addEventListener('change', updateSchedulePreview);

    // Buttons
    document.getElementById('btn-save-cron')?.addEventListener('click', saveCronJob);
    document.getElementById('btn-remove-cron')?.addEventListener('click', removeCronJob);
    document.getElementById('btn-refresh-logs')?.addEventListener('click', loadLogs);
    document.getElementById('btn-clear-logs')?.addEventListener('click', clearLogs);
    document.getElementById('log-lines')?.addEventListener('change', loadLogs);
}

function handleFrequencyChange() {
    const frequency = document.querySelector('input[name="frequency"]:checked')?.value || 'daily';
    const daySelection = document.getElementById('day-selection');
    const weekdayPicker = document.getElementById('weekday-picker');
    const monthdayPicker = document.getElementById('monthday-picker');
    const timeStepNumber = document.getElementById('time-step-number');
    const dayLabel = document.getElementById('day-selection-label');

    if (frequency === 'daily') {
        daySelection.style.display = 'none';
        timeStepNumber.textContent = '3';
    } else if (frequency === 'weekly') {
        daySelection.style.display = 'block';
        weekdayPicker.style.display = 'flex';
        monthdayPicker.style.display = 'none';
        dayLabel.textContent = 'Which day of the week?';
        timeStepNumber.textContent = '4';
    } else if (frequency === 'monthly') {
        daySelection.style.display = 'block';
        weekdayPicker.style.display = 'none';
        monthdayPicker.style.display = 'flex';
        dayLabel.textContent = 'Which day of the month?';
        timeStepNumber.textContent = '4';
    }

    updateSchedulePreview();
}

function updateSchedulePreview() {
    const frequency = document.querySelector('input[name="frequency"]:checked')?.value || 'daily';
    const hour = parseInt(document.getElementById('scan-hour')?.value || '0');
    const weekday = document.querySelector('input[name="weekday"]:checked')?.value || '6';
    const monthday = document.getElementById('monthday')?.value || '1';

    const timeStr = formatHour(hour);
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthdayStr = getOrdinal(parseInt(monthday));

    let previewText = '';
    if (frequency === 'daily') {
        previewText = `Every day at ${timeStr}`;
    } else if (frequency === 'weekly') {
        previewText = `Every ${weekdayNames[parseInt(weekday)]} at ${timeStr}`;
    } else if (frequency === 'monthly') {
        previewText = `On the ${monthdayStr} of each month at ${timeStr}`;
    }

    document.getElementById('schedule-preview-text').textContent = previewText;
}

function formatHour(hour) {
    if (hour === 0) return '12:00 AM (Midnight)';
    if (hour === 12) return '12:00 PM (Noon)';
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
}

function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function loadCronProfiles() {
    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/list-profiles.sh'],
        { superuser: 'try' })
        .then(output => {
            cronProfiles = JSON.parse(output);
            const select = document.getElementById('cron-profile');
            select.innerHTML = '';

            if (cronProfiles.length === 0) {
                select.innerHTML = '<option value="">No profiles available</option>';
                return;
            }

            cronProfiles.forEach(profile => {
                select.innerHTML += `<option value="${profile.id}" data-datastream="${profile.datastream}">${profile.title}</option>`;
            });
        })
        .catch(error => {
            console.error('Error loading cron profiles:', error);
            document.getElementById('cron-profile').innerHTML = '<option value="">Failed to load profiles</option>';
        });
}

function loadCronStatus() {
    const container = document.getElementById('cron-status');
    const removeBtn = document.getElementById('btn-remove-cron');
    const saveBtn = document.getElementById('btn-save-cron');

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/manage-cron.sh', 'get'],
        { superuser: 'require' })
        .then(output => {
            try {
                const status = JSON.parse(output);

                if (status.enabled) {
                    // Parse schedule for human-readable display
                    const scheduleDesc = parseScheduleDescription(status.schedule, status.profile);

                    container.innerHTML = `
                        <div class="cron-status-active">
                            <div class="cron-status-info">
                                <span class="cron-status-icon">✅</span>
                                <div class="cron-status-details">
                                    <strong>Automatic Scanning is ON</strong>
                                    <span>${scheduleDesc}</span>
                                    <span>Profile: ${escapeHtml(status.profile)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    removeBtn.style.display = 'inline-flex';
                    saveBtn.innerHTML = '🔄 Update Schedule';
                } else {
                    container.innerHTML = `
                        <div class="cron-status-inactive">
                            <span class="status-icon">⏸️</span>
                            <span>Automatic scanning is not configured. Set up a schedule below.</span>
                        </div>
                    `;
                    removeBtn.style.display = 'none';
                    saveBtn.innerHTML = '✅ Enable Scheduled Scan';
                }
            } catch (e) {
                container.innerHTML = `
                    <div class="cron-status-inactive">
                        <span class="status-icon">⚠️</span>
                        <span>Unable to read schedule status</span>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading cron status:', error);
            container.innerHTML = `
                <div class="cron-status-inactive">
                    <span class="status-icon">❌</span>
                    <span>Error loading status</span>
                </div>
            `;
        });
}

function parseScheduleDescription(cronExpr, profile) {
    // Parse cron expression: minute hour day month weekday
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return cronExpr;

    const [minute, hour, day, month, weekday] = parts;
    const hourNum = parseInt(hour);
    const timeStr = formatHour(hourNum);

    if (day === '*' && month === '*' && weekday === '*') {
        return `Runs daily at ${timeStr}`;
    } else if (day === '*' && month === '*' && weekday !== '*') {
        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Runs every ${weekdayNames[parseInt(weekday)]} at ${timeStr}`;
    } else if (day !== '*' && month === '*') {
        return `Runs on the ${getOrdinal(parseInt(day))} of each month at ${timeStr}`;
    }

    return `Schedule: ${cronExpr}`;
}

function getCronExpression() {
    const frequency = document.querySelector('input[name="frequency"]:checked')?.value || 'daily';
    const hour = document.getElementById('scan-hour')?.value || '0';
    const weekday = document.querySelector('input[name="weekday"]:checked')?.value || '0';
    const monthday = document.getElementById('monthday')?.value || '1';

    // Cron format: minute hour day-of-month month day-of-week
    switch (frequency) {
        case 'daily':
            return `0 ${hour} * * *`;
        case 'weekly':
            return `0 ${hour} * * ${weekday}`;
        case 'monthly':
            return `0 ${hour} ${monthday} * *`;
        default:
            return `0 ${hour} * * *`;
    }
}

function saveCronJob() {
    const profileSelect = document.getElementById('cron-profile');
    const selectedOption = profileSelect.options[profileSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        showError('Please select a security profile');
        return;
    }

    const profileId = selectedOption.value;
    const datastream = selectedOption.dataset.datastream;
    const cronExpr = getCronExpression();

    const btn = document.getElementById('btn-save-cron');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Saving...';
    btn.disabled = true;

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/manage-cron.sh',
        'set', cronExpr, datastream, profileId], { superuser: 'require' })
        .then(output => {
            try {
                const result = JSON.parse(output);
                if (result.status === 'success') {
                    loadCronStatus();
                    alert('Schedule saved successfully!');
                } else {
                    showError(result.message || 'Failed to save schedule');
                }
            } catch (e) {
                showError('Failed to parse response');
            }
        })
        .catch(error => {
            console.error('Save cron error:', error);
            showError('Failed to save schedule: ' + error.message);
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

function removeCronJob() {
    if (!confirm('Remove the scheduled scan?')) return;

    const btn = document.getElementById('btn-remove-cron');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Removing...';
    btn.disabled = true;

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/manage-cron.sh', 'remove'],
        { superuser: 'require' })
        .then(output => {
            loadCronStatus();
            alert('Schedule removed');
        })
        .catch(error => {
            console.error('Remove cron error:', error);
            showError('Failed to remove schedule: ' + error.message);
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

// ============================================================================
// LOG VIEWER
// ============================================================================

function loadLogs() {
    const lines = document.getElementById('log-lines')?.value || '50';
    const logContent = document.getElementById('log-content');

    logContent.textContent = 'Loading logs...';

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/get-logs.sh', lines],
        { superuser: 'require' })
        .then(output => {
            if (output.trim()) {
                // Add some color highlighting
                const highlighted = output
                    .replace(/ERROR/g, '<span class="log-error">ERROR</span>')
                    .replace(/WARNING/g, '<span class="log-warning">WARNING</span>')
                    .replace(/SUCCESS/g, '<span class="log-success">SUCCESS</span>')
                    .replace(/INFO/g, '<span class="log-info">INFO</span>')
                    .replace(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/g, '<span class="log-timestamp">[$1]</span>');

                logContent.innerHTML = highlighted;
            } else {
                logContent.textContent = 'No logs available';
            }

            // Scroll to bottom
            const viewer = document.getElementById('log-viewer');
            viewer.scrollTop = viewer.scrollHeight;
        })
        .catch(error => {
            console.error('Load logs error:', error);
            logContent.textContent = 'Failed to load logs: ' + error.message;
        });
}

function clearLogs() {
    if (!confirm('Clear all diagnostic logs?')) return;

    cockpit.spawn(['bash', '/usr/share/cockpit/cockpit-openscap/scripts/get-logs.sh', '0', 'clear'],
        { superuser: 'require' })
        .then(() => {
            loadLogs();
        })
        .catch(error => {
            console.error('Clear logs error:', error);
            showError('Failed to clear logs: ' + error.message);
        });
}
