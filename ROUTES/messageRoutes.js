const express = require('express');
const router = express.Router();
const db = require('../db');

// 1️⃣ Send Message
router.post('/', async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`,
            [name, email, message]
        );

        res.status(201).json({ message: "Message Sent Successfully", messageId: result.insertId });
    } catch (err) {
        console.error('❌ Error sending message:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2️⃣ Get All Messages
router.get('/', async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT id, name, email, message, created_at FROM messages ORDER BY id DESC`
        );
        res.json(results);
    } catch (err) {
        console.error('❌ Error fetching messages:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3️⃣ Get Single Message by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(`SELECT * FROM messages WHERE id = ?`, [id]);

        if (result.length === 0) {
            return res.status(404).json({ message: "Message not found" });
        }

        res.json(result[0]);
    } catch (err) {
        console.error('❌ Error fetching message:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4️⃣ Delete Message
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(`DELETE FROM messages WHERE id = ?`, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Message not found" });
        }

        res.json({ message: "Message deleted successfully", id: parseInt(id) });
    } catch (err) {
        console.error('❌ Error deleting message:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;