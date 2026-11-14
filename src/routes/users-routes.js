const router = require('express').Router();
const purchase = require('../controllers/purchase-controller');
const user = require('../controllers/user-controller');
const { authenticate, requireAdmin } = require('../middleware/authentication');
const { configureRouter, noQuery } = require('../middleware/router-validation');

configureRouter(router);
router.post('/', user.register);
router.get('/', authenticate, requireAdmin, user.list);
router.get('/:id', authenticate, noQuery, user.get);
router.patch('/:id/status', authenticate, requireAdmin, user.updateStatus);
router.get('/:userId/purchases', authenticate, purchase.listForUser);

module.exports = router;
