const mongoose = require('mongoose');

const prisonerRecordSchema = new mongoose.Schema({
  PID: { type: Number, index: true },      
  JID: { type: String, index: true },   //      77-3917-2026-UT  , this suffix in the last tells the actual type of prisoner UT/CT
  'Prisoner Name': { type: String, index: true },   // ANIL MAURYA (5701/25) @ (UT-427/26) 
  'Father Name': String,
  Gender: String,
  Age: Number,
  'FIR/Case No': String,
  'PS Name': String,
  'Prisoner Alias Name': String,
  'Mother Name': String,
  'Spouse Name': String,
  'Permanent Address': String,
  PermtDistrict: String,
  PermtState: String,
  'Present Address': String,
  PresentDistrict: String,
  PresentState: String,
  'Jail Name': String,
  'Prisoner Type': String,              // This tells whether a prisoner is UT/CT
  Ward: String,
  Barrack: String,
  RegisterNo: String,                   // this is ut/ct number, changes when a prisoner is convicted
  'Period Undergone(Days)': Number,
  'First Admission Date': String,
  'Latest Admission Date': String,
  'Release Date': String,
  Tendency: String,
  ImprisonmentType: String,
  Occupation: String,
  'Duty Point': String,
  'Relative Contact': String,
  Religion: String,
  Case_Type: String,
  '14-Digit FIR No': String,
  'CNR No': { type: String, index: true },
  'PTN No': String,
  'Case SNO': Number,
  'Case Year': Number,
  'FIR SNo': String,
  'FIR Year': Number,
  'Case No.': String,
  'Act Section': String,    //411,413 IPC AND 4/5 EXP(S) ACT
  'FIR Date': String,     
  'Court Name': String,   // by default it shows Alld District Court 
  'Judge Name': String,
  'Action Code': String,
  'Action Date': String,
  'Next Date': mongoose.Schema.Types.Mixed,
  'Date Of Disposal': String,
  'Sentence Year': Number,
  'Sentence Month': Number,
  'Prob Date Release': String,
  WarrentDate: String,
  Nationality: String,
  'PS District': String,
  'PS State': String,
  'Status(True Or False)': String
}, { timestamps: true });

const PrisonerRecord = mongoose.model('PrisonerRecord', prisonerRecordSchema);
module.exports = PrisonerRecord;