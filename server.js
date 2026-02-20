// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================
// ✅ CREATE UPLOADS FOLDER IF NOT EXISTS
// ========================================
const uploadPath = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// ========================================
// ✅ SERVE UPLOADS STATICALLY
// ========================================
app.use('/uploads', express.static(uploadPath));

// ========================================
// ✅ CALL ROUTES
// ========================================
app.use('/api/users', require('./ROUTES/userRoutes'));
app.use('/api/activities', require('./ROUTES/activityRoutes'));
app.use('/api/donations', require('./ROUTES/donationRoutes'));
app.use('/api/activity-media', require('./ROUTES/activityMediaRoutes'));
app.use('/api/messages', require('./ROUTES/messageRoutes'));

// ========================================
// ✅ TEST ROUTE
// ========================================
app.get('/', (req, res) => {
    res.send('Server is running ✅');
});

// ========================================
// ✅ START SERVER
// ========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});