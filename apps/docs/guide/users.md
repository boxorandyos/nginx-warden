# User Management Guide

This comprehensive guide covers user management in the Nginx Warden, including creating users, managing roles and permissions, configuring Two-Factor Authentication (2FA), and monitoring user activity.

## Overview

The user management system provides:
- **Role-Based Access Control**: Three-tier permission system
- **User Authentication**: Secure login with JWT tokens
- **Two-Factor Authentication**: Enhanced security with 2FA
- **Activity Logging**: Comprehensive audit trail
- **Session Management**: Control active user sessions
- **Password Policies**: Enforce strong password requirements

## User Management Interface

Access user management by clicking **Users** in the sidebar navigation:

![User Management](/reference/screenshots/User_Management.png)

The user management interface provides:
- **User List**: Overview of all system users
- **User Status**: Visual indicators for user status
- **Role Indicators**: User role badges
- **Quick Actions**: Common user management tasks

## User Roles and Permissions

The platform uses a three-tier role-based access control system:

### Administrator (Admin)

**Full System Access** - Complete control over all aspects of the system:

**Domain Management**
- Create, edit, and delete domains
- Configure upstream servers and load balancing
- Manage SSL certificates
- Configure ModSecurity rules

**User Management**
- Create, edit, and delete users
- Assign roles and permissions
- Reset user passwords
- Manage user sessions

**System Configuration**
- Configure system settings
- Manage notification channels
- Set up alert rules
- View system logs and metrics

**Security**
- Configure ACL rules
- Manage WAF settings
- Access security logs
- Configure 2FA settings

### Moderator

**Operational Access** - Manage domains and security settings:

**Domain Management**
- Create, edit not delete domain
- Configure upstream servers and load balancing
- Manage SSL certificates
- Configure ModSecurity rules

**Security**
- Configure ACL rules
- Manage WAF settings
- Access security logs

**Limited System Access**
- View system metrics and logs
- Manage notification channels
- Set up alert rules

**Restrictions**
- Cannot manage other users
- Cannot modify system settings
- Cannot access user management

### Viewer

**Read-Only Access** - View system status and reports:

**Monitoring**
- View dashboard and metrics
- Check domain status
- View performance reports
- Access log files

**Limited Configuration**
- View but not modify settings
- Export reports and logs
- Check SSL certificate status

**Restrictions**
- Cannot make any configuration changes
- Cannot access user management
- Cannot modify security settings

## Creating Users

### Add a New User

1. Click **Users** in the sidebar
2. Click the **Invite User** button
3. Fill in the user details:

**Required Information:**
- **Username**: Unique username (alphanumeric, underscores, hyphens)
- **Email**: Valid email address
- **Full Name**: Display name for the user
- **Role**: Admin, Moderator, or Viewer
- **Password**: Initial password (or auto-generate)
- **Status**: Active or Inactive

### Username Requirements

- **Length**: 3-50 characters
- **Characters**: Letters (a-z, A-Z), numbers (0-9), underscores (_), hyphens (-)
- **Unique**: Must be unique across all users
- **Case-sensitive**: Usernames are case-sensitive

### Password Requirements

- **Minimum Length**: 8 characters
- **Complexity**: Must include:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (!@#$%^&*)
- **Common Passwords**: Cannot use common passwords
- **Personal Information**: Cannot contain username or email

## User Account Management

### Editing User Information

1. Select the user from the list
2. Click the **Edit** button
3. Update the required fields
4. Click **Save** to apply changes

### Changing User Roles

1. Select the user from the list
2. Click the **Edit** button
3. Change the **Role** field
4. Click **Save** to apply changes

⚠️ **Warning**: Changing a user's role will immediately affect their permissions.

### Toggling User Status

Quickly enable or disable user accounts:

1. Select the user from the list
2. Click the **Toggle Status** button
3. Confirm the action

**Status Types:**
- **Active**: User can log in and access the system
- **Inactive**: User cannot log in (account disabled)

### Resetting User Passwords
in development

### Deleting Users

⚠️ **Warning**: Deleting a user is permanent and cannot be undone.

1. Select the user from the list
2. Click the **Delete** button
3. Confirm the deletion

## Two-Factor Authentication (2FA)

Two-Factor Authentication adds an extra layer of security by requiring a second form of verification.

### Supported 2FA Methods

#### Time-Based One-Time Password (TOTP)
- **Apps**: Google Authenticator, Authy, Microsoft Authenticator
- **Setup**: QR code or manual entry
- **Backup Codes**: Generated for recovery


### Setting Up 2FA for Users

#### User Self-Setup

1. Log in to the user account
2. Navigate to **Profile** settings
3. Click **Enable 2FA**
4. Choose 2FA method only Authenticator App
5. Follow the setup instructions:
   - Scan QR code with authenticator app
   - Enter verification code
   - Save backup codes securely


#### Disable 2FA

1. Select the user from the list
2. Click **Edit** button
3. Disable **Require 2FA**
4. Click **Save**

### Viewing Activity Logs

1. Select a user from the list
2. Click **View Activity**
3. Filter activities by:
   - **Date Range**: Custom date range
   - **Activity Type**: Login, logout, configuration changes
   - **Success Status**: Successful or failed actions
   - **IP Address**: Filter by specific IP

### Activity Types

- **Login**: User login attempts
- **Logout**: User logout actions
- **Config Change**: Configuration modifications
- **User Action**: User management actions
- **Security**: Security-related events




For more information on related topics:
- [Domain Management](/guide/domains)
- [SSL Certificate Management](/guide/ssl)
- [ModSecurity WAF Configuration](/guide/modsecurity)
- [Log Analysis](/guide/logs)