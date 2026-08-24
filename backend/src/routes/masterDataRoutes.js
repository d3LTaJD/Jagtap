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
router.get('/', requirePermission('MasterData', 'view'), getAllMasterData);
router.get('/slug/:slug', requirePermission('MasterData', 'view'), getMasterDataBySlug);
router.get('/:id', requirePermission('MasterData', 'view'), getMasterData);

// Write — SOW: SA, DIR, TA have full master data access
router.post('/', requirePermission('MasterData', 'create'), createMasterData);
router.patch('/:id', requirePermission('MasterData', 'edit'), updateMasterData);
router.post('/:id/link-field', requirePermission('MasterData', 'edit'), linkField);
router.delete('/:id/link-field/:fieldId', requirePermission('MasterData', 'delete'), unlinkField);
router.delete('/:id', requirePermission('MasterData', 'delete'), deleteMasterData);

module.exports = router;
