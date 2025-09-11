const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Atlas connection with your credentials
const MONGO_URI = process.env.MONGO_URI || 
  'mongodb+srv://samueljoseph:samuel@iwpcluster.f754koy.mongodb.net/IWP_Team11?retryWrites=true&w=majority&appName=IWPCluster';

// MongoDB Connection Function
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });
    console.log('✅ MongoDB Atlas Connected Successfully');
    console.log('🗄️  Database: IWP_Team11');
    console.log('☁️  Provider: MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB Atlas Connection Error:', error);
    process.exit(1);
  }
}

// MongoDB Schemas
const studentSchema = new mongoose.Schema({
  registerNumber: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  department: { type: String, required: true },
  phone: String,
  createdAt: { type: Date, default: Date.now }
});

// 🔧 UPDATED Faculty Schema with additional fields
const facultySchema = new mongoose.Schema({
  employeeId: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  department: { type: String, required: true },
  phone: String,
  createdAt: { type: Date, default: Date.now }
});

const internshipDetailsSchema = new mongoose.Schema({
  registerNumber: { type: String, required: true },
  internshipType: { type: String, required: true },
  
  // Student Details
  studentName: String,
  department: String,
  studentEmail: String,
  
  // Off-campus fields
  companyName: String,
  companyType: String,
  companyAddress: String,
  jobTitle: String,
  jobDepartment: String,
  workMode: String,
  stipend: Number,
  supervisorName: String,
  supervisorDesignation: String,
  supervisorEmail: String,
  supervisorPhone: String,
  
  // On-campus fields
  universityDepartment: String,
  projectTitle: String,
  labName: String,
  internshipDuration: String,
  mentorName: String,
  mentorDesignation: String,
  mentorEmail: String,
  mentorPhone: String,
  expectedDeliverables: String,
  
  // Common fields
  startDate: Date,
  endDate: Date,
  learningObjectives: String,
  additionalNotes: String,
  jobDescription: String,
  projectDescription: String,
  
  // File info
  offerLetterFilename: String,
  offerLetterPath: String,
  
  submittedAt: { type: Date, default: Date.now }
});

const internshipReportSchema = new mongoose.Schema({
  registerNumber: { type: String, required: true },
  department: String,
  name: String,
  internshipType: String,
  internshipRole: String,
  startDate: Date,
  mentor: String,
  summary: String,
  rating: { type: Number, min: 0, max: 10 },
  declaration: Boolean,
  
  // File info
  reportFilename: String,
  reportPath: String,
  
  submittedAt: { type: Date, default: Date.now }
});

// Models
const Student = mongoose.model('Student', studentSchema);
const Faculty = mongoose.model('Faculty', facultySchema);
const InternshipDetails = mongoose.model('InternshipDetails', internshipDetailsSchema);
const InternshipReport = mongoose.model('InternshipReport', internshipReportSchema);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration with MongoDB Atlas store
app.use(session({
  secret: process.env.SESSION_SECRET || 'christ-university-internship-portal-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Input sanitization function
function sanitizeInput(input) {
  if (Array.isArray(input)) {
    return String(input[0]).trim();
  }
  return String(input || '').trim();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const registerNumber = sanitizeInput(req.body.registerNumber);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = registerNumber + '-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed!'), false);
    }
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.get('/student-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student_register.html'));
});

app.get('/faculty', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'faculty.html'));
});

// 🆕 NEW: Teacher registration page route
app.get('/teacher-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher_register.html'));
});

app.get('/internship-details', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'internship_details.html'));
});

app.get('/internship-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'internship_report.html'));
});

app.get('/student-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student_dashboard.html'));
});

app.get('/teacher-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher_dashboard.html'));
});

// API Endpoints

