const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
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

// Data persistence setup
const DATA_FILE = path.join(__dirname, 'data.json');

// Load data from JSON file or create default structure
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(rawData);
      console.log('Data loaded from file:', DATA_FILE);
      return data;
    } else {
      console.log('Creating new data file:', DATA_FILE);
      // Return default data structure if file doesn't exist
      return {
        students: [
          { 
            registerNumber: '123456', 
            password: 'password123', 
            name: 'John Doe', 
            email: 'john@christuniversity.in', 
            department: 'computer-science', 
            phone: '+919876543210', 
            createdAt: '2025-09-01T10:30:00.000Z' 
          },
          { 
            registerNumber: '789012', 
            password: 'student456', 
            name: 'Jane Smith', 
            email: 'jane@christuniversity.in', 
            department: 'information-technology', 
            phone: '+919876543211', 
            createdAt: '2025-09-02T14:20:00.000Z' 
          }
        ],
        faculty: [
          { employeeId: 'FAC001', password: 'faculty123' },
          { employeeId: 'FAC002', password: 'professor456' }
        ],
        internshipDetails: {}
      };
    }
  } catch (error) {
    console.error('Error loading data:', error);
    return { students: [], faculty: [], internshipDetails: {} };
  }
}

// Save data to JSON file
function saveData() {
  try {
    const dataToSave = {
      students: students,
      faculty: faculty,
      internshipDetails: internshipDetails
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    console.log('✅ Data saved successfully to', DATA_FILE);
  } catch (error) {
    console.error('❌ Error saving data:', error);
  }
}

// Load initial data
const initialData = loadData();
let students = initialData.students || [];
let faculty = initialData.faculty || [];
let internshipDetails = initialData.internshipDetails || {};

// Save initial data if new file was created
if (!fs.existsSync(DATA_FILE)) {
  saveData();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
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

app.get('/student-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student_dashboard.html'));
});

// Debug endpoint to check data
app.get('/debug/data', (req, res) => {
  res.json({
    studentsCount: students.length,
    students: students.map(s => ({ registerNumber: s.registerNumber, name: s.name })),
    internshipDetailsCount: Object.keys(internshipDetails).length,
    internshipDetailsKeys: Object.keys(internshipDetails),
    filePath: DATA_FILE
  });
});

// API endpoints
app.get('/api/student-profile/:registerNumber', (req, res) => {
  console.log('🔍 API call to /api/student-profile/' + req.params.registerNumber);
  
  const registerNumber = req.params.registerNumber;
  const student = students.find(s => s.registerNumber === registerNumber);
  
  if (student) {
    const { password, ...studentProfile } = student;
    console.log('✅ Found student:', studentProfile.name);
    res.json({
      success: true,
      profile: studentProfile
    });
  } else {
    console.log('❌ Student not found:', registerNumber);
    res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }
});

app.get('/api/internship-details/:registerNumber', (req, res) => {
  console.log('🔍 API call to /api/internship-details/' + req.params.registerNumber);
  
  const registerNumber = req.params.registerNumber;
  const details = internshipDetails[registerNumber];
  
  console.log(`📊 Internship details for ${registerNumber}:`, details ? 'FOUND' : 'NOT FOUND');
  
  res.json({
    success: true,
    hasDetails: !!details,
    details: details || null
  });
});

