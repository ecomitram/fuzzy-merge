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

function toTitleCase(str) {
    return str.toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function mapStateName(govStateName, mapper) {
    const cleanStateName = govStateName.replace(/"/g, '').trim().toUpperCase();
    return mapper.states[cleanStateName] || toTitleCase(cleanStateName);
}

function mapDistrictName(govDistrictName, mapper) {
    const cleanDistrictName = govDistrictName.replace(/"/g, '').trim();
    
    // Check for exact matches in special cases first
    if (mapper.districtSpecialCases[cleanDistrictName]) {
        return mapper.districtSpecialCases[cleanDistrictName];
    }
    
    // Handle district names with abbreviations in parentheses
    const abbrevMatch = cleanDistrictName.match(/^(.+)\s\(([A-Z]{2,3})\)$/);
    if (abbrevMatch) {
        const baseName = abbrevMatch[1];
        const abbrev = abbrevMatch[2];
        if (mapper.stateAbbreviations[abbrev]) {
            return `${toTitleCase(baseName)} (${abbrev})`;
        }
        return toTitleCase(baseName);
    }
    
    // Convert to title case for standard cases
    return toTitleCase(cleanDistrictName);
}

function populateNewCmsPincodes() {
    const missingFile = path.join(__dirname, 'missing_cms_pincodes.csv');
    const mapperFile = path.join(__dirname, 'name_mapper.json');
    const outputFile = path.join(__dirname, 'new_cms_pincodes.csv');
    
    try {
        // Load the name mapper
        console.log('Loading name mapper...');
        const mapper = JSON.parse(fs.readFileSync(mapperFile, 'utf8'));
        
        // Load missing pincodes data
        console.log('Loading missing pincodes data...');
        const data = fs.readFileSync(missingFile, 'utf8');
        const lines = data.trim().split('\n');
        const dataLines = lines.slice(1); // Skip header
        
        // Process data
        const newPincodes = [];
        const header = '"id","district","state"';
        newPincodes.push(header);
        
        let processedCount = 0;
        let skippedCount = 0;
        
        dataLines.forEach(line => {
            const fields = parseCsvLine(line);
            if (fields.length >= 3) {
                const pincode = fields[0].replace(/"/g, '').trim();
                const govDistrict = fields[1];
                const govState = fields[2];
                
                if (pincode && /^\d+$/.test(pincode)) {
                    const cmsState = mapStateName(govState, mapper);
                    const cmsDistrict = mapDistrictName(govDistrict, mapper);
                    
                    newPincodes.push(`"${pincode}","${cmsDistrict}","${cmsState}"`);
                    processedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
        });
        
        // Write output file
        fs.writeFileSync(outputFile, newPincodes.join('\n'), 'utf8');
        
        console.log('\n=== Populate New CMS Pincodes Summary ===');
        console.log(`Total rows processed: ${processedCount}`);
        console.log(`Rows skipped: ${skippedCount}`);
        console.log(`Output written to: ${outputFile}`);
        
        // Show some examples of transformations
        console.log('\n=== Sample Transformations ===');
        const sampleLines = newPincodes.slice(1, 11); // Skip header, show first 10
        sampleLines.forEach(line => {
            console.log(line);
        });
        
    } catch (error) {
        console.error('Error populating new CMS pincodes:', error.message);
        process.exit(1);
    }
}

// Run the population
populateNewCmsPincodes();