# NSPC 2025 - Required Reports Status

## ✅ IMPLEMENTED (Currently Generating)

### 1. Total Participants
- ✅ **Available** - Can be derived from any existing report's total count
- **File:** Any report in `output/reports/` shows total count

### 2. Daily Participation (July 1 - Aug 27)
- ✅ **Implemented** - `daily-participation` report added
- **File:** `output/reports/daily-participation.csv`
- **Note:** Requires `c_at` field from updated db-export.js

### 3. India Coverage
- ✅ **A. State-wise participation** - `state-wise` report
- ✅ **B. District-wise participation** - `district-wise` report  
- ✅ **C. Kshetra-wise participation** - `kshetra-wise` report
- ✅ **D. Prant-wise participation** - `prant-wise` report
- ❌ **E. Top 10 states** - Need sorted/limited version
- ❌ **F. Top 20 districts** - Need sorted/limited version
- ✅ **G. State-wise 20/20 participants** - `state-wise-20-scorer` report

### 4. Approvals/Institutions
- ✅ **Total institutions** - `institute-wise` report
- ✅ **Institution names with 10+ registrations** - `institute-wise-normalized-name-at-least-10-registrations`
- ❌ **Top 100 institutes** - Need sorted/limited version

### 5. World Coverage
- ✅ **NRI participation** - Handled in all reports (state='NRI')
- **Note:** All reports already handle NRI and blank states

### 6. Categories
- ❌ **a. Category-wise participation** - Missing 'category' field definition
- ❌ **b. Category-wise 20/20 by standard** - Missing 'category' field
- ✅ **c. Gender-wise participants** - `gender-wise` report
- ✅ **c. Gender-wise 20/20 scores** - `grade-gender-wise-20-scorer` report
- ✅ **d. Standard-wise participation** - `grade-wise` report
- ✅ **d. Standard-wise 20/20** - `grade-wise-20-scorer` report
- ❌ **e. Gender-wise by state** - Need cross-tabulation report

### 7. Top States 20/20
- ✅ **Available** - `state-wise-20-scorer` (just needs sorting by count)

### 8. Student Lists State-wise 20/20
- ✅ **Implemented** - `state-wise-20-scorer` student list
- **Folder:** `output/student-lists/state-wise-20-scorer/`

### 9. Language Participation
- ✅ **a. Language-wise participation** - `language-wise` report
- ❌ **b. Top languages** - Need sorted version
- ❌ **c. Category-wise languages** - Missing 'category' field

### 10. Tree Planting
- ✅ **Total participants who planted trees** - `planted_10_seeds-wise` report
- ✅ **20/20 + tree planters** - `planted_10_seeds-wise-20-scorer` report

## ❌ NOT IMPLEMENTED (Need to Create)

### Simple Reports (Can implement easily)
- [ ] **Top 10 states by participation count** (sort existing state-wise)
- [ ] **Top 20 districts by participation count** (sort existing district-wise)
- [ ] **Top 100 institutes by participation count** (sort existing institute-wise)
- [ ] **Top languages by participation count** (sort existing language-wise)
- [ ] **Gender-wise participation by state** (cross-tabulation report)

### Medium Complexity Reports
- [ ] **Category-wise participation** (need to define 'category' field)
- [ ] **Category-wise 20/20 by standard** (need 'category' field)
- [ ] **Category-wise languages** (need 'category' field)

### Complex/External Data Required
- [ ] **Ecomitram app users count** (separate data source)
- [ ] **Ecomitram app data sent** (separate data source)
- [ ] **Ecomitram app max daily users** (separate data source)
- [ ] **Ecomitram app installations** (separate data source)
- [ ] **Ecomitram app server hits** (separate data source)

## 📝 IMPLEMENTATION NOTES

### Priority 1 (Easy wins - just sorting existing data)
1. Top 10 states - Sort `state-wise.csv` by count DESC, take top 10
2. Top 20 districts - Sort `district-wise.csv` by count DESC, take top 20  
3. Top 100 institutes - Sort `institute-wise.csv` by count DESC, take top 100
4. Top languages - Sort `language-wise.csv` by count DESC

### Priority 2 (New reports with existing data)
5. Gender-wise by state cross-tabulation
6. Total participant count summary

### Priority 3 (Need data clarification)
7. Category field definition and implementation
8. Ecomitram app data source integration

### Data Requirements
- ✅ **c_at field** - Added to db-export.js for daily participation
- ❌ **category field** - Need to clarify what this represents
- ❌ **Ecomitram data** - Need separate data source/API

## 📊 CURRENT STATISTICS
- **✅ Implemented:** 18/31 requirements (58%)
- **❌ Missing:** 13/31 requirements (42%)
  - 5 simple sorting tasks
  - 3 category-related (need field definition)
  - 5 Ecomitram app metrics (need external data)

## 🎯 NEXT STEPS
1. Implement the 5 "Top N" sorting reports
2. Create gender-by-state cross-tabulation report
3. Clarify category field definition
4. Identify Ecomitram app data source