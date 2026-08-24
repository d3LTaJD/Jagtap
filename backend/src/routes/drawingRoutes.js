const express = require('express');
const multer = require('multer');
const { protect, requirePermission } = require('../middleware/auth');
const drawingController = require('../controllers/drawingController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for engineering drawings
});

router.use(protect);

router.route('/')
  .get(requirePermission('Drawing', 'view'), drawingController.getDrawings)
  .post(requirePermission('Drawing', 'create'), drawingController.createDrawing);

router.route('/:id')
  .get(requirePermission('Drawing', 'view'), drawingController.getDrawing);

router.post('/:id/revisions', requirePermission('Drawing', 'edit'), upload.single('file'), drawingController.uploadRevision);
router.patch('/:id/checklist', requirePermission('Drawing', 'edit'), drawingController.updateChecklist);
router.post('/:id/approve', requirePermission('Drawing', 'approve'), drawingController.approveDrawing);
router.post('/:id/reject', requirePermission('Drawing', 'reject'), drawingController.rejectDrawing);
router.post('/:id/escalate', requirePermission('Drawing', 'edit'), drawingController.escalateDrawing);

module.exports = router;
