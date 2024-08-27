#! /bin/bash
set -e

# read script arguments into tableName and localCsvFile from user
tableName=$1
localCsvFile=$2
CMS_MYSQL_PASSWORD=$3
COLUMNS=$4

echo "tableName: $tableName"
echo "localCsvFile: $localCsvFile"
echo "CMS_MYSQL_PASSWORD: $CMS_MYSQL_PASSWORD"

# bash db-upload-to-cms.sh nspc_top_students output/student-lists/20-scorer-student-list/list-20.csv 'PASSWORD' 'assessmentId,name,grade,language,state,city,institute,gender'
# bash db-upload-to-cms.sh nspc_institutes output/reports/institute-wise-normalized-name-at-least-10-registrations.csv 'PASSWORD' 'name,city,state,registration_count'
#

if [ -z "$tableName" ] || [ -z "$localCsvFile" ] || [ -z "$CMS_MYSQL_PASSWORD" ]; then
    echo "Usage: $0 <tableName> <localCsvFile> <CMS_MYSQL_PASSWORD>"
    exit 1
fi

CMS_IP=139.59.21.157
CMS_MYSQL_USER=emroot
CMS_MYSQL_HOST=127.0.0.1
CMS_MYSQL_DB=emv2
#number of records in local csv file
localRows=$(wc -l < $localCsvFile)
echo "Number of rows in local csv file: $localRows"

# run the mysql command on remote server using ssh

CMS_MYSQL_CMD="mysql -u $CMS_MYSQL_USER -p'$CMS_MYSQL_PASSWORD' $CMS_MYSQL_DB --host=$CMS_MYSQL_HOST"

# Get the column names from the table
TABLE_COLUMNS=$(ssh root@$CMS_IP "$CMS_MYSQL_CMD -se \"DESCRIBE $tableName;\" | awk '{print \$1}' | tr '\n' ',' | sed 's/,$//'")
CSV_COLUMNS=$(head -1 $localCsvFile | tr ',' '\n' | sed 's/^ *//' | tr '\n' ',' | sed 's/,$//')

echo "CSV columns   : $CSV_COLUMNS"
echo "Table columns : $TABLE_COLUMNS"
echo "Columns Order : $COLUMNS"

# ask user to confirm if the column names order is correct
read -p "Are the column names in the correct order? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Please update the script with the correct column names"
    exit 1
fi

# Construct the IMPORT_CMD with the column names
IMPORT_CMD="LOAD DATA INFILE '/var/lib/mysql-files/$tableName.csv' 
INTO TABLE $tableName 
FIELDS TERMINATED BY ',' 
OPTIONALLY ENCLOSED BY '\\\"' 
LINES TERMINATED BY '\\n' 
IGNORE 1 ROWS
($COLUMNS)"

echo "Import command: $IMPORT_CMD"

# upload the local csv file to the mysql server
echo "Uploading $localCsvFile to $CMS_IP:/var/lib/mysql-files/$tableName.csv"
scp $localCsvFile root@$CMS_IP:/var/lib/mysql-files/$tableName.csv
echo "Uploaded successfully"

# truncate the existing table
echo "Truncating table $tableName"
ssh root@$CMS_IP "$CMS_MYSQL_CMD -e \"TRUNCATE TABLE $tableName;\""
echo "Truncated successfully"

echo "Loading data from /var/lib/mysql-files/$tableName.csv into $tableName"
ssh root@$CMS_IP "$CMS_MYSQL_CMD -e \"$IMPORT_CMD\""
echo "Data loaded successfully"

# list number of rows in the table
rows=$(ssh root@$CMS_IP "$CMS_MYSQL_CMD -se \"SELECT COUNT(*) FROM $tableName;\"")
echo "Number of rows in $tableName: $rows"

