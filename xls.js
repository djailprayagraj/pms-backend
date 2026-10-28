const XLSX = require('xlsx');




// Function to read and inspect Excel and convert it into json.
const readExcelFile = (filePath) => {
  try {

   
    const workbook = XLSX.readFile(filePath);    // 1. Read the Excel file and keep it in variable named workbook
    
   
    const sheetName = workbook.SheetNames[0];     // 2. from the workbook variable take its first sheetname store in sheetname Variable.
    console.log(`\n📄 Reading Sheet: "${sheetName}"`);   // 3.console.log first sheet's name
    
   
    const worksheet = workbook.Sheets[sheetName];     // 4. from the workbook variable get the sheet or sheet data itself and store it in variable worksheet
    const jsonData = XLSX.utils.sheet_to_json(worksheet); // 5. now the worksheet which is in worsheet variable is changed to json using 

    console.log(`📊 Total Rows Found: ${jsonData.length}`);

    if (jsonData.length > 0) {
      // 4. Extract and print the exact column headers (Keys)
      const columnHeaders = Object.keys(jsonData[0]);   // from the json data the first entry is taken and then it's key is extracted i.e columns name
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