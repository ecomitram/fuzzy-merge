const fs = require('fs');
const path = require('path');

function parseCsvLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current.trim());
    return fields;
}

function loadPincodes(filePath, pincodeIndex = 0) {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    const dataLines = lines.slice(1); // Skip header
    
    const pincodes = new Set();
    dataLines.forEach(line => {
        const fields = parseCsvLine(line);
        if (fields.length > pincodeIndex) {
            const pincode = fields[pincodeIndex].replace(/"/g, '').trim();
            if (pincode && /^\d+$/.test(pincode)) {
                pincodes.add(pincode);
            }
        }
    });
    
    return pincodes;
}

function loadGovPincodesWithData(filePath) {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    const dataLines = lines.slice(1); // Skip header
    
    const pincodeData = new Map();
    dataLines.forEach(line => {
        const fields = parseCsvLine(line);
        if (fields.length >= 3) {
            const pincode = fields[0].replace(/"/g, '').trim();
            const district = fields[1].replace(/"/g, '').trim();
            const state = fields[2].replace(/"/g, '').trim();
            
            if (pincode && /^\d+$/.test(pincode)) {
                pincodeData.set(pincode, { district, state });
            }
        }
    });
    
    return pincodeData;
}

function findMissingCmsPincodes() {
    const govFile = path.join(__dirname, 'gov-pincodes.csv');
    const cmsFile = path.join(__dirname, 'cms-pincodes.csv');
    const outputFile = path.join(__dirname, 'missing_cms_pincodes.csv');
    
    try {
        console.log('Loading government pincodes with data...');
        const govPincodesData = loadGovPincodesWithData(govFile);
        console.log(`Loaded ${govPincodesData.size} government pincodes`);
        
        console.log('Loading CMS pincodes...');
        const cmsPincodes = loadPincodes(cmsFile);
        console.log(`Loaded ${cmsPincodes.size} CMS pincodes`);
        
        // Find pincodes that are in government data but missing from CMS
        const missingPincodes = [];
        const header = 'pincode,district,state';
        missingPincodes.push(header);
        
        let missingCount = 0;
        
        // Sort pincodes numerically for consistent output
        const sortedGovPincodes = Array.from(govPincodesData.keys())
            .sort((a, b) => parseInt(a) - parseInt(b));
        
        sortedGovPincodes.forEach(pincode => {
            if (!cmsPincodes.has(pincode)) {
                const govData = govPincodesData.get(pincode);
                missingPincodes.push(`${pincode},"${govData.district}","${govData.state}"`);
                missingCount++;
            }
        });
        
        // Write output file
        fs.writeFileSync(outputFile, missingPincodes.join('\n'), 'utf8');
        
        console.log('\n=== Missing Pincodes Summary ===');
        console.log(`Total government pincodes: ${govPincodesData.size}`);
        console.log(`Total CMS pincodes: ${cmsPincodes.size}`);
        console.log(`Missing from CMS: ${missingCount}`);
        console.log(`Coverage: ${((cmsPincodes.size / govPincodesData.size) * 100).toFixed(1)}%`);
        console.log(`Output written to: ${outputFile}`);
        
    } catch (error) {
        console.error('Error finding missing pincodes:', error.message);
        process.exit(1);
    }
}

// Run the analysis
findMissingCmsPincodes();