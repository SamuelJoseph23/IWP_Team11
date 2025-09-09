const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Student database
let students = [
  { registerNumber: '123456', password: 'password123', name: 'John Doe', email: 'john@christuniversity.in', department: 'computer-science', phone: '+919876543210', createdAt: '2025-09-01T10:30:00.000Z' },
  { registerNumber: '789012', password: 'student456', name: 'Jane Smith', email: 'jane@christuniversity.in', department: 'information-technology', phone: '+919876543211', createdAt: '2025-09-02T14:20:00.000Z' }
];

// Faculty database
const faculty = [
  { employeeId: 'FAC001', password: 'faculty123' },
  { employeeId: 'FAC002', password: 'professor456' }
];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    const fs = require('fs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.body.registerNumber + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// In-memory storage for internship details
const internshipDetails = {};

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

app.get('/internship-type', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'internship_type.html'));
});

app.get('/offcampus-details', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'offcampus_details.html'));
});

app.get('/student-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student_dashboard.html'));
});

// API ENDPOINTS - ADD THESE
// Get student profile details
app.get('/api/student-profile/:registerNumber', (req, res) => {
  console.log('API call to /api/student-profile/' + req.params.registerNumber);
  
  const registerNumber = req.params.registerNumber;
  const student = students.find(s => s.registerNumber === registerNumber);
  
  if (student) {
    // Don't send password in response
    const { password, ...studentProfile } = student;
    console.log('Found student:', studentProfile);
    res.json({
      success: true,
      profile: studentProfile
    });
  } else {
    console.log('Student not found:', registerNumber);
    res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }
});

// Get internship details for dashboard
app.get('/api/internship-details/:registerNumber', (req, res) => {
  console.log('API call to /api/internship-details/' + req.params.registerNumber);
  
  const registerNumber = req.params.registerNumber;
  const details = internshipDetails[registerNumber];
  
  console.log('Internship details for', registerNumber, ':', details ? 'found' : 'not found');
  
  res.json({
    success: true,
    hasDetails: !!details,
    details: details || null
  });
});

// Student login endpoint
app.post('/student-login', (req, res) => {
  console.log('Student login attempt:', req.body);
  
  const { registerNumber, password } = req.body;
  
  if (!registerNumber || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Register number and password are required' 
    });
  }
  
  const student = students.find(s => 
    s.registerNumber === registerNumber && s.password === password
  );
  
  if (student) {
    // Check if student has submitted internship details
    const hasDetails = !!internshipDetails[registerNumber];
    
    res.json({ 
      success: true, 
      message: 'Student login successful!',
      registerNumber: registerNumber,
      redirectUrl: hasDetails ? '/student-dashboard' : '/internship-type',
      hasInternshipDetails: hasDetails
    });
  } else {
    // Check if register number exists but password is wrong
    const studentExists = students.find(s => s.registerNumber === registerNumber);
    if (studentExists) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid password. Please try again.' 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Register number not found. Would you like to create an account?',
        showRegisterOption: true,
        registerNumber: registerNumber
      });
    }
  }
});

// Student registration endpoint
app.post('/student-register', (req, res) => {
  console.log('Student registration attempt:', req.body);
  
  const { registerNumber, password, confirmPassword, name, email, department, phone } = req.body;
  
  // Validation
  if (!registerNumber || !password || !confirmPassword || !name || !email || !department) {
    return res.status(400).json({
      success: false,
      message: 'All required fields must be filled'
    });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }
  
  // Check if register number already exists
  const existingStudent = students.find(s => s.registerNumber === registerNumber);
  if (existingStudent) {
    return res.status(400).json({
      success: false,
      message: 'Account with this register number already exists'
    });
  }
  
  // Check if email already exists
  const existingEmail = students.find(s => s.email === email);
  if (existingEmail) {
    return res.status(400).json({
      success: false,
      message: 'Account with this email already exists'
    });
  }
  
  // Create new student account
  const newStudent = {
    registerNumber,
    password,
    name,
    email,
    department,
    phone: phone || '',
    createdAt: new Date().toISOString()
  };
  
  students.push(newStudent);
  
  console.log('New student registered:', registerNumber);
  
  res.json({
    success: true,
    message: 'Account created successfully! You can now login.',
    redirectUrl: '/student'
  });
});

// Submit internship details endpoint
app.post('/submit-internship-details', upload.single('offerLetter'), (req, res) => {
  console.log('Internship details submission:', req.body);
  console.log('Uploaded file:', req.file);
  
  const { registerNumber, ...details } = req.body;
  
  if (!registerNumber) {
    return res.status(400).json({
      success: false,
      message: 'Register number is required'
    });
  }
  
  // Store the internship details including file info
  internshipDetails[registerNumber] = {
    ...details,
    offerLetterPath: req.file ? req.file.path : null,
    offerLetterOriginalName: req.file ? req.file.originalname : null,
    submittedAt: new Date().toISOString()
  };
  
  console.log('Stored internship details for:', registerNumber);
  
  res.json({
    success: true,
    message: 'Internship details submitted successfully!',
    redirectUrl: '/student-dashboard'
  });
});

// Faculty login endpoint
app.post('/faculty-login', (req, res) => {
  console.log('Faculty login attempt:', req.body);
  
  const { employeeId, password } = req.body;
  
  if (!employeeId || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Employee ID and password are required' 
    });
  }
  
  const facultyMember = faculty.find(f => 
    f.employeeId === employeeId && f.password === password
  );
  
  if (facultyMember) {
    res.json({ success: true, message: 'Faculty login successful!' });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid employee ID or password' 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Available pages:');
  console.log('- Main page: http://localhost:3000');
  console.log('- Student login: http://localhost:3000/student');
  console.log('- Student registration: http://localhost:3000/student-register');
  console.log('- Faculty login: http://localhost:3000/faculty');
  console.log('- Internship type selection: http://localhost:3000/internship-type');
  console.log('- Off-campus details: http://localhost:3000/offcampus-details');
  console.log('- Student dashboard: http://localhost:3000/student-dashboard');
  console.log('\nAPI Endpoints:');
  console.log('- GET /api/student-profile/:registerNumber');
  console.log('- GET /api/internship-details/:registerNumber');
  console.log('\nTest credentials:');
  console.log('Students - Register: 123456, Password: password123');
  console.log('Students - Register: 789012, Password: student456');
});
