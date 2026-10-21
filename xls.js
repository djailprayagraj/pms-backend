const XLSX = require('xlsx');




// Function to read and inspect Excel data
const readExcelFile = (filePath) => {
  try {
    // 1. Read the Excel workbook
    const workbook = XLSX.readFile(filePath);
    
    // 2. Get the first sheet's name
    const sheetName = workbook.SheetNames[0];
    console.log(`\n📄 Reading Sheet: "${sheetName}"`);
    
    // 3. Convert sheet data into JSON rows
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Total Rows Found: ${jsonData.length}`);

    if (jsonData.length > 0) {
      // 4. Extract and print the exact column headers (Keys)
      const columnHeaders = Object.keys(jsonData[0]);
      console.log('🔑 Column Headers (Use these for your Mongoose Schema):');
      console.log(columnHeaders);
      
      console.log('📝 First Row Sample:');
      console.log(jsonData[0]);
    } else {
      console.log('⚠️ The Excel sheet appears to be empty.');
    }

    return {
      success: true,
      totalRows: jsonData.length,
      headers: jsonData.length > 0 ? Object.keys(jsonData[0]) : [],
      sampleData: jsonData[0] || null,
      data: jsonData // <-- Complete dataset included here
    };

  } catch (error) {
    console.error('❌ Error reading Excel file:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = readExcelFile;