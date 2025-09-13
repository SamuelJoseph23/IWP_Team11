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

// MongoDB Atlas connection
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
        console.log('🗄️ Database: IWP_Team11');
        console.log('☁️ Provider: MongoDB Atlas');
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
    registerNumber: { type: String, required: true, index: true },
    internshipType: { type: String, required: true },
    // Student Details (auto-populated from session)
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
    stipend: String,
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
    startDate: [String], // Array to handle both date formats
    endDate: [String],
    learningObjectives: String,
    additionalNotes: String,
    jobDescription: String,
    projectDescription: String,
    // File info
    offerLetterFilename: String,
    offerLetterPath: String,
    offerLetterOriginalName: String,
    submittedAt: { type: Date, default: Date.now }
});

const internshipReportSchema = new mongoose.Schema({
    registerNumber: { type: String, required: true, index: true },
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
        collectionName: 'sessions',
        touchAfter: 24 * 3600 // lazy session update
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
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

// Authentication Middleware
function requireStudentAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Please login to access this page',
            redirectUrl: '/student'
        });
    }
    next();
}

function requireFacultyAuth(req, res, next) {
    if (!req.session.faculty) {
        return res.status(401).json({ 
            success: false, 
            message: 'Please login to access this page',
            redirectUrl: '/faculty'
        });
    }
    next();
}

// Input sanitization function
function sanitizeInput(input) {
    if (Array.isArray(input)) {
        return String(input[0]).trim();
    }
    return String(input || '').trim();
}

// Configure multer for file uploads with user-specific paths
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create user-specific upload directory
        const registerNumber = req.session.user?.registerNumber || 'unknown';
        const uploadPath = path.join(__dirname, 'uploads', registerNumber);

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const registerNumber = req.session.user?.registerNumber || 'unknown';
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const filename = `${registerNumber}-${timestamp}-${randomSuffix}${path.extname(file.originalname)}`;
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

app.get('/teacher-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher_register.html'));
});

// Protected routes - require authentication
app.get('/internship-details', requireStudentAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'internship_details.html'));
});

app.get('/internship-report', requireStudentAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'internship_report.html'));
});

app.get('/student-dashboard', requireStudentAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student_dashboard.html'));
});

app.get('/teacher-dashboard', requireFacultyAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher_dashboard.html'));
});

// API Endpoints with user-specific data

