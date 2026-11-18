// Usage: npm run create-user -- "Name" email@company.com password [role]
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

const [name, email, password, role = 'staff'] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error('Usage: npm run create-user -- "Name" email@company.com password [role]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, email.toLowerCase(), hash, role]
  );
  console.log(`User created (id ${rows[0].id}): ${email}`);
} catch (err) {
  console.error(err.code === '23505' ? 'A user with this email already exists.' : err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
