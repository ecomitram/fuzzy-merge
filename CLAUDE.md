# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Node.js tool for analyzing assessment data through fuzzy string matching to merge CSV records. The project processes student assessment data with location mapping (district → prant → kshetra hierarchy) and generates various reports and student lists based on different criteria.

## Commands

### Core Operations
- `npm start` or `node index.js` - Process assessment data and generate reports/student lists
- `node mapper/mapper.js` - Build location mapping from CSV files (districts, prants, kshetras)
- `node db-export.js <host> <port> <db_name> <output_file>` - Export data from MongoDB to CSV

### Database Operations
- `./db-connect.sh` - Connect to remote MongoDB via SSH tunnel and export assessment data
- `./db-upload-to-cms.sh <table> <csv_file> <password> <columns>` - Upload processed CSV to MySQL CMS

## Architecture

### Data Flow
1. **Data Export**: MongoDB assessment collection → CSV via `db-export.js`
2. **Location Mapping**: Geographic data processed by `mapper/mapper.js` creates district→prant→kshetra mapping
3. **Processing**: Main `index.js` applies fuzzy matching for location normalization and institute name deduplication
4. **Output Generation**: Creates categorized reports and filtered student lists

### Key Components

**Main Processing (`index.js`)**
- CSV parsing with location mapping via `mapper/mapper.json`
- Fuzzy string matching using FuzzySet for institute name normalization
- Report generation system with configurable filters and preprocessing
- Student list generation with geographic and score-based segmentation

**Location Mapping (`mapper/`)**
- `districts.json` - District to state mapping
- `prants.csv/json` - District to prant (administrative region) mapping  
- `kshetra.csv` - Prant to kshetra (larger region) mapping
- `mapper.js` - Builds unified mapping from source files

**Database Integration**
- MongoDB aggregation pipeline for data export with participant details
- SSH tunnel setup for secure remote database access
- MySQL import functionality for processed results

### Data Structure
Assessment records contain: student details (name, email, phone, age, language), institution info, location data (city, state, district), assessment results (score, grade), and demographic data (gender, registration type).

### Output Structure
- `output/reports/` - Aggregated statistics by various dimensions (location, demographics, scores)
- `output/student-lists/` - Filtered student records grouped by criteria
- Reports use configurable `check`, `preprocess`, and `postCheck` functions for flexible data processing

### Fuzzy Matching Strategy
- Institute names normalized per district+state combination
- City names cleaned and mapped to standardized district names
- 0.9 threshold for institute matching, 0.75 for location matching
- Handles special cases: NRI students, blank/missing data