// Get current user's profile (session-based)
app.get('/api/student-profile', requireStudentAuth, async (req, res) => {
    try {
        const registerNumber = req.session.user.registerNumber;
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

// Get current user's internship details
app.get('/api/internship-details', requireStudentAuth, async (req, res) => {
    try {
        const registerNumber = req.session.user.registerNumber;
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

// Get current user's internship report
app.get('/api/internship-report', requireStudentAuth, async (req, res) => {
    try {
        const registerNumber = req.session.user.registerNumber;
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

// Get session data for frontend
app.get('/api/session', (req, res) => {
    if (req.session.user) {
        res.json({
            success: true,
            user: {
                registerNumber: req.session.user.registerNumber,
                name: req.session.user.name
            },
            userType: 'student'
        });
    } else if (req.session.faculty) {
        res.json({
            success: true,
            user: {
                employeeId: req.session.faculty.employeeId,
                name: req.session.faculty.name
            },
            userType: 'faculty'
        });
    } else {
        res.json({ success: false, message: 'No active session' });
    }
});

// Student login with enhanced session management
app.post('/student-login', async (req, res) => {
    try {
        let { registerNumber, password } = req.body;

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

        // Set comprehensive session data
        req.session.user = {
            registerNumber: student.registerNumber,
            name: student.name,
            email: student.email,
            department: student.department,
            phone: student.phone
        };

        // Check if internship details exist
        const hasDetails = await InternshipDetails.exists({ registerNumber });

        res.json({
            success: true,
            message: 'Student login successful!',
            user: req.session.user,
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

// Teacher registration
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
            message: 'Faculty account created successfully! You can now login.'
        });
    } catch (error) {
        console.error('Faculty registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// Submit internship details with user association
app.post('/submit-internship-details', requireStudentAuth, upload.single('offerLetter'), async (req, res) => {
    console.log('📋 === INTERNSHIP SUBMISSION START ===');

    try {
        const registerNumber = req.session.user.registerNumber;
        const studentData = req.session.user;

        let details = { ...req.body };

        // Sanitize all string fields
        Object.keys(details).forEach(key => {
            if (typeof details[key] === 'string' || Array.isArray(details[key])) {
                details[key] = sanitizeInput(details[key]);
            }
        });

        // Prepare internship details with auto-populated user data
        const internshipData = {
            registerNumber,
            studentName: studentData.name,
            department: studentData.department,
            studentEmail: studentData.email,
            ...details,
            offerLetterFilename: req.file ? req.file.filename : null,
            offerLetterPath: req.file ? req.file.path : null,
            offerLetterOriginalName: req.file ? req.file.originalname : null
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

// Submit internship report with user association
app.post('/submit-internship-report', requireStudentAuth, upload.single('internshipReport'), async (req, res) => {
    console.log('📄 === REPORT SUBMISSION START ===');

    try {
        const registerNumber = req.session.user.registerNumber;
        const studentData = req.session.user;

        let reportData = { ...req.body };

        // Sanitize all string fields
        Object.keys(reportData).forEach(key => {
            if (typeof reportData[key] === 'string' || Array.isArray(reportData[key])) {
                reportData[key] = sanitizeInput(reportData[key]);
            }
        });

        // Prepare report data with auto-populated user data
        const reportInfo = {
            registerNumber,
            name: studentData.name,
            department: studentData.department,
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

// Faculty login with session management
app.post('/faculty-login', async (req, res) => {
    try {
        let { employeeId, password } = req.body;

        employeeId = sanitizeInput(employeeId);
        password = sanitizeInput(password);

        if (!employeeId || !password) {
            return res.status(400).json({ success: false, message: 'Employee ID and password are required' });
        }

        const facultyMember = await Faculty.findOne({ employeeId, password });

        if (!facultyMember) {
            return res.status(401).json({ success: false, message: 'Invalid employee ID or password' });
        }

        // Set comprehensive session data
        req.session.faculty = {
            employeeId: facultyMember.employeeId,
            name: facultyMember.name,
            email: facultyMember.email,
            department: facultyMember.department,
            phone: facultyMember.phone
        };

        res.json({
            success: true,
            message: 'Faculty login successful!',
            faculty: req.session.faculty,
            redirectUrl: '/teacher-dashboard'
        });
    } catch (error) {
        console.error('Faculty login error:', error);
        res.status(500).json({ success: false, message: 'Server error during faculty login' });
    }
});

// Faculty API to get all students and their internship data
app.get('/api/faculty/students', requireFacultyAuth, async (req, res) => {
    try {
        const students = await Student.find({}).select('-password');
        const internshipDetails = await InternshipDetails.find({});
        const internshipReports = await InternshipReport.find({});

        // Combine student data with their internship information
        const studentsWithInternships = students.map(student => {
            const details = internshipDetails.find(d => d.registerNumber === student.registerNumber);
            const report = internshipReports.find(r => r.registerNumber === student.registerNumber);

            return {
                ...student.toObject(),
                internshipDetails: details || null,
                internshipReport: report || null,
                hasInternshipDetails: !!details,
                hasInternshipReport: !!report
            };
        });

        res.json({
            success: true,
            students: studentsWithInternships,
            totalStudents: students.length,
            studentsWithDetails: internshipDetails.length,
            studentsWithReports: internshipReports.length
        });
    } catch (error) {
        console.error('Error fetching students data:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Download file endpoint with user verification
app.get('/api/download/:registerNumber/:fileType/:filename', requireFacultyAuth, async (req, res) => {
    try {
        const { registerNumber, fileType, filename } = req.params;

        // Verify file belongs to a valid submission
        let fileRecord = null;
        if (fileType === 'offer-letter') {
            fileRecord = await InternshipDetails.findOne({ 
                registerNumber, 
                offerLetterFilename: filename 
            });
        } else if (fileType === 'report') {
            fileRecord = await InternshipReport.findOne({ 
                registerNumber, 
                reportFilename: filename 
            });
        }

        if (!fileRecord) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const filePath = path.join(__dirname, 'uploads', registerNumber, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        res.download(filePath);
    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({ success: false, message: 'Server error during file download' });
    }
});

// Logout with session cleanup
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            res.status(500).json({ success: false, message: 'Logout failed' });
        } else {
            res.clearCookie('connect.sid'); // Clear session cookie
            res.json({ 
                success: true, 
                message: 'Logged out successfully',
                redirectUrl: '/'
            });
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

        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });

            // Create .gitkeep file
            fs.writeFileSync(path.join(uploadsDir, '.gitkeep'), '');
        }

        app.listen(PORT, () => {
            console.log(`🚀 Christ University Internship Portal`);
            console.log(`🌐 Server running on port ${PORT}`);
            console.log(`📊 Database: IWP_Team11 (MongoDB Atlas)`);
            console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('\n📄 Available endpoints:');
            console.log(' - Main page: /');
            console.log(' - Student login: /student');
            console.log(' - Student registration: /student-register');
            console.log(' - Faculty login: /faculty');
            console.log(' - Teacher registration: /teacher-register');
            console.log(' - Internship details: /internship-details (protected)');
            console.log(' - Internship report: /internship-report (protected)');
            console.log(' - Student dashboard: /student-dashboard (protected)');
            console.log(' - Teacher dashboard: /teacher-dashboard (protected)');
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