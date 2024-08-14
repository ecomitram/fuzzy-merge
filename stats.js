const fs = require("fs");
const csvParse = require("csv-parse");
const FuzzySet = require("fuzzyset");
let districtsMap = require('./mapper.json');
const { exit } = require("process");
const { count } = require("console");

districtsMap[''] = districtsMap['BLANK'] = {
  district: 'BLANK',
  state: 'BLANK',
  prant: 'BLANK',
  kshetra: 'BLANK'
};

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

  let data = report.keyFields.map(keyField => record[keyField]);
  let key = data.join(',');

  // check if record should be included in report
  if (report.check && !report.check(record)) {
    return;
  }

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
    report.keyFields.join('-') + ',' + report.dataFields.join(',') + ',count\n' +
    Object.values(dataStore)
      .map(function (record) {
        let data = report.dataFields.map(dataField => record[dataField]);
        let ret = `${record.key},${data.join(',')},${record.count}`;
        return ret;
      })
      .join("\n")
  );
}

function prepareStats(csvData, report) {

  let counter = 0;
  for (const row of csvData) {
    let [_id, institute, grade, pincode, city, state, count, score] = row;

    if (_id === '_id') {
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
      grade: grade,
      city: city,
      state: state,
      count: count,
      score: score,
      district: district,
      prant: prant,
      kshetra: kshetra
    }

    addToReport(report, record);
    counter++;
  }

  console.log('Total records: ', counter);
  // write to file
  saveReport(report);

}

// Read the CSV file
console.time("TotalTime");
fs.readFile("input/nspc.csv", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const reports = [
    // {
    //   name: 'district-wise',
    //   keyFields: ['district'],
    //   dataFields: ['city'],
    // },
    // {
    //   name: 'prant-wise',
    //   keyFields: ['prant'],
    //   dataFields: ['prant'],
    // },
    // {
    //   name: 'kshetra-wise',
    //   keyFields: ['kshetra'],
    //   dataFields: ['kshetra'],
    // },
    // {
    //   name: 'grade-wise',
    //   keyFields: ['grade'],
    //   dataFields: ['grade'],
    // },
    // {
    //   name: 'prant-grade-wise',
    //   keyFields: ['prant', 'grade'],
    //   dataFields: ['prant', 'grade'],
    // },
    {
      name: 'prant-grade-wise-20-scorer',
      keyFields: ['prant', 'grade', 'score'],
      dataFields: ['prant', 'grade'],
      check: (record) => {
        return record.score >= 20;
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