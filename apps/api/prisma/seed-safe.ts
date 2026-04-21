import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting safe database seed...');
  console.log('ℹ️  This script will only create data that doesn\'t exist yet');

  // Check if users already exist
  const existingUsers = await prisma.user.count();
  console.log(`Found ${existingUsers} existing users`);

  if (existingUsers === 0) {
    console.log('Creating default users...');

    // Create admin user (password: admin123)
    const adminPassword = await hashPassword('admin123');
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@example.com',
        password: adminPassword,
        fullName: 'System Administrator',
        role: 'admin',
        status: 'active',
        avatar: null,
        phone: '+1 (555) 100-0001',
        timezone: 'America/New_York',
        language: 'en',
        lastLogin: new Date(),
        profile: {
          create: {
            bio: 'System administrator with full access',
          },
        },
      },
    });

    // Create moderator user (password: operator123)
    const operatorPassword = await hashPassword('operator123');
    const operator = await prisma.user.create({
      data: {
        username: 'operator',
        email: 'operator@example.com',
        password: operatorPassword,
        fullName: 'System Operator',
        role: 'moderator',
        status: 'active',
        avatar: null,
        phone: '+1 (555) 100-0002',
        timezone: 'America/Chicago',
        language: 'en',
        lastLogin: new Date(Date.now() - 86400000), // 1 day ago
        profile: {
          create: {
            bio: 'System operator',
          },
        },
      },
    });

    // Create viewer user (password: viewer123)
    const viewerPassword = await hashPassword('viewer123');
    const viewer = await prisma.user.create({
      data: {
        username: 'viewer',
        email: 'viewer@example.com',
        password: viewerPassword,
        fullName: 'Read Only User',
        role: 'viewer',
        status: 'active',
        avatar: null,
        phone: '+1 (555) 100-0003',
        timezone: 'America/Los_Angeles',
        language: 'en',
        lastLogin: new Date(Date.now() - 172800000), // 2 days ago
        profile: {
          create: {
            bio: 'Read-only access user',
          },
        },
      },
    });

    console.log('✅ Default users created successfully!');
    
    // Create sample activity logs for new admin user
    console.log('Creating initial activity logs...');
    await prisma.activityLog.createMany({
      data: [
        {
          userId: admin.id,
          action: 'User logged in',
          type: 'login',
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          success: true,
        },
        {
          userId: admin.id,
          action: 'System initialized',
          type: 'system',
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date(),
          details: 'Initial system setup completed',
          success: true,
        },
      ],
    });
  } else {
    console.log('ℹ️  Users already exist, skipping user creation');
  }

  // Check and create ModSecurity CRS rules if they don't exist
  const existingCRSRules = await prisma.modSecCRSRule.count();
  console.log(`Found ${existingCRSRules} existing CRS rules`);

  if (existingCRSRules === 0) {
    console.log('Creating ModSecurity CRS rules...');

    // Create OWASP CRS rule configurations (metadata only)
    await prisma.modSecCRSRule.createMany({
      data: [
        {
          ruleFile: 'REQUEST-942-APPLICATION-ATTACK-SQLI.conf',
          name: 'SQL Injection Protection',
          category: 'SQLi',
          description: 'Detects SQL injection attempts using OWASP CRS detection rules',
          enabled: true,
          paranoia: 1
        },
        {
          ruleFile: 'REQUEST-941-APPLICATION-ATTACK-XSS.conf',
          name: 'XSS Attack Prevention',
          category: 'XSS',
          description: 'Blocks cross-site scripting attacks',
          enabled: true,
          paranoia: 1
        },
        {
          ruleFile: 'REQUEST-932-APPLICATION-ATTACK-RCE.conf',
          name: 'RCE Detection',
          category: 'RCE',
          description: 'Remote code execution prevention',
          enabled: true,
          paranoia: 1
        },
        {
          ruleFile: 'REQUEST-930-APPLICATION-ATTACK-LFI.conf',
          name: 'LFI Protection',
          category: 'LFI',
          description: 'Local file inclusion prevention',
          enabled: false,
          paranoia: 1
        },
        {
          ruleFile: 'REQUEST-943-APPLICATION-ATTACK-SESSION-FIXATION.conf',
          name: 'Session Fixation',
          category: 'SESSION-FIXATION',
          description: 'Prevents session fixation attacks',
          enabled: true,
          paranoia: 1
        },
        {
          ruleFile: 'REQUEST-933-APPLICATION-ATTACK-PHP.conf',
          name: 'PHP Attacks',
          category: 'PHP',
          description: 'PHP-specific attack prevention',
          enabled: true,
          paranoia: 1
        },
        {
          ruleFile: 'REQUEST-920-PROTOCOL-ENFORCEMENT.conf',
          name: 'Protocol Attacks',
          category: 'PROTOCOL-ATTACK',
          description: 'HTTP protocol attack prevention',
          enabled: true,
          paranoia: 1
        },
        {
          ruleFile: 'RESPONSE-950-DATA-LEAKAGES.conf',
          name: 'Data Leakage',
          category: 'DATA-LEAKAGES',
          description: 'Prevents sensitive data leakage',
          enabled: false,
          paranoia: 1
        },
        {
          ruleFile: 'REQUEST-934-APPLICATION-ATTACK-GENERIC.conf',
          name: 'SSRF Protection',
          category: 'SSRF',
          description: 'Server-side request forgery prevention (part of generic attacks)',
          enabled: true,
          paranoia: 1
        },
        {
          ruleFile: 'RESPONSE-955-WEB-SHELLS.conf',
          name: 'Web Shell Detection',
          category: 'WEB-SHELL',
          description: 'Detects web shell uploads',
          enabled: true,
          paranoia: 1
        },
      ],
    });

    console.log('✅ ModSecurity CRS rules created successfully!');
  } else {
    console.log('ℹ️  CRS rules already exist, skipping CRS rule creation');
  }

  console.log('\n✅ Safe database seed completed successfully!');
  console.log('ℹ️  All existing data has been preserved');
  
  // Show current user count
  const totalUsers = await prisma.user.count();
  const totalCRSRules = await prisma.modSecCRSRule.count();
  console.log(`\n📊 Current database state:`);
  console.log(`  • Users: ${totalUsers}`);
  console.log(`  • CRS Rules: ${totalCRSRules}`);
  
  if (existingUsers === 0) {
    console.log('\n📝 Default Test Credentials (only if created):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('  Email: admin@example.com');
    console.log('  Role: admin');
    console.log('\nOperator:');
    console.log('  Username: operator');
    console.log('  Password: operator123');
    console.log('  Email: operator@example.com');
    console.log('  Role: moderator');
    console.log('\nViewer:');
    console.log('  Username: viewer');
    console.log('  Password: viewer123');
    console.log('  Email: viewer@example.com');
    console.log('  Role: viewer');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });