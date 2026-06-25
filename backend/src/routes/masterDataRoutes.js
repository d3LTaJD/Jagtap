const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const {
  getAllMasterData, getMasterData, getMasterDataBySlug,
  createMasterData, updateMasterData,
  linkField, unlinkField, deleteMasterData
} = require('../controllers/masterDataController');

const router = express.Router();
router.use(protect);

// Read — any authenticated user can fetch master data for dropdowns
router.get('/', getAllMasterData);
router.get('/slug/:slug', getMasterDataBySlug);
router.get('/:id', getMasterData);

// Write — SOW: SA, DIR, TA have full master data access
router.post('/', requirePermission('Admin', 'masterDataWrite'), createMasterData);
router.patch('/:id', requirePermission('Admin', 'masterDataWrite'), updateMasterData);
router.post('/:id/link-field', requirePermission('Admin', 'masterDataWrite'), linkField);
router.delete('/:id/link-field/:fieldId', requirePermission('Admin', 'masterDataWrite'), unlinkField);
router.delete('/:id', requirePermission('Admin', 'masterDataWrite'), deleteMasterData);

module.exports = router;
