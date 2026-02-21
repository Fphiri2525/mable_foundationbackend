const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// =====================================
// 1️⃣ CONFIGURE UPLOADS PATH (Railway Volume Support)
// =====================================
// Check if we're on Railway with a volume
const isRailway = !!process.env.RAILWAY_VOLUME_MOUNT_PATH;
const uploadPath = isRailway
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : path.join(__dirname, '..', 'uploads');

console.log('📁 Activity Routes - Upload path:', uploadPath);
console.log('📁 Activity Routes - Railway volume:', isRailway ? 'Yes' : 'No');

// Create upload folder if it doesn't exist
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log('📁 Created uploads directory at:', uploadPath);
}

// =====================================
// 2️⃣ MULTER CONFIGURATION
// =====================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(file.originalname);
        const fileName = uniqueSuffix + fileExt;
        console.log('📁 Saving file as:', fileName);
        cb(null, fileName);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// =====================================
// Helper: Generate Full URL Dynamically
// =====================================
const getFullMediaUrl = (req, filename) => {
    // Build URL dynamically from request
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}/uploads/${filename}`;
};

// =====================================
// 3️⃣ ADD ACTIVITY + MULTIPLE PHOTOS
// =====================================
router.post('/', upload.array('photos', 10), (req, res) => {
    console.log('📍 Received POST request to add activity');
    console.log('📍 Files received:', req.files ? req.files.length : 0);
    console.log('📍 Body:', req.body);

    const { title, activity_date, location, amount_used, description } = req.body;

    if (!title || !activity_date || !location || !amount_used || !description) {
        return res.status(400).json({ message: "All fields required" });
    }

    const activitySql = `
        INSERT INTO activities (title, activity_date, location, amount_used, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(activitySql, [title, activity_date, location, amount_used, description], (err, result) => {
        if (err) {
            console.error('❌ Error creating activity:', err);
            return res.status(500).json({ error: err.message });
        }

        const activityId = result.insertId;
        console.log('✅ Activity created with ID:', activityId);

        // If images uploaded
        if (req.files && req.files.length > 0) {
            const mediaValues = req.files.map(file => [activityId, file.filename]);

            const mediaSql = `INSERT INTO activity_media (activity_id, image) VALUES ?`;

            db.query(mediaSql, [mediaValues], (err2) => {
                if (err2) {
                    console.error('❌ Error saving media:', err2);
                    return res.status(500).json({ error: err2.message });
                }

                // Verify files were saved
                req.files.forEach(file => {
                    const filePath = path.join(uploadPath, file.filename);
                    console.log(`📁 File ${file.filename} exists: ${fs.existsSync(filePath)} at ${filePath}`);
                });

                // Return the full URLs for the uploaded images
                const uploadedImages = req.files.map(file => ({
                    filename: file.filename,
                    url: getFullMediaUrl(req, file.filename)
                }));

                console.log('✅ Images saved:', uploadedImages);

                res.status(201).json({
                    message: "Activity & photos added successfully",
                    activityId,
                    images: uploadedImages
                });
            });
        } else {
            res.status(201).json({
                message: "Activity added (no photos)",
                activityId
            });
        }
    });
});

