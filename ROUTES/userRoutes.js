const express = require('express');
const router = express.Router();
const db = require('../db');

// =====================================
// IMPORTANT: Order matters - specific routes FIRST
// =====================================

// 1️⃣ User Login (specific route - comes before /:id)
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    console.log('📍 Login attempt for email:', email);

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    const sql = `SELECT * FROM users WHERE email = ?`;

    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error('❌ Login error:', err);
            return res.status(500).json({ error: err.message });
        }

        // Check if user exists
        if (results.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ message: "Invalid Email or Password" });
        }

        const user = results[0];

        // Check password (plain text - consider using bcrypt in production)
        if (user.password !== password) {
            console.log('❌ Invalid password for user:', email);
            return res.status(401).json({ message: "Invalid Email or Password" });
        }

        console.log('✅ Login successful for user:', user.username);

        // Success - don't send password back
        res.json({
            message: "Login Successful",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                location: user.location
            }
        });
    });
});

// 2️⃣ Get User by Email (specific route - comes before /:id)
router.get('/email/:email', (req, res) => {
    const { email } = req.params;
    
    console.log('📍 Fetching user with email:', email);

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    const sql = `SELECT id, username, email, location, created_at FROM users WHERE email = ?`;

    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error('❌ Error fetching user by email:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found with this email" });
        }

        console.log('✅ User found by email:', result[0].username);
        res.json(result[0]);
    });
});

// 3️⃣ Get All Users
router.get('/', (req, res) => {
    console.log('📍 Fetching all users...');
    
    const sql = `SELECT id, username, email, location, created_at FROM users ORDER BY id DESC`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching users:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ Found ${results.length} users`);
        res.json(results);
    });
});

// 4️⃣ Get Single User by ID
router.get('/:id', (req, res) => {
    const { id } = req.params;
    
    console.log('📍 Fetching user with ID:', id);

    // Check if id is a valid number
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    const sql = `SELECT id, username, email, location, created_at FROM users WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('❌ Error fetching user:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ User found:', result[0].username);
        res.json(result[0]);
    });
});

// 5️⃣ Add New User
router.post('/', (req, res) => {
    const { username, email, password, location } = req.body;

    console.log('📍 Creating new user:', { username, email, location });

    // Validate required fields
    if (!username || !email || !password || !location) {
        return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email already exists
    const checkEmailSql = `SELECT id FROM users WHERE email = ?`;
    db.query(checkEmailSql, [email], (err, results) => {
        if (err) {
            console.error('❌ Error checking email:', err);
            return res.status(500).json({ error: err.message });
        }

        if (results.length > 0) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Insert new user
        const sql = `
            INSERT INTO users 
            (username, email, password, location) 
            VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [username, email, password, location], (err, result) => {
            if (err) {
                console.error('❌ Error creating user:', err);
                return res.status(500).json({ error: err.message });
            }

            console.log('✅ User created with ID:', result.insertId);

            res.status(201).json({
                message: "User Added Successfully",
                userId: result.insertId,
                user: {
                    id: result.insertId,
                    username,
                    email,
                    location
                }
            });
        });
    });
});

// 6️⃣ Update User Details - FIXED VERSION
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { username, email, password, location } = req.body;

    console.log('📍 Updating user ID:', id, { username, email, location });

    // Validate required fields
    if (!username || !email || !location) {
        return res.status(400).json({ message: "Username, email and location are required" });
    }

    // Check if id is a valid number
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    // First, get the current user data to compare emails
    const getUserSql = `SELECT email FROM users WHERE id = ?`;
    
    db.query(getUserSql, [id], (err, userResult) => {
        if (err) {
            console.error('❌ Error fetching user:', err);
            return res.status(500).json({ error: err.message });
        }

        if (userResult.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const currentEmail = userResult[0].email;

        // Only check for email duplicate if email is being changed
        if (email !== currentEmail) {
            // Check if the new email already exists for another user
            const checkEmailSql = `SELECT id FROM users WHERE email = ? AND id != ?`;
            
            db.query(checkEmailSql, [email, id], (err, emailResults) => {
                if (err) {
                    console.error('❌ Error checking email:', err);
                    return res.status(500).json({ error: err.message });
                }

                if (emailResults.length > 0) {
                    return res.status(400).json({ message: "Email already exists for another user" });
                }

                // Proceed with update (email changed)
                performUpdate(id, username, email, password, location, res);
            });
        } else {
            // Email hasn't changed, proceed with update directly
            performUpdate(id, username, email, password, location, res);
        }
    });
});

// Helper function to perform the actual update
function performUpdate(id, username, email, password, location, res) {
    // Build update query - include password only if provided and not empty
    let sql;
    let params;

    if (password && password.trim() !== '') {
        // Update with new password
        sql = `
            UPDATE users
            SET username = ?, 
                email = ?, 
                password = ?, 
                location = ?
            WHERE id = ?
        `;
        params = [username, email, password, location, id];
    } else {
        // Update without changing password
        sql = `
            UPDATE users
            SET username = ?, 
                email = ?, 
                location = ?
            WHERE id = ?
        `;
        params = [username, email, location, id];
    }

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('❌ Error updating user:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User Not Found" });
        }

        console.log('✅ User updated successfully');

        // Fetch the updated user to return (without password)
        const fetchSql = `SELECT id, username, email, location, created_at FROM users WHERE id = ?`;
        db.query(fetchSql, [id], (err, userResult) => {
            if (err) {
                console.error('❌ Error fetching updated user:', err);
                return res.json({ 
                    message: "User Updated Successfully",
                    id: parseInt(id)
                });
            }

            res.json({ 
                message: "User Updated Successfully",
                id: parseInt(id),
                user: userResult[0]
            });
        });
    });
}

// 7️⃣ Delete User
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    console.log('📍 Deleting user ID:', id);

    // Check if id is a valid number
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    const sql = `DELETE FROM users WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('❌ Error deleting user:', err);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User Not Found" });
        }

        console.log('✅ User deleted successfully');
        
        res.json({ 
            message: "User Deleted Successfully",
            id: parseInt(id) 
        });
    });
});

// 8️⃣ Get User Stats (Total count)
router.get('/stats/summary', (req, res) => {
    console.log('📍 Fetching user stats...');
    
    const sql = `SELECT COUNT(*) as total_users FROM users`;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('❌ Error fetching user stats:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json({
            total_users: result[0].total_users || 0
        });
    });
});

module.exports = router;