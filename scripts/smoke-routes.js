/* eslint-disable no-console */
const { createAuthMiddleware } = require('../server/middleware/auth');
const { createEmailRouter } = require('../server/routes/email');
const { createDataRouter } = require('../server/routes/data');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findRouteLayer(router, path, method) {
  return router.stack.find(layer =>
    layer.route &&
    layer.route.path === path &&
    layer.route.methods &&
    layer.route.methods[method]
  );
}

function run() {
  const { authenticateToken } = createAuthMiddleware('smoke-test-secret');

  const emailRouter = createEmailRouter({ authenticateToken });
  const emailPost = findRouteLayer(emailRouter, '/', 'post');
  assert(emailPost, 'Email route POST / не найден');
  assert(emailPost.route.stack[0].name === 'authenticateToken', 'POST /api/send-email должен быть защищен authenticateToken');

  const dataRouter = createDataRouter({
    dataStorage: {
      async loadData() { return { data: [] }; },
      async saveData() { return true; },
      async getAllData() { return {}; }
    },
    authenticateToken,
    UploadHistory: { async create() { return { id: 1 }; } },
    UploadData: { async create() { return { id: 1 }; } }
  });
  const dataGetAll = findRouteLayer(dataRouter, '/', 'get');
  assert(dataGetAll, 'Data route GET / не найден');
  assert(dataGetAll.route.stack[0].name === 'authenticateToken', 'GET /api/data должен быть защищен authenticateToken');

  // Важно: require server.js не должен автоматически стартовать сервер.
  const serverModule = require('../server');
  assert(serverModule && typeof serverModule.startServer === 'function', 'server.js должен экспортировать startServer');

  console.log('✅ Smoke routes check passed');
}

try {
  run();
} catch (error) {
  console.error('❌ Smoke routes check failed:', error.message);
  process.exit(1);
}
