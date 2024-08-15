#!/bin/bash

# Variables
SSH_USER="root"
SSH_HOST="139.59.21.153"
SSH_PORT="22" # Default SSH port

REMOTE_DB_HOST="10.122.0.2" # Replace with the desired remote localhost
REMOTE_DB_PORT="27017" # Remote MongoDB port

LOCAL_DB_HOST="localhost" # Local MongoDB host
LOCAL_DB_PORT="27018" # Local port for the SSH tunnel
DB_NAME="ecomitram"
OUTPUT_DIR="./input"

# Establish SSH tunnel
ssh -f -N -L ${LOCAL_DB_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT} ${SSH_USER}@${SSH_HOST} -p ${SSH_PORT}

# Export data using mongodump
mongodump --host ${LOCAL_DB_HOST} --port ${LOCAL_DB_PORT} --db ${DB_NAME} --out ${OUTPUT_DIR}

#export data using aggregation query
COLLECTION="assessments"
QUERY='[
  {
    $match:
      /**
       * query: The query in MQL.
       */
      {
        module: "nspc",
        type: "nspc24",
        $expr: {
          $lte: [
            {
              $toDate: "$c_at"
            },
            // Convert creation date field to Date
            ISODate("2024-08-31T00:00:00Z") // Specify the date you want to match
          ]
        }
      }
  },
  {
    $project:
      /**
       * specifications: The fields to
       *   include or exclude.
       */
      {
        institutionName:"$participant.institutionName",
        gender: "$participant.gender",
        class: "$participant.class",
        score: "$result.score",
        pincode: "$participant.location.pincode",
        city: "$participant.location.city",
        state: "$participant.location.state",
        count: "1"
      }
  }
]'
OUTPUT_FILE="${OUTPUT_DIR}/users.json"

mongoexport --host ${LOCAL_DB_HOST} --port ${LOCAL_DB_PORT} --db ${DB_NAME} --collection ${COLLECTION} --query "$QUERY" --out ${OUTPUT_FILE}


# Close the SSH tunnel (optional, as it will close when the SSH session ends)
ssh -O exit -L ${LOCAL_DB_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT} ${SSH_USER}@${SSH_HOST} -p ${SSH_PORT}

echo "Data export completed. Files are located in ${OUTPUT_DIR}"