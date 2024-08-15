const { MongoClient } = require("mongodb");
const fs = require('fs');
const { Transform } = require('stream');
const { exit } = require("process");

//read arguments from command line ${LOCAL_DB_HOST} ${LOCAL_DB_PORT} ${DB_NAME} ${OUTPUT_FILE}
const args = process.argv.slice(2);
const LOCAL_DB_HOST = args[0];
const LOCAL_DB_PORT = args[1];
const DB_NAME = args[2];
const OUTPUT_FILE = args[3];

console.log('Starting script with arguments:');
console.log(`LOCAL_DB_HOST: ${LOCAL_DB_HOST}`);
console.log(`LOCAL_DB_PORT: ${LOCAL_DB_PORT}`);
console.log(`DB_NAME: ${DB_NAME}`);
console.log(`OUTPUT_FILE: ${OUTPUT_FILE}`);



async function writeToCsvFile(data, filename, headers = []) {
    await new Promise((resolve, reject) => {
        const transform = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                const values = headers.map(function(header){
                    let v = chunk[header] || '';
                    v = v + '';
                    v = v.replaceAll('"', ' ');
                    return '"' + v + '"';
                });
                this.push(`${values.join(',')}\n`);
                callback();
            }
        });
        const writeStream = fs.createWriteStream(filename);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        if (headers.length > 0) {
            writeStream.write(`${headers.join(',')}\n`);
        }
        data.forEach(item => transform.write(item));
        transform.end();
        transform.pipe(writeStream);
    });
}


async function fetchData() {
  const agg = [
    {
      '$match': {
        'module': 'nspc', 
        'type': 'nspc24', 
        '$expr': {
          '$lte': [
            {
              '$toDate': '$c_at'
            }, new Date('Sat, 31 Aug 2024 00:00:00 GMT')
          ]
        }
      }
    }, {
      '$project': {
        'institutionName': '$participant.institutionName', 
        'gender': '$participant.profile.gender', 
        'class': '$participant.class', 
        'registrationType': '$participant.registrationType',
        'score': '$result.score', 
        'city': '$participant.location.city', 
        'state': '$participant.location.state', 
      }
    }
  ];
  // get Object keys from $project
  const keys = Object.keys(agg[1].$project);
  console.log('keys:', keys);
  
  console.log("Connecting to db");
  const client = await MongoClient.connect(`mongodb://${LOCAL_DB_HOST}:${LOCAL_DB_PORT}`);
  const coll = client.db(DB_NAME).collection('assessments');
  console.log("Connected to db");

  console.log("Running query");
  const cursor = coll.aggregate(agg);

  console.log("Fetching data");
  const result = await cursor.toArray();
  
  // write to file
  const fs = require('fs');
  console.log("Writing data to file");
  //write as CSV

    try {
        await writeToCsvFile(result, OUTPUT_FILE, keys);
        console.log('The CSV file was written successfully.');
    } catch (e) {
        console.error('An error occurred while writing the CSV file.', e);
    }finally{
        console.log('Closing connection');
        await client.close(true); // Close the connection pool
        console.log('Connection closed');
    }

}

fetchData();