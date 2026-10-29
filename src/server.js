require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { initDatabase } = require('./models');
const { logger, enableDatabaseLogging } = require('./utils/logger');
const configRoutes = require('./routes/configRoutes');
const levelRoutes = require('./routes/levelRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust reverse proxies (Cloudflare, Nginx, Traefik, etc.) when present
app.set('trust proxy', true);

// Security middleware via Helmet (allowing inline styles/canvas rendering from self + Cloudflare Turnstile when active)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
        frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'https://challenges.cloudflare.com']
      }
    }
  })
);

app.use(express.json({ limit: '500kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/config', configRoutes);
app.use('/api/levels', levelRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    await initDatabase();
    enableDatabaseLogging();
    logger.info('Database initialized and Sequelize models synced successfully.');

    app.listen(PORT, () => {
      logger.info(`Retro 2D Game Engine server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Fatal] Failed to initialize database or start server:', err);
    process.exit(1);
  }
}

startServer();
