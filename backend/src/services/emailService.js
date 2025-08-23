const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  // Initialize email transporter
  async initialize() {
    try {
      // Check if email credentials are configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.log('� Email service not configured. Email features disabled.');
        this.initialized = false;
        return;
      }

      // Create transporter with Gmail
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      console.log(' Email service initialized successfully');
    } catch (error) {
      console.error('L Email service initialization failed:', error.message);
      this.initialized = false;
    }
  }

  // Generate verification token
  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Calculate token expiry (24 hours from now)
  getTokenExpiry() {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry;
  }

  // Send studio verification email
  async sendStudioVerificationEmail(email, token, studioName, ownerName) {
    if (!this.initialized) {
      console.log('Email service not initialized. Skipping email send.');
      return { success: false, message: 'Email service not configured' };
    }

    const verificationUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/v1/auth/verify-email/${token}`;
    
    const mailOptions = {
      from: `"Abnehmen im Liegen Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Studio-Registrierung bestätigen - Abnehmen im Liegen',
      replyTo: process.env.EMAIL_USER,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Abnehmen im Liegen!</h1>
            </div>
            <div class="content">
              <h2>Hallo ${ownerName},</h2>
              <p>vielen Dank für die Registrierung Ihres Studios <strong>${studioName}</strong>.</p>
              <p>Um Ihre Registrierung abzuschließen und Ihr Studio-Konto zu aktivieren, bestätigen Sie bitte Ihre E-Mail-Adresse:</p>
              <center>
                <a href="${verificationUrl}" class="button">E-Mail-Adresse bestätigen</a>
              </center>
              <p style="margin-top: 20px;">Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd;">
                ${verificationUrl}
              </p>
              <p><strong>Wichtig:</strong> Dieser Bestätigungslink ist 24 Stunden gültig.</p>
              <p style="margin-top: 20px; font-size: 12px; color: #666;">
                <strong>Tipp:</strong> Falls diese E-Mail in Ihrem Spam-Ordner gelandet ist, markieren Sie sie als "Kein Spam" für zukünftige E-Mails.
              </p>
            </div>
            <div class="footer">
              <p>If you didn't register a studio with us, please ignore this email.</p>
              <p>&copy; 2025 Abnehmen im Liegen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send customer verification email (optional)
  async sendCustomerVerificationEmail(email, token, customerName) {
    if (!this.initialized) {
      console.log('Email service not initialized. Skipping email send.');
      return { success: false, message: 'Email service not configured' };
    }

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"Abnehmen im Liegen" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Abnehmen im Liegen',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Abnehmen im Liegen!</h1>
            </div>
            <div class="content">
              <h2>Hello ${customerName},</h2>
              <p>Thank you for registering with Abnehmen im Liegen.</p>
              <p>To enhance the security of your account, please verify your email address by clicking the button below:</p>
              <center>
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </center>
              <p style="margin-top: 20px;">Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd;">
                ${verificationUrl}
              </p>
              <p><strong>Note:</strong> You can already use your account. Email verification is optional but recommended for security.</p>
              <p>This verification link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>If you didn't create an account with us, please ignore this email.</p>
              <p>&copy; 2025 Abnehmen im Liegen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Customer verification email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send customer verification email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send welcome email after successful verification
  async sendWelcomeEmail(email, name, isStudioOwner = false) {
    if (!this.initialized) {
      return { success: false, message: 'Email service not configured' };
    }

    const subject = isStudioOwner 
      ? 'Welcome to Abnehmen im Liegen - Studio Account Activated!'
      : 'Welcome to Abnehmen im Liegen!';

    const mailOptions = {
      from: `"Abnehmen im Liegen" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
            .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verified Successfully!</h1>
            </div>
            <div class="content">
              <h2>Welcome ${name}!</h2>
              <p>Your email has been successfully verified.</p>
              ${isStudioOwner ? `
                <p>Your studio account is now fully activated. You can:</p>
                <ul>
                  <li>Manage your studio settings</li>
                  <li>Add and manage customers</li>
                  <li>Schedule appointments</li>
                  <li>Track sessions and treatments</li>
                  <li>Use the Lead Management system</li>
                </ul>
              ` : `
                <p>Your account is now fully verified. Enjoy using the Abnehmen im Liegen app!</p>
              `}
              <p>If you have any questions, please don't hesitate to contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Abnehmen im Liegen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  // Test email configuration
  async testEmailConfiguration() {
    if (!this.initialized) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;