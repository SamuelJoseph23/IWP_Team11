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

console.log('🔗 Connecting to MongoDB Atlas...');

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

// Trust proxy for deployment
app.set('trust proxy', 1);

// MIDDLEWARE CONFIGURATION (Order is critical!)

// 1. Body parsing - MUST be first
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. CORS configuration - BEFORE session
app.use((req, res, next) => {
    const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://your-railway-domain.up.railway.app' // Replace with actual Railway URL
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin) || !origin) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Cookie, Set-Cookie');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 3. Session configuration - CRITICAL
app.use(session({
    name: 'christ_university_session',
    secret: process.env.SESSION_SECRET || 'christ-university-super-secret-key-for-internship-portal-12345678',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGO_URI,
        collectionName: 'portal_sessions',
        ttl: 24 * 60 * 60, // 24 hours
        touchAfter: 3600 // 1 hour
    }),
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

// 4. Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const sessionInfo = req.session ? 
        `Session: ${req.sessionID?.slice(-8)} | User: ${req.session.user?.registerNumber || 'None'} | Faculty: ${req.session.faculty?.employeeId || 'None'}` : 
        'No Session';

    console.log(`[${timestamp}] ${req.method} ${req.path} | ${sessionInfo}`);
    next();
});

// 5. Static file serving
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h', // Cache static files for 1 hour
    etag: true
}));

// Input sanitization
function sanitizeInput(input) {
    if (Array.isArray(input)) {
        return String(input[0] || '').trim();
    }
    return String(input || '').trim();
}

// Enhanced Authentication Middleware
function requireStudentAuth(req, res, next) {
    console.log('🔐 Student Auth Check:', {
        sessionExists: !!req.session,
        sessionID: req.sessionID?.slice(-8),
        userExists: !!req.session?.user,
        userRegNo: req.session?.user?.registerNumber
    });

    if (!req.session || !req.session.user) {
        console.log('❌ Student authentication failed');

        // Check if it's an API request
        const isApiRequest = req.path.startsWith('/api/') || 
                            req.xhr || 
                            req.headers.accept?.includes('application/json');

        if (isApiRequest) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required. Please login again.',
                redirectUrl: '/student'
            });
        } else {
            return res.redirect('/student?error=session_expired');
        }
    }

    console.log(`✅ Student authentication successful: ${req.session.user.registerNumber}`);
    next();
}