// =====================================
// 4️⃣ GET ACTIVITY STATISTICS
// =====================================
router.get('/stats/summary', (req, res) => {
    console.log('📍 Fetching activity statistics...');
    
    const sql = `
        SELECT 
            COUNT(*) as total_activities,
            SUM(amount_used) as total_spent,
            AVG(amount_used) as average_spent,
            MIN(amount_used) as min_spent,
            MAX(amount_used) as max_spent,
            COUNT(DISTINCT location) as unique_locations
        FROM activities
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('❌ Error fetching activity stats:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json({
            total_activities: result[0]?.total_activities || 0,
            total_spent: result[0]?.total_spent || 0,
            average_spent: Math.round(result[0]?.average_spent) || 0,
            min_spent: result[0]?.min_spent || 0,
            max_spent: result[0]?.max_spent || 0,
            unique_locations: result[0]?.unique_locations || 0
        });
    });
});

// =====================================
// 5️⃣ GET MONTHLY ACTIVITY STATISTICS
// =====================================
router.get('/stats/monthly', (req, res) => {
    console.log('📍 Fetching monthly activity statistics...');
    
    const sql = `
        SELECT 
            MONTH(activity_date) as month,
            YEAR(activity_date) as year,
            COUNT(*) as activity_count,
            SUM(amount_used) as total_spent
        FROM activities
        WHERE activity_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY YEAR(activity_date), MONTH(activity_date)
        ORDER BY year DESC, month DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching monthly stats:', err);
            return res.status(500).json({ error: err.message });
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyData = [];

        results.forEach(row => {
            monthlyData.push({
                month: months[row.month - 1],
                year: row.year,
                count: row.activity_count,
                total: row.total_spent
            });
        });

        res.json(monthlyData);
    });
});

// =====================================
// 6️⃣ GET LOCATION BREAKDOWN
// =====================================
router.get('/stats/locations', (req, res) => {
    console.log('📍 Fetching location breakdown...');
    
    const sql = `
        SELECT 
            location,
            COUNT(*) as activity_count,
            SUM(amount_used) as total_spent,
            AVG(amount_used) as average_spent
        FROM activities
        GROUP BY location
        ORDER BY total_spent DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching location stats:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});

// =====================================
// 7️⃣ GET TOTAL SPENT (for dashboard)
// =====================================
router.get('/total/spent', (req, res) => {
    console.log('📍 Fetching total activity spending...');
    
    const sql = `SELECT SUM(amount_used) AS total_spent FROM activities`;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('❌ Error calculating total spending:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json({
            total_spent: result[0]?.total_spent || 0
        });
    });
});

// =====================================
// 8️⃣ GET RECENT ACTIVITIES (limited)
// =====================================
router.get('/recent/limit/:count', (req, res) => {
    const count = parseInt(req.params.count) || 5;
    console.log(`📍 Fetching ${count} recent activities`);

    const sql = `
        SELECT a.*, 
               COUNT(m.id) as photo_count
        FROM activities a
        LEFT JOIN activity_media m ON a.id = m.activity_id
        GROUP BY a.id
        ORDER BY a.activity_date DESC, a.id DESC
        LIMIT ?
    `;

    db.query(sql, [count], (err, results) => {
        if (err) {
            console.error('❌ Error fetching recent activities:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});

// =====================================
// 9️⃣ GET ACTIVITIES BY DATE RANGE
// =====================================
router.get('/range', (req, res) => {
    const { start_date, end_date } = req.query;
    console.log(`📍 Fetching activities from ${start_date} to ${end_date}`);

    let sql = `
        SELECT a.*, 
               COUNT(m.id) as photo_count
        FROM activities a
        LEFT JOIN activity_media m ON a.id = m.activity_id
    `;

    const params = [];
    
    if (start_date && end_date) {
        sql += ` WHERE a.activity_date BETWEEN ? AND ?`;
        params.push(start_date, end_date);
    }

    sql += ` GROUP BY a.id ORDER BY a.activity_date DESC`;

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('❌ Error fetching activities by range:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});

// =====================================
// 🔟 GET ACTIVITY WITH MOST PHOTOS
// =====================================
router.get('/most-photos', (req, res) => {
    console.log('📍 Fetching activity with most photos');

    const sql = `
        SELECT a.*, 
               COUNT(m.id) as photo_count
        FROM activities a
        LEFT JOIN activity_media m ON a.id = m.activity_id
        GROUP BY a.id
        ORDER BY photo_count DESC
        LIMIT 1
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('❌ Error fetching activity with most photos:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "No activities found" });
        }

        res.json(result[0]);
    });
});

// =====================================
// 1️⃣1️⃣ GET SINGLE ACTIVITY BY ID WITH PHOTOS
// =====================================
router.get('/:id', (req, res) => {
    const { id } = req.params;
    console.log('📍 Fetching activity with ID:', id);

    const activitySql = `SELECT * FROM activities WHERE id = ?`;

    db.query(activitySql, [id], (err, activityResult) => {
        if (err) {
            console.error('❌ Error fetching activity:', err);
            return res.status(500).json({ error: err.message });
        }

        if (activityResult.length === 0) {
            return res.status(404).json({ message: "Activity not found" });
        }

        const activity = activityResult[0];
        console.log('✅ Activity found:', activity.title);

        const mediaSql = `SELECT id AS media_id, image FROM activity_media WHERE activity_id = ?`;

        db.query(mediaSql, [id], (err, mediaResult) => {
            if (err) {
                console.error('❌ Error fetching media:', err);
                return res.status(500).json({ error: err.message });
            }

            // Verify each image exists and return full URLs
            const media = mediaResult.map(media => {
                const filePath = path.join(uploadPath, media.image);
                const fileExists = fs.existsSync(filePath);
                
                if (!fileExists) {
                    console.warn('⚠️ File not found:', filePath);
                }

                return {
                    media_id: media.media_id,
                    media_url: getFullMediaUrl(req, media.image),
                    filename: media.image,
                    exists: fileExists
                };
            });

            console.log('✅ Media found:', media.length);

            const response = {
                id: activity.id,
                title: activity.title,
                activity_date: activity.activity_date,
                location: activity.location,
                amount_used: activity.amount_used,
                description: activity.description,
                media: media
            };

            res.json(response);
        });
    });
});

// =====================================
// 1️⃣2️⃣ GET ALL ACTIVITIES WITH PHOTOS
// =====================================
router.get('/', (req, res) => {
    console.log('📍 Fetching all activities');

    const sql = `
        SELECT a.*, m.id AS media_id, m.image
        FROM activities a
        LEFT JOIN activity_media m ON a.id = m.activity_id
        ORDER BY a.id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching activities:', err);
            return res.status(500).json({ error: err.message });
        }

        const activities = [];
        const map = {};

        results.forEach(row => {
            if (!map[row.id]) {
                map[row.id] = {
                    id: row.id,
                    title: row.title,
                    activity_date: row.activity_date,
                    location: row.location,
                    amount_used: row.amount_used,
                    description: row.description,
                    media: []
                };
                activities.push(map[row.id]);
            }

            if (row.media_id) {
                // Verify file exists
                const filePath = path.join(uploadPath, row.image);
                const fileExists = fs.existsSync(filePath);
                
                if (fileExists) {
                    map[row.id].media.push({
                        media_id: row.media_id,
                        media_url: getFullMediaUrl(req, row.image),
                        filename: row.image
                    });
                } else {
                    console.warn('⚠️ File not found for media ID', row.media_id, ':', filePath);
                }
            }
        });

        console.log('✅ Returning', activities.length, 'activities');
        res.json(activities);
    });
});

// =====================================
// 1️⃣3️⃣ UPDATE ACTIVITY
// =====================================
router.put('/:id', upload.array('photos', 10), (req, res) => {
    const { id } = req.params;
    const { title, activity_date, location, amount_used, description } = req.body;

    console.log('📍 Updating activity ID:', id);
    console.log('📍 Files received:', req.files ? req.files.length : 0);

    if (!title || !activity_date || !location || !amount_used || !description) {
        return res.status(400).json({ message: "All fields required" });
    }

    const updateSql = `
        UPDATE activities 
        SET title = ?, activity_date = ?, location = ?, amount_used = ?, description = ?
        WHERE id = ?
    `;

    db.query(updateSql, [title, activity_date, location, amount_used, description, id], (err, result) => {
        if (err) {
            console.error('❌ Error updating activity:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Activity not found" });
        }

        // If new photos were uploaded
        if (req.files && req.files.length > 0) {
            const mediaValues = req.files.map(file => [id, file.filename]);
            const mediaSql = `INSERT INTO activity_media (activity_id, image) VALUES ?`;

            db.query(mediaSql, [mediaValues], (err2) => {
                if (err2) {
                    console.error('❌ Error saving new photos:', err2);
                    return res.status(500).json({ error: err2.message });
                }

                // Return the URLs of uploaded images
                const uploadedImages = req.files.map(file => ({
                    filename: file.filename,
                    url: getFullMediaUrl(req, file.filename)
                }));

                res.json({
                    message: "Activity updated successfully with new photos",
                    activityId: parseInt(id),
                    images: uploadedImages
                });
            });
        } else {
            res.json({
                message: "Activity updated successfully",
                activityId: parseInt(id)
            });
        }
    });
});

// =====================================
// 1️⃣4️⃣ ADD MORE PHOTOS TO EXISTING ACTIVITY
// =====================================
router.post('/media/batch/:activityId', upload.array('photos', 10), (req, res) => {
    const { activityId } = req.params;

    console.log('📍 Adding photos to activity ID:', activityId);
    console.log('📍 Files received:', req.files ? req.files.length : 0);

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No photos uploaded" });
    }

    const checkSql = `SELECT id FROM activities WHERE id = ?`;
    db.query(checkSql, [activityId], (err, result) => {
        if (err) {
            console.error('❌ Error checking activity:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Activity not found" });
        }

        const mediaValues = req.files.map(file => [activityId, file.filename]);
        const sql = `INSERT INTO activity_media (activity_id, image) VALUES ?`;

        db.query(sql, [mediaValues], (err2) => {
            if (err2) {
                console.error('❌ Error saving photos:', err2);
                return res.status(500).json({ error: err2.message });
            }

            // Return the URLs of uploaded images
            const uploadedImages = req.files.map(file => ({
                filename: file.filename,
                url: getFullMediaUrl(req, file.filename)
            }));

            console.log('✅ Photos added:', uploadedImages);

            res.json({
                message: "Photos added successfully",
                count: req.files.length,
                images: uploadedImages
            });
        });
    });
});

// =====================================
// 1️⃣5️⃣ DELETE SINGLE MEDIA
// =====================================
router.delete('/media/:mediaId', (req, res) => {
    const { mediaId } = req.params;
    console.log('📍 Deleting media ID:', mediaId);

    const getImageSql = `SELECT image FROM activity_media WHERE id = ?`;
    
    db.query(getImageSql, [mediaId], (err, result) => {
        if (err) {
            console.error('❌ Error fetching media:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Media not found" });
        }

        const imageFile = result[0].image;

        const deleteSql = `DELETE FROM activity_media WHERE id = ?`;
        
        db.query(deleteSql, [mediaId], (err2) => {
            if (err2) {
                console.error('❌ Error deleting media from DB:', err2);
                return res.status(500).json({ error: err2.message });
            }

            // Delete physical file
            const filePath = path.join(uploadPath, imageFile);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('✅ Deleted file:', filePath);
            }

            res.json({ message: "Media deleted successfully" });
        });
    });
});

// =====================================
// 1️⃣6️⃣ DELETE ACTIVITY + ALL PHOTOS
// =====================================
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    console.log('📍 Deleting activity ID:', id);

    const getImagesSql = `SELECT image FROM activity_media WHERE activity_id = ?`;

    db.query(getImagesSql, [id], (err, images) => {
        if (err) {
            console.error('❌ Error fetching images:', err);
            return res.status(500).json({ error: err.message });
        }

        // Delete files physically
        images.forEach(img => {
            const filePath = path.join(uploadPath, img.image);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('✅ Deleted file:', filePath);
            }
        });

        db.query(`DELETE FROM activities WHERE id = ?`, [id], (err2, result) => {
            if (err2) {
                console.error('❌ Error deleting activity:', err2);
                return res.status(500).json({ error: err2.message });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Activity not found" });
            }

            res.json({ message: "Activity & media deleted successfully" });
        });
    });
});

module.exports = router;