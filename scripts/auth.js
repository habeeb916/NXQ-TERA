const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('../database/db');
require('dotenv').config();

class AuthService {
  constructor() {
    this.db = new Database();
    this.jwtSecret = process.env.JWT_SECRET || 'nxq-super-secret-key-change-in-production';
    this.tokenExpiry = process.env.TOKEN_EXPIRY || '24h';
    this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    this.lockoutDuration = parseInt(process.env.LOCKOUT_DURATION) || 15;
    
    // Debug environment variables
    console.log('Auth Service Configuration:');
    console.log('- JWT Secret:', this.jwtSecret ? 'Loaded' : 'Using default');
    console.log('- Token Expiry:', this.tokenExpiry);
    console.log('- Max Login Attempts:', this.maxLoginAttempts);
    console.log('- Lockout Duration:', this.lockoutDuration, 'minutes');
  }

  // Initialize authentication service
  async init() {
    await this.db.init();
  }

  // Generate JWT token
  generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.tokenExpiry,
      issuer: 'nxq-app',
      audience: 'nxq-users'
    });
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'nxq-app',
        audience: 'nxq-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Authenticate user login
  async login(username, password) {
    try {
      // Strict input validation
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        throw new Error('Username is required and must be a non-empty string');
      }

      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        throw new Error('Password is required and must be a non-empty string');
      }

      // Sanitize inputs
      const sanitizedUsername = username.trim();
      const sanitizedPassword = password.trim();

      // Length validation
      if (sanitizedUsername.length < 3 || sanitizedUsername.length > 50) {
        throw new Error('Username must be between 3 and 50 characters');
      }

      if (sanitizedPassword.length < 6 || sanitizedPassword.length > 128) {
        throw new Error('Password must be between 6 and 128 characters');
      }

      // Character validation (alphanumeric and common symbols only)
      if (!/^[a-zA-Z0-9_@.-]+$/.test(sanitizedUsername)) {
        throw new Error('Username contains invalid characters');
      }

      // Rate limiting check (simple implementation)
      const loginAttempts = this.getLoginAttempts(sanitizedUsername);
      if (loginAttempts >= this.maxLoginAttempts) {
        throw new Error(`Too many failed login attempts. Please try again in ${this.lockoutDuration} minutes.`);
      }

      // Authenticate with database
      const result = await this.db.authenticateUser(sanitizedUsername, sanitizedPassword);
      console.log('salies xyx test found:', result);
      
      if (result.success) {
        // Clear failed attempts on successful login
        this.clearLoginAttempts(sanitizedUsername);
        
        // Generate token
        const token = this.generateToken(result.user);
        
        return {
          success: true,
          token,
          user: result.user,
          message: 'Login successful'
        };
      } else {
        // Record failed attempt
        this.recordFailedAttempt(username);
        throw new Error(result.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error.message);
      throw error;
    }
  }

  // Validate user session
  async validateSession(token) {
    try {
      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = this.verifyToken(token);
      const user = await this.db.getUserById(decoded.id);
      
      if (!user) {
        throw new Error('User not found');
      }

      return {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Logout user (invalidate token on client side)
  async logout(token) {
    try {
      // In a production app, you might want to maintain a blacklist of tokens
      // For now, we'll just return success as token invalidation is handled client-side
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      throw new Error('Logout failed');
    }
  }

  // Simple rate limiting (in production, use Redis or similar)
  getLoginAttempts(username) {
    const attempts = global.loginAttempts || {};
    return attempts[username] || 0;
  }

  recordFailedAttempt(username) {
    global.loginAttempts = global.loginAttempts || {};
    global.loginAttempts[username] = (global.loginAttempts[username] || 0) + 1;
    
    // Reset attempts after configured duration
    setTimeout(() => {
      if (global.loginAttempts && global.loginAttempts[username]) {
        global.loginAttempts[username] = 0;
      }
    }, this.lockoutDuration * 60 * 1000);
  }

  clearLoginAttempts(username) {
    if (global.loginAttempts && global.loginAttempts[username]) {
      global.loginAttempts[username] = 0;
    }
  }

  // Security utilities
  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePassword(password) {
    // At least 6 characters, contains letters and numbers
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/;
    return passwordRegex.test(password);
  }

  // Close database connection
  close() {
    this.db.close();
  }
}

module.exports = AuthService;