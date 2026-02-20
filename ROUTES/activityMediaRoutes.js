const express = require('express');
const router = express.Router();
const db = require('../db');

// Add Activity Media
router.post('/', (req, res) => {
    const { activity_id, media_type, media_url } = req.body;

    const sql = `INSERT INTO activity_media (activity_id, media_type, media_url) VALUES (?, ?, ?)`;

    db.query(sql, [activity_id, media_type, media_url], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Activity Media Added Successfully" });
    });
});

module.exports = router;
