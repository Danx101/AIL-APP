const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../database/database-wrapper');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, phone, activationCode, managerCode, role = 'customer' } = req.body;

      // Check if user already exists
      const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Validate activation code for customers
      if (role === 'customer') {
        if (!activationCode) {
          return res.status(400).json({ message: 'Activation code is required for customers' });
        }

        const validCode = await new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM activation_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > NOW())',
            [activationCode],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (!validCode) {
          return res.status(400).json({ message: 'Invalid or expired activation code' });
        }
      }

      // Validate manager code for studio owners
      let managerCodeData = null;
      if (role === 'studio_owner') {
        if (!managerCode) {
          return res.status(400).json({ message: 'Manager code is required for studio owners' });
        }

        managerCodeData = await new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM manager_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > NOW())',
            [managerCode],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (!managerCodeData) {
          return res.status(400).json({ message: 'Invalid or expired manager code' });
        }
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user - for studio owners, use intended name from manager code if provided
      let finalFirstName = firstName;
      let finalLastName = lastName;
      
      if (role === 'studio_owner' && managerCodeData && managerCodeData.intended_owner_name) {
        const nameParts = managerCodeData.intended_owner_name.split(' ');
        finalFirstName = finalFirstName || nameParts[0] || '';
        finalLastName = finalLastName || nameParts.slice(1).join(' ') || '';
      }

      const userId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (email, password_hash, role, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
          [email, hashedPassword, role, finalFirstName, finalLastName, phone],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Delete activation code after successful use for customers
      if (role === 'customer' && activationCode) {
        await new Promise((resolve, reject) => {
          db.run(
            'DELETE FROM activation_codes WHERE code = ?',
            [activationCode],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Delete manager code after successful use for studio owners
      if (role === 'studio_owner' && managerCode) {
        await new Promise((resolve, reject) => {
          db.run(
            'DELETE FROM manager_codes WHERE code = ?',
            [managerCode],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId, email, role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      const responseData = {
        message: 'User registered successfully',
        user: {
          id: userId,
          email,
          role,
          firstName: finalFirstName,
          lastName: finalLastName,
          phone
        },
        token
      };

      // Add manager code information for studio owners
      if (role === 'studio_owner' && managerCodeData) {
        responseData.studioInfo = {
          intendedCity: managerCodeData.intended_city,
          intendedStudioName: managerCodeData.intended_studio_name
        };
      }

      res.status(201).json(responseData);

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Debug: Log user object structure
      console.log('User object from database:', JSON.stringify(user, null, 2));
      console.log('Password hash field:', user.password_hash);
      console.log('Password hash type:', typeof user.password_hash);
      console.log('Password hash value:', user.password_hash ? 'exists' : 'undefined/null');
      console.log('Input password:', password);
      console.log('Input password type:', typeof password);

      // Check password
      let isValidPassword = false;
      try {
        isValidPassword = await bcrypt.compare(password, user.password_hash);
      } catch (bcryptError) {
        console.error('Bcrypt compare error:', bcryptError);
        console.error('Bcrypt error details:', {
          message: bcryptError.message,
          passwordProvided: !!password,
          hashProvided: !!user.password_hash,
          hashValue: user.password_hash
        });
        return res.status(500).json({ 
          message: 'Password validation error',
          error: bcryptError.message,
          debug: {
            passwordProvided: !!password,
            hashProvided: !!user.password_hash
          }
        });
      }
      
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone
        },
        token
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;

      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          createdAt: user.created_at
        }
      });

    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { firstName, lastName, phone } = req.body;

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = datetime("now") WHERE id = ?',
          [firstName, lastName, phone, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({ message: 'Profile updated successfully' });

    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Logout (client-side token removal, server-side could implement token blacklisting)
  async logout(req, res) {
    res.json({ message: 'Logged out successfully' });
  }
}

module.exports = new AuthController();