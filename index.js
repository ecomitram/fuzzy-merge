const fs = require('fs');
const csvParse = require('csv-parse');
const FuzzySet = require('fuzzyset');
const pincodeMap = require('./pincodes/pincode.json');
const { exit } = require('process');
const { count } = require('console');
const { normalize } = require('path');

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

function formatDateToYYYYMMDD(dateString) {
  if (!dateString) return 'Unknown';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  } catch (e) {
    return 'Invalid Date';
  }
}

function cleanString(name, city) {
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
  return cleanString(name, city);
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

  if (state == 'NotFound') {
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

function getLocationFromPincode(pincode) {
  // Clean and validate pincode
  const cleanedPincode = (pincode || '').toString().trim();

  // Look up in pincode mapping
  if (cleanedPincode && pincodeMap[cleanedPincode]) {
    return pincodeMap[cleanedPincode];
  }

  // Return NotFound for invalid or missing pincodes
  return {
    district: 'NotFound',
    state: 'NotFound',
    prant: 'NotFound',
    kshetra: 'NotFound',
  };
}

function fixRecordLocationByPincode(record) {
  const locationData = getLocationFromPincode(record.pincode);
  return { ...record, ...locationData };
}

const studentListData = {};

function addToStudentList(list, record) {
  // check if record should be included in list
  if (list.check && !list.check(record)) {
    return;
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

  if (list.hierarchical?.enabled) {
    // Handle hierarchical structure
    const baseFolder = `output/student-lists/${list.name}/`;

    if (fs.existsSync(baseFolder)) {
      fs.rmSync(baseFolder, { recursive: true, force: true });
    }

    for (const [key, records] of Object.entries(dataStore)) {
      const keyParts = key.split(',');
      const keyMap = {};
      list.keyFields.forEach((field, index) => {
        keyMap[field] = keyParts[index];
      });

      // Build folder path from configuration
      const folderParts = list.hierarchical.folderPath.map((field) =>
        keyMap[field].replace(/[^a-z0-9]/gi, '_')
      );
      const folderPath = `${baseFolder}${folderParts.join('/')}/`;

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Build filename from configuration
      const fileName = `${folderPath}list-${keyMap[
        list.hierarchical.fileName
      ].replace(/[^a-z0-9]/gi, '_')}.csv`;

      // Write CSV content
      const header = list.dataFields.join(',') + '\n';
      const rows = records
        .map((record) =>
          list.dataFields.map((field) => `"${record[field]}"`).join(',')
        )
        .join('\n');

      fs.writeFileSync(fileName, header + rows);
    }
  } else {
    // Keep existing non-hierarchical logic
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
}

const instituteListData = {};

function addToInstituteList(list, record) {
  // check if record should be included in list
  if (list.check && !list.check(record)) {
    return;
  }

  // preprocess record
  if (list.preprocess) {
    record = list.preprocess(record, list);
  }

  let data = list.keyFields.map((keyField) => record[keyField]);
  let key = data.join(',');

  if (instituteListData[list.name] === undefined) {
    instituteListData[list.name] = {};
  }

  const dataStore = instituteListData[list.name];

  if (dataStore[key] === undefined) {
    dataStore[key] = {};
  }

  // For institutes, we aggregate by unique institute+pincode combination
  const instituteKey = `${record.cleanInstitute},${record.pincode}`;

  if (dataStore[key][instituteKey] === undefined) {
    dataStore[key][instituteKey] = {
      institute: record.institute, // Original name
      pincode: record.pincode,
      district: record.district,
      state: record.state,
      prant: record.prant,
      studentCount: 0,
    };
  }

  dataStore[key][instituteKey].studentCount++;
}

function saveInstituteLists(list) {
  const dataStore = instituteListData[list.name];

  if (list.hierarchical?.enabled) {
    // Handle hierarchical structure
    const baseFolder = `output/institute-lists/${list.name}/`;

    if (fs.existsSync(baseFolder)) {
      fs.rmSync(baseFolder, { recursive: true, force: true });
    }

    for (const [key, institutes] of Object.entries(dataStore)) {
      const keyParts = key.split(',');
      const keyMap = {};
      list.keyFields.forEach((field, index) => {
        keyMap[field] = keyParts[index];
      });

      // Build folder path from configuration
      const folderParts = list.hierarchical.folderPath.map((field) =>
        keyMap[field].replace(/[^a-z0-9]/gi, '_')
      );
      const folderPath = `${baseFolder}${folderParts.join('/')}/`;

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Build filename from configuration
      const fileName = `${folderPath}${keyMap[
        list.hierarchical.fileName
      ].replace(/[^a-z0-9]/gi, '_')}.csv`;

      // Write CSV content
      const header = list.dataFields.join(',') + '\n';
      const rows = Object.values(institutes)
        .sort((a, b) => b.studentCount - a.studentCount)
        .map((inst) => {
          const values = list.dataFields.map((field) => {
            if (field === 'institute') {
              return `"${inst.institute}"`;
            } else if (typeof inst[field] === 'string') {
              return `"${inst[field]}"`;
            } else {
              return inst[field];
            }
          });
          return values.join(',');
        })
        .join('\n');

      fs.writeFileSync(fileName, header + rows);
    }
  } else {
    // Keep existing non-hierarchical logic
    const targetFolder = `output/institute-lists/${list.name}/`;

    if (fs.existsSync(targetFolder)) {
      fs.rmSync(targetFolder, { recursive: true, force: true });
    }

    fs.mkdirSync(targetFolder, { recursive: true });

    for (const [key, institutes] of Object.entries(dataStore)) {
      const fileName = `${targetFolder}institutes-${key.replace(
        /[^a-z0-9]/gi,
        '_'
      )}.csv`;

      const header = 'institute,studentCount,pincode,district,state,prant\n';
      const rows = Object.values(institutes)
        .sort((a, b) => b.studentCount - a.studentCount)
        .map(
          (inst) =>
            `"${inst.institute}",${inst.studentCount},"${inst.pincode}","${inst.district}","${inst.state}","${inst.prant}"`
        )
        .join('\n');

      fs.writeFileSync(fileName, header + rows);
    }
  }
}

const reportData = {};

function addToReport(report, record) {
  // check if record should be included in report
  if (report.check && !report.check(record)) {
    return;
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
          return { line: ret, count: record.count };
        })
        .filter((item) => item !== null) // Remove null entries (skipped records)
        .sort((a, b) => b.count - a.count) // Sort by count descending
        .map((item) => item.line) // Extract just the line
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
      pincode,
      planted_10_seeds,
      c_at,
      userType,
    ] = row;

    //skip header
    if (state === 'state') {
      continue;
    }
    score = parseInt(score.trim() || 0);

    let record = {
      assessmentId: assessmentId,
      sName: sName,
      sEmail: sEmail,
      sPhone: sPhone,
      sAge: sAge,
      sLang: sLang,
      institute: institute,
      grade: grade,
      city: city,
      gender: gender,
      score: score,
      planted_10_seeds: planted_10_seeds,
      registrationType: registrationType,
      pincode: pincode,
      c_at: c_at,
      userType: userType,
    };

    // cleanup the data
    record = fixRecordLocationByPincode(record);

    addTo(report, record);
    counter++;
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
      name: 'institute-wise',
      keyFields: ['institute', 'district', 'state'],
      dataFields: ['institute', 'city', 'district', 'state'],
      preprocess: (record) => {
        record.institute = cleanInstituteName(record.institute, record.city);
        return record;
      },
    },
    {
      name: 'pincode-wise',
      keyFields: ['pincode'],
      dataFields: ['pincode', 'district', 'state', 'prant', 'kshetra'],
      check: (record) => {
        return record.state != 'NotFound';
      },
      postCheck: (record) => record.count > 9 && record.state != 'NotFound',
    },
    {
      name: 'prant-wise-0-scorer',
      keyFields: ['prant'],
      dataFields: ['prant', 'score'],
      check: (record) => {
        return record.score == 0;
      },
    },

    {
      name: 'district-wise',
      keyFields: ['district'],
      dataFields: ['city', 'state', 'district'],
    },
    {
      name: 'district-wise-0-scorer',
      keyFields: ['district', 'state'],
      dataFields: ['district', 'state', 'score'],
      check: (record) => {
        return record.score == 0;
      },
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
      name: 'state-wise-0-scorer',
      keyFields: ['state'],
      dataFields: ['state', 'score'],
      check: (record) => {
        return record.score == 0;
      },
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
      name: 'prant-wise-0-scorer',
      keyFields: ['prant'],
      dataFields: ['prant', 'score'],
      check: (record) => {
        return record.score == 0;
      },
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
      name: 'kshetra-wise-0-scorer',
      keyFields: ['kshetra'],
      dataFields: ['kshetra', 'score'],
      check: (record) => {
        return record.score == 0;
      },
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
      name: 'grade-wise-prant',
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
      name: 'gender-wise-20-scorer',
      keyFields: ['gender'],
      dataFields: ['gender'],
      check: (record) => {
        return record.score == 20;
      },
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
      name: 'institute-wise-clean-name-at-least-10-registrations',
      keyFields: ['cleanInstitute', 'pincode'],
      dataFields: ['institute', 'pincode', 'district', 'state'],
      preprocess: (record) => {
        record.cleanInstitute = cleanInstituteName(
          record.institute,
          record.city
        );
        return record;
      },
      postCheck: (record) => record.count > 10,
    },
    {
      name: 'institute-wise-20-scorer',
      keyFields: ['cleanInstitute', 'pincode'],
      dataFields: ['institute', 'pincode', 'district', 'state'],
      check: (record) => {
        return record.score == 20;
      },
      preprocess: (record) => {
        record.cleanInstitute = cleanInstituteName(
          record.institute,
          record.city
        );
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
    {
      name: 'daily-participation',
      keyFields: ['participationDate'],
      dataFields: ['participationDate'],
      preprocess: (record) => {
        record.participationDate = formatDateToYYYYMMDD(record.c_at);
        return record;
      },
      check: (record) => {
        // Only include dates from July 1, 2025 to August 27, 2025
        const date = new Date(record.c_at);
        if (isNaN(date.getTime())) return false;

        const startDate = new Date('2025-07-01');
        const endDate = new Date('2025-08-27T23:59:59');

        return date >= startDate && date <= endDate;
      },
    },
    {
      name: 'state-wise-gender',
      keyFields: ['state', 'gender'],
      dataFields: ['state', 'gender'],
    },
  ];

  const lists = [
    {
      name: 'prant-wise-0-scorer',
      keyFields: ['prant'],
      dataFields: [
        'prant',
        'sPhone',
        'score',
        'district',
        'sName',
        'institute',
        'grade',
      ],
      check: (record) => {
        return record.score == 0;
      },
    },
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
      keyFields: ['district', 'state'],
      hierarchical: {
        enabled: true,
        folderPath: ['state'],
        fileName: 'district',
      },
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
      keyFields: ['district', 'state'],
      hierarchical: {
        enabled: true,
        folderPath: ['state'],
        fileName: 'district',
      },
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

  const instituteLists = [
    {
      name: 'prant-wise-institutes',
      keyFields: ['prant'],
      dataFields: [
        'institute',
        'studentCount',
        'pincode',
        'district',
        'state',
        'prant',
      ],
      preprocess: (record) => {
        record.cleanInstitute = cleanInstituteName(
          record.institute,
          record.city
        );
        return record;
      },
      check: (record) => {
        return record.state !== 'NotFound' && record.prant !== 'NotFound';
      },
    },
    {
      name: 'district-wise-institutes',
      keyFields: ['district', 'prant'],
      hierarchical: {
        enabled: true,
        folderPath: ['prant'],
        fileName: 'district',
      },
      dataFields: [
        'institute',
        'studentCount',
        'pincode',
        'district',
        'state',
        'prant',
      ],
      preprocess: (record) => {
        record.cleanInstitute = cleanInstituteName(
          record.institute,
          record.city
        );
        return record;
      },
      check: (record) => {
        return record.state !== 'NotFound' && record.district !== 'NotFound';
      },
    },
    {
      name: 'state-wise-institutes',
      keyFields: ['state'],
      dataFields: [
        'institute',
        'studentCount',
        'pincode',
        'district',
        'state',
        'prant',
      ],
      preprocess: (record) => {
        record.cleanInstitute = cleanInstituteName(
          record.institute,
          record.city
        );
        return record;
      },
      check: (record) => {
        return record.state !== 'NotFound';
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

    for (const instituteList of instituteLists) {
      console.log('Processing institute list: ', instituteList.name);
      console.time(instituteList.name);
      prepareStats(
        csvData,
        instituteList,
        addToInstituteList,
        saveInstituteLists
      );
      console.timeEnd(instituteList.name);
    }

    console.timeEnd('TotalTime');
  });
});
