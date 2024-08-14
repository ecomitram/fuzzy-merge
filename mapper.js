const fs = require("fs");
const csvParse = require("csv-parse");
const FuzzySet = require("fuzzyset");
const { exit } = require("process");

// const pincodeData = require('./pincodes.json');

function cleanName(name) {
    name = name.trim();

    //lowercase
    name = name.toLowerCase();

    //remove non alpha-numeric, with space
    name = name.replace("/[^a-z0-9 ]/g", " ");

    // replace multi space, with single space
    name = name.replace(/\s\s+/g, ' ');

    name = name.trim();
    return name;
}

const districtFuzzyMap = new FuzzySet();
function fuzzymatch(name, map) {
    matches = map.get(name, null, 0.75);
    if (matches) {
        return matches[0][1];
    }else{
        return null;
    }
}

const statesDate = require('./states.json');
const statesMap = [];
for (let index = 0; index < statesDate.length; index++) {
    const element = statesDate[index];
    statesMap[cleanName(element.id)] = element.id;
}

const districtsData = require('./districts.json');
const districtsMap = [];
for (let index = 0; index < districtsData.length; index++) {
    const element = districtsData[index];
    districtsMap[cleanName(element.id)] = {
        district: element.id,
        state: element.state
    };

    districtFuzzyMap.add(cleanName(element.id));
}

//process prant to kshetra mapping
const prantMap = [];

fs.readFile("./kshetra.csv", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      
    }
  
    // Parse the CSV data
    csvParse(data, { delimiter: "," }, (err, csvData) => {
      if (err) {
        console.error(err);
        exit(1);
      }

        matched = 0;
        notMatched = 0;
        csvData.forEach((row, index) => {
            let [prant,kshetra] = row;
            prant = cleanName(prant);

            // append prant 
            prantMap[prant] = kshetra;
        });
        console.log('prantMap: ', prantMap);
    });
});

// process prant to district mapping
fs.readFile("./prants.csv", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      exit(1);
    }
  
    // Parse the CSV data
    csvParse(data, { delimiter: "," }, (err, csvData) => {
      if (err) {
        console.error(err);
        return;
      }

        csvData.forEach((row, index) => {
            let [state, district, prant] = row;
            district = cleanName(district);

            if(!prantMap[cleanName(prant)]){
                console.log('Prant not found: ', prant);
                exit(1);
            }
            // append prant 
            districtsMap[district] = {...districtsMap[district], 'prant': prant, 'kshetra': prantMap[cleanName(prant)] };
        });
    });
    console.log('districtsMap: ', districtsMap);
});
// 

// for (let index = 0; index < districtsMap.length; index++) {
//     const element = districtsMap[index];
//     console.log(element);
// }