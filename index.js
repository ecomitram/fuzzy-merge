const fs = require('fs');
const csvParse = require('csv-parse');
const FuzzySet = require('fuzzyset');
let districtsMap = require('./mapper/mapper.json');
const { exit } = require('process');
const { count } = require('console');
const { normalize } = require('path');

districtsMap[''] = districtsMap['BLANK'] = {
  district: 'BLANK',
  state: 'BLANK',
  prant: 'BLANK',
  kshetra: 'BLANK',
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

function cleanString(name) {
  name = name.trim();
  name = name.toLowerCase();

  //remove special characters, consider multiple languages
  name = name.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  // Explanation:
  // \p{L} - Matches any kind of letter from any language
  // \p{N} - Matches any numeric digit from any script
  // \s - Matches any whitespace character
  // ^ inside [] - Negates the set, meaning "match anything that is not these"
  // /g - Global flag, replace all occurrences
  // /u - Unicode flag, for proper Unicode processing

  // we cannot do it as it will remove all the words (solapur univeristy, raipur college)
  // let replaceWords = [
  //   ['school', ''],
  //   ['institute', ''],
  //   ['college', ''],
  //   ['university', ''],
  //   ['institution', ''],
  // ];
  // replaceWords.forEach(([from, to]) => {
  //   name = name.replaceAll(from, to);
  // });

  //remove multi space with single space
  name = name.replace(/\s\s+/g, ' ');
  name = name.trim();

  //if all digits, then return blank
  if (/^\d+$/.test(name)) {
    return 'Invalid Name';
  }

  return name;
}

function cleanInstituteName(name, city) {
  return cleanString(name);
}

const cityFuzzyMap = {};
function getFuzzyMap(fuzzyMapKey) {
  if (cityFuzzyMap[fuzzyMapKey] === undefined) {
    cityFuzzyMap[fuzzyMapKey] = FuzzySet();
  }

  return cityFuzzyMap[fuzzyMapKey];
}

function normalizeInstitute(institute, city, district, state) {
  if (state == 'NRI') {
    return 'NRI';
  }

  if (state == '') {
    return null;
  }

  let name = cleanInstituteName(institute, city);
  let key = district + state;
  const fuzzyMap = getFuzzyMap(key);
  matches = fuzzyMap.get(name, null, 0.9);
  if (matches) {
    return matches[0][1];
  } else {
    fuzzyMap.add(name);
    return name;
  }
}

function cleanDistrictName(name) {
  //lowercase
  name = name.toLowerCase();

  //remove non alpha-numeric, with space
  name = name.replace('/[^a-z0-9 ]/g', ' ');

  // replace multi space, with single space
  name = name.replace(/\s\s+/g, ' ');

  name = name.trim();
  return name;
}

const studentListData = {};

function addToStudentList(list, record) {
  // check if record should be included in list
  if (list.check && !list.check(record)) {
    return;
  }

  //  if state is blank
  if (record.state == '') {
    record.state = 'Not Provided';
    record.district = 'Not Provided';
    record.prant = 'Not Provided';
    record.kshetra = 'Not Provided';
  }

  if (record.state == 'NRI') {
    record.state = 'NRI';
    record.district = 'NRI';
    record.prant = 'NRI';
    record.kshetra = 'NRI';
  }

  // preprocess record
  if (list.preprocess) {
    record = list.preprocess(record, list);
  }

  let data = list.keyFields.map((keyField) => record[keyField]);
  let key = data.join(',');

  if (studentListData[list.name] === undefined) {
    studentListData[list.name] = {};
  }

  const dataStore = studentListData[list.name];

  if (dataStore[key] === undefined) {
    dataStore[key] = [];
  }

  dataStore[key].push(record);
}

function saveStudentLists(list) {
  const dataStore = studentListData[list.name];

  const targetFolder = `output/student-lists/${list.name}/`;
  // Delete the folder if it already exists
  if (fs.existsSync(targetFolder)) {
    fs.rmSync(targetFolder, { recursive: true, force: true });
  }

  fs.mkdirSync(targetFolder, { recursive: true });

  for (const [key, records] of Object.entries(dataStore)) {
    const fileName = `${targetFolder}list-${key.replace(
      /[^a-z0-9]/gi,
      '_'
    )}.csv`;

    const header = list.dataFields.join(',') + '\n';
    const rows = records
      .map((record) =>
        list.dataFields.map((field) => `"${record[field]}"`).join(',')
      )
      .join('\n');

    fs.writeFileSync(fileName, header + rows);
  }
}

const reportData = {};

function addToReport(report, record) {
  // check if record should be included in report
  if (report.check && !report.check(record)) {
    return;
  }

  //  if state is blank
  if (record.state == '') {
    record.state = 'Not Provided';
    record.district = 'Not Provided';
    record.prant = 'Not Provided';
    record.kshetra = 'Not Provided';
  }

  if (record.state == 'NRI') {
    record.state = 'NRI';
    record.district = 'NRI';
    record.prant = 'NRI';
    record.kshetra = 'NRI';
  }

  // preprocess record
  if (report.preprocess) {
    record = report.preprocess(record, report);
  }

  let data = report.keyFields.map((keyField) => record[keyField]);
  let key = data.join('');

  // skip if key is blank
  if (key == '') {
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

  report.dataFields.forEach((dataField) => {
    dataStore[key][dataField] = `"${record[dataField]}"`;
  });

  report.counter = report.counter || 0;
  report.counter++;
  // show progress for every 10000 records
  if (report.counter % 10000 === 0) {
    console.log('Processed records: ', report.counter);
  }
}

function saveReport(report) {
  const dataStore = reportData[report.name];

  const targetFolder = `output/reports/`;
  // Delete the folder if it already exists
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  fs.writeFileSync(
    `${targetFolder}${report.name}.csv`,
    report.dataFields.join(',') +
      ',count\n' +
      Object.values(dataStore)
        .map(function (record) {
          // Check if the record should be skipped based on some attributes
          if (report.postCheck && !report.postCheck(record)) {
            return null; // Returning null for records to be skipped
          }
          let data = report.dataFields.map((dataField) => record[dataField]);
          let ret = `${data.join(',')},${record.count}`;
          return ret;
        })
        .filter((item) => item !== null) // Remove null entries (skipped records)
        .join('\n')
  );
}

function prepareStats(csvData, report, addTo, saveTo) {
  let counter = 0;
  for (const row of csvData) {
    // institutionName,gender,class,registrationType,score,city,state
    let [
      assessmentId,
      sName,
      sEmail,
      sPhone,
      sAge,
      sLang,
      institute,
      gender,
      grade,
      registrationType,
      score,
      city,
      state,
      planted_10_seeds,
    ] = row;

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
      assessmentId: assessmentId,
      sName: sName,
      sEmail: sEmail,
      sPhone: sPhone,
      sAge: sAge,
      sLang: sLang,
      institute: institute,
      grade: grade,
      city: city,
      state: state,
      gender: gender,
      score: score,
      district: district,
      state: state,
      planted_10_seeds: planted_10_seeds,
      registrationType: registrationType,
      prant: prant,
      kshetra: kshetra,
    };

    addTo(report, record);
    counter++;
    // if (counter % 1000 === 0) {
    //   console.log('Processed records: ', counter);
    // }
  }

  console.log('Total records: ', counter);
  // write to file
  saveTo(report);
}

// Read the CSV file
console.time('TotalTime');
fs.readFile('input/assessments.csv', 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const reports = [
    //to check if the normalized names are correct, else comment it
    // {
    //   name: 'institute-normalized-names',
    //   keyFields: ['institute', 'district', 'state'],
    //   dataFields: [
    //     'institute',
    //     'normalizeInstitute',
    //     'city',
    //     'district',
    //     'state',
    //   ],
    //   preprocess: (record) => {
    //     record.normalizeInstitute = normalizeInstitute(
    //       record.institute,
    //       record.city,
    //       record.district,
    //       record.state
    //     );
    //     return record;
    //   },
    // },
    {
      name: 'institute-wise-normalized-name-at-least-10-registrations',
      keyFields: ['normalizeInstitute', 'district', 'state'],
      dataFields: ['institute', 'normalizeInstitute', 'district', 'state'],
      preprocess: (record, report) => {
        // report.counter = report.counter || 0;
        // report.counter++;
        // record.id = report.counter;
        record.normalizeInstitute = normalizeInstitute(
          record.institute,
          record.city,
          record.district,
          record.state
        );
        return record;
      },
      postCheck: (record) => record.count > 9,
    },
    {
      name: 'district-wise',
      keyFields: ['district'],
      dataFields: ['city', 'state', 'district'],
    },
    {
      name: 'district-wise-20-scorer',
      keyFields: ['district'],
      dataFields: ['district', 'city', 'state', 'score'],
      check: (record) => {
        return record.score == 20;
      },
    },
    {
      name: 'state-wise',
      keyFields: ['state'],
      dataFields: ['state'],
    },
    {
      name: 'state-wise-20-scorer',
      keyFields: ['state'],
      dataFields: ['state', 'score'],
      check: (record) => {
        return record.score == 20;
      },
    },
    {
      name: 'prant-wise',
      keyFields: ['prant'],
      dataFields: ['prant'],
    },
    {
      name: 'prant-wise-20-scorer',
      keyFields: ['prant'],
      dataFields: ['prant', 'score'],
      check: (record) => {
        return record.score == 20;
      },
    },
    {
      name: 'kshetra-wise',
      keyFields: ['kshetra'],
      dataFields: ['kshetra'],
    },
    {
      name: 'kshetra-wise-20-scorer',
      keyFields: ['kshetra'],
      dataFields: ['kshetra', 'score'],
      check: (record) => {
        return record.score == 20;
      },
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
      keyFields: ['grade'],
      dataFields: ['grade'],
      check: (record) => {
        return record.score == 20;
      },
    },
    {
      name: 'gender-wise',
      keyFields: ['gender'],
      dataFields: ['gender'],
    },
    {
      name: 'score-wise',
      keyFields: ['score'],
      dataFields: ['score'],
      check: (record) => {
        return record.score <= 20;
      },
    },
    {
      name: 'grade-gender-wise',
      keyFields: ['grade', 'gender'],
      dataFields: ['grade', 'gender'],
      check: (record) => {
        return record.score <= 20;
      },
    },
    {
      name: 'grade-gender-wise-20-scorer',
      keyFields: ['grade', 'gender', 'score'],
      dataFields: ['grade', 'gender', 'score'],
      check: (record) => {
        return record.score == 20;
      },
    },

    {
      name: 'institute-wise-clean-name',
      keyFields: ['institute'],
      dataFields: ['institute', 'district', 'state', 'prant', 'kshetra'],
      preprocess: (record) => {
        record.institute = cleanInstituteName(record.institute, record.city);
        return record;
      },
      postCheck: (record) => record.count > 1,
    },

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
      },
      preprocess: (record) => {
        record.institute = cleanInstituteName(record.institute, record.city);
        return record;
      },
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
      dataFields: ['sLang', 'sLangName', 'score'],
      preprocess: (record) => {
        record.sLangName = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
      check: (record) => {
        return record.score == 20;
      },
    },
    {
      name: 'planted_10_seeds-wise',
      keyFields: ['planted_10_seeds'],
      dataFields: ['planted_10_seeds'],
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        return record;
      },
    },
    {
      name: 'planted_10_seeds-wise-20-scorer',
      keyFields: ['planted_10_seeds'],
      dataFields: ['planted_10_seeds', 'score'],
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        return record;
      },
      check: (record) => {
        return record.score == 20;
      },
    },
  ];

  const lists = [
    {
      name: 'prant-wise-20-scorer',
      keyFields: ['prant'],
      dataFields: [
        'sName',
        'sPhone',
        'sLang',
        'institute',
        'grade',
        'city',
        'state',
        'gender',
        'score',
        'district',
        'planted_10_seeds',
        'registrationType',
        'prant',
        'kshetra',
      ],
      check: (record) => {
        return record.score == 20;
      },
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        record.sLang = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
    },
    {
      name: 'state-wise-20-scorer',
      keyFields: ['state'],
      dataFields: [
        'sName',
        'sPhone',
        'sLang',
        'institute',
        'grade',
        'city',
        'state',
        'gender',
        'score',
        'district',
        'planted_10_seeds',
        'registrationType',
        'prant',
        'kshetra',
      ],
      check: (record) => {
        return record.score == 20;
      },
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        record.sLang = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
    },
    {
      name: 'district-wise-20-scorer',
      keyFields: ['district'],
      dataFields: [
        'sName',
        'sPhone',
        'sLang',
        'institute',
        'grade',
        'city',
        'state',
        'gender',
        'score',
        'district',
        'planted_10_seeds',
        'registrationType',
        'prant',
        'kshetra',
      ],
      check: (record) => {
        return record.score == 20;
      },
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        record.sLang = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        record.district = record.district || 'BLANK';
        return record;
      },
    },
    {
      name: 'prant-wise',
      keyFields: ['prant'],
      dataFields: [
        'sName',
        'sPhone',
        'sLang',
        'institute',
        'grade',
        'city',
        'state',
        'gender',
        'score',
        'district',
        'planted_10_seeds',
        'registrationType',
        'prant',
        'kshetra',
      ],
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        record.sLang = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
    },
    {
      name: 'state-wise',
      keyFields: ['state'],
      dataFields: [
        'sName',
        'sPhone',
        'sLang',
        'institute',
        'grade',
        'city',
        'state',
        'gender',
        'score',
        'district',
        'planted_10_seeds',
        'registrationType',
        'prant',
        'kshetra',
      ],
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        record.sLang = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
    },
    {
      name: 'district-wise',
      keyFields: ['district'],
      dataFields: [
        'sName',
        'sPhone',
        'sLang',
        'institute',
        'grade',
        'city',
        'state',
        'gender',
        'score',
        'district',
        'planted_10_seeds',
        'registrationType',
        'prant',
        'kshetra',
      ],
      preprocess: (record) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        record.sLang = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
    },
    {
      name: '20-scorer-student-list',
      keyFields: ['score'],
      dataFields: [
        'assessmentId',
        'sName',
        'grade',
        'sLang',
        'state',
        'district',
        'institute',
        'gender',
      ],
      check: (record) => {
        return record.score == 20;
      },
      preprocess: (record, list) => {
        record.planted_10_seeds = record.planted_10_seeds ? 'Yes' : 'No';
        record.sLang = langMap[record.sLang] || `Unknown: ${record.sLang}`;
        return record;
      },
    },
  ];

  // Parse the CSV data
  csvParse(data, { delimiter: ',' }, (err, csvData) => {
    if (err) {
      console.error(err);
      return;
    }

    for (const report of reports) {
      console.log('Processing report: ', report.name);
      console.time(report.name);
      prepareStats(csvData, report, addToReport, saveReport);
      console.timeEnd(report.name);
    }

    for (const list of lists) {
      console.log('Processing student list: ', list.name);
      console.time(list.name);
      prepareStats(csvData, list, addToStudentList, saveStudentLists);
      console.timeEnd(list.name);
    }

    console.timeEnd('TotalTime');
  });
});
