const express = require('express');
const path = require('path');

function createSystemRouter(rootDir) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  router.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  router.get('*', (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  return router;
}

module.exports = {
  createSystemRouter
};
