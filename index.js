const fs = require("fs");
const csvParse = require("csv-parse");
const FuzzySet = require("fuzzyset");
let districtsMap = require('./mapper/mapper.json');
const { exit } = require("process");
const { count } = require("console");
const { normalize } = require("path");

districtsMap[''] = districtsMap['BLANK'] = {
  district: 'BLANK',
  state: 'BLANK',
  prant: 'BLANK',
  kshetra: 'BLANK'
};

const langMap = {
  1: 'Asaamese',
  2: 'Bangla',
  3: 'English',
  4: 'Gujarati',
  5: 'Hindi',
  6: 'Kannada',
  7: 'Malayalam',
  8: 'Marathi',
  10: 'Tamil',
  11: 'Telugu',
};

function cleanInstituteName(name, city) {
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

  //if all numbers, remove
  if (/^\d+$/.test(name)) {
    return 'Invalid';
  }

  name = name.trim();
  return name;
}

const cityFuzzyMap = {};
function getFuzzyMap(city) {
  //use seperate fuzzyset for every city
  let fuzzyMapKey = `${city}`;
  if (cityFuzzyMap[fuzzyMapKey] === undefined) {
    cityFuzzyMap[fuzzyMapKey] = FuzzySet();
  }

  return cityFuzzyMap[fuzzyMapKey];
}

function normalizeInstitute(institute, city) {
  let name = cleanInstituteName(institute, city);

  const fuzzyMap = getFuzzyMap(city);
  matches = fuzzyMap.get(name, null, 0.85);
  if (matches) {
    return matches[0][1];
  }else{
    fuzzyMap.add(name);
    return name;
  }
}

