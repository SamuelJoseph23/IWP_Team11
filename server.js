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

// Your Railway MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:ZkjlIleshkrqBLcjldnzVcsndxEHRtnJ@mongodb.railway.internal:27017';

// MongoDB Connection
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected Successfully');
    console.log('🔗 Connected to Railway MongoDB');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
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

const facultySchema = new mongoose.Schema({
  employeeId: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: String,
  department: String,
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

// Session configuration with MongoDB store
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = req.body.registerNumber + '-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
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
    const student = await Student.findOne({ registerNumber: req.params.registerNumber }).select('-password');
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
    const details = await InternshipDetails.findOne({ registerNumber: req.params.registerNumber });
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
    const report = await InternshipReport.findOne({ registerNumber: req.params.registerNumber });
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

// Student login
app.post('/student-login', async (req, res) => {
  try {
    const { registerNumber, password } = req.body;
    
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

// Student registration
app.post('/student-register', async (req, res) => {
  try {
    const { registerNumber, password, confirmPassword, name, email, department, phone } = req.body;
    
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
      phone: phone || ''
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

// Submit internship details
app.post('/submit-internship-details', upload.single('offerLetter'), async (req, res) => {
  try {
    const { registerNumber, ...details } = req.body;
    
    if (!registerNumber) {
      return res.status(400).json({ success: false, message: 'Register number is required' });
    }
    
    // Prepare internship details
    const internshipData = {
      registerNumber,
      ...details,
      offerLetterFilename: req.file ? req.file.filename : null,
      offerLetterPath: req.file ? req.file.path : null
    };
    
    // Save or update internship details
    await InternshipDetails.findOneAndUpdate(
      { registerNumber },
      internshipData,
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      message: 'Internship details submitted successfully!',
      redirectUrl: '/student-dashboard'
    });
  } catch (error) {
    console.error('Internship submission error:', error);
    res.status(500).json({ success: false, message: 'Server error during internship submission' });
  }
});

// Submit internship report
app.post('/submit-internship-report', upload.single('internshipReport'), async (req, res) => {
  try {
    const { registerNumber, ...reportData } = req.body;
    
    if (!registerNumber) {
      return res.status(400).json({ success: false, message: 'Register number is required' });
    }
    
    // Prepare report data
    const reportInfo = {
      registerNumber,
      ...reportData,
      reportFilename: req.file ? req.file.filename : null,
      reportPath: req.file ? req.file.path : null
    };
    
    // Save or update report
    await InternshipReport.findOneAndUpdate(
      { registerNumber },
      reportInfo,
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      message: 'Internship report submitted successfully!',
      redirectUrl: '/student-dashboard'
    });
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ success: false, message: 'Server error during report submission' });
  }
});

// Faculty login
app.post('/faculty-login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    
    if (!employeeId || !password) {
      return res.status(400).json({ success: false, message: 'Employee ID and password are required' });
    }
    
    const facultyMember = await Faculty.findOne({ employeeId, password });
    
    if (!facultyMember) {
      return res.status(401).json({ success: false, message: 'Invalid employee ID or password' });
    }
    
    req.session.faculty = { employeeId: facultyMember.employeeId };
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
        { employeeId: 'FAC001', password: 'faculty123', name: 'Dr. Faculty One', department: 'Computer Science' },
        { employeeId: 'FAC002', password: 'professor456', name: 'Prof. Faculty Two', department: 'Information Technology' }
      ]);
      console.log('✅ Default faculty accounts created');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Database: Railway MongoDB`);
      console.log('\n📄 Available endpoints:');
      console.log('- Main: /');
      console.log('- Student login: /student');
      console.log('- Student registration: /student-register');
      console.log('- Faculty login: /faculty');
      console.log('- Internship details: /internship-details');
      console.log('- Internship report: /internship-report');
      console.log('- Student dashboard: /student-dashboard');
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
  console.log('📤 MongoDB connection closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  console.log('📤 MongoDB connection closed');
  process.exit(0);
});

startServer();
