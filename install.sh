#!/bin/bash

# OpenSCAP Cockpit Plugin Installation Script
# Version 5.0.1 - Preserves scan history on upgrade
# License: Business Source License 1.1 - see LICENSE file.

PLUGIN_NAME="cockpit-openscap"
INSTALL_DIR="/usr/share/cockpit/${PLUGIN_NAME}"
LOG_DIR="/var/log/${PLUGIN_NAME}"
LOG_FILE="${LOG_DIR}/install-$(date +%Y%m%d-%H%M%S).log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root first
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR]${NC} This script must be run as root (sudo)"
   exit 1
fi

# Create log directory
mkdir -p "${LOG_DIR}" 2>/dev/null
chmod 755 "${LOG_DIR}" 2>/dev/null

# Function to log messages
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}" 2>/dev/null
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null
}

echo ""
log "=========================================="
log "OpenSCAP Cockpit Plugin Installer v4.5.2"
log "=========================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a package is installed (RHEL/CentOS/Fedora)
package_installed() {
    rpm -q "$1" >/dev/null 2>&1
}

# Detect package manager
if command_exists dnf; then
    PKG_MGR="dnf"
elif command_exists yum; then
    PKG_MGR="yum"
else
    log_error "No supported package manager found (dnf/yum)"
    exit 1
fi

log "Package manager: ${PKG_MGR}"

# Array to track what needs to be installed
MISSING_PACKAGES=()

# Check prerequisites
log "Checking prerequisites..."

# Check for Cockpit
if ! command_exists cockpit-bridge; then
    MISSING_PACKAGES+=("cockpit")
else
    log_success "Cockpit installed"
fi

# Check for OpenSCAP
if ! command_exists oscap; then
    MISSING_PACKAGES+=("openscap-scanner")
else
    log_success "OpenSCAP installed"
fi

# Check for SCAP Security Guide
if ! package_installed scap-security-guide; then
    MISSING_PACKAGES+=("scap-security-guide")
else
    log_success "SCAP Security Guide installed"
fi

# Check for xmllint (required for parsing)
if ! command_exists xmllint; then
    MISSING_PACKAGES+=("libxml2")
else
    log_success "xmllint installed"
fi

# Check for jq (used by list-scans.sh)
if ! command_exists jq; then
    MISSING_PACKAGES+=("jq")
else
    log_success "jq installed"
fi

# Install missing packages
if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    log "Installing: ${MISSING_PACKAGES[*]}"

    for package in "${MISSING_PACKAGES[@]}"; do
        if ${PKG_MGR} install -y "${package}" >> "${LOG_FILE}" 2>&1; then
            log_success "${package} installed"
        else
            log_error "Failed to install ${package}"
            exit 1
        fi
    done
else
    log_success "All prerequisites satisfied"
fi

# Preserve existing scans before upgrade
SCANS_BACKUP=""
if [ -d "${INSTALL_DIR}/scans" ]; then
    SCAN_COUNT=$(find "${INSTALL_DIR}/scans" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
    if [ "${SCAN_COUNT}" -gt 0 ]; then
        log "Preserving ${SCAN_COUNT} existing scan(s)..."
        SCANS_BACKUP="/tmp/cockpit-openscap-scans-backup-$$"
        mv "${INSTALL_DIR}/scans" "${SCANS_BACKUP}"
    fi
fi

# Remove old installation if exists
if [ -d "${INSTALL_DIR}" ]; then
    log "Removing previous installation..."
    rm -rf "${INSTALL_DIR}"
fi

# Create plugin directory
log "Installing plugin to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/scripts"

# Restore preserved scans or create empty scans directory
if [ -n "${SCANS_BACKUP}" ] && [ -d "${SCANS_BACKUP}" ]; then
    log "Restoring preserved scans..."
    mv "${SCANS_BACKUP}" "${INSTALL_DIR}/scans"
    log_success "Scan history preserved"
else
    mkdir -p "${INSTALL_DIR}/scans"
fi

# Copy plugin files (excluding install/uninstall scripts and tarballs)
cp "${SCRIPT_DIR}/manifest.json" "${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/index.html" "${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/openscap.js" "${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/openscap.css" "${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/VERSION" "${INSTALL_DIR}/" 2>/dev/null
cp "${SCRIPT_DIR}/scripts/"*.sh "${INSTALL_DIR}/scripts/"

# Set permissions
log "Setting permissions..."
chown -R root:root "${INSTALL_DIR}"
chmod 755 "${INSTALL_DIR}"
chmod 755 "${INSTALL_DIR}/scripts"
chmod 755 "${INSTALL_DIR}/scans"
chmod 644 "${INSTALL_DIR}"/*.html
chmod 644 "${INSTALL_DIR}"/*.css
chmod 644 "${INSTALL_DIR}"/*.js
chmod 644 "${INSTALL_DIR}"/*.json
chmod 644 "${INSTALL_DIR}/VERSION" 2>/dev/null
chmod 755 "${INSTALL_DIR}/scripts/"*.sh

# Ensure log directory is writable
chmod 755 "${LOG_DIR}"

# Enable and start Cockpit if not running
log "Configuring Cockpit service..."
systemctl enable cockpit.socket >> "${LOG_FILE}" 2>&1
systemctl start cockpit.socket >> "${LOG_FILE}" 2>&1

if systemctl is-active cockpit.socket >/dev/null 2>&1; then
    log_success "Cockpit service running"
else
    log_warning "Cockpit service may need manual start"
fi

# Configure firewall if firewalld is running
if systemctl is-active firewalld >/dev/null 2>&1; then
    log "Configuring firewall..."
    firewall-cmd --permanent --add-service=cockpit >> "${LOG_FILE}" 2>&1
    firewall-cmd --reload >> "${LOG_FILE}" 2>&1
    log_success "Firewall configured"
fi

# Get installed version
VERSION=$(cat "${INSTALL_DIR}/VERSION" 2>/dev/null || echo "4.3.0")

echo ""
log "=========================================="
log_success "Installation complete! v${VERSION}"
log "=========================================="
echo ""
log "Access at: https://$(hostname -f 2>/dev/null || hostname):9090"
log "Navigate to: Tools > OpenSCAP"
echo ""

exit 0