function cleanDistrictName(name) {
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



const reportData = {
};

function addToReport(report, record) {
  // check if record should be included in report
  if (report.check && !report.check(record)) {
    return;
  }

  // preprocess record
  if(report.preprocess){
    record = report.preprocess(record);
  }

  let data = report.keyFields.map(keyField => record[keyField]);
  let key = data.join(',');

  const incrementBy = 1;

  if (reportData[report.name] === undefined) {
    reportData[report.name] = {};
  }

  const dataStore = reportData[report.name];

  if (dataStore[key] === undefined) {
    dataStore[key] = {};
  }

  dataStore[key]['key'] = `"${key}"`;

  if (dataStore[key]['count'] === undefined) {
    dataStore[key]['count'] = 0;
  }

  dataStore[key]['count'] += incrementBy;

  report.dataFields.forEach(dataField => {
    dataStore[key][dataField] = `"${record[dataField]}"`;
  });
}

function saveReport(report) {
  const dataStore = reportData[report.name];

  fs.writeFileSync(
    `output/report-${report.name}.csv`,
    report.dataFields.join(',') + ',count\n' +
    Object.values(dataStore)
      .map(function (record) {
        let data = report.dataFields.map(dataField => record[dataField]);
        let ret = `${data.join(',')},${record.count}`;
        return ret;
      })
      .join("\n")
  );
}

function prepareStats(csvData, report) {

  let counter = 0;
  for (const row of csvData) {
    // institutionName,gender,class,registrationType,score,city,state
    let [sName, sEmail, sPhone, sAge, sLang, institute, gender, grade, registrationType, score,  city, state, planted_10_seeds] = row;

    //skip header
    if (state === 'state') {
      continue;
    }

    let district = cleanDistrictName(city);
    if (districtsMap[district] === undefined) {
      console.log('District not found: ', district);
      continue;
    }
    let prant = districtsMap[district].prant || 'BLANK';
    let kshetra = districtsMap[district].kshetra || 'BLANK';
    score = parseInt(score.trim() || 0);

    const record = {
      sName: sName,
      sEmail: sEmail,
      sPhone: sPhone,
      sAge: sAge,
      sLang: sLang,
      institute: institute,
      grade: grade,
      city: city,
      state: state,
      gender:gender,
      score: score,
      district: district,
      state: state,
      planted_10_seeds: planted_10_seeds,
      registrationType: registrationType,
      prant: prant,
      kshetra: kshetra,


    }

    addToReport(report, record);
    counter++;
    // if (counter % 1000 === 0) {
    //   console.log('Processed records: ', counter);
    // }
  }

  console.log('Total records: ', counter);
  // write to file
  saveReport(report);

}

// Read the CSV file
console.time("TotalTime");
fs.readFile("input/assessments.csv", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const reports = [
    {
      name: 'district-wise',
      keyFields: ['district'],
      dataFields: ['city'],
    },
    {
      name: 'district-wise-20-scorer',
      keyFields: ['district'],
      dataFields: ['district','city','score'],
      check: (record) => {
        return record.score == 20;
      }
    },
    {
      name: 'state-wise',
      keyFields: ['state'],
      dataFields: ['state'],
    },
    {
      name: 'state-wise-20-scorer',
      keyFields: ['state'],
      dataFields: ['state','score'],
      check: (record) => {
        return record.score == 20;
      }
    },
    {
      name: 'prant-wise',
      keyFields: ['prant'],
      dataFields: ['prant'],
    },
    {
      name: 'prant-wise-20-scorer',
      keyFields: ['prant'],
      dataFields: ['prant','score'],
      check: (record) => {
        return record.score == 20;
      }
    },
    {
      name: 'kshetra-wise',
      keyFields: ['kshetra'],
      dataFields: ['kshetra'],
    },
    {
      name: 'kshetra-wise-20-scorer',
      keyFields: ['kshetra'],
      dataFields: ['kshetra','score'],
      check: (record) => {
        return record.score == 20;
      }
    },
    {
      name: 'grade-wise',
      keyFields: ['grade'],
      dataFields: ['grade'],
    },
    {
      name: 'prant-grade-wise',
      keyFields: ['prant', 'grade'],
      dataFields: ['prant', 'grade'],
    },
    {
      name: 'grade-wise-20-scorer',
      keyFields: [ 'grade',],
      dataFields: [ 'grade'],
      check: (record) => {
        return record.score == 20;
      }
    },
    {
      name: 'gender-wise',
      keyFields: [ 'gender'],
      dataFields: [ 'gender'],
    },
    {
      name: 'score-wise',
      keyFields: [ 'score'],
      dataFields: [ 'score'],
      check: (record) => {
        return record.score <= 20;
      }
    },
    {
      name: 'grade-gender-wise',
      keyFields: ['grade','gender'],
      dataFields: ['grade','gender'],
      check: (record) => {
        return record.score <= 20;
      }
    },
    {
      name: 'grade-gender-wise-20-scorer',
      keyFields: ['grade','gender','score'],
      dataFields: ['grade','gender','score'],
      check: (record) => {
        return record.score == 20;
      }
    },

    {
      name: 'institute-wise-clean-name',
      keyFields: ['institute'],
      dataFields: ['institute','district','state','prant','kshetra'],
        preprocess: (record) => {
          record.institute = cleanInstituteName(record.institute, record.city);
          return record;
      }
    },
    // {
    //   name: 'institute-wise-normalized-name',
    //   keyFields: ['normalizeInstitute'],
    //   dataFields: ['institute','normalizeInstitute','district'],
    //     preprocess: (record) => {
    //       record.normalizeInstitute = normalizeInstitute(record.institute, record.city);
    //       return record;
    //   }
    // },
    
    {
      name: 'institute-wise',
      keyFields: ['institute'],
      dataFields: ['institute', 'district', 'prant', 'kshetra'],
    },
    {
      name: 'institute-wise-20-scorer',
      keyFields: ['institute'],
      dataFields: ['institute', 'district', 'prant', 'kshetra', 'score'],
      check: (record) => {
        return record.score == 20;
      }
    },
    {
      name: 'age-wise',
      keyFields: ['sAge'],
      dataFields: ['sAge'],
    },
    {
      name: 'language-wise',
      keyFields: ['sLang'],
      dataFields: ['sLang', 'sLangName'],
      preprocess: (record) => {
        record.sLangName = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
    },
    {
      name: 'language-wise-20-scorer',
      keyFields: ['sLang'],
      dataFields: ['sLang', 'sLangName','score'],
      preprocess: (record) => {
        record.sLangName = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
      check: (record) => {
        return record.score == 20;
      }
    },
    {
      name: 'planted_10_seeds-wise',
      keyFields: ['planted_10_seeds'],
      dataFields: ['planted_10_seeds'],
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes': 'No';
        return record;
      },
    },
    {
      name: 'planted_10_seeds-wise-20-scorer',
      keyFields: ['planted_10_seeds'],
      dataFields: ['planted_10_seeds','score'],
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes': 'No';
        return record;
      },
      check: (record) => {
        return record.score == 20;
      }
    },

  ];



  // from data only pick first 100 lines
  // data = data.split('\n').slice(0,100).join('\n');
  // console.log('data: ', data);

  // Parse the CSV data
  csvParse(data, { delimiter: "," }, (err, csvData) => {
    if (err) {
      console.error(err);
      return;
    }

    for (const report of reports) {
      console.log('Processing report: ', report.name);
      console.time(report.name);
      prepareStats(csvData, report);
      console.timeEnd(report.name);
    }

    console.timeEnd("TotalTime");
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