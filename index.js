/**
 * Serveur Stripe pour GameHub — Checkout + Webhook
 * Démarrage: npm run stripe  (ou node server/index.js)
 *
 * Variables .env requises:
 *   STRIPE_SECRET_KEY      — Clé secrète Stripe (sk_...)
 *   STRIPE_WEBHOOK_SECRET  — Secret du webhook (whsec_...)
 *   STRIPE_PORT            — Port (défaut: 4242)
 *   STRIPE_BASE_URL        — URL de base pour success/cancel (ex: https://ton-site.com)
 *
 * Pour le webhook en local: stripe listen --forward-to localhost:4242/webhook
 */
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const db = require('./db');

// ── Mailer (même config que main.js) ──
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-shadowlive.alwaysdata.net',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'shadowlive@alwaysdata.net',
    pass: process.env.SMTP_PASS || '',
  },
  tls: { rejectUnauthorized: false },
});

const PLAN_LABELS = { pro: 'Pro', ultimate: 'Ultimate' };
const PLAN_PRICES = {
  pro_monthly: '2,99€', pro_annual: '28,68€',
  ultimate_monthly: '6,99€', ultimate_annual: '67,08€',
};
const PLAN_COLORS = { pro: '#f59e0b', ultimate: '#a855f7' };

async function sendInvoiceEmail(toEmail, username, plan, interval, amount, sessionId, expiresAt) {
  const planLabel  = PLAN_LABELS[plan]  || plan;
  const planColor  = PLAN_COLORS[plan]  || '#0044cc';
  const intervalLabel = interval === 'annual' ? 'Annuel' : 'Mensuel';
  const expiryStr  = expiresAt ? new Date(expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const dateStr    = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const invoiceNum = `GH-${Date.now().toString(36).toUpperCase()}`;

  await mailer.sendMail({
    from: '"GameHub" <shadowlive@alwaysdata.net>',
    to: toEmail,
    subject: `GameHub — Confirmation d'abonnement ${planLabel}`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0e1a;border-radius:16px;overflow:hidden;border:1px solid #1e2a45;">
        <div style="background:linear-gradient(135deg,${planColor}22,${planColor}44);padding:32px;text-align:center;border-bottom:1px solid ${planColor}33;">
          <h1 style="color:white;font-size:28px;margin:0 0 6px;letter-spacing:4px;font-weight:900;">GAMEHUB</h1>
          <p style="color:${planColor};margin:0;font-size:13px;font-weight:700;letter-spacing:1px;">ABONNEMENT ${planLabel.toUpperCase()} ACTIVÉ</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#e8eaf0;font-size:16px;margin-bottom:4px;">Merci <strong>${username}</strong> !</p>
          <p style="color:#8892a8;font-size:14px;line-height:1.6;margin-bottom:24px;">Ton abonnement <strong style="color:${planColor};">GameHub ${planLabel}</strong> est maintenant actif. Voici ta confirmation de paiement.</p>

          <div style="background:#0d1220;border:1px solid #1e2a45;border-radius:12px;padding:20px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr>
                <td style="color:#8892a8;padding:7px 0;border-bottom:1px solid #1e2a4520;">N° de facture</td>
                <td style="color:#e8eaf0;text-align:right;padding:7px 0;border-bottom:1px solid #1e2a4520;font-family:monospace;">${invoiceNum}</td>
              </tr>
              <tr>
                <td style="color:#8892a8;padding:7px 0;border-bottom:1px solid #1e2a4520;">Date</td>
                <td style="color:#e8eaf0;text-align:right;padding:7px 0;border-bottom:1px solid #1e2a4520;">${dateStr}</td>
              </tr>
              <tr>
                <td style="color:#8892a8;padding:7px 0;border-bottom:1px solid #1e2a4520;">Plan</td>
                <td style="text-align:right;padding:7px 0;border-bottom:1px solid #1e2a4520;"><span style="background:${planColor}22;color:${planColor};padding:2px 10px;border-radius:100px;font-weight:700;font-size:12px;">GameHub ${planLabel}</span></td>
              </tr>
              <tr>
                <td style="color:#8892a8;padding:7px 0;border-bottom:1px solid #1e2a4520;">Facturation</td>
                <td style="color:#e8eaf0;text-align:right;padding:7px 0;border-bottom:1px solid #1e2a4520;">${intervalLabel}</td>
              </tr>
              <tr>
                <td style="color:#8892a8;padding:7px 0;border-bottom:1px solid #1e2a4520;">Expire le</td>
                <td style="color:#e8eaf0;text-align:right;padding:7px 0;border-bottom:1px solid #1e2a4520;">${expiryStr}</td>
              </tr>
              <tr>
                <td style="color:#e8eaf0;font-weight:700;padding:10px 0 0;">Total payé</td>
                <td style="color:${planColor};font-size:18px;font-weight:900;text-align:right;padding:10px 0 0;">${amount}</td>
              </tr>
            </table>
          </div>

          <div style="background:#0d1a10;border:1px solid #22c55e33;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
            <p style="color:#4ade80;font-size:13px;margin:0;font-weight:600;">✓ Avantages débloqués :</p>
            <ul style="color:#8892a8;font-size:13px;margin:8px 0 0;padding-left:18px;line-height:1.8;">
              ${plan === 'ultimate' ? `
                <li>Badge Ultimate animé</li>
                <li>Jeux exclusifs Ultimate</li>
                <li>Téléchargements prioritaires</li>
                <li>Support VIP prioritaire</li>
                <li>Profil animé & effets</li>
                <li>Accès anticipé aux nouvelles sorties</li>
              ` : `
                <li>Badge Pro exclusif</li>
                <li>Jeux exclusifs Pro</li>
                <li>Téléchargements prioritaires</li>
                <li>Profil personnalisé</li>
              `}
            </ul>
          </div>

          <p style="color:#556080;font-size:12px;line-height:1.6;">Pour toute question, contacte-nous à <a href="mailto:shadowlive@alwaysdata.net" style="color:#339dff;">shadowlive@alwaysdata.net</a>.<br>Référence Stripe : <span style="font-family:monospace;color:#8892a8;">${sessionId || '—'}</span></p>
        </div>
        <div style="background:#060a14;padding:16px;text-align:center;border-top:1px solid #1e2a45;">
          <p style="color:#556080;font-size:11px;margin:0;">© 2026 GameHub · Paiement sécurisé via Stripe</p>
        </div>
      </div>
    `,
  });
  console.log(`[STRIPE] Facture envoyée à ${toEmail}`);
}

const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

const app = express();
const PORT = process.env.STRIPE_PORT || 4242;

// Prix Stripe
const STRIPE_PRICES = {
  pro_monthly: 'price_1TAPgBIBfMUrmuqZJE3PjyQR',      // 2,99€/mois
  ultimate_monthly: 'price_1TAPgdIBfMUrmuqZP9axgQUi', // 6,99€/mois
  pro_annual: 'price_1TAPhQIBfMUrmuqZ6Da8gzce',      // 28,68€/an
  ultimate_annual: 'price_1TAPhjIBfMUrmuqZJlBll7oW', // 67,08€/an
};

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Webhook DOIT être avant express.json() pour garder le body raw
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).send('Stripe non configuré');
  }
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Mode dev sans secret : on parse le body JSON directement (non sécurisé, local uniquement)
      console.warn('[STRIPE] STRIPE_WEBHOOK_SECRET absent — mode dev (non sécurisé)');
      try {
        event = JSON.parse(req.body.toString());
      } catch {
        return res.status(400).send('Body invalide');
      }
    }
  } catch (err) {
    console.error('[STRIPE] Webhook signature invalide', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, plan, interval, durationDays, username } = session.metadata || {};
    if (!userId || !plan) {
      console.error('[STRIPE] Metadata manquante', session.id);
      return res.json({ received: true });
    }
    try {
      const days = parseInt(durationDays, 10) || 30;
      const result = await db.grantPremium(parseInt(userId, 10), plan, days, 0, 'Paiement Stripe');
      console.log('[STRIPE] Premium activé:', userId, plan, days, 'jours');

      // Envoi de la facture par email
      const customerEmail = session.customer_email || session.customer_details?.email;
      if (customerEmail) {
        const priceKey = `${plan}_${interval || 'monthly'}`;
        const amount = PLAN_PRICES[priceKey] || '—';
        const expiresAt = result?.expires_at || null;
        try {
          await sendInvoiceEmail(
            customerEmail,
            username || customerEmail,
            plan,
            interval || 'monthly',
            amount,
            session.id,
            expiresAt
          );
        } catch (mailErr) {
          console.error('[STRIPE] Erreur envoi facture:', mailErr.message);
        }
      }
    } catch (dbErr) {
      console.error('[STRIPE] Erreur DB', dbErr);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const userId = sub.metadata?.userId;
    if (userId) {
      try {
        await db.revokePremium(parseInt(userId, 10), 0);
        console.log('[STRIPE] Premium révoqué:', userId);
      } catch (e) {
        console.error('[STRIPE] Erreur revokePremium', e);
      }
    }
  }

  res.json({ received: true });
});

// JSON pour les autres routes
app.use(express.json());

// Créer une session Checkout
app.post('/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe non configuré. Ajoute STRIPE_SECRET_KEY dans .env' });
  }
  try {
    const { userId, userEmail, username, priceKey } = req.body;
    if (!userId || !userEmail || !priceKey || !STRIPE_PRICES[priceKey]) {
      return res.status(400).json({ error: 'Paramètres manquants ou invalides.' });
    }

    const priceId = STRIPE_PRICES[priceKey];
    const isAnnual = priceKey.includes('annual');
    const plan = priceKey.includes('ultimate') ? 'ultimate' : 'pro';
    const durationDays = isAnnual ? 365 : 30;
    const baseUrl = process.env.STRIPE_BASE_URL || 'https://gamehub.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/premium?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/premium?canceled=true`,
      customer_email: userEmail,
      metadata: {
        userId: String(userId),
        username: username || '',
        plan,
        interval: isAnnual ? 'annual' : 'monthly',
        durationDays: String(durationDays),
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[STRIPE] create-checkout-session', err);
    res.status(500).json({ error: err.message || 'Erreur Stripe' });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'gamehub-stripe' });
});

async function start() {
  try {
    await db.initDatabase();
  } catch (e) {
    console.error('[STRIPE] Init DB failed', e);
  }
  app.listen(PORT, () => {
    console.log(`[STRIPE] Serveur sur http://localhost:${PORT}`);
    if (!stripe) {
      console.warn('[STRIPE] STRIPE_SECRET_KEY manquante — ajoute-la dans .env pour activer les paiements');
    }
  });
}

start().catch(console.error);
