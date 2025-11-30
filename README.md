# The Tee Elite Circle

A private golf mastermind PWA for women who play life at the highest level.

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS
- **Backend:** Vercel Serverless Functions
- **Database:** Vercel Postgres
- **Storage:** Vercel Blob
- **Auth:** bcrypt + session tokens

## Local Development

```bash
npm install
vercel dev
```

## Environment Variables

Set these in Vercel:

```
POSTGRES_URL=your_postgres_connection_string
BLOB_READ_WRITE_TOKEN=your_blob_token
```

## Database Schema

Run these in your Vercel Postgres console:

```sql
-- Members table
CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  pin_number INTEGER UNIQUE,
  bio TEXT,
  photo_url TEXT,
  looking_for TEXT,
  offering TEXT,
  finished_scorecard TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Posts (wins feed) table
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  post_type VARCHAR(50) DEFAULT 'win',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Comments table
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Likes table
CREATE TABLE likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, member_id)
);

-- Retreats table
CREATE TABLE retreats (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  start_date DATE,
  end_date DATE,
  description TEXT,
  status VARCHAR(50) DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Resources table
CREATE TABLE resources (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables
4. Deploy

## Pages

- `/` - Public landing page
- `/member-login.html` - Member login
- `/home.html` - Member dashboard
- `/members.html` - Member directory
- `/retreats.html` - Retreat info
- `/wins.html` - Wins feed
- `/between-the-tees.html` - Discussions
- `/resources.html` - Resource vault
- `/photos.html` - Photo galleries
- `/profile.html` - Member profile

---

A TMac Inspired Experience
