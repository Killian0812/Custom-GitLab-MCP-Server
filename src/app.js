const express = require('express');
const webhookRoutes = require('./routes/webhook.route');
const logger = require('./utils/logger');
const config = require('../config/config');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api', webhookRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;