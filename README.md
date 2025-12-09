# University Internship Management Portal

A full-stack web application for managing student internships at a University. This portal provides separate dashboards for students and faculty members to track and manage internship details, submissions, and reports.

## Features

### For Students
- **Student Registration & Authentication** - Secure account creation and login system
- **Student Dashboard** - Comprehensive view of internship progress and status
- **Internship Details Submission** - Submit both on-campus and off-campus internship information
- **Internship Report Submission** - Upload final internship reports and self-evaluation
- **Progress Tracking** - Real-time tracking of submission status and completion percentage
- **Document Upload** - Secure file upload for offer letters and reports (PDF, DOC, DOCX)

### For Faculty
- **Faculty Authentication** - Dedicated login system for teachers
- **Teacher Dashboard** - Overview of all student submissions and statistics
- **Student Management** - View and manage student profiles and submissions
- **Department Statistics** - Track completion rates and performance by department
- **Student Progress Monitoring** - View individual student internship details and reports
- **Analytics & Insights** - Dashboard with completion rates, average ratings, and actionable insights

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB & Mongoose** - Database and ODM
- **Express Session** - Session management with MongoDB store

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling
- **JavaScript (Vanilla)** - Client-side logic

### Additional Libraries
- **Multer** - File upload handling
- **Body-Parser** - Request body parsing
- **Dotenv** - Environment variable management
- **Connect-Mongo** - MongoDB session store

## Project Structure

```
Main/
├── public/ # Frontend files
│ ├── index.html # Landing page
│ ├── student.html # Student login
│ ├── student_register.html # Student registration
│ ├── student_dashboard.html # Student dashboard
│ ├── internship_details.html # Internship details form
│ ├── internship_report.html # Internship report form
│ ├── faculty.html # Faculty login
│ ├── teacher_register.html # Faculty registration
│ ├── teacher_dashboard.html # Teacher dashboard
│ ├── logo.png # University logo
│ └── background.jpg # Background image
├── uploads/ # File uploads directory
├── node_modules/ # Dependencies
├── server.js # Main server file
├── package.json # Project metadata & dependencies
├── package-lock.json # Locked dependency versions
├── data.json # Sample/mock data
├── .env # Environment variables
├── .gitignore # Git ignore rules
└── railway.json # Railway deployment config
```


## Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- MongoDB Atlas account (or local MongoDB instance)

### Installation

1. **Clone the repository**
git clone https://github.com/SamuelJoseph23/IWP_Team11.git
cd IWP_Team11


2. **Install dependencies**
npm install


3. **Configure environment variables**
Create a `.env` file in the root directory:

MONGO_URI=your_mongodb_connection_string
SESSION_SECRET=your_session_secret_key
PORT=3000
NODE_ENV=development


4. **Start the server**

Development mode (with auto-reload):
npm run dev

Production mode:
npm start


5. **Access the application**

Open your browser and navigate to:
http://localhost:3000


## Default Credentials

### Faculty Accounts (Pre-configured)
- **Account 1:**
- Employee ID: `FAC001`
- Password: `faculty123`
- Name: Dr. Faculty One
- Department: Computer Science

- **Account 2:**
- Employee ID: `FAC002`
- Password: `professor456`
- Name: Prof. Faculty Two
- Department: Information Technology

### Student Accounts
Students need to register through the student registration page.

## API Endpoints

### Authentication
- `POST /student-login` - Student authentication
- `POST /student-register` - Student registration
- `POST /faculty-login` - Faculty authentication
- `POST /faculty-register` - Faculty registration
- `POST /logout` - Logout (both student & faculty)

### Student Endpoints (Protected)
- `GET /api/session` - Check session status
- `GET /api/student-profile` - Get student profile
- `GET /api/internship-details` - Fetch internship details
- `GET /api/internship-report` - Fetch internship report
- `GET /api/dashboard-stats` - Get dashboard statistics
- `POST /submit-internship-details` - Submit internship details
- `POST /submit-internship-report` - Submit internship report

### Faculty Endpoints (Protected)
- `GET /api/teacher-dashboard-stats` - Dashboard statistics
- `GET /api/teacher-students` - List all students with status
- `GET /api/teacher-student/:registerNumber` - Get individual student details
- `GET /api/teacher-department-stats` - Department-wise statistics
- `DELETE /api/teacher-student/:registerNumber` - Delete student account

## Database Schema

### Student Schema
```
{
registerNumber: String (unique, required),
password: String (required),
name: String (required),
email: String (unique, required),
department: String (required),
phone: String,
createdAt: Date (default: Date.now)
}
```


### Faculty Schema
```
{
employeeId: String (unique, required),
password: String (required),
name: String (required),
email: String (unique, required),
department: String (required),
phone: String,
createdAt: Date (default: Date.now)
}
```


### Internship Details Schema
```
{
registerNumber: String (required, indexed),
internshipType: String (required), // "on-campus" or "off-campus"
studentName: String,
department: String,
studentEmail: String,
companyName: String,
jobTitle: String,
startDate: [String],
endDate: [String],
offerLetterFilename: String,
offerLetterPath: String,
submittedAt: Date (default: Date.now),
// ... additional fields
}
```


### Internship Report Schema
```
{
registerNumber: String (required, indexed),
department: String,
name: String,
internshipType: String,
internshipRole: String,
startDate: Date,
mentor: String,
summary: String,
rating: Number (0-10),
declaration: Boolean,
reportFilename: String,
reportPath: String,
submittedAt: Date (default: Date.now)
}
```


## Security Features

- Session-based authentication with MongoDB store
- Password validation (minimum 6 characters)
- Input sanitization to prevent injection attacks
- File type validation (only PDF, DOC, DOCX allowed)
- File size limit (10MB maximum)
- Protected routes with authentication middleware
- CORS configuration for secure cross-origin requests
- HTTP-only cookies for session management

## Deployment

### Railway Deployment

This project is configured for deployment on Railway. The `railway.json` file contains the necessary configuration.

1. Push your code to GitHub
2. Connect your repository to Railway
3. Add environment variables in Railway dashboard
4. Deploy!

### Environment Variables for Production
MONGO_URI=your_production_mongodb_uri
SESSION_SECRET=your_strong_session_secret
NODE_ENV=production
PORT=3000


## Contributors

- [**Samuel Joseph**](https://github.com/SamuelJoseph23)
- [**joe222318**](https://github.com/joe222318)

## License

This project is licensed under the **MIT License**.

## Known Issues & Future Enhancements

### Current Limitations
- Passwords are stored in plain text (consider bcrypt for production)
- No email verification system
- Limited file format support

### Planned Features
- Password encryption with bcrypt
- Email notifications for submissions
- PDF report generation
- Advanced analytics dashboard
- File preview functionality
- Bulk student data import/export
