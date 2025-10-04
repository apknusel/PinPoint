CREATE EXTENSION postgis;

CREATE TABLE Users (
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL
);

CREATE TABLE Posts (
  post_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id TEXT NOT NULL,
  location GEOMETRY(Point, 4326),
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Comments (
  comment_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  comment TEXT NOT NULL,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Likes (
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE Media (
  created_at TIMESTAMPTZ DEFAULT NOW(),
  media_id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  post_id TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE
);

CREATE TABLE Followers (
  created_at TIMESTAMPTZ DEFAULT NOW(),
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  CHECK (follower_id != followee_id),
  FOREIGN KEY (follower_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (followee_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id,followee_id)
);
