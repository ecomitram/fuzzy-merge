const fs = require('fs');
const path = require('path');

function extractUniquePincodes() {
    const inputFile = path.join(__dirname, 'gov-multi-pincode.csv');
    const outputFile = path.join(__dirname, 'gov-pincodes.csv');
    
    try {
        // Read the input CSV file
        const data = fs.readFileSync(inputFile, 'utf8');
        const lines = data.trim().split('\n');
        
        // Skip header line and process data
        const header = lines[0];
        const dataLines = lines.slice(1);
        
        // Use a Map to store unique pincodes with their district and state
        const uniquePincodes = new Map();
        
        dataLines.forEach(line => {
            // Parse CSV line (handle quoted fields)
            const fields = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    fields.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            fields.push(current); // Add the last field
            
            if (fields.length >= 9) {
                const pincode = fields[4].trim();
                const district = fields[7].trim().replace(/"/g, '');
                const state = fields[8].trim().replace(/"/g, '');
                
                // Only add if pincode is valid (numeric and not empty)
                if (pincode && /^\d+$/.test(pincode)) {
                    const key = pincode;
                    if (!uniquePincodes.has(key)) {
                        uniquePincodes.set(key, { pincode, district, state });
                    }
                }
            }
        });
        
        // Create output CSV
        const outputLines = ['pincode,district,state'];
        
        // Sort by pincode for consistent output
        const sortedPincodes = Array.from(uniquePincodes.values())
            .sort((a, b) => parseInt(a.pincode) - parseInt(b.pincode));
        
        sortedPincodes.forEach(({ pincode, district, state }) => {
            outputLines.push(`${pincode},"${district}","${state}"`);
        });
        
        // Write output file
        fs.writeFileSync(outputFile, outputLines.join('\n'), 'utf8');
        
        console.log(`Extracted ${uniquePincodes.size} unique pincodes`);
        console.log(`Output written to: ${outputFile}`);
        
    } catch (error) {
        console.error('Error processing CSV:', error.message);
        process.exit(1);
    }
}

// Run the extraction
extractUniquePincodes();