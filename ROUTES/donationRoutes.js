const express = require('express');
const router = express.Router();
const db = require('../db');

// =====================================
// IMPORTANT: Order matters - specific routes FIRST
// =====================================

// 1️⃣ Get Total Amount Donated (MUST come before /:id)
router.get('/total', (req, res) => {
    console.log('📍 Fetching total donations...');
    
    const sql = `SELECT SUM(amount) AS total_donated FROM donations`;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('❌ Error calculating total:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log('✅ Total result:', result[0]);
        
        res.json({
            total_donated: result[0]?.total_donated || 0
        });
    });
});

// 2️⃣ Get All Donations
router.get('/', (req, res) => {
    console.log('📍 Fetching all donations...');
    
    const sql = `SELECT * FROM donations ORDER BY donation_date DESC`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching donations:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Found ${results.length} donations`);
        res.json(results);
    });
});

// 3️⃣ Get Single Donation by ID (dynamic route - comes after /total)
router.get('/:id', (req, res) => {
    const { id } = req.params;
    
    console.log('📍 Fetching donation with ID:', id);

    // Check if id is a valid number
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid donation ID" });
    }

    const sql = `SELECT * FROM donations WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('❌ Error fetching donation:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Donation not found" });
        }

        console.log('✅ Donation found:', result[0]);
        res.json(result[0]);
    });
});

// 4️⃣ Add New Donation
router.post('/', (req, res) => {
    const { donor_name, location, purpose, donation_date, amount } = req.body;

    console.log('📍 Creating new donation:', { donor_name, location, purpose, donation_date, amount });

    // Validate required fields
    if (!donor_name || !location || !purpose || !donation_date || !amount) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const sql = `
        INSERT INTO donations 
        (donor_name, location, purpose, donation_date, amount) 
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [donor_name, location, purpose, donation_date, amount], (err, result) => {
        if (err) {
            console.error('❌ Error creating donation:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log('✅ Donation created with ID:', result.insertId);
        
        res.status(201).json({ 
            message: "Donation Added Successfully",
            id: result.insertId 
        });
    });
});

// 5️⃣ Update (Edit) Donation
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { donor_name, location, purpose, donation_date, amount } = req.body;

    console.log('📍 Updating donation ID:', id, 'with data:', { donor_name, location, purpose, donation_date, amount });

    // Validate required fields
    if (!donor_name || !location || !purpose || !donation_date || !amount) {
        return res.status(400).json({ message: "All fields are required" });
    }

    // Check if id is a valid number
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid donation ID" });
    }

    const sql = `
        UPDATE donations 
        SET donor_name = ?, 
            location = ?, 
            purpose = ?, 
            donation_date = ?, 
            amount = ?
        WHERE id = ?
    `;

    db.query(sql, [donor_name, location, purpose, donation_date, amount, id], (err, result) => {
        if (err) {
            console.error('❌ Error updating donation:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Donation Not Found" });
        }

        console.log('✅ Donation updated successfully');
        
        res.json({ 
            message: "Donation Updated Successfully",
            id: parseInt(id) 
        });
    });
});

// 6️⃣ Delete Donation
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    console.log('📍 Deleting donation ID:', id);

    // Check if id is a valid number
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid donation ID" });
    }

    const sql = `DELETE FROM donations WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('❌ Error deleting donation:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Donation Not Found" });
        }

        console.log('✅ Donation deleted successfully');
        
        res.json({ 
            message: "Donation Deleted Successfully",
            id: parseInt(id) 
        });
    });
});

// 7️⃣ Debug route to check database (optional - remove in production)
router.get('/debug/check', (req, res) => {
    const sql = 'SELECT COUNT(*) as count, SUM(amount) as total FROM donations';
    
    db.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            count: result[0].count,
            total: result[0].total || 0,
            message: 'Database check successful'
        });
    });
});

module.exports = router;