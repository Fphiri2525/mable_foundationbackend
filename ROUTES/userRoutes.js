const express = require('express');
const router = express.Router();
const db = require('../db');

// 1️⃣ User Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('📍 Login attempt for email:', email);

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const [results] = await db.query(`SELECT * FROM users WHERE email = ?`, [email]);

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid Email or Password" });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid Email or Password" });
        }

        console.log('✅ Login successful for user:', user.username);

        res.json({
            message: "Login Successful",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                location: user.location
            }
        });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2️⃣ Get User by Email
router.get('/email/:email', async (req, res) => {
    const { email } = req.params;
    console.log('📍 Fetching user with email:', email);

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        const [result] = await db.query(
            `SELECT id, username, email, location, created_at FROM users WHERE email = ?`,
            [email]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found with this email" });
        }

        console.log('✅ User found by email:', result[0].username);
        res.json(result[0]);
    } catch (err) {
        console.error('❌ Error fetching user by email:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3️⃣ Get User Stats
router.get('/stats/summary', async (req, res) => {
    console.log('📍 Fetching user stats...');
    try {
        const [result] = await db.query(`SELECT COUNT(*) as total_users FROM users`);
        res.json({ total_users: result[0].total_users || 0 });
    } catch (err) {
        console.error('❌ Error fetching user stats:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4️⃣ Get All Users
router.get('/', async (req, res) => {
    console.log('📍 Fetching all users...');
    try {
        const [results] = await db.query(
            `SELECT id, username, email, location, created_at FROM users ORDER BY id DESC`
        );
        console.log(`✅ Found ${results.length} users`);
        res.json(results);
    } catch (err) {
        console.error('❌ Error fetching users:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5️⃣ Get Single User by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    console.log('📍 Fetching user with ID:', id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
        const [result] = await db.query(
            `SELECT id, username, email, location, created_at FROM users WHERE id = ?`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ User found:', result[0].username);
        res.json(result[0]);
    } catch (err) {
        console.error('❌ Error fetching user:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6️⃣ Add New User
router.post('/', async (req, res) => {
    const { username, email, password, location } = req.body;
    console.log('📍 Creating new user:', { username, email, location });

    if (!username || !email || !password || !location) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const [existing] = await db.query(`SELECT id FROM users WHERE email = ?`, [email]);

        if (existing.length > 0) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const [result] = await db.query(
            `INSERT INTO users (username, email, password, location) VALUES (?, ?, ?, ?)`,
            [username, email, password, location]
        );

        console.log('✅ User created with ID:', result.insertId);

        res.status(201).json({
            message: "User Added Successfully",
            userId: result.insertId,
            user: { id: result.insertId, username, email, location }
        });
    } catch (err) {
        console.error('❌ Error creating user:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7️⃣ Update User
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { username, email, password, location } = req.body;
    console.log('📍 Updating user ID:', id);

    if (!username || !email || !location) {
        return res.status(400).json({ message: "Username, email and location are required" });
    }

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
        const [userResult] = await db.query(`SELECT email FROM users WHERE id = ?`, [id]);

        if (userResult.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const currentEmail = userResult[0].email;

        if (email !== currentEmail) {
            const [emailCheck] = await db.query(
                `SELECT id FROM users WHERE email = ? AND id != ?`,
                [email, id]
            );
            if (emailCheck.length > 0) {
                return res.status(400).json({ message: "Email already exists for another user" });
            }
        }

        let sql, params;
        if (password && password.trim() !== '') {
            sql = `UPDATE users SET username = ?, email = ?, password = ?, location = ? WHERE id = ?`;
            params = [username, email, password, location, id];
        } else {
            sql = `UPDATE users SET username = ?, email = ?, location = ? WHERE id = ?`;
            params = [username, email, location, id];
        }

        const [result] = await db.query(sql, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User Not Found" });
        }

        const [updatedUser] = await db.query(
            `SELECT id, username, email, location, created_at FROM users WHERE id = ?`,
            [id]
        );

        console.log('✅ User updated successfully');
        res.json({ message: "User Updated Successfully", id: parseInt(id), user: updatedUser[0] });
    } catch (err) {
        console.error('❌ Error updating user:', err);
        res.status(500).json({ error: err.message });
    }
});

// 8️⃣ Delete User
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    console.log('📍 Deleting user ID:', id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
        const [result] = await db.query(`DELETE FROM users WHERE id = ?`, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User Not Found" });
        }

        console.log('✅ User deleted successfully');
        res.json({ message: "User Deleted Successfully", id: parseInt(id) });
    } catch (err) {
        console.error('❌ Error deleting user:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;