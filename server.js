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
// ✅ CONFIGURE UPLOADS PATH (Railway Volume Support)
// ========================================
// Check if we're on Railway with a volume
const isRailway = !!process.env.RAILWAY_VOLUME_MOUNT_PATH;
const uploadPath = isRailway
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : path.join(__dirname, 'uploads');

console.log('📁 Environment:', isRailway ? 'Railway (with volume)' : 'Local development');
console.log('📁 Upload path:', uploadPath);
console.log('📁 RAILWAY_VOLUME_MOUNT_PATH:', process.env.RAILWAY_VOLUME_MOUNT_PATH || 'Not set');

// Create uploads folder if it doesn't exist
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log('📁 Created uploads directory at:', uploadPath);
} else {
    console.log('📁 Uploads directory already exists');
}

// ========================================
// ✅ SERVE UPLOADS STATICALLY
// ========================================
app.use('/uploads', express.static(uploadPath));

// ========================================
// ✅ DEBUG ENDPOINT (Remove in production)
// ========================================
app.get('/debug/storage', (req, res) => {
    const files = fs.existsSync(uploadPath) ? fs.readdirSync(uploadPath) : [];
    
    res.json({
        environment: process.env.NODE_ENV || 'development',
        isRailway: isRailway,
        railwayVolumePath: process.env.RAILWAY_VOLUME_MOUNT_PATH || 'Not set',
        uploadPath: uploadPath,
        uploadExists: fs.existsSync(uploadPath),
        fileCount: files.length,
        files: files,
        baseUrl: `${req.protocol}://${req.get('host')}`
    });
});

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
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Uploads served from: ${uploadPath}`);
    console.log(`🔗 Base URL: http://localhost:${PORT}`);
});