const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// above are only library imports




const connectDB = require('./config/db'); // connecting to database over here.



// Routes start over here 
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const dataRoutes = require('./routes/dataRoutes'); // to upload files to backen
const fetchRecordsRoutes = require('./routes/fetchRecordsRoutes');
const hearingRoutes = require('./routes/hearingRoutes');
const adalatRoutes = require('./routes/adalatRoutes');
const allahabadhighcourt = require('./routes/allHcRoutes');
// Routes end over here 


// 1. Import your xls function
const readExcelFile = require('./xls');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies (useful for future API endpoints)
app.use(express.json());
app.use(cors());


// Middleware functions above 


// Connect to Database
connectDB();


// Basic GET route
app.get('/', (req, res) => {
    res.json({ 
        message: "Hello World! Welcome to the District Jail Management System API." 
    });
});



// 2. GET route to trigger the Excel file processing and display full JSON data
app.get('/get', (req, res) => {
    // Relative path to your ePrison excel file
    const filePath = './excel/eprison1monthdata.xls'; 

    
    const result = readExcelFile(filePath); // from the xls.js file a function named  readExcelFile(parameter) which takes file path as parameter is run and result is returned to to the constant

    if (result.success) {
        res.json({
            message: "Excel file processed successfully!",
            totalRows: result.totalRows,
            columnHeaders: result.headers,
            allData: result.data // Displays the entire 3000+ rows in JSON format
        });
    } else {
        res.status(500).json({
            message: "Failed to process Excel file",
            error: result.error
        });
    }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/data', dataRoutes); // to uploaf files on backend  /api/data/import
app.use('/api/prisoners', fetchRecordsRoutes);
app.use('/api/hearings', hearingRoutes);
app.use('/api/adalat', adalatRoutes);
app.use('/api/HC', allahabadhighcourt);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running successfully on http://localhost:${PORT}`);
});