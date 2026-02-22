const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// =====================================
// 1️⃣ CONFIGURE UPLOADS PATH
// =====================================
const isRailway = !!process.env.RAILWAY_VOLUME_MOUNT_PATH;
const uploadPath = isRailway
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : path.join(__dirname, '..', 'uploads');

console.log('📁 Activity Routes - Upload path:', uploadPath);
console.log('📁 Activity Routes - Railway volume:', isRailway ? 'Yes' : 'No');

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// =====================================
// 2️⃣ MULTER CONFIGURATION
// =====================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadPath); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

const getFullMediaUrl = (req, filename) => {
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
};

// =====================================
// 3️⃣ ADD ACTIVITY + MULTIPLE PHOTOS
// =====================================
router.post('/', upload.array('photos', 10), async (req, res) => {
    console.log('📍 Received POST request to add activity');
    const { title, activity_date, location, amount_used, description } = req.body;

    if (!title || !activity_date || !location || !amount_used || !description) {
        return res.status(400).json({ message: "All fields required" });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO activities (title, activity_date, location, amount_used, description) VALUES (?, ?, ?, ?, ?)`,
            [title, activity_date, location, amount_used, description]
        );

        const activityId = result.insertId;
        console.log('✅ Activity created with ID:', activityId);

        if (req.files && req.files.length > 0) {
            const mediaValues = req.files.map(file => [activityId, file.filename]);
            await db.query(`INSERT INTO activity_media (activity_id, image) VALUES ?`, [mediaValues]);

            const uploadedImages = req.files.map(file => ({
                filename: file.filename,
                url: getFullMediaUrl(req, file.filename)
            }));

            return res.status(201).json({
                message: "Activity & photos added successfully",
                activityId,
                images: uploadedImages
            });
        }

        res.status(201).json({ message: "Activity added (no photos)", activityId });
    } catch (err) {
        console.error('❌ Error creating activity:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 4️⃣ GET ACTIVITY STATISTICS
// =====================================
router.get('/stats/summary', async (req, res) => {
    try {
        const [result] = await db.query(`
            SELECT COUNT(*) as total_activities, SUM(amount_used) as total_spent,
                   AVG(amount_used) as average_spent, MIN(amount_used) as min_spent,
                   MAX(amount_used) as max_spent, COUNT(DISTINCT location) as unique_locations
            FROM activities
        `);

        res.json({
            total_activities: result[0]?.total_activities || 0,
            total_spent: result[0]?.total_spent || 0,
            average_spent: Math.round(result[0]?.average_spent) || 0,
            min_spent: result[0]?.min_spent || 0,
            max_spent: result[0]?.max_spent || 0,
            unique_locations: result[0]?.unique_locations || 0
        });
    } catch (err) {
        console.error('❌ Error fetching activity stats:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 5️⃣ GET MONTHLY STATISTICS
// =====================================
router.get('/stats/monthly', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT MONTH(activity_date) as month, YEAR(activity_date) as year,
                   COUNT(*) as activity_count, SUM(amount_used) as total_spent
            FROM activities
            WHERE activity_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY YEAR(activity_date), MONTH(activity_date)
            ORDER BY year DESC, month DESC
        `);

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyData = results.map(row => ({
            month: months[row.month - 1],
            year: row.year,
            count: row.activity_count,
            total: row.total_spent
        }));

        res.json(monthlyData);
    } catch (err) {
        console.error('❌ Error fetching monthly stats:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 6️⃣ GET LOCATION BREAKDOWN
// =====================================
router.get('/stats/locations', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT location, COUNT(*) as activity_count,
                   SUM(amount_used) as total_spent, AVG(amount_used) as average_spent
            FROM activities GROUP BY location ORDER BY total_spent DESC
        `);
        res.json(results);
    } catch (err) {
        console.error('❌ Error fetching location stats:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 7️⃣ GET TOTAL SPENT
// =====================================
router.get('/total/spent', async (req, res) => {
    try {
        const [result] = await db.query(`SELECT SUM(amount_used) AS total_spent FROM activities`);
        res.json({ total_spent: result[0]?.total_spent || 0 });
    } catch (err) {
        console.error('❌ Error calculating total spending:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 8️⃣ GET RECENT ACTIVITIES
// =====================================
router.get('/recent/limit/:count', async (req, res) => {
    const count = parseInt(req.params.count) || 5;
    try {
        const [results] = await db.query(`
            SELECT a.*, COUNT(m.id) as photo_count
            FROM activities a
            LEFT JOIN activity_media m ON a.id = m.activity_id
            GROUP BY a.id ORDER BY a.activity_date DESC, a.id DESC LIMIT ?
        `, [count]);
        res.json(results);
    } catch (err) {
        console.error('❌ Error fetching recent activities:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 9️⃣ GET ACTIVITIES BY DATE RANGE
// =====================================
router.get('/range', async (req, res) => {
    const { start_date, end_date } = req.query;

    let sql = `
        SELECT a.*, COUNT(m.id) as photo_count
        FROM activities a
        LEFT JOIN activity_media m ON a.id = m.activity_id
    `;
    const params = [];

    if (start_date && end_date) {
        sql += ` WHERE a.activity_date BETWEEN ? AND ?`;
        params.push(start_date, end_date);
    }

    sql += ` GROUP BY a.id ORDER BY a.activity_date DESC`;

    try {
        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (err) {
        console.error('❌ Error fetching activities by range:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 🔟 GET ACTIVITY WITH MOST PHOTOS
// =====================================
router.get('/most-photos', async (req, res) => {
    try {
        const [result] = await db.query(`
            SELECT a.*, COUNT(m.id) as photo_count
            FROM activities a
            LEFT JOIN activity_media m ON a.id = m.activity_id
            GROUP BY a.id ORDER BY photo_count DESC LIMIT 1
        `);

        if (result.length === 0) {
            return res.status(404).json({ message: "No activities found" });
        }

        res.json(result[0]);
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 1️⃣1️⃣ GET SINGLE ACTIVITY BY ID WITH PHOTOS
// =====================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    console.log('📍 Fetching activity with ID:', id);

    try {
        const [activityResult] = await db.query(`SELECT * FROM activities WHERE id = ?`, [id]);

        if (activityResult.length === 0) {
            return res.status(404).json({ message: "Activity not found" });
        }

        const activity = activityResult[0];
        const [mediaResult] = await db.query(
            `SELECT id AS media_id, image FROM activity_media WHERE activity_id = ?`,
            [id]
        );

        const media = mediaResult.map(m => ({
            media_id: m.media_id,
            media_url: getFullMediaUrl(req, m.image),
            filename: m.image,
            exists: fs.existsSync(path.join(uploadPath, m.image))
        }));

        res.json({
            id: activity.id,
            title: activity.title,
            activity_date: activity.activity_date,
            location: activity.location,
            amount_used: activity.amount_used,
            description: activity.description,
            media
        });
    } catch (err) {
        console.error('❌ Error fetching activity:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 1️⃣2️⃣ GET ALL ACTIVITIES WITH PHOTOS
// =====================================
router.get('/', async (req, res) => {
    console.log('📍 Fetching all activities');

    try {
        const [results] = await db.query(`
            SELECT a.*, m.id AS media_id, m.image
            FROM activities a
            LEFT JOIN activity_media m ON a.id = m.activity_id
            ORDER BY a.id DESC
        `);

        const activities = [];
        const map = {};

        results.forEach(row => {
            if (!map[row.id]) {
                map[row.id] = {
                    id: row.id, title: row.title, activity_date: row.activity_date,
                    location: row.location, amount_used: row.amount_used,
                    description: row.description, media: []
                };
                activities.push(map[row.id]);
            }

            if (row.media_id && fs.existsSync(path.join(uploadPath, row.image))) {
                map[row.id].media.push({
                    media_id: row.media_id,
                    media_url: getFullMediaUrl(req, row.image),
                    filename: row.image
                });
            }
        });

        console.log('✅ Returning', activities.length, 'activities');
        res.json(activities);
    } catch (err) {
        console.error('❌ Error fetching activities:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 1️⃣3️⃣ UPDATE ACTIVITY
// =====================================
router.put('/:id', upload.array('photos', 10), async (req, res) => {
    const { id } = req.params;
    const { title, activity_date, location, amount_used, description } = req.body;
    console.log('📍 Updating activity ID:', id);

    if (!title || !activity_date || !location || !amount_used || !description) {
        return res.status(400).json({ message: "All fields required" });
    }

    try {
        const [result] = await db.query(
            `UPDATE activities SET title = ?, activity_date = ?, location = ?, amount_used = ?, description = ? WHERE id = ?`,
            [title, activity_date, location, amount_used, description, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Activity not found" });
        }

        if (req.files && req.files.length > 0) {
            const mediaValues = req.files.map(file => [id, file.filename]);
            await db.query(`INSERT INTO activity_media (activity_id, image) VALUES ?`, [mediaValues]);

            const uploadedImages = req.files.map(file => ({
                filename: file.filename,
                url: getFullMediaUrl(req, file.filename)
            }));

            return res.json({ message: "Activity updated successfully with new photos", activityId: parseInt(id), images: uploadedImages });
        }

        res.json({ message: "Activity updated successfully", activityId: parseInt(id) });
    } catch (err) {
        console.error('❌ Error updating activity:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 1️⃣4️⃣ ADD MORE PHOTOS TO EXISTING ACTIVITY
// =====================================
router.post('/media/batch/:activityId', upload.array('photos', 10), async (req, res) => {
    const { activityId } = req.params;
    console.log('📍 Adding photos to activity ID:', activityId);

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No photos uploaded" });
    }

    try {
        const [check] = await db.query(`SELECT id FROM activities WHERE id = ?`, [activityId]);

        if (check.length === 0) {
            return res.status(404).json({ message: "Activity not found" });
        }

        const mediaValues = req.files.map(file => [activityId, file.filename]);
        await db.query(`INSERT INTO activity_media (activity_id, image) VALUES ?`, [mediaValues]);

        const uploadedImages = req.files.map(file => ({
            filename: file.filename,
            url: getFullMediaUrl(req, file.filename)
        }));

        res.json({ message: "Photos added successfully", count: req.files.length, images: uploadedImages });
    } catch (err) {
        console.error('❌ Error saving photos:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 1️⃣5️⃣ DELETE SINGLE MEDIA
// =====================================
router.delete('/media/:mediaId', async (req, res) => {
    const { mediaId } = req.params;
    console.log('📍 Deleting media ID:', mediaId);

    try {
        const [result] = await db.query(`SELECT image FROM activity_media WHERE id = ?`, [mediaId]);

        if (result.length === 0) {
            return res.status(404).json({ message: "Media not found" });
        }

        const imageFile = result[0].image;
        await db.query(`DELETE FROM activity_media WHERE id = ?`, [mediaId]);

        const filePath = path.join(uploadPath, imageFile);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        res.json({ message: "Media deleted successfully" });
    } catch (err) {
        console.error('❌ Error deleting media:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// 1️⃣6️⃣ DELETE ACTIVITY + ALL PHOTOS
// =====================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    console.log('📍 Deleting activity ID:', id);

    try {
        const [images] = await db.query(`SELECT image FROM activity_media WHERE activity_id = ?`, [id]);

        images.forEach(img => {
            const filePath = path.join(uploadPath, img.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        const [result] = await db.query(`DELETE FROM activities WHERE id = ?`, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Activity not found" });
        }

        res.json({ message: "Activity & media deleted successfully" });
    } catch (err) {
        console.error('❌ Error deleting activity:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;