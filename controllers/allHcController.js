const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION: Set the Court Number Here
// ==========================================
const TARGET_COURT_NO = '82'; // Change this to '82', '66', etc. as needed

// Dynamic file path based on the selected court number
const filePath = path.join(__dirname, `../court${TARGET_COURT_NO}_cases_log.json`);

// Memory store for tracking case history and start/end times
let courtHistory = [];

// Helper function to load existing log from file if server restarts
const loadExistingLog = () => {
  try {
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, 'utf8');
      courtHistory = JSON.parse(rawData);
    }
  } catch (err) {
    console.error(`Error loading existing log for Court ${TARGET_COURT_NO}:`, err.message);
  }
};

loadExistingLog();

// Function to poll court API, parse the target court, and calculate start/end times
const trackCourtCases = async () => {
  const url = 'https://courtview2.allahabadhighcourt.in/courtview/CourtViewAllahabad.do';

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const htmlText = await response.text();
    const ch = cheerio.load(htmlText);

    let currentActiveCase = null;
    const nowISO = new Date().toISOString();

    // Iterate through table rows
    ch('table tr').each((index, element) => {
      const tds = ch(element).find('td');

      if (tds.length >= 2) {
        let courtNo = ch(tds[0]).text().trim().replace(/\s+/g, '');

        // Match against the configured target court number
        if (courtNo === TARGET_COURT_NO) {
          let serialNo = null;
          let listType = null;
          let progress = null;
          let caseDetailsRaw = null;
          let importantInfo = null;

          if (tds.length >= 5) {
            serialNo = ch(tds[1]).text().trim();
            listType = ch(tds[2]).text().trim();
            progress = ch(tds[3]).text().trim();
            caseDetailsRaw = ch(tds[4]).html();
            importantInfo = ch(tds[5]).text().trim();
          } else if (tds.length === 3) {
            progress = ch(tds[1]).text().trim();
            importantInfo = ch(tds[2]).text().trim();
          }

          let parsedCase = null;
          if (caseDetailsRaw) {
            const caseCh = cheerio.load(caseDetailsRaw);
            const fullText = caseCh.text();

            const caseNoMatch = fullText.match(/([A-Z0-9]+\/\d+\/\d+)/);
            const titleMatch = fullText.match(/Title\s*[:\-]\s*([^\n<]+)/i);
            const petCounselMatch = fullText.match(/Petitioner's\s*Counsels\s*[:\-]\s*([^\n<]+)/i);
            const respCounselMatch = fullText.match(/Respondent's\s*Counsel\s*[:\-]\s*([^\n<]+)/i);

            parsedCase = {
              caseNumber: caseNoMatch ? caseNoMatch[1].trim() : null,
              title: titleMatch ? titleMatch[1].trim() : null,
              petitionerCounsels: petCounselMatch ? petCounselMatch[1].trim() : null,
              respondentCounsel: respCounselMatch ? respCounselMatch[1].trim() : null
            };
          }

          if (parsedCase && parsedCase.caseNumber) {
            currentActiveCase = {
              serialNo: serialNo || null,
              listType: listType || null,
              progress: progress || null,
              caseDetails: parsedCase,
              importantInformation: importantInfo || null
            };
          }
        }
      }
    });

    // Check if target court is currently hearing a case
    if (currentActiveCase) {
      const activeCaseNo = currentActiveCase.caseDetails.caseNumber;

      // Find if this case is currently ongoing in our log
      let ongoingEntry = courtHistory.find(
        (entry) => entry.caseDetails.caseNumber === activeCaseNo && entry.endTime === null
      );

      if (!ongoingEntry) {
        // Close any previously open case that finished
        courtHistory.forEach((entry) => {
          if (entry.endTime === null) {
            entry.endTime = nowISO;
          }
        });

        // Add the newly started case
        courtHistory.push({
          courtNo: TARGET_COURT_NO,
          startTime: nowISO,
          endTime: null,
          lastActiveTime: nowISO,
          serialNo: currentActiveCase.serialNo,
          listType: currentActiveCase.listType,
          progress: currentActiveCase.progress,
          caseDetails: currentActiveCase.caseDetails,
          importantInformation: currentActiveCase.importantInformation
        });
        console.log(`[${new Date().toLocaleTimeString()}] Court ${TARGET_COURT_NO} - Started hearing case: ${activeCaseNo}`);
      } else {
        // Case is still being heard, update last active timestamp
        ongoingEntry.lastActiveTime = nowISO;
        ongoingEntry.progress = currentActiveCase.progress;
      }
    } else {
      // If target court is NOT in session or empty, close any active open case
      courtHistory.forEach((entry) => {
        if (entry.endTime === null) {
          entry.endTime = nowISO;
          console.log(`[${new Date().toLocaleTimeString()}] Court ${TARGET_COURT_NO} - Concluded hearing for case: ${entry.caseDetails.caseNumber}`);
        }
      });
    }

    // Save updated history list to JSON file
    fs.writeFileSync(filePath, JSON.stringify(courtHistory, null, 2), 'utf8');

  } catch (error) {
    console.error(`Error tracking Court ${TARGET_COURT_NO} cases:`, error.message);
  }
};

// Poll the API every 10 seconds (10000ms)
setInterval(trackCourtCases, 10000);

// Express Route Controller to view tracked court history as JSON
const getCourtHistory = (req, res) => {
  try {
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, 'utf8');
      return res.json(JSON.parse(rawData));
    } else {
      return res.json([]);
    }
  } catch (error) {
    return res.status(500).json({ error: `Failed to read Court ${TARGET_COURT_NO} log file` });
  }
};

module.exports = {
  fetchCourtData: getCourtHistory,
  trackCourtCases
};