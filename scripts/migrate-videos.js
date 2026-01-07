// scripts/migrate-videos.js
// Run this script to create the videos table
// Usage: node scripts/migrate-videos.js

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    console.log('Running videos table migration...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        blob_url TEXT NOT NULL,
        blob_key TEXT NOT NULL,
        file_size BIGINT,
        duration INTEGER,
        thumbnail_url TEXT,
        post_slug VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✓ Videos table created');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_post_slug ON videos(post_slug);
    `);
    
    console.log('✓ Post slug index created');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
    `);
    
    console.log('✓ Created_at index created');
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
