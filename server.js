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

console.log('🔗 MongoDB URI configured');

// MongoDB Connection Function
async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB Atlas Connected Successfully');
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
    startDate: [String],
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
    reportFilename: String,
    reportPath: String,
    submittedAt: { type: Date, default: Date.now }
});

// Models
const Student = mongoose.model('Student', studentSchema);
const Faculty = mongoose.model('Faculty', facultySchema);
const InternshipDetails = mongoose.model('InternshipDetails', internshipDetailsSchema);
const InternshipReport = mongoose.model('InternshipReport', internshipReportSchema);

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// CRITICAL: Middleware order is VERY important!

// 1. Body parsing middleware FIRST
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. CORS middleware BEFORE session - CRITICAL for session cookies
app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Allow specific origins in production, all in development
    if (process.env.NODE_ENV === 'production') {
        // Add your Railway domain here when deploying
        const allowedOrigins = ['https://your-railway-domain.up.railway.app'];
        if (allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
        }
    } else {
        // Development - allow localhost
        res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Cookie');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 3. Session middleware - CRITICAL configuration
const sessionConfig = {
    name: 'internship_session', // Custom session name
    secret: process.env.SESSION_SECRET || 'christ-university-super-secret-key-12345-very-long-and-secure',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGO_URI,
        collectionName: 'user_sessions',
        ttl: 24 * 60 * 60 // 24 hours in seconds
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Only use secure in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
};

app.use(session(sessionConfig));

// 4. Debug middleware to track sessions
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Session ID:', req.sessionID);
    console.log('Session exists:', !!req.session);
    console.log('User in session:', !!req.session?.user);
    console.log('Faculty in session:', !!req.session?.faculty);
    if (req.session?.user) {
        console.log('User data:', req.session.user.registerNumber, req.session.user.name);
    }
    console.log('---');
    next();
});

// 5. Static files middleware
app.use(express.static(path.join(__dirname, 'public')));

// Input sanitization function
function sanitizeInput(input) {
    if (Array.isArray(input)) {
        return String(input[0]).trim();
    }
    return String(input || '').trim();
}

// Authentication Middleware with detailed logging
function requireStudentAuth(req, res, next) {
    console.log('🔐 Student Auth Check:');
    console.log('  - Session exists:', !!req.session);
    console.log('  - Session ID:', req.sessionID);
    console.log('  - User in session:', !!req.session?.user);

    if (!req.session || !req.session.user) {
        console.log('❌ Student auth failed - redirecting to login');
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to access this page',
                redirectUrl: '/student'
            });
        } else {
            return res.redirect('/student');
        }
    }

    console.log('✅ Student auth successful for:', req.session.user.registerNumber);
    next();
}

function requireFacultyAuth(req, res, next) {
    console.log('🔐 Faculty Auth Check:');
    console.log('  - Session exists:', !!req.session);
    console.log('  - Faculty in session:', !!req.session?.faculty);

    if (!req.session || !req.session.faculty) {
        console.log('❌ Faculty auth failed');
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to access this page',
                redirectUrl: '/faculty'
            });
        } else {
            return res.redirect('/faculty');
        }
    }

    console.log('✅ Faculty auth successful');
    next();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const registerNumber = req.session?.user?.registerNumber || 'unknown';
        const uploadPath = path.join(__dirname, 'uploads', registerNumber);

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const registerNumber = req.session?.user?.registerNumber || 'unknown';
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

// PUBLIC ROUTES (no authentication required)
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

// PROTECTED ROUTES (authentication required)
app.get('/internship-details', requireStudentAuth, (req, res) => {
    console.log('📋 Serving internship details page');
    res.sendFile(path.join(__dirname, 'public', 'internship_details.html'));
});

app.get('/internship-report', requireStudentAuth, (req, res) => {
    console.log('📄 Serving internship report page');
    res.sendFile(path.join(__dirname, 'public', 'internship_report.html'));
});

app.get('/student-dashboard', requireStudentAuth, (req, res) => {
    console.log('🎓 Serving student dashboard');
    res.sendFile(path.join(__dirname, 'public', 'student_dashboard.html'));
});

app.get('/teacher-dashboard', requireFacultyAuth, (req, res) => {
    console.log('👨‍🏫 Serving teacher dashboard');
    res.sendFile(path.join(__dirname, 'public', 'teacher_dashboard.html'));
});

// API ROUTES

// Session check endpoint
app.get('/api/session', (req, res) => {
    console.log('🔍 Session check request');
    console.log('  - Session exists:', !!req.session);
    console.log('  - User exists:', !!req.session?.user);
    console.log('  - Faculty exists:', !!req.session?.faculty);

    if (req.session?.user) {
        console.log('  - Returning student session data');
        res.json({
            success: true,
            user: {
                registerNumber: req.session.user.registerNumber,
                name: req.session.user.name,
                email: req.session.user.email,
                department: req.session.user.department
            },
            userType: 'student'
        });
    } else if (req.session?.faculty) {
        console.log('  - Returning faculty session data');
        res.json({
            success: true,
            user: {
                employeeId: req.session.faculty.employeeId,
                name: req.session.faculty.name,
                email: req.session.faculty.email,
                department: req.session.faculty.department
            },
            userType: 'faculty'
        });
    } else {
        console.log('  - No active session found');
        res.json({ success: false, message: 'No active session' });
    }
});

// Get student profile
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

// Get internship details
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

// Get internship report
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

// Student login
app.post('/student-login', async (req, res) => {
    try {
        console.log('👤 Student login attempt');
        let { registerNumber, password } = req.body;

        registerNumber = sanitizeInput(registerNumber);
        password = sanitizeInput(password);

        console.log('  - Register Number:', registerNumber);

        if (!registerNumber || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Register number and password are required' 
            });
        }

        const student = await Student.findOne({ registerNumber, password });

        if (!student) {
            console.log('  - Student not found or invalid password');
            const studentExists = await Student.findOne({ registerNumber });
            if (studentExists) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid password. Please try again.' 
                });
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'Register number not found. Would you like to create an account?',
                    showRegisterOption: true,
                    registerNumber: registerNumber
                });
            }
        }

        console.log('  - Student found, creating session');

        // Set session data
        req.session.user = {
            registerNumber: student.registerNumber,
            name: student.name,
            email: student.email,
            department: student.department,
            phone: student.phone
        };

        // CRITICAL: Force session save and wait for completion
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.error('❌ Session save error:', err);
                    reject(err);
                } else {
                    console.log('✅ Session saved successfully');
                    console.log('  - Session ID:', req.sessionID);
                    console.log('  - User in session:', req.session.user.registerNumber);
                    resolve();
                }
            });
        });

        // Check internship details
        const hasDetails = await InternshipDetails.exists({ registerNumber });

        console.log('  - Login successful, sending response');
        res.json({
            success: true,
            message: 'Student login successful!',
            user: req.session.user,
            redirectUrl: hasDetails ? '/student-dashboard' : '/internship-details',
            hasInternshipDetails: !!hasDetails
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// Student registration
app.post('/student-register', async (req, res) => {
    try {
        let { registerNumber, password, confirmPassword, name, email, department, phone } = req.body;

        // Sanitize inputs
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

        // Check existing user
        const existingUser = await Student.findOne({
            $or: [{ registerNumber }, { email }]
        });

        if (existingUser) {
            const field = existingUser.registerNumber === registerNumber ? 'register number' : 'email';
            return res.status(400).json({ success: false, message: `Account with this ${field} already exists` });
        }

        // Create new student
        const newStudent = new Student({
            registerNumber, password, name, email, department, phone
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
app.post('/submit-internship-details', requireStudentAuth, upload.single('offerLetter'), async (req, res) => {
    try {
        console.log('📋 Internship details submission');
        const registerNumber = req.session.user.registerNumber;
        const studentData = req.session.user;

        console.log('  - User:', registerNumber);
        console.log('  - File uploaded:', !!req.file);

        let details = { ...req.body };

        // Sanitize fields
        Object.keys(details).forEach(key => {
            if (typeof details[key] === 'string' || Array.isArray(details[key])) {
                details[key] = sanitizeInput(details[key]);
            }
        });

        // Prepare data
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

        // Save to database
        const result = await InternshipDetails.findOneAndUpdate(
            { registerNumber },
            internshipData,
            { upsert: true, new: true }
        );

        console.log('✅ Internship details saved:', result._id);

        res.json({
            success: true,
            message: 'Internship details submitted successfully!',
            redirectUrl: '/student-dashboard'
        });
    } catch (error) {
        console.error('❌ Internship submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// Submit internship report
app.post('/submit-internship-report', requireStudentAuth, upload.single('internshipReport'), async (req, res) => {
    try {
        console.log('📄 Report submission');
        const registerNumber = req.session.user.registerNumber;
        const studentData = req.session.user;

        let reportData = { ...req.body };

        // Sanitize fields
        Object.keys(reportData).forEach(key => {
            if (typeof reportData[key] === 'string' || Array.isArray(reportData[key])) {
                reportData[key] = sanitizeInput(reportData[key]);
            }
        });

        // Prepare data
        const reportInfo = {
            registerNumber,
            name: studentData.name,
            department: studentData.department,
            ...reportData,
            reportFilename: req.file ? req.file.filename : null,
            reportPath: req.file ? req.file.path : null
        };

        // Save to database
        const result = await InternshipReport.findOneAndUpdate(
            { registerNumber },
            reportInfo,
            { upsert: true, new: true }
        );

        console.log('✅ Report saved:', result._id);

        res.json({
            success: true,
            message: 'Internship report submitted successfully!',
            redirectUrl: '/student-dashboard'
        });
    } catch (error) {
        console.error('❌ Report submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// Faculty login
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

        req.session.faculty = {
            employeeId: facultyMember.employeeId,
            name: facultyMember.name,
            email: facultyMember.email,
            department: facultyMember.department,
            phone: facultyMember.phone
        };

        // Force session save
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

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

// Logout
app.post('/logout', (req, res) => {
    console.log('👋 Logout request');
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            res.status(500).json({ success: false, message: 'Logout failed' });
        } else {
            console.log('✅ Session destroyed');
            res.clearCookie('internship_session');
            res.json({ 
                success: true, 
                message: 'Logged out successfully',
                redirectUrl: '/'
            });
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize server
async function startServer() {
    try {
        await connectDB();

        // Create default accounts
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

        // Ensure uploads directory
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        app.listen(PORT, () => {
            console.log('\n🚀 Christ University Internship Portal');
            console.log(`🌐 Server: http://localhost:${PORT}`);
            console.log(`📊 Database: Connected to MongoDB Atlas`);
            console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🍪 Session store: MongoDB`);
            console.log('\n📄 Protected Routes:');
            console.log('  - /student-dashboard (requires student login)');
            console.log('  - /internship-details (requires student login)');
            console.log('  - /internship-report (requires student login)');
            console.log('  - /teacher-dashboard (requires faculty login)');
        });
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

startServer();