function requireFacultyAuth(req, res, next) {
    console.log('🔐 Faculty Auth Check:', {
        sessionExists: !!req.session,
        facultyExists: !!req.session?.faculty
    });

    if (!req.session || !req.session.faculty) {
        console.log('❌ Faculty authentication failed');

        const isApiRequest = req.path.startsWith('/api/') || 
                            req.xhr || 
                            req.headers.accept?.includes('application/json');

        if (isApiRequest) {
            return res.status(401).json({ 
                success: false, 
                message: 'Faculty authentication required',
                redirectUrl: '/faculty'
            });
        } else {
            return res.redirect('/faculty?error=session_expired');
        }
    }

    console.log(`✅ Faculty authentication successful: ${req.session.faculty.employeeId}`);
    next();
}

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const registerNumber = req.session?.user?.registerNumber || 'temp';
        const uploadPath = path.join(__dirname, 'uploads', registerNumber);

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const registerNumber = req.session?.user?.registerNumber || 'temp';
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const filename = `${registerNumber}-${timestamp}-${random}${extension}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1 // Only one file at a time
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
        }
    }
});

// =============================================================================
// PUBLIC ROUTES (No authentication required)
// =============================================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/student', (req, res) => {
    // If already logged in as student, redirect to dashboard
    if (req.session?.user) {
        console.log('👤 Student already logged in, redirecting to dashboard');
        return res.redirect('/student-dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.get('/student-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student_register.html'));
});

app.get('/faculty', (req, res) => {
    // If already logged in as faculty, redirect to dashboard
    if (req.session?.faculty) {
        console.log('👨‍🏫 Faculty already logged in, redirecting to dashboard');
        return res.redirect('/teacher-dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'faculty.html'));
});

app.get('/teacher-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher_register.html'));
});

// =============================================================================
// PROTECTED ROUTES (Authentication required)
// =============================================================================

app.get('/student-dashboard', requireStudentAuth, (req, res) => {
    console.log('🎓 Serving comprehensive student dashboard');
    res.sendFile(path.join(__dirname, 'public', 'student_dashboard.html'));
});

app.get('/internship-details', requireStudentAuth, (req, res) => {
    console.log('📋 Serving internship details form');
    res.sendFile(path.join(__dirname, 'public', 'internship_details.html'));
});

app.get('/internship-report', requireStudentAuth, (req, res) => {
    console.log('📄 Serving internship report form');
    res.sendFile(path.join(__dirname, 'public', 'internship_report.html'));
});

app.get('/teacher-dashboard', requireFacultyAuth, (req, res) => {
    console.log('👨‍🏫 Serving teacher dashboard');
    res.sendFile(path.join(__dirname, 'public', 'teacher_dashboard.html'));
});

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Session management API
app.get('/api/session', (req, res) => {
    console.log('🔍 Session check API called');

    const sessionData = {
        sessionID: req.sessionID?.slice(-8),
        exists: !!req.session,
        user: req.session?.user || null,
        faculty: req.session?.faculty || null
    };

    console.log('Session data:', sessionData);

    if (req.session?.user) {
        res.json({
            success: true,
            user: {
                registerNumber: req.session.user.registerNumber,
                name: req.session.user.name,
                email: req.session.user.email,
                department: req.session.user.department,
                phone: req.session.user.phone
            },
            userType: 'student',
            sessionID: req.sessionID?.slice(-8)
        });
    } else if (req.session?.faculty) {
        res.json({
            success: true,
            user: {
                employeeId: req.session.faculty.employeeId,
                name: req.session.faculty.name,
                email: req.session.faculty.email,
                department: req.session.faculty.department,
                phone: req.session.faculty.phone
            },
            userType: 'faculty',
            sessionID: req.sessionID?.slice(-8)
        });
    } else {
        res.json({ 
            success: false, 
            message: 'No active session found',
            sessionID: req.sessionID?.slice(-8)
        });
    }
});

// Student profile API
app.get('/api/student-profile', requireStudentAuth, async (req, res) => {
    try {
        const registerNumber = req.session.user.registerNumber;
        console.log(`📋 Fetching profile for: ${registerNumber}`);

        const student = await Student.findOne({ registerNumber }).select('-password');

        if (!student) {
            return res.status(404).json({ 
                success: false, 
                message: 'Student profile not found' 
            });
        }

        res.json({ success: true, profile: student });
    } catch (error) {
        console.error('Error fetching student profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching profile' 
        });
    }
});

// Internship details API
app.get('/api/internship-details', requireStudentAuth, async (req, res) => {
    try {
        const registerNumber = req.session.user.registerNumber;
        console.log(`📋 Fetching internship details for: ${registerNumber}`);

        const details = await InternshipDetails.findOne({ registerNumber });

        res.json({
            success: true,
            hasDetails: !!details,
            details: details || null
        });
    } catch (error) {
        console.error('Error fetching internship details:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching internship details' 
        });
    }
});

// Internship report API
app.get('/api/internship-report', requireStudentAuth, async (req, res) => {
    try {
        const registerNumber = req.session.user.registerNumber;
        console.log(`📄 Fetching internship report for: ${registerNumber}`);

        const report = await InternshipReport.findOne({ registerNumber });

        res.json({
            success: true,
            hasReport: !!report,
            report: report || null
        });
    } catch (error) {
        console.error('Error fetching internship report:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching report' 
        });
    }
});

// Student dashboard stats API
app.get('/api/dashboard-stats', requireStudentAuth, async (req, res) => {
    try {
        const registerNumber = req.session.user.registerNumber;
        console.log(`📊 Fetching dashboard stats for: ${registerNumber}`);

        const [internshipDetails, internshipReport] = await Promise.all([
            InternshipDetails.findOne({ registerNumber }),
            InternshipReport.findOne({ registerNumber })
        ]);

        // Calculate progress
        let progress = 0;
        if (internshipDetails) progress += 50;
        if (internshipReport) progress += 50;

        // Calculate days remaining
        let daysRemaining = null;
        if (internshipDetails && internshipDetails.endDate && internshipDetails.endDate.length > 0) {
            const endDate = new Date(internshipDetails.endDate.find(date => date));
            const today = new Date();
            const diffTime = endDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysRemaining = diffDays > 0 ? diffDays : 0;
        }

        const stats = {
            internship: {
                completed: !!internshipDetails,
                submittedAt: internshipDetails?.submittedAt || null
            },
            report: {
                completed: !!internshipReport,
                submittedAt: internshipReport?.submittedAt || null
            },
            progress: progress,
            daysRemaining: daysRemaining
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching stats' 
        });
    }
});

// =============================================================================
// TEACHER DASHBOARD API ENDPOINTS
// =============================================================================

// Get all students with their internship status
app.get('/api/teacher-dashboard-stats', requireFacultyAuth, async (req, res) => {
    try {
        console.log('👨‍🏫 Fetching teacher dashboard stats');

        // Get total counts
        const [totalStudents, studentsWithDetails, studentsWithReports] = await Promise.all([
            Student.countDocuments(),
            InternshipDetails.countDocuments(),
            InternshipReport.countDocuments()
        ]);

        // Calculate completion rate
        const detailsCompletionRate = totalStudents > 0 ? Math.round((studentsWithDetails / totalStudents) * 100) : 0;
        const reportsCompletionRate = totalStudents > 0 ? Math.round((studentsWithReports / totalStudents) * 100) : 0;

        // Get average rating
        const reportStats = await InternshipReport.aggregate([
            { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);

        const avgRating = reportStats.length > 0 ? Math.round(reportStats[0].avgRating * 10) / 10 : 0;

        const stats = {
            totalStudents,
            studentsWithDetails,
            studentsWithReports,
            detailsCompletionRate,
            reportsCompletionRate,
            averageRating: avgRating,
            // Mock data for UI consistency
            tasksCompleted: studentsWithReports,
            averageTaskScore: Math.round(avgRating * 10), // Convert 0-10 to 0-100 scale
            projectsAssigned: totalStudents,
            actionableInsights: Math.floor(totalStudents * 0.1) // 10% of students
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching teacher dashboard stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching teacher stats' 
        });
    }
});

// Get all students with their details and status
app.get('/api/teacher-students', requireFacultyAuth, async (req, res) => {
    try {
        console.log('👨‍🏫 Fetching all students data');

        // Get all students
        const students = await Student.find().select('-password').sort({ createdAt: -1 });

        // Get internship details and reports for all students
        const studentsWithStatus = await Promise.all(students.map(async (student) => {
            const [internshipDetails, internshipReport] = await Promise.all([
                InternshipDetails.findOne({ registerNumber: student.registerNumber }),
                InternshipReport.findOne({ registerNumber: student.registerNumber })
            ]);

            // Determine status
            let status = 'Not Started';
            let progress = 0;
            let avgScore = 0;

            if (internshipDetails && internshipReport) {
                status = 'Completed';
                progress = 100;
                avgScore = internshipReport.rating ? Math.round(internshipReport.rating * 10) : 0; // Convert to 0-100 scale
            } else if (internshipDetails) {
                status = 'In Progress';
                progress = 50;
                avgScore = 50; // Partial completion score
            }

            return {
                registerNumber: student.registerNumber,
                name: student.name,
                email: student.email,
                department: student.department,
                phone: student.phone,
                createdAt: student.createdAt,
                status,
                progress,
                avgScore,
                projects: internshipDetails ? 1 : 0,
                hasInternshipDetails: !!internshipDetails,
                hasInternshipReport: !!internshipReport,
                internshipType: internshipDetails?.internshipType || null,
                companyName: internshipDetails?.companyName || null,
                projectTitle: internshipDetails?.projectTitle || null,
                submittedDetailsAt: internshipDetails?.submittedAt || null,
                submittedReportAt: internshipReport?.submittedAt || null,
                rating: internshipReport?.rating || null
            };
        }));

        res.json({ success: true, students: studentsWithStatus });
    } catch (error) {
        console.error('Error fetching students data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching students data' 
        });
    }
});

// Get individual student details for profile view
app.get('/api/teacher-student/:registerNumber', requireFacultyAuth, async (req, res) => {
    try {
        const { registerNumber } = req.params;
        console.log(`👨‍🏫 Fetching student details for: ${registerNumber}`);

        const [student, internshipDetails, internshipReport] = await Promise.all([
            Student.findOne({ registerNumber }).select('-password'),
            InternshipDetails.findOne({ registerNumber }),
            InternshipReport.findOne({ registerNumber })
        ]);

        if (!student) {
            return res.status(404).json({ 
                success: false, 
                message: 'Student not found' 
            });
        }

        const studentProfile = {
            ...student.toObject(),
            internshipDetails,
            internshipReport,
            hasInternshipDetails: !!internshipDetails,
            hasInternshipReport: !!internshipReport
        };

        res.json({ success: true, student: studentProfile });
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching student details' 
        });
    }
});

// Delete student account (admin function)
app.delete('/api/teacher-student/:registerNumber', requireFacultyAuth, async (req, res) => {
    try {
        const { registerNumber } = req.params;
        console.log(`👨‍🏫 Deleting student: ${registerNumber}`);

        // Delete student and all related data
        await Promise.all([
            Student.deleteOne({ registerNumber }),
            InternshipDetails.deleteOne({ registerNumber }),
            InternshipReport.deleteOne({ registerNumber })
        ]);

        // Also delete uploaded files if they exist
        const uploadsPath = path.join(__dirname, 'uploads', registerNumber);
        if (fs.existsSync(uploadsPath)) {
            fs.rmSync(uploadsPath, { recursive: true, force: true });
        }

        console.log(`✅ Student ${registerNumber} deleted successfully`);
        res.json({ 
            success: true, 
            message: 'Student account and data deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while deleting student' 
        });
    }
});

// Get department-wise statistics
app.get('/api/teacher-department-stats', requireFacultyAuth, async (req, res) => {
    try {
        console.log('👨‍🏫 Fetching department-wise statistics');

        const departmentStats = await Student.aggregate([
            {
                $group: {
                    _id: '$department',
                    totalStudents: { $sum: 1 },
                    students: { $push: '$registerNumber' }
                }
            },
            { $sort: { totalStudents: -1 } }
        ]);

        // Get completion stats for each department
        const departmentData = await Promise.all(departmentStats.map(async (dept) => {
            const [withDetails, withReports] = await Promise.all([
                InternshipDetails.countDocuments({ registerNumber: { $in: dept.students } }),
                InternshipReport.countDocuments({ registerNumber: { $in: dept.students } })
            ]);

            return {
                department: dept._id,
                totalStudents: dept.totalStudents,
                studentsWithDetails: withDetails,
                studentsWithReports: withReports,
                detailsCompletionRate: Math.round((withDetails / dept.totalStudents) * 100),
                reportsCompletionRate: Math.round((withReports / dept.totalStudents) * 100)
            };
        }));

        res.json({ success: true, departments: departmentData });
    } catch (error) {
        console.error('Error fetching department statistics:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching department statistics' 
        });
    }
});

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================

// Student login
app.post('/student-login', async (req, res) => {
    try {
        console.log('👤 Student login attempt');
        let { registerNumber, password } = req.body;

        registerNumber = sanitizeInput(registerNumber);
        password = sanitizeInput(password);

        console.log(`Login attempt for register number: ${registerNumber}`);

        if (!registerNumber || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Register number and password are required' 
            });
        }

        const student = await Student.findOne({ registerNumber, password });

        if (!student) {
            console.log(`❌ Invalid credentials for: ${registerNumber}`);
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

        // Create session data
        req.session.user = {
            registerNumber: student.registerNumber,
            name: student.name,
            email: student.email,
            department: student.department,
            phone: student.phone
        };

        // Force session save with promise
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    reject(err);
                } else {
                    console.log(`✅ Session created successfully for ${registerNumber} | Session ID: ${req.sessionID?.slice(-8)}`);
                    resolve();
                }
            });
        });

        // Check if user has internship details
        const hasDetails = await InternshipDetails.exists({ registerNumber });

        res.json({
            success: true,
            message: 'Student login successful!',
            user: req.session.user,
            redirectUrl: hasDetails ? '/student-dashboard' : '/student-dashboard', // Always go to dashboard first
            hasInternshipDetails: !!hasDetails,
            sessionID: req.sessionID?.slice(-8)
        });

    } catch (error) {
        console.error('❌ Student login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

// Student registration
app.post('/student-register', async (req, res) => {
    try {
        console.log('👤 Student registration attempt');
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

        // Check for existing user
        const existingUser = await Student.findOne({
            $or: [{ registerNumber }, { email }]
        });

        if (existingUser) {
            const field = existingUser.registerNumber === registerNumber ? 'register number' : 'email';
            return res.status(400).json({ 
                success: false, 
                message: `Account with this ${field} already exists` 
            });
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
        console.log(`✅ New student registered: ${registerNumber}`);

        res.json({
            success: true,
            message: 'Account created successfully! You can now login.',
            redirectUrl: '/student'
        });
    } catch (error) {
        console.error('❌ Student registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

// Faculty login
app.post('/faculty-login', async (req, res) => {
    try {
        console.log('👨‍🏫 Faculty login attempt');
        let { employeeId, password } = req.body;

        employeeId = sanitizeInput(employeeId);
        password = sanitizeInput(password);

        if (!employeeId || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Employee ID and password are required' 
            });
        }

        const facultyMember = await Faculty.findOne({ employeeId, password });

        if (!facultyMember) {
            console.log(`❌ Invalid faculty credentials for: ${employeeId}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid employee ID or password' 
            });
        }

        // Create session data
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
                if (err) {
                    console.error('Faculty session save error:', err);
                    reject(err);
                } else {
                    console.log(`✅ Faculty session created: ${employeeId}`);
                    resolve();
                }
            });
        });

        res.json({
            success: true,
            message: 'Faculty login successful!',
            faculty: req.session.faculty,
            redirectUrl: '/teacher-dashboard'
        });
    } catch (error) {
        console.error('❌ Faculty login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during faculty login' 
        });
    }
});

