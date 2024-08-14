const fs = require("fs");
const csvParse = require("csv-parse");
const FuzzySet = require("fuzzyset");
const districtsMap = require('./mapper.json');
const { exit } = require("process");

console.log('districtsMap: ', districtsMap);
const finalData = {};
function saveRecord(row, matchedName)
{
  if(finalData[matchedName] !== undefined){
    //record already exist, merge
    finalData[matchedName][1] = parseInt(finalData[matchedName][1])+parseInt(row[1]);//count column
  }else{
    //insert new record
    finalData[matchedName] = row;
  }
}

function cleanName(name, city) {
  name = name.trim();

  //lowercase
  name = name.toLowerCase();

  name = name.replaceAll('-', ' ')
  name = name.replaceAll('.', ' ')
  name = name.replaceAll('"', '')
  name = name.replaceAll(',', '')

  //remove city names
  name = name.replaceAll(city.toLowerCase(), "");

  //remove school word
  name = name.replaceAll('school', "");

  //remove non alpha-numeric, with space
  name = name.replace("/[^a-z0-9 ]/g", " ");
  
  name = name.trim();
  return name;
}

function mergeRecords(csvData) {
  const mergedData = [];
  
  let matches = [];
  let count = 1;


  //empty log file
  fs.writeFileSync("output/matches.log", "");

  const cityFuzzyMap = {};
  csvData.forEach((row, index) => {
    const [nameWithCity, count, origName, pincode, city, state] = row;

    const name = cleanName(origName,city);
    //use seperate fuzzyset for every city
    let fuzzyMapKey = `${city}:${state}`;
    if (cityFuzzyMap[fuzzyMapKey] === undefined) {
      cityFuzzyMap[fuzzyMapKey] = FuzzySet();
    }
    const fuzzyMap = cityFuzzyMap[fuzzyMapKey];

    if (index && index % 10000 == 0) {
      console.log(
        "Processed:",
        index,
        "  Normalized: ",
        Object.values(finalData).length,
        "  Percentage:", (100 * Object.values(finalData).length / index).toFixed(2)
      );
    }
    // Check if there is a fuzzy match for the name
    matches = fuzzyMap.get(name, null, 0.75);
    if (matches) {
      //already have a match
      fs.appendFileSync(
        "output/matches.log",
        `${matches[0][1]}, ${name}, score:${matches[0][0]}` + "\n",
        (err) => {
          if (err) {
            console.error(err);
          }
        }
      );
      saveRecord(row, matches[0][1]);
    } else {
      fuzzyMap.add(name);
      saveRecord(row,name);
    }
  });

  console.log(
    "Original Items:",
    csvData.length,
    "Matched Items:",
    Object.values(finalData).length
  );

  return finalData;
}

// Read the CSV file
console.time("Execution Time");

//_id,registration_count,name,pincode,city
// fs.writeFileSync("output/out.csv", "_id,registration_count,name,pincode,city\n");

fs.readFile("input/nspc.csv", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  // Parse the CSV data
  csvParse(data, { delimiter: "," }, (err, csvData) => {
    if (err) {
      console.error(err);
      return;
    }

    mergeRecords(csvData);
    console.timeEnd("Execution Time");
    fs.writeFileSync(
      `output/out.csv`,
      "id,registration_count,name,city,state\n" +
      Object.values(finalData)
        .map(function (record, id) {

          let [nameWithCity, registration_count, origName, pincode, city, state] = record;
          // console.log('record: ', record);
          origName = origName.replaceAll('"', '').replaceAll(',', ' ').trim();
          city = city.replaceAll('"', '').replaceAll(',', ' ').trim();
          registration_count = parseInt(registration_count) || 0;
          state = state.replaceAll('state:', '').replaceAll('(', '').replaceAll(')', '');
          return `${id + 1}, ${registration_count},${origName},${city},${state}`;
        })
        .join("\n")
    );


  });
  

});


/*

mlr --csv sort -n  registration_count output/out.csv > output/out-sorted.csv

scp output/out.csv root@139.59.21.157:/var/lib/mysql-files/nspcout.csv


LOAD DATA INFILE '/var/lib/mysql-files/nspcout.csv'
INTO TABLE nspc_institutes
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;


 */