// Get student profile
app.get('/api/student-profile/:registerNumber', async (req, res) => {
  try {
    const registerNumber = sanitizeInput(req.params.registerNumber);
    const student = await Student.findOne({ registerNumber }).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, profile: student });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get internship details
app.get('/api/internship-details/:registerNumber', async (req, res) => {
  try {
    const registerNumber = sanitizeInput(req.params.registerNumber);
    const details = await InternshipDetails.findOne({ registerNumber });
    res.json({
      success: true,
      hasDetails: !!details,
      details: details || null
    });
  } catch (error) {
    console.error('Error fetching internship details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get internship report
app.get('/api/internship-report/:registerNumber', async (req, res) => {
  try {
    const registerNumber = sanitizeInput(req.params.registerNumber);
    const report = await InternshipReport.findOne({ registerNumber });
    res.json({
      success: true,
      hasReport: !!report,
      report: report || null
    });
  } catch (error) {
    console.error('Error fetching internship report:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Student login - FIXED
app.post('/student-login', async (req, res) => {
  try {
    let { registerNumber, password } = req.body;
    
    // Sanitize inputs
    registerNumber = sanitizeInput(registerNumber);
    password = sanitizeInput(password);
    
    if (!registerNumber || !password) {
      return res.status(400).json({ success: false, message: 'Register number and password are required' });
    }
    
    const student = await Student.findOne({ registerNumber, password });
    
    if (!student) {
      const studentExists = await Student.findOne({ registerNumber });
      if (studentExists) {
        return res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
      } else {
        return res.status(401).json({ 
          success: false, 
          message: 'Register number not found. Would you like to create an account?',
          showRegisterOption: true,
          registerNumber: registerNumber
        });
      }
    }
    
    // Set session
    req.session.user = {
      registerNumber: student.registerNumber,
      name: student.name
    };
    
    // Check if internship details exist
    const hasDetails = await InternshipDetails.exists({ registerNumber });
    
    res.json({
      success: true,
      message: 'Student login successful!',
      registerNumber: registerNumber,
      redirectUrl: hasDetails ? '/student-dashboard' : '/internship-details',
      hasInternshipDetails: !!hasDetails
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// Student registration - FIXED
app.post('/student-register', async (req, res) => {
  try {
    let { registerNumber, password, confirmPassword, name, email, department, phone } = req.body;
    
    // Sanitize all inputs
    registerNumber = sanitizeInput(registerNumber);
    password = sanitizeInput(password);
    confirmPassword = sanitizeInput(confirmPassword);
    name = sanitizeInput(name);
    email = sanitizeInput(email);
    department = sanitizeInput(department);
    phone = sanitizeInput(phone);
    
    // Validation
    if (!registerNumber || !password || !confirmPassword || !name || !email || !department) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    
    // Check for existing user
    const existingUser = await Student.findOne({
      $or: [{ registerNumber }, { email }]
    });
    
    if (existingUser) {
      const field = existingUser.registerNumber === registerNumber ? 'register number' : 'email';
      return res.status(400).json({ success: false, message: `Account with this ${field} already exists` });
    }
    
    // Create new student
    const newStudent = new Student({
      registerNumber,
      password,
      name,
      email,
      department,
      phone
    });
    
    await newStudent.save();
    
    res.json({
      success: true,
      message: 'Account created successfully! You can now login.',
      redirectUrl: '/student'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// 🆕 NEW: Teacher registration route
app.post('/teacher-register', async (req, res) => {
  try {
    let { employeeId, password, name, email, department, phone } = req.body;
    
    // Sanitize all inputs
    employeeId = sanitizeInput(employeeId);
    password = sanitizeInput(password);
    name = sanitizeInput(name);
    email = sanitizeInput(email);
    department = sanitizeInput(department);
    phone = sanitizeInput(phone);
    
    // Validation
    if (!employeeId || !password || !name || !email || !department) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    
    // Check for existing faculty
    const existingFaculty = await Faculty.findOne({
      $or: [{ employeeId }, { email }]
    });
    
    if (existingFaculty) {
      const field = existingFaculty.employeeId === employeeId ? 'employee ID' : 'email';
      return res.status(400).json({ success: false, message: `Account with this ${field} already exists` });
    }
    
    // Create new faculty member
    const newFaculty = new Faculty({
      employeeId,
      password,
      name,
      email,
      department,
      phone
    });
    
    await newFaculty.save();
    
    res.json({
      success: true,
      message: 'Faculty account created successfully! You can now login.',
    });
  } catch (error) {
    console.error('Faculty registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// Submit internship details - FIXED with input sanitization
app.post('/submit-internship-details', upload.single('offerLetter'), async (req, res) => {
  console.log('📋 === INTERNSHIP SUBMISSION START ===');
  console.log('📝 Raw request body keys:', Object.keys(req.body));
  
  try {
    let { registerNumber, ...details } = req.body;
    
    // 🔧 CRITICAL FIX: Sanitize registerNumber if it's an array
    registerNumber = sanitizeInput(registerNumber);
    
    console.log('📊 Sanitized registerNumber:', registerNumber, 'Type:', typeof registerNumber);
    
    if (!registerNumber) {
      console.log('❌ Missing register number after sanitization');
      return res.status(400).json({ success: false, message: 'Register number is required' });
    }
    
    // Sanitize all other string fields
    Object.keys(details).forEach(key => {
      if (typeof details[key] === 'string' || Array.isArray(details[key])) {
        details[key] = sanitizeInput(details[key]);
      }
    });
    
    // Prepare internship details
    const internshipData = {
      registerNumber,
      ...details,
      offerLetterFilename: req.file ? req.file.filename : null,
      offerLetterPath: req.file ? req.file.path : null
    };
    
    console.log('💾 Saving internship data for:', registerNumber);
    
    // Save or update internship details
    const result = await InternshipDetails.findOneAndUpdate(
      { registerNumber },
      internshipData,
      { upsert: true, new: true }
    );
    
    console.log('✅ Internship details saved successfully with ID:', result._id);
    
    res.json({
      success: true,
      message: 'Internship details submitted successfully!',
      redirectUrl: '/student-dashboard'
    });
  } catch (error) {
    console.error('❌ Internship submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during internship submission: ' + error.message
    });
  }
  
  console.log('📋 === INTERNSHIP SUBMISSION END ===');
});

// Submit internship report - FIXED with input sanitization  
app.post('/submit-internship-report', upload.single('internshipReport'), async (req, res) => {
  console.log('📄 === REPORT SUBMISSION START ===');
  console.log('📝 Raw request body keys:', Object.keys(req.body));
  
  try {
    let { registerNumber, ...reportData } = req.body;
    
    // 🔧 CRITICAL FIX: Sanitize registerNumber if it's an array
    registerNumber = sanitizeInput(registerNumber);
    
    console.log('📊 Sanitized registerNumber:', registerNumber, 'Type:', typeof registerNumber);
    
    if (!registerNumber) {
      console.log('❌ Missing register number after sanitization');
      return res.status(400).json({ success: false, message: 'Register number is required' });
    }
    
    // Sanitize all other string fields
    Object.keys(reportData).forEach(key => {
      if (typeof reportData[key] === 'string' || Array.isArray(reportData[key])) {
        reportData[key] = sanitizeInput(reportData[key]);
      }
    });
    
    // Prepare report data
    const reportInfo = {
      registerNumber,
      ...reportData,
      reportFilename: req.file ? req.file.filename : null,
      reportPath: req.file ? req.file.path : null
    };
    
    console.log('💾 Saving report data for:', registerNumber);
    
    // Save or update report
    const result = await InternshipReport.findOneAndUpdate(
      { registerNumber },
      reportInfo,
      { upsert: true, new: true }
    );
    
    console.log('✅ Report saved successfully with ID:', result._id);
    
    res.json({
      success: true,
      message: 'Internship report submitted successfully!',
      redirectUrl: '/student-dashboard'
    });
  } catch (error) {
    console.error('❌ Report submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during report submission: ' + error.message
    });
  }
  
  console.log('📄 === REPORT SUBMISSION END ===');
});

// Faculty login - FIXED
app.post('/faculty-login', async (req, res) => {
  try {
    let { employeeId, password } = req.body;
    
    // Sanitize inputs
    employeeId = sanitizeInput(employeeId);
    password = sanitizeInput(password);
    
    if (!employeeId || !password) {
      return res.status(400).json({ success: false, message: 'Employee ID and password are required' });
    }
    
    const facultyMember = await Faculty.findOne({ employeeId, password });
    
    if (!facultyMember) {
      return res.status(401).json({ success: false, message: 'Invalid employee ID or password' });
    }
    
    req.session.faculty = { employeeId: facultyMember.employeeId, name: facultyMember.name };
    res.json({ success: true, message: 'Faculty login successful!' });
  } catch (error) {
    console.error('Faculty login error:', error);
    res.status(500).json({ success: false, message: 'Server error during faculty login' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      res.status(500).json({ success: false, message: 'Logout failed' });
    } else {
      res.json({ success: true, message: 'Logged out successfully' });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
  try {
    await connectDB();
    
    // Create default faculty accounts if they don't exist
    const facultyCount = await Faculty.countDocuments();
    if (facultyCount === 0) {
      await Faculty.insertMany([
        { 
          employeeId: 'FAC001', 
          password: 'faculty123', 
          name: 'Dr. Faculty One', 
          email: 'faculty1@christuniversity.in',
          department: 'Computer Science' 
        },
        { 
          employeeId: 'FAC002', 
          password: 'professor456', 
          name: 'Prof. Faculty Two', 
          email: 'faculty2@christuniversity.in',
          department: 'Information Technology' 
        }
      ]);
      console.log('✅ Default faculty accounts created');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Christ University Internship Portal`);
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📊 Database: IWP_Team11 (MongoDB Atlas)`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('\n📄 Available endpoints:');
      console.log('   - Main page: /');
      console.log('   - Student login: /student');
      console.log('   - Student registration: /student-register');
      console.log('   - Faculty login: /faculty');
      console.log('   - Teacher registration: /teacher-register');
      console.log('   - Internship details: /internship-details');
      console.log('   - Internship report: /internship-report');
      console.log('   - Student dashboard: /student-dashboard');
      console.log('   - Teacher dashboard: /teacher-dashboard');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  console.log('📤 MongoDB Atlas connection closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  console.log('📤 MongoDB Atlas connection closed');
  process.exit(0);
});

startServer();
