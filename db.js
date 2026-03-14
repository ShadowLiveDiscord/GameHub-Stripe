/**
 * db-stripe.js — Module DB minimal pour le serveur Stripe (Railway)
 * Contient uniquement les fonctions nécessaires au webhook Stripe.
 */
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'mysql-shadowlive.alwaysdata.net',
  user:     process.env.DB_USER     || 'shadowlive',
  password: process.env.DB_PASS     || 'Clem2830',
  database: process.env.DB_NAME     || 'shadowlive_gamehub',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
};

let pool = null;
async function getPool() {
  if (!pool) pool = mysql.createPool(DB_CONFIG);
  return pool;
}

async function initDatabase() {
  const p = await getPool();
  // Vérifier la connexion
  await p.execute('SELECT 1');
  console.log('[DB] Connexion MySQL OK');
}

async function grantPremium(userId, plan, durationDays, grantedBy, note = '') {
  const p = await getPool();
  const validPlans = ['pro', 'ultimate'];
  if (!validPlans.includes(plan)) return { success: false, error: 'Plan invalide.' };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (durationDays || 30));

  await p.execute(
    'UPDATE users SET is_premium = 1, premium_plan = ?, premium_expires = ? WHERE id = ?',
    [plan, expiresAt, userId]
  );
  await p.execute(
    "UPDATE subscriptions SET status = 'revoked' WHERE user_id = ? AND status = 'active'",
    [userId]
  );
  await p.execute(
    'INSERT INTO subscriptions (user_id, plan, status, expires_at, granted_by, note) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, plan, 'active', expiresAt, grantedBy || null, note]
  );
  return { success: true, expires_at: expiresAt };
}

async function revokePremium(userId) {
  const p = await getPool();
  await p.execute(
    "UPDATE users SET is_premium = 0, premium_plan = 'free', premium_expires = NULL WHERE id = ?",
    [userId]
  );
  await p.execute(
    "UPDATE subscriptions SET status = 'revoked' WHERE user_id = ? AND status = 'active'",
    [userId]
  );
  return { success: true };
}

module.exports = { initDatabase, grantPremium, revokePremium };
