#!/bin/bash

# OpenSCAP Cockpit Plugin Uninstallation Script

PLUGIN_NAME="cockpit-openscap"
INSTALL_DIR="/usr/share/cockpit/${PLUGIN_NAME}"
LOG_DIR="/var/log/${PLUGIN_NAME}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=========================================="
echo "OpenSCAP Cockpit Plugin Uninstaller"
echo -e "==========================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR]${NC} This script must be run as root"
   exit 1
fi

echo "This will remove the OpenSCAP Cockpit Plugin."
echo ""
echo "The following will be removed:"
echo "  - Plugin files: ${INSTALL_DIR}"
echo "  - Logs: ${LOG_DIR}"
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

echo ""
echo "Uninstalling plugin..."

# Remove plugin directory
if [ -d "${INSTALL_DIR}" ]; then
    echo -e "${GREEN}[OK]${NC} Removing plugin files..."
    rm -rf "${INSTALL_DIR}"
else
    echo -e "${YELLOW}[WARN]${NC} Plugin directory not found: ${INSTALL_DIR}"
fi

# Ask about logs
echo ""
read -p "Do you want to remove logs as well? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "${LOG_DIR}" ]; then
        echo -e "${GREEN}[OK]${NC} Removing logs..."
        rm -rf "${LOG_DIR}"
    else
        echo -e "${YELLOW}[WARN]${NC} Log directory not found: ${LOG_DIR}"
    fi
else
    echo -e "${GREEN}[OK]${NC} Logs preserved in ${LOG_DIR}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Uninstallation completed!"
echo -e "==========================================${NC}"
echo ""
echo "The plugin has been removed from Cockpit."
echo "Refresh your browser to see the changes."
echo ""

exit 0