// Student login endpoint - FIXED VERSION
app.post('/student-login', (req, res) => {
  console.log('🔐 === LOGIN REQUEST START ===');
  console.log('📝 Request body:', req.body);
  
  try {
    const { registerNumber, password } = req.body;
    
    if (!registerNumber || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ 
        success: false, 
        message: 'Register number and password are required' 
      });
    }
    
    console.log('🔍 Looking for student in database...');
    console.log('👥 Available students:', students.map(s => s.registerNumber));
    
    const student = students.find(s => 
      s.registerNumber === registerNumber && s.password === password
    );
    
    console.log('👤 Student found:', !!student);
    
    if (student) {
      console.log('📋 Checking internship details...');
      console.log('🗂️ All internship details keys:', Object.keys(internshipDetails));
      console.log('🔍 Looking for details for:', registerNumber);
      
      const hasDetails = !!internshipDetails[registerNumber];
      console.log('✅ Has internship details:', hasDetails);
      
      if (hasDetails) {
        console.log('🎯 User has details, redirecting to dashboard');
      } else {
        console.log('📝 User has no details, redirecting to internship form');
      }
      
      const response = { 
        success: true, 
        message: 'Student login successful!',
        registerNumber: registerNumber,
        redirectUrl: hasDetails ? '/student-dashboard' : '/internship-details',
        hasInternshipDetails: hasDetails
      };
      
      console.log('📤 Sending response:', response);
      res.json(response);
    } else {
      console.log('🔍 Student not found, checking if register number exists...');
      const studentExists = students.find(s => s.registerNumber === registerNumber);
      
      if (studentExists) {
        console.log('❌ Wrong password for existing student');
        res.status(401).json({ 
          success: false, 
          message: 'Invalid password. Please try again.' 
        });
      } else {
        console.log('❌ Register number not found');
        res.status(401).json({ 
          success: false, 
          message: 'Register number not found. Would you like to create an account?',
          showRegisterOption: true,
          registerNumber: registerNumber
        });
      }
    }
  } catch (error) {
    console.error('🚨 === LOGIN ERROR ===');
    console.error('Error details:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
  
  console.log('🔐 === LOGIN REQUEST END ===');
});

// Student registration endpoint
app.post('/student-register', (req, res) => {
  console.log('📝 Student registration attempt:', req.body);
  
  try {
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
    
    // Save data immediately after adding new student
    saveData();
    
    console.log('✅ New student registered and saved:', registerNumber);
    
    res.json({
      success: true,
      message: 'Account created successfully! You can now login.',
      redirectUrl: '/student'
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// Submit internship details endpoint - FIXED VERSION
app.post('/submit-internship-details', upload.single('offerLetter'), (req, res) => {
  console.log('📋 === INTERNSHIP SUBMISSION START ===');
  console.log('📝 Request body:', req.body);
  console.log('📎 Uploaded file:', req.file ? req.file.filename : 'No file');
  
  try {
    const { registerNumber, ...details } = req.body;
    
    if (!registerNumber) {
      console.log('❌ Missing register number');
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
    
    console.log('💾 Stored internship details for:', registerNumber);
    console.log('📊 Details stored:', Object.keys(internshipDetails[registerNumber]));
    
    // FORCE SAVE DATA
    saveData();
    
    console.log('✅ Data saved to file');
    console.log('🗂️ Current internship details keys:', Object.keys(internshipDetails));
    
    res.json({
      success: true,
      message: 'Internship details submitted successfully!',
      redirectUrl: '/student-dashboard'
    });
  } catch (error) {
    console.error('❌ Internship submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during internship submission'
    });
  }
  
  console.log('📋 === INTERNSHIP SUBMISSION END ===');
});

// Faculty login endpoint
app.post('/faculty-login', (req, res) => {
  console.log('👨‍🏫 Faculty login attempt:', req.body);
  
  try {
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
  } catch (error) {
    console.error('❌ Faculty login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during faculty login'
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 === GLOBAL ERROR HANDLER ===');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Save data on graceful shutdown
process.on('SIGINT', () => {
  console.log('\n💾 Received SIGINT. Saving data and graceful shutdown...');
  saveData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n💾 Received SIGTERM. Saving data and graceful shutdown...');
  saveData();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('💾 Data file:', DATA_FILE);
  console.log('👥 Students loaded:', students.length);
  console.log('👨‍🏫 Faculty loaded:', faculty.length);
  console.log('📋 Internship details loaded:', Object.keys(internshipDetails).length);
  console.log('\n📄 Available pages:');
  console.log('- Main page: http://localhost:3000');
  console.log('- Student login: http://localhost:3000/student');
  console.log('- Student registration: http://localhost:3000/student-register');
  console.log('- Faculty login: http://localhost:3000/faculty');
  console.log('- Internship details (unified): http://localhost:3000/internship-details');
  console.log('- Student dashboard: http://localhost:3000/student-dashboard');
  console.log('\n🔍 Debug endpoint: http://localhost:3000/debug/data');
  console.log('\n🔑 Test credentials:');
  console.log('Students - Register: 123456, Password: password123');
  console.log('Students - Register: 789012, Password: student456');
});
