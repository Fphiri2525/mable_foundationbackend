const express = require('express');
const router = express.Router();
const db = require('../db');

// 1️⃣ Get Total Amount Donated
router.get('/total', async (req, res) => {
    console.log('📍 Fetching total donations...');
    try {
        const [result] = await db.query(`SELECT SUM(amount) AS total_donated FROM donations`);
        res.json({ total_donated: result[0]?.total_donated || 0 });
    } catch (err) {
        console.error('❌ Error calculating total:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2️⃣ Debug route
router.get('/debug/check', async (req, res) => {
    try {
        const [result] = await db.query('SELECT COUNT(*) as count, SUM(amount) as total FROM donations');
        res.json({ count: result[0].count, total: result[0].total || 0, message: 'Database check successful' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3️⃣ Get All Donations
router.get('/', async (req, res) => {
    console.log('📍 Fetching all donations...');
    try {
        const [results] = await db.query(`SELECT * FROM donations ORDER BY donation_date DESC`);
        console.log(`✅ Found ${results.length} donations`);
        res.json(results);
    } catch (err) {
        console.error('❌ Error fetching donations:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4️⃣ Get Single Donation by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    console.log('📍 Fetching donation with ID:', id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid donation ID" });
    }

    try {
        const [result] = await db.query(`SELECT * FROM donations WHERE id = ?`, [id]);

        if (result.length === 0) {
            return res.status(404).json({ message: "Donation not found" });
        }

        res.json(result[0]);
    } catch (err) {
        console.error('❌ Error fetching donation:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5️⃣ Add New Donation
router.post('/', async (req, res) => {
    const { donor_name, location, purpose, donation_date, amount } = req.body;
    console.log('📍 Creating new donation:', { donor_name, location, purpose, donation_date, amount });

    if (!donor_name || !location || !purpose || !donation_date || !amount) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO donations (donor_name, location, purpose, donation_date, amount) VALUES (?, ?, ?, ?, ?)`,
            [donor_name, location, purpose, donation_date, amount]
        );

        console.log('✅ Donation created with ID:', result.insertId);
        res.status(201).json({ message: "Donation Added Successfully", id: result.insertId });
    } catch (err) {
        console.error('❌ Error creating donation:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6️⃣ Update Donation
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { donor_name, location, purpose, donation_date, amount } = req.body;
    console.log('📍 Updating donation ID:', id);

    if (!donor_name || !location || !purpose || !donation_date || !amount) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid donation ID" });
    }

    try {
        const [result] = await db.query(
            `UPDATE donations SET donor_name = ?, location = ?, purpose = ?, donation_date = ?, amount = ? WHERE id = ?`,
            [donor_name, location, purpose, donation_date, amount, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Donation Not Found" });
        }

        console.log('✅ Donation updated successfully');
        res.json({ message: "Donation Updated Successfully", id: parseInt(id) });
    } catch (err) {
        console.error('❌ Error updating donation:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7️⃣ Delete Donation
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    console.log('📍 Deleting donation ID:', id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid donation ID" });
    }

    try {
        const [result] = await db.query(`DELETE FROM donations WHERE id = ?`, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Donation Not Found" });
        }

        console.log('✅ Donation deleted successfully');
        res.json({ message: "Donation Deleted Successfully", id: parseInt(id) });
    } catch (err) {
        console.error('❌ Error deleting donation:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;