// Faculty registration
app.post('/faculty-register', async (req, res) => {
    try {
        console.log('👨‍🏫 Faculty registration attempt');
        let { employeeId, password, confirmPassword, name, email, department, phone } = req.body;

        // Sanitize inputs
        employeeId = sanitizeInput(employeeId);
        password = sanitizeInput(password);
        confirmPassword = sanitizeInput(confirmPassword);
        name = sanitizeInput(name);
        email = sanitizeInput(email);
        department = sanitizeInput(department);
        phone = sanitizeInput(phone);

        // Validation
        if (!employeeId || !password || !confirmPassword || !name || !email || !department) {
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

        // Check for existing user
        const existingUser = await Faculty.findOne({
            $or: [{ employeeId }, { email }]
        });

        if (existingUser) {
            const field = existingUser.employeeId === employeeId ? 'employee ID' : 'email';
            return res.status(400).json({ 
                success: false, 
                message: `Account with this ${field} already exists` 
            });
        }

        // Create new faculty
        const newFaculty = new Faculty({
            employeeId,
            password,
            name,
            email,
            department,
            phone
        });

        await newFaculty.save();
        console.log(`✅ New faculty registered: ${employeeId}`);

        res.json({
            success: true,
            message: 'Faculty account created successfully! You can now login.',
            redirectUrl: '/faculty'
        });
    } catch (error) {
        console.error('❌ Faculty registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

// =============================================================================
// FORM SUBMISSION ENDPOINTS
// =============================================================================

// Submit internship details
app.post('/submit-internship-details', requireStudentAuth, upload.single('offerLetter'), async (req, res) => {
    try {
        console.log('📋 Internship details submission');
        const registerNumber = req.session.user.registerNumber;
        const studentData = req.session.user;

        console.log(`Processing submission for: ${registerNumber}`);
        console.log(`File uploaded: ${req.file ? 'Yes' : 'No'}`);

        let formData = { ...req.body };

        // Sanitize all form fields
        Object.keys(formData).forEach(key => {
            if (typeof formData[key] === 'string' || Array.isArray(formData[key])) {
                formData[key] = sanitizeInput(formData[key]);
            }
        });

        // Prepare internship details
        const internshipData = {
            registerNumber,
            studentName: studentData.name,
            department: studentData.department,
            studentEmail: studentData.email,
            ...formData,
            offerLetterFilename: req.file ? req.file.filename : null,
            offerLetterPath: req.file ? req.file.path : null,
            offerLetterOriginalName: req.file ? req.file.originalname : null,
            submittedAt: new Date()
        };

        // Save or update in database
        const result = await InternshipDetails.findOneAndUpdate(
            { registerNumber },
            internshipData,
            { upsert: true, new: true, runValidators: true }
        );

        console.log(`✅ Internship details saved with ID: ${result._id}`);

        res.json({
            success: true,
            message: 'Internship details submitted successfully!',
            redirectUrl: '/student-dashboard',
            data: {
                id: result._id,
                submittedAt: result.submittedAt
            }
        });
    } catch (error) {
        console.error('❌ Internship submission error:', error);
        res.status(500).json({
            success: false,
            message: `Submission error: ${error.message}`
        });
    }
});

// Submit internship report
app.post('/submit-internship-report', requireStudentAuth, upload.single('internshipReport'), async (req, res) => {
    try {
        console.log('📄 Internship report submission');
        const registerNumber = req.session.user.registerNumber;
        const studentData = req.session.user;

        let formData = { ...req.body };

        // Sanitize form fields
        Object.keys(formData).forEach(key => {
            if (typeof formData[key] === 'string' || Array.isArray(formData[key])) {
                formData[key] = sanitizeInput(formData[key]);
            }
        });

        // Prepare report data
        const reportData = {
            registerNumber,
            name: studentData.name,
            department: studentData.department,
            ...formData,
            reportFilename: req.file ? req.file.filename : null,
            reportPath: req.file ? req.file.path : null,
            submittedAt: new Date()
        };

        // Save or update in database
        const result = await InternshipReport.findOneAndUpdate(
            { registerNumber },
            reportData,
            { upsert: true, new: true, runValidators: true }
        );

        console.log(`✅ Report saved with ID: ${result._id}`);

        res.json({
            success: true,
            message: 'Internship report submitted successfully!',
            redirectUrl: '/student-dashboard',
            data: {
                id: result._id,
                submittedAt: result.submittedAt
            }
        });
    } catch (error) {
        console.error('❌ Report submission error:', error);
        res.status(500).json({
            success: false,
            message: `Report submission error: ${error.message}`
        });
    }
});

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

// Logout endpoint
app.post('/logout', (req, res) => {
    console.log('👋 Logout request');
    const sessionID = req.sessionID?.slice(-8);

    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            res.status(500).json({ 
                success: false, 
                message: 'Logout failed' 
            });
        } else {
            console.log(`✅ Session destroyed: ${sessionID}`);
            res.clearCookie('christ_university_session');
            res.json({ 
                success: true, 
                message: 'Logged out successfully',
                redirectUrl: '/'
            });
        }
    });
});

// Session refresh endpoint
app.post('/api/refresh-session', (req, res) => {
    if (req.session) {
        req.session.touch(); // Refresh session expiry
        res.json({ 
            success: true, 
            message: 'Session refreshed',
            sessionID: req.sessionID?.slice(-8)
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'No session to refresh' 
        });
    }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Multer error handling
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 10MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Please upload only one file.'
            });
        }
    }

    if (error.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    console.error('💥 Unhandled error:', error);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `API endpoint ${req.path} not found`
    });
});

// 404 handler for pages
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

async function initializeServer() {
    try {
        // Connect to database
        await connectDB();

        // Create default faculty accounts if none exist
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
            fs.writeFileSync(path.join(uploadsDir, '.gitkeep'), ''); // For git
            console.log('✅ Uploads directory created');
        }

        // Start server
        app.listen(PORT, () => {
            console.log('\n🚀 Christ University Internship Portal');
            console.log(`🌐 Server: http://localhost:${PORT}`);
            console.log(`📊 Database: MongoDB Atlas (Connected)`);
            console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🍪 Session Store: MongoDB`);
            console.log('\n📄 Available Routes:');
            console.log('   Public:');
            console.log('     GET  /                    - Landing page');
            console.log('     GET  /student             - Student login');
            console.log('     GET  /faculty             - Faculty login');
            console.log('     GET  /student-register    - Student registration');
            console.log('     GET  /teacher-register    - Teacher registration');
            console.log('   Protected:');
            console.log('     GET  /student-dashboard   - Student dashboard');
            console.log('     GET  /internship-details  - Internship form');
            console.log('     GET  /internship-report   - Report form');
            console.log('     GET  /teacher-dashboard   - Teacher dashboard');
            console.log('   API:');
            console.log('     GET  /api/session         - Session status');
            console.log('     GET  /api/student-profile - Student profile');
            console.log('     GET  /api/internship-*    - Internship data');
            console.log('     GET  /api/teacher-*       - Teacher dashboard data');
            console.log('     POST /student-login       - Student authentication');
            console.log('     POST /faculty-login       - Faculty authentication');
            console.log('     POST /submit-*            - Form submissions');
            console.log('\n✅ Server ready for connections!');
        });
    } catch (error) {
        console.error('❌ Server initialization failed:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('📤 Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('📤 Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize the server
initializeServer();