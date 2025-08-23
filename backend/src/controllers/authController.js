const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../database/database-wrapper');
const emailService = require('../services/emailService');
const SubscriptionService = require('../services/subscriptionService');
const PromoCode = require('../models/PromoCode');
const Notification = require('../models/Notification');

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

      // Check if email is verified
      if (!user.email_verified) {
        return res.status(403).json({ 
          message: 'Bitte bestätigen Sie Ihre E-Mail-Adresse bevor Sie sich anmelden.',
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // For studio owners, get studio information
      let studioInfo = null;
      if (user.role === 'studio_owner') {
        const studio = await db.get(
          'SELECT * FROM studios WHERE owner_id = ? AND is_active = 1',
          [user.id]
        );
        if (studio) {
          studioInfo = studio;
        }
      }

      const response = {
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
      };

      // Add studio information if user is a studio owner
      if (studioInfo) {
        response.user.studio_id = studioInfo.id;
        response.studio = studioInfo;
      }

      res.json(response);

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;

      const user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [userId]);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get additional data for studio owners
      let machinesCount = null;
      if (user.role === 'studio_owner') {
        const studio = await db.get('SELECT machine_count FROM studios WHERE owner_id = ?', [userId]);
        machinesCount = studio ? studio.machine_count : 1;
      }

      const responseData = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          country: user.country,
          postalCode: user.postal_code,
          city: user.city,
          street: user.street,
          houseNumber: user.house_number,
          doorApartment: user.door_apartment,
          address: user.address, // Keep for backward compatibility
          createdAt: user.created_at
        }
      };

      // Add machine count for studio owners
      if (user.role === 'studio_owner') {
        responseData.user.machinesCount = machinesCount;
      }

      res.json(responseData);

    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    console.log('🔥 UPDATE PROFILE METHOD CALLED!!! 🔥');
    try {
      console.log('=== UPDATE PROFILE REQUEST ===');
      console.log('User ID:', req.user.userId);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { firstName, lastName, phone, country, postalCode, city, street, houseNumber, doorApartment, machinesCount } = req.body;
      
      console.log('Extracted fields:');
      console.log('- firstName:', firstName);
      console.log('- lastName:', lastName);
      console.log('- phone:', phone);
      console.log('- country:', country);
      console.log('- postalCode:', postalCode);
      console.log('- city:', city);
      console.log('- street:', street);
      console.log('- houseNumber:', houseNumber);
      console.log('- doorApartment:', doorApartment);

      // Update user table with personal info
      const updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?, country = ?, postal_code = ?, city = ?, street = ?, house_number = ?, door_apartment = ?, updated_at = NOW() WHERE id = ?';
      const updateParams = [firstName, lastName, phone, country, postalCode, city, street, houseNumber, doorApartment, userId];
      
      console.log('Executing SQL query:', updateQuery);
      console.log('With parameters:', updateParams);
      
      await new Promise((resolve, reject) => {
        db.run(
          updateQuery,
          updateParams,
          (err) => {
            if (err) {
              console.log('SQL UPDATE ERROR:', err);
              reject(err);
            } else {
              console.log('SQL UPDATE SUCCESS');
              resolve();
            }
          }
        );
      });

      // If studio owner and machinesCount provided, update studio
      if (req.user.role === 'studio_owner' && machinesCount !== undefined) {
        await db.run(
          'UPDATE studios SET machine_count = ? WHERE owner_id = ?',
          [machinesCount, userId]
        );
      }

      res.json({ message: 'Profile updated successfully' });

    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Change user password
  async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      // Get user from database
      const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
          [hashedPassword, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({ message: 'Password changed successfully' });

    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Request email change with password verification
  async requestEmailChange(req, res) {
    try {
      const userId = req.user.userId;
      const { newEmail, password } = req.body;

      if (!newEmail || !password) {
        return res.status(400).json({ message: 'Neue E-Mail und Passwort sind erforderlich' });
      }

      // Get user from database
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Ungültiges Passwort' });
      }

      // Check if new email is already in use
      const existingUser = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Diese E-Mail-Adresse wird bereits verwendet' });
      }

      // Generate email change token
      const emailChangeToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store email change request
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET email_change_token = ?, email_change_token_expires = ?, new_email_pending = ? WHERE id = ?',
          [emailChangeToken, tokenExpires.toISOString(), newEmail, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Send verification email (in a real app, you would send this via email service)
      const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email-change?token=${emailChangeToken}`;
      
      // For now, just log the verification URL (in production, send email)
      console.log(`Email change verification URL for ${newEmail}: ${verificationUrl}`);

      res.json({ 
        message: 'Bestätigungs-E-Mail wurde gesendet',
        // In development, also return the token for testing
        ...(process.env.NODE_ENV === 'development' && { verificationUrl })
      });

    } catch (error) {
      console.error('Email change request error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Logout (client-side token removal, server-side could implement token blacklisting)
  async logout(req, res) {
    res.json({ message: 'Logged out successfully' });
  }

  // Validate registration code for customer
  async validateRegistrationCode(req, res) {
    try {
      const { code } = req.query;

      if (!code) {
        return res.status(400).json({ message: 'Registration code is required' });
      }

      // Look up customer by registration code
      const customer = await db.get(
        `SELECT c.*, s.name as studio_name,
         (SELECT remaining_sessions 
          FROM customer_sessions cs 
          WHERE cs.customer_id = c.id AND cs.status = 'active'
          LIMIT 1) as remaining_sessions
         FROM customers c
         JOIN studios s ON c.studio_id = s.id
         WHERE c.registration_code = ?`,
        [code]
      );

      if (!customer) {
        return res.status(404).json({ 
          valid: false,
          message: 'Invalid registration code' 
        });
      }

      // Check if customer already has app access
      if (customer.has_app_access) {
        return res.status(400).json({ 
          valid: false,
          message: 'This customer is already registered',
          already_registered: true
        });
      }

      // Customer found and can register
      res.json({
        valid: true,
        customer_name: `${customer.contact_first_name} ${customer.contact_last_name}`,
        studio_name: customer.studio_name,
        total_sessions_purchased: customer.total_sessions_purchased,
        remaining_sessions: customer.remaining_sessions || 0,
        can_register: true
      });

    } catch (error) {
      console.error('Code validation error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Register customer using registration code
  async registerCustomer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { registrationCode, email, password } = req.body;

      // Look up customer by registration code
      const customer = await db.get(
        `SELECT c.*, s.name as studio_name,
         (SELECT remaining_sessions 
          FROM customer_sessions cs 
          WHERE cs.customer_id = c.id AND cs.status = 'active'
          LIMIT 1) as remaining_sessions
         FROM customers c
         JOIN studios s ON c.studio_id = s.id
         WHERE c.registration_code = ?`,
        [registrationCode]
      );

      if (!customer) {
        return res.status(404).json({ message: 'Invalid registration code' });
      }

      // Check if customer already has app access
      if (customer.has_app_access) {
        return res.status(400).json({ message: 'This customer is already registered' });
      }

      // Check if email is already in use
      const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user account
      const userId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (email, password_hash, role, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
          [email, hashedPassword, 'customer', customer.contact_first_name, customer.contact_last_name, customer.contact_phone],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Update customer to link with user and mark as having app access
      await db.run(
        'UPDATE customers SET user_id = ?, has_app_access = 1 WHERE id = ?',
        [userId, customer.id]
      );

      // Generate JWT token
      const token = jwt.sign(
        { userId, email, role: 'customer' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Create welcome notification for new customer
      try {
        await Notification.createWelcomeNotification(
          customer.studio_id,
          'customer',
          customer.contact_first_name,
          customer.studio_name
        );
      } catch (notificationError) {
        console.error('Error creating welcome notification:', notificationError);
        // Don't fail registration if notification creation fails
      }

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: userId,
          email,
          role: 'customer',
          firstName: customer.contact_first_name,
          lastName: customer.contact_last_name,
          phone: customer.contact_phone
        },
        customer: {
          id: customer.id,
          studio_id: customer.studio_id,
          studio_name: customer.studio_name,
          registration_code: registrationCode,
          total_sessions_purchased: customer.total_sessions_purchased,
          remaining_sessions: customer.remaining_sessions || 0
        },
        token
      });

    } catch (error) {
      console.error('Customer registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  // Register studio with email verification
  async registerStudio(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        email, 
        password, 
        firstName, 
        lastName, 
        phone,
        country,
        postalCode,
        city,
        street,
        houseNumber,
        doorApartment,
        termsAccepted,
        privacyAccepted,
        promocode
      } = req.body;

      // Check if email already exists
      const existingUser = await db.get(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (existingUser) {
        // Check if user exists but is not verified
        if (!existingUser.email_verified) {
          return res.status(400).json({ 
            message: 'Email already registered but not verified. Please check your email (including spam folder) for the verification link.',
            code: 'EMAIL_NOT_VERIFIED',
            canResendVerification: true
          });
        }
        return res.status(400).json({ message: 'Email already registered and verified' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Validate legal compliance
      if (!termsAccepted || !privacyAccepted) {
        return res.status(400).json({ 
          message: 'You must accept the terms and conditions and privacy policy' 
        });
      }

      // Check if email service is properly configured
      if (!emailService.initialized) {
        await emailService.initialize();
        if (!emailService.initialized) {
          return res.status(500).json({ 
            message: 'Email service is not configured. Please contact support.',
            code: 'EMAIL_SERVICE_UNAVAILABLE'
          });
        }
      }

      // Generate verification token
      const verificationToken = emailService.generateVerificationToken();
      const tokenExpiry = emailService.getTokenExpiry();

      // Start transaction
      const connection = await db.beginTransaction();

      try {
        // Create user with email_verified = false
        const userId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO users (
              email, 
              password_hash, 
              role, 
              first_name, 
              last_name, 
              phone,
              country,
              postal_code,
              city,
              street,
              house_number,
              door_apartment,
              terms_accepted,
              terms_accepted_at,
              privacy_accepted,
              privacy_accepted_at,
              email_verified,
              email_verification_token,
              email_verification_expires,
              verification_attempts
            ) VALUES (?, ?, 'studio_owner', ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), TRUE, NOW(), FALSE, ?, ?, 1)`,
            [email, hashedPassword, firstName, lastName, phone, country, postalCode, city, street, houseNumber, doorApartment, verificationToken, tokenExpiry],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });

        // Send verification email
        const emailResult = await emailService.sendStudioVerificationEmail(
          email,
          verificationToken,
          `AIL ${city}`, // Temporary studio name for email
          `${firstName} ${lastName}`
        );

        if (!emailResult.success) {
          // Email failed - rollback transaction
          await db.rollback(connection);
          console.error('Failed to send verification email during registration:', emailResult.message);
          return res.status(500).json({ 
            message: 'Failed to send verification email. Please try again.',
            code: 'EMAIL_SEND_FAILED'
          });
        }

        await db.commit(connection);

        res.status(201).json({
          message: 'Registration successful. Please check your email to verify your account.',
          requiresVerification: true,
          emailSent: true
        });

      } catch (error) {
        await db.rollback(connection);
        throw error;
      }

    } catch (error) {
      console.error('Studio registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Verify email token
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ message: 'Verification token is required' });
      }

      // Find user by token
      const user = await db.get(
        `SELECT * FROM users 
         WHERE email_verification_token = ? 
         AND email_verification_expires > NOW()`,
        [token]
      );

      if (!user) {
        // Redirect to frontend with error message
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/?verification=error&message=Invalid or expired verification token`);
      }

      // Update user as verified
      await db.run(
        `UPDATE users 
         SET email_verified = TRUE,
             email_verification_token = NULL,
             email_verification_expires = NULL
         WHERE id = ?`,
        [user.id]
      );

      // If studio owner, create and activate their studio
      if (user.role === 'studio_owner') {
        // Check if studio already exists
        let studio = await db.get(
          'SELECT * FROM studios WHERE owner_id = ?',
          [user.id]
        );

        if (!studio) {
          // Create studio with auto-generated name based on city
          const finalStudioName = `AIL ${user.city || 'Studio'}`;
          
          // Generate enhanced unique identifier: {CITY_3_LETTERS}-{SEQUENCE}{RANDOM_LETTER}
          const cityName = user.city || 'STU';
          const cityPrefix = cityName.toUpperCase().substring(0, 3).padEnd(3, 'X');
          
          // Get sequence number for this city prefix
          const existingStudios = await db.all(
            'SELECT unique_identifier FROM studios WHERE unique_identifier LIKE ?',
            [`${cityPrefix}-%`]
          );
          const sequenceNumber = existingStudios.length + 1;
          
          // Generate random letter (exclude confusing characters: I, O, 0, 1)
          const randomLetters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
          const randomLetter = randomLetters[Math.floor(Math.random() * randomLetters.length)];
          
          const uniqueIdentifier = `${cityPrefix}-${sequenceNumber}${randomLetter}`;
          
          // Create the studio
          const studioId = await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO studios (
                owner_id,
                name,
                address,
                city,
                unique_identifier,
                is_active
              ) VALUES (?, ?, ?, ?, ?, TRUE)`,
              [user.id, finalStudioName, user.address, user.city, uniqueIdentifier],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });
          
          // Get the newly created studio
          studio = await db.get(
            'SELECT * FROM studios WHERE id = ?',
            [studioId]
          );
        } else {
          // Activate existing studio
          await db.run(
            'UPDATE studios SET is_active = TRUE WHERE owner_id = ?',
            [user.id]
          );
        }

        // Create trial subscription for studio owner
        try {
          const subscription = await SubscriptionService.createTrial(user.id, 30);
          console.log(`Trial subscription created for user ${user.id}:`, subscription);
        } catch (subscriptionError) {
          console.error('Failed to create trial subscription:', subscriptionError);
          // Don't fail the entire verification process, but log the error
        }

        // Send welcome email
        await emailService.sendWelcomeEmail(
          user.email,
          `${user.first_name} ${user.last_name}`,
          true
        );

        // Create welcome notification for studio owner
        try {
          await Notification.createWelcomeNotification(
            studio.id,
            'studio_owner',
            `${user.first_name} ${user.last_name}`,
            studio.name
          );
        } catch (notificationError) {
          console.error('Error creating welcome notification for studio owner:', notificationError);
          // Don't fail verification if notification creation fails
        }

        // Generate JWT token for auto-login
        const authToken = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        // Redirect to frontend with success message and auto-login token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/?verification=success&token=${authToken}&message=Email verified successfully. Your studio is now active!`);
      } else {
        // For customers
        await emailService.sendWelcomeEmail(
          user.email,
          `${user.first_name} ${user.last_name}`,
          false
        );

        // Generate JWT token for auto-login
        const authToken = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        // Redirect to frontend with success message and auto-login token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/?verification=success&token=${authToken}&message=Email verified successfully`);
      }

    } catch (error) {
      console.error('Email verification error:', error);
      // Redirect to frontend with error message
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/?verification=error&message=An error occurred during verification. Please try again.`);
    }
  }

  // Resend verification email for unverified users
  async resendVerificationEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Find user by email
      const user = await db.get(
        'SELECT * FROM users WHERE email = ? AND email_verified = FALSE',
        [email]
      );

      if (!user) {
        return res.status(400).json({ 
          message: 'User not found or already verified',
          code: 'USER_NOT_FOUND_OR_VERIFIED'
        });
      }

      // Check verification attempts (max 5 per day)
      if (user.verification_attempts >= 5) {
        return res.status(429).json({ 
          message: 'Too many verification attempts. Please try again later.',
          code: 'TOO_MANY_ATTEMPTS'
        });
      }

      // Check if email service is properly configured
      if (!emailService.initialized) {
        await emailService.initialize();
        if (!emailService.initialized) {
          return res.status(500).json({ 
            message: 'Email service is not configured. Please contact support.',
            code: 'EMAIL_SERVICE_UNAVAILABLE'
          });
        }
      }

      // Generate new verification token
      const verificationToken = emailService.generateVerificationToken();
      const tokenExpiry = emailService.getTokenExpiry();

      // Update user with new token and increment attempts
      await db.run(
        `UPDATE users 
         SET email_verification_token = ?, 
             email_verification_expires = ?, 
             verification_attempts = verification_attempts + 1
         WHERE id = ?`,
        [verificationToken, tokenExpiry, user.id]
      );

      // Send verification email based on user role
      let emailResult;
      if (user.role === 'studio_owner') {
        emailResult = await emailService.sendStudioVerificationEmail(
          email,
          verificationToken,
          `AIL ${user.city}`,
          `${user.first_name} ${user.last_name}`
        );
      } else {
        emailResult = await emailService.sendCustomerVerificationEmail(
          email,
          verificationToken,
          `${user.first_name} ${user.last_name}`
        );
      }

      if (!emailResult.success) {
        return res.status(500).json({ 
          message: 'Failed to send verification email. Please try again.',
          code: 'EMAIL_SEND_FAILED'
        });
      }

      res.json({
        message: 'Verification email sent successfully. Please check your email (including spam folder).',
        attemptsRemaining: 5 - (user.verification_attempts + 1)
      });

    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Enhanced customer registration with optional email verification
  async registerCustomerEnhanced(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { registrationCode, email, password, sendVerificationEmail } = req.body;

      // Look up customer by registration code
      const customer = await db.get(
        'SELECT * FROM customers WHERE registration_code = ?',
        [registrationCode]
      );

      if (!customer) {
        return res.status(400).json({ 
          message: 'Invalid registration code' 
        });
      }

      if (customer.has_app_access) {
        return res.status(400).json({ 
          message: 'Customer already registered' 
        });
      }

      // Check if email already exists
      const existingUser = await db.get(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (existingUser) {
        return res.status(400).json({ 
          message: 'Email already registered' 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Prepare verification token if requested
      let verificationToken = null;
      let tokenExpiry = null;
      
      if (sendVerificationEmail) {
        verificationToken = emailService.generateVerificationToken();
        tokenExpiry = emailService.getTokenExpiry();
      }

      // Create user account
      const userId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO users (
            email, 
            password_hash, 
            role, 
            first_name, 
            last_name, 
            phone,
            email_verified,
            email_verification_token,
            email_verification_expires
          ) VALUES (?, ?, 'customer', ?, ?, ?, ?, ?, ?)`,
          [
            email, 
            hashedPassword, 
            customer.contact_first_name, 
            customer.contact_last_name, 
            customer.contact_phone,
            !sendVerificationEmail, // If not sending email, mark as verified
            verificationToken,
            tokenExpiry
          ],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Update customer record
      await db.run(
        'UPDATE customers SET user_id = ?, has_app_access = TRUE WHERE id = ?',
        [userId, customer.id]
      );

      // Send verification email if requested
      if (sendVerificationEmail) {
        const emailResult = await emailService.sendCustomerVerificationEmail(
          email,
          verificationToken,
          `${customer.contact_first_name} ${customer.contact_last_name}`
        );

        if (!emailResult.success) {
          console.error('Failed to send verification email, but registration completed');
        }
      }

      // Generate JWT token
      const authToken = jwt.sign(
        { userId, email, role: 'customer' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Get customer details
      const customerDetails = await db.get(
        `SELECT c.*, s.name as studio_name,
         (SELECT remaining_sessions 
          FROM customer_sessions cs 
          WHERE cs.customer_id = c.id AND cs.status = 'active'
          LIMIT 1) as remaining_sessions
         FROM customers c
         JOIN studios s ON c.studio_id = s.id
         WHERE c.id = ?`,
        [customer.id]
      );

      res.status(201).json({
        message: sendVerificationEmail 
          ? 'Registration successful! A verification email has been sent (optional).'
          : 'Registration successful!',
        token: authToken,
        user: {
          id: userId,
          email,
          role: 'customer',
          firstName: customer.contact_first_name,
          lastName: customer.contact_last_name,
          emailVerified: !sendVerificationEmail
        },
        customer: {
          id: customer.id,
          studio_id: customer.studio_id,
          studio_name: customerDetails.studio_name,
          registration_code: customer.registration_code,
          total_sessions_purchased: customer.total_sessions_purchased,
          remaining_sessions: customerDetails.remaining_sessions || 0
        }
      });

    } catch (error) {
      console.error('Customer registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Redeem promocode for trial extension
  async redeemPromocode(req, res) {
    try {
      const { promocode } = req.body;
      const userId = req.user.userId;

      if (!promocode) {
        return res.status(400).json({ 
          message: 'Promocode is required',
          success: false 
        });
      }

      // Only allow studio owners to redeem promocodes
      if (req.user.role !== 'studio_owner') {
        return res.status(403).json({
          message: 'Only studio owners can redeem promocodes',
          success: false
        });
      }

      const result = await SubscriptionService.redeemPromoCode(promocode, userId);

      if (!result.success) {
        return res.status(400).json({
          message: result.error,
          success: false,
          code: result.code
        });
      }

      res.json({
        message: result.message,
        success: true,
        months_added: result.months_added,
        previous_trial_end: result.previous_trial_end,
        new_trial_end: result.new_trial_end
      });

    } catch (error) {
      console.error('Promocode redemption error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        success: false 
      });
    }
  }

  // Validate promocode (for frontend validation)
  async validatePromocode(req, res) {
    try {
      const { code } = req.query;

      if (!code) {
        return res.status(400).json({ 
          valid: false,
          message: 'Promocode is required' 
        });
      }

      const validation = await PromoCode.validateForRedemption(code);

      if (!validation.valid) {
        return res.json({
          valid: false,
          message: validation.reason,
          code: validation.code
        });
      }

      res.json({
        valid: true,
        message: 'Promocode is valid',
        extension_months: validation.extension_months,
        promocode: {
          code: validation.promocode.code,
          extension_months: validation.promocode.extension_months,
          description: validation.promocode.description
        }
      });

    } catch (error) {
      console.error('Promocode validation error:', error);
      res.status(500).json({ 
        valid: false,
        message: 'Error validating promocode' 
      });
    }
  }
}

module.exports = new AuthController();