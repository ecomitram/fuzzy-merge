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

function generatePincodeJson() {
    const inputFile = path.join(__dirname, 'cms-pincodes.csv');
    const outputFile = path.join(__dirname, 'pincode.json');
    const mapperFile = path.join(__dirname, '../mapper/mapper.json');
    
    try {
        // Load the district-to-prant-kshetra mapper
        console.log('Loading mapper data...');
        const mapper = JSON.parse(fs.readFileSync(mapperFile, 'utf8'));
        
        console.log('Reading CMS pincodes CSV...');
        const data = fs.readFileSync(inputFile, 'utf8');
        const lines = data.trim().split('\n');
        const dataLines = lines.slice(1); // Skip header
        
        const pincodeData = {};
        let processedCount = 0;
        let skippedCount = 0;
        
        dataLines.forEach((line, index) => {
            const fields = parseCsvLine(line);
            if (fields.length >= 3) {
                const pincode = fields[0].replace(/"/g, '').trim();
                const district = fields[1].replace(/"/g, '').trim();
                const state = fields[2].replace(/"/g, '').trim();
                
                if (pincode && /^\d+$/.test(pincode)) {
                    // Look up prant and kshetra from mapper
                    const districtKey = district.toLowerCase();
                    const mappedData = mapper[districtKey];
                    const prant = mappedData ? mappedData.prant : '';
                    const kshetra = mappedData ? mappedData.kshetra : '';
                    
                    pincodeData[pincode] = {
                        district: district,
                        state: state,
                        prant: prant,
                        kshetra: kshetra
                    };
                    processedCount++;
                } else {
                    console.warn(`Skipping invalid pincode at line ${index + 2}: ${pincode}`);
                    skippedCount++;
                }
            } else {
                console.warn(`Skipping malformed line ${index + 2}: ${line}`);
                skippedCount++;
            }
        });
        
        // Write JSON file with pretty formatting
        console.log('Writing pincode.json...');
        fs.writeFileSync(outputFile, JSON.stringify(pincodeData, null, 2), 'utf8');
        
        console.log('\n=== Generate Pincode JSON Summary ===');
        console.log(`Total pincodes processed: ${processedCount}`);
        console.log(`Rows skipped: ${skippedCount}`);
        console.log(`Output written to: ${outputFile}`);
        console.log(`JSON file size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
        
        // Show some sample data
        console.log('\n=== Sample JSON Structure ===');
        const samplePincodes = Object.keys(pincodeData).slice(0, 5);
        const sampleData = {};
        samplePincodes.forEach(pincode => {
            sampleData[pincode] = pincodeData[pincode];
        });
        console.log(JSON.stringify(sampleData, null, 2));
        
    } catch (error) {
        console.error('Error generating pincode JSON:', error.message);
        process.exit(1);
    }
}

// Run the generator
generatePincodeJson();