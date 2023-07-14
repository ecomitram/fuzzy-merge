const fs = require("fs");
const csvParse = require("csv-parse");
const FuzzySet = require("fuzzyset");

function mergeRecords(csvData) {
  const mergedData = [];
  const fuzzyMap = FuzzySet();
  let matches = [];
  let count = 1;

  //empty log file
  fs.writeFileSync("matches.log", "");

  csvData.forEach((row, index) => {
    //bhabha bhopal (465691),1,Bhabha Bhopal,465691,Rajgarh
    const [name, count, school, pincode, city] = row;

    if (index % 1000 == 0) {
      console.log("processed:", index, "Matched Items:", fuzzyMap.length());
    }
    // Check if there is a fuzzy match for the name
    //console.log("Checking:", name);
    matches = fuzzyMap.get(name, null, 0.75);
    if (matches) {
      //already have a match
      fs.appendFileSync(
        "matches.log",
        `${matches[0][1]}, ${name}, score:${matches[0][0]}` + "\n",
        (err) => {
          if (err) {
            console.error(err);
          }
        }
      );
    } else {
      //console.log("XXX No Matching", name);
      fuzzyMap.add(name);
    }
  });

  console.log(
    "Original Items:",
    csvData.length,
    "Matched Items:",
    fuzzyMap.length()
  );

  fs.writeFileSync("matches.txt", fuzzyMap.values().join("\n"));
  // fuzzyMap.forEach((value) => {
  //   mergedData.push([value.name, value.count]);
  // });

  // return mergedData;
}

// Read the CSV file
fs.readFile("nspc.csv", "utf8", (err, data) => {
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

    const mergedData = mergeRecords(csvData);
    // console.log(mergedData);
  });
});
