require('dotenv').config();
const db = require('../src/database/database-wrapper');

async function createDefaultAppointmentTypes(studioId) {
  try {
    await db.init();
    
    console.log(`🔍 Checking appointment types for studio ${studioId}...`);
    
    // Check if studio exists
    const studio = await db.get('SELECT * FROM studios WHERE id = ?', [studioId]);
    if (!studio) {
      console.log(`❌ Studio ${studioId} not found!`);
      process.exit(1);
    }
    
    console.log(`✅ Found studio: ${studio.name}`);
    
    // Check existing appointment types
    const existingTypes = await db.all(
      'SELECT * FROM appointment_types WHERE studio_id = ?',
      [studioId]
    );
    
    if (existingTypes.length > 0) {
      console.log(`⚠️  Studio already has ${existingTypes.length} appointment types:`);
      existingTypes.forEach(t => {
        console.log(`  - ${t.name} (${t.duration_minutes} min)`);
      });
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        readline.question('Do you want to add default types anyway? (y/n): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        process.exit(0);
      }
    }
    
    // Default appointment types for Abnehmen im Liegen studios
    const defaultTypes = [
      {
        name: 'Behandlung',
        duration_minutes: 60,
        description: 'Standard Behandlung mit dem Gerät',
        color: '#4CAF50',
        is_active: true
      },
      {
        name: 'Beratung',
        duration_minutes: 20,
        description: 'Beratungsgespräch ohne Gerätenutzung',
        color: '#2196F3',
        is_active: true
      }
    ];
    
    console.log('\n📝 Creating default appointment types...');
    
    for (const type of defaultTypes) {
      try {
        const result = await db.run(
          `INSERT INTO appointment_types (
            studio_id, name, duration_minutes, description, color, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [studioId, type.name, type.duration_minutes, type.description, type.color, type.is_active]
        );
        
        console.log(`  ✅ Created: ${type.name} (${type.duration_minutes} min)`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`  ⚠️  ${type.name} already exists, skipping...`);
        } else {
          console.error(`  ❌ Error creating ${type.name}:`, error.message);
        }
      }
    }
    
    // Verify creation
    console.log('\n📊 Final appointment types:');
    const finalTypes = await db.all(
      'SELECT * FROM appointment_types WHERE studio_id = ? ORDER BY duration_minutes DESC',
      [studioId]
    );
    
    finalTypes.forEach(t => {
      console.log(`  - ${t.name}: ${t.duration_minutes} min | Active: ${t.is_active ? 'YES' : 'NO'}`);
    });
    
    console.log('\n✅ Appointment types created successfully!');
    console.log('💡 Tip: You can customize these in the studio settings.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Get studio ID from command line or use default
const studioId = process.argv[2];

if (!studioId) {
  console.log('Usage: node create-appointment-types.js <studioId>');
  console.log('Example: node create-appointment-types.js 5');
  
  // If no studio ID provided, offer to create for all studios without types
  console.log('\n🔍 Checking all studios without appointment types...');
  
  (async () => {
    await db.init();
    const studiosWithoutTypes = await db.all(`
      SELECT s.* 
      FROM studios s
      LEFT JOIN appointment_types at ON s.id = at.studio_id
      WHERE at.id IS NULL AND s.is_active = 1
      GROUP BY s.id
    `);
    
    if (studiosWithoutTypes.length > 0) {
      console.log('\nStudios without appointment types:');
      studiosWithoutTypes.forEach(s => {
        console.log(`  - Studio ${s.id}: ${s.name} (${s.city})`);
      });
      console.log('\nRun this script with a studio ID to add default types.');
    } else {
      console.log('\n✅ All active studios have appointment types!');
    }
    process.exit(0);
  })();
} else {
  createDefaultAppointmentTypes(parseInt(studioId));
}