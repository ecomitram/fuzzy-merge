#!/bin/bash
set -e

# Variables
SSH_USER="root"
SSH_HOST="139.59.21.153"
SSH_PORT="22" # Default SSH port

REMOTE_DB_HOST="10.122.0.2" # Replace with the desired remote localhost
REMOTE_DB_PORT="27017" # Remote MongoDB port

LOCAL_DB_HOST="127.0.0.1" # Local MongoDB host
LOCAL_DB_PORT="27019" # Local port for the SSH tunnel
DB_NAME="ecomitram"
OUTPUT_DIR="./input/assessments.csv" # Output directory for the dump

#kill existing ssh tunnel

#close open port
echo "Closing port ${LOCAL_DB_PORT}"
#lsof -i :${LOCAL_DB_PORT} | grep LISTEN | awk '{print $2}' | xargs kill

# Establish SSH tunnel
echo "Establishing SSH tunnel..."
ssh -f -N -L ${LOCAL_DB_HOST}:${LOCAL_DB_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT} ${SSH_USER}@${SSH_HOST} -p ${SSH_PORT}

# Export the MongoDB data
echo "Exporting data from MongoDB..."
node ./db-export.js ${LOCAL_DB_HOST} ${LOCAL_DB_PORT} ${DB_NAME} ${OUTPUT_DIR}

# Close the SSH tunnel (optional, as it will close when the SSH session ends)
echo "Closing SSH tunnel..."
ssh -S none -O exit -L ${LOCAL_DB_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT} ${SSH_USER}@${SSH_HOST} -p ${SSH_PORT}

echo "Data export completed. Files are located in ${OUTPUT_DIR}"