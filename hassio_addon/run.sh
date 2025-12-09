#!/usr/bin/with-contenv bashio
# ==============================================================================
# Home Assistant Community Add-on: Roehn Automacao
#
# This script starts the application.
# ==============================================================================

bashio::log.info "Starting Roehn Automacao..."

# Start the application
python3 /app/app.py
