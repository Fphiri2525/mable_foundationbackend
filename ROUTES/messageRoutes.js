const express = require('express');
const router = express.Router();
const db = require('../db');

// 1️⃣ Send Message
router.post('/', (req, res) => {
    const { name, email, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const sql = `
        INSERT INTO messages (name, email, message)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [name, email, message], (err, result) => {
        if (err) {
            console.error('Error sending message:', err);
            return res.status(500).json({ error: err.message });
        }

        res.status(201).json({
            message: "Message Sent Successfully",
            messageId: result.insertId
        });
    });
});

// 2️⃣ Get All Messages
router.get('/', (req, res) => {
    const sql = `
        SELECT id, name, email, message, created_at
        FROM messages
        ORDER BY id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});

// 3️⃣ Get Single Message by ID
router.get('/:id', (req, res) => {
    const { id } = req.params;

    const sql = `SELECT * FROM messages WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error fetching message:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Message not found" });
        }

        res.json(result[0]);
    });
});

// 4️⃣ Delete Message
router.delete('/:id', (req, res) => {
    const { id } = req.params;

    const sql = `DELETE FROM messages WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting message:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Message not found" });
        }

        res.json({ 
            message: "Message deleted successfully",
            id: parseInt(id)
        });
    });
});

module.exports = router;