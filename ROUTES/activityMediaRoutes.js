const express = require('express');
const router = express.Router();
const db = require('../db');

// Add Activity Media
router.post('/', async (req, res) => {
    const { activity_id, media_type, media_url } = req.body;

    try {
        await db.query(
            `INSERT INTO activity_media (activity_id, media_type, media_url) VALUES (?, ?, ?)`,
            [activity_id, media_type, media_url]
        );
        res.json({ message: "Activity Media Added Successfully" });
    } catch (err) {
        console.error('❌ Error adding activity media:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;