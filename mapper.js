const fs = require("fs");
const csvParse = require("csv-parse");
const FuzzySet = require("fuzzyset");

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

      matched = 0;
    notMatched = 0;
    fuzzyMatched = 0 ;
      csvData.forEach((row, index) => {
        let [state, district, prant] = row;

        district = cleanName(district);

        
        if (!districtsMap[district]) {
            if(fdistrict=fuzzymatch(district, districtFuzzyMap)){
                console.log(`Fuzzy Matched:  ./prants.csv:${index+1}`, index,' District: ', district, '|' ,fdistrict);
                fuzzyMatched++;
            }else{
                console.log(` ./prants.csv:${index+1}`, 'Not Matched:  District: ', district, ' State:', state);
                notMatched++;
            }
        }else{
            matched++;
            //  console.log('Matched District Name: ', district);
        }
        

        // if (!statesMap[state]) {
        //     console.log('Not Matched State Name: ', state);
        // }

      });
      console.log('Matched: ', matched, 'Not Matched: ', notMatched);
    });
});

// 

// for (let index = 0; index < districtsMap.length; index++) {
//     const element = districtsMap[index];
//     console.log(element);
// }