# Quick Start Guide - OpenSCAP Cockpit Plugin

## Installation (3 Easy Steps)

### Step 1: Extract the Files
```bash
tar -xzf cockpit-openscap.tar.gz
cd cockpit-openscap
```

### Step 2: Run the Installer
```bash
sudo ./install.sh
```

The installer will automatically:
- ✓ Check for prerequisites (Cockpit, OpenSCAP, SCAP Security Guide, etc.)
- ✓ Install any missing packages
- ✓ Copy plugin files to the correct location
- ✓ Set proper permissions
- ✓ Configure Cockpit and firewall
- ✓ Create log directories
- ✓ Generate installation logs for troubleshooting

### Step 3: Access the Plugin
1. Open your browser and go to: **https://your-server:9090**
2. Log in with your system credentials
3. Click **"OpenSCAP"** in the left navigation menu

## First Scan

1. **System Information** is automatically detected
2. **Select a Profile** from the list (e.g., "Standard System Security Profile")
3. Click **"Start Security Scan"**
4. Wait for the scan to complete (progress bar shows status)
5. View results and download:
   - HTML Report
   - XCCDF Results
   - Bash Remediation Script
   - Ansible Playbook

## Example Workflow

```bash
# 1. Install the plugin
sudo ./install.sh

# 2. Access Cockpit in browser
# https://your-server:9090

# 3. In the UI:
#    - Select "OpenSCAP" from menu
#    - Choose profile: "PCI-DSS v3.2.1 Control Baseline"
#    - Click "Start Security Scan"
#    - Wait for completion

# 4. Download remediation script
#    - Click "Download Bash Remediation Script"

# 5. Review and apply remediation
less remediation.sh
sudo bash remediation.sh

# OR use Ansible for multiple servers
ansible-playbook -i inventory remediation.yml
```

## Viewing Logs

Installation logs:
```bash
sudo tail -f /var/log/cockpit-openscap/install-*.log
```

Scan logs:
```bash
sudo tail -f /var/log/cockpit-openscap/scan-*.log
```

## Troubleshooting

**Problem**: Cannot access Cockpit
```bash
# Check if Cockpit is running
sudo systemctl status cockpit.socket

# Start if needed
sudo systemctl start cockpit.socket

# Check firewall
sudo firewall-cmd --list-services
```

**Problem**: No security profiles found
```bash
# Install SCAP Security Guide
sudo dnf install scap-security-guide

# Verify installation
ls -la /usr/share/xml/scap/ssg/content/
```

**Problem**: Scan fails
```bash
# Check logs for details
sudo cat /var/log/cockpit-openscap/scan-*.log

# Verify OpenSCAP is working
oscap --version
```

## Uninstallation

```bash
sudo ./uninstall.sh
```

## Need Help?

- Check the full **README.md** for detailed documentation
- Review logs in `/var/log/cockpit-openscap/`
- Ensure all prerequisites are installed: `oscap --version`

## Supported Systems

- ✓ Red Hat Enterprise Linux 7, 8, 9
- ✓ CentOS 7, 8, 9 (Stream)  
- ✓ Fedora (recent releases)
- ✓ Rocky Linux 8, 9
- ✓ AlmaLinux 8, 9

---

**WARNING**: Always review remediation scripts before executing them in production!
Test in a non-production environment first and create backups.
