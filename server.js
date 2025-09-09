// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Multer storage (creates uploads folder automatically)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.post('/submit', upload.single('internshipReport'), (req, res) => {
  try {
    const {
      department,
      name,
      registerNumber,
      internshipType,
      internshipRole,
      startMonth,
      mentor,
      summary,
      rating,
      declaration
    } = req.body;

    const uploadedFile = req.file ? req.file.filename : null;

    console.log('Form Data Received:', {
      department,
      name,
      registerNumber,
      internshipType,
      internshipRole,
      startMonth,
      mentor,
      summary,
      rating,
      declaration,
      uploadedFile
    });

    res.json({ success: true, message: 'Form submitted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
