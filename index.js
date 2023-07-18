const fs = require("fs");
const csvParse = require("csv-parse");
const FuzzySet = require("fuzzyset");



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

  //remove cioty names
  name = name.replace(city.toLowerCase(), "");

  //remove non alpha-numeric, with space
  name = name.replace("/[^a-z0-9 ]/g", " ");

  return name;
}

function mergeRecords(csvData) {
  const mergedData = [];
  
  let matches = [];
  let count = 1;


  //empty log file
  fs.writeFileSync("output/matches.log", "");

  const pincodeFuzzymap = {};
  csvData.forEach((row, index) => {
    const [nameWithPincode, count, origName, pincode, city] = row;

    const name = cleanName(origName,city);
    //use seperate fuzzyset for every pincode
    if(pincodeFuzzymap[pincode] === undefined){
      pincodeFuzzymap[pincode] = FuzzySet();
    }
    const fuzzyMap = pincodeFuzzymap[pincode];

    if (index && index % 10000 == 0) {
      console.log(
        "Processed:",
        index,
        "Normalized:",
        Object.values(finalData).length
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
    fs.writeFileSync(
      "output/out.csv",
      Object.values(finalData)
        .map((record) => '"'+Object.values(record).join('","')+'"')
        .join("\n")
    );

    console.timeEnd("Execution Time");
  });
  

});
