const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { createTask, getTasks, getTask, updateTask, deleteTask } = require('../controllers/taskController');

const router = express.Router();

// All task routes require authentication
router.use(protect);

router.route('/')
  .get(requirePermission('Tasks', 'view'), getTasks)
  .post(requirePermission('Tasks', 'create'), createTask);

router.route('/:id')
  .get(requirePermission('Tasks', 'view'), getTask)
  .patch(requirePermission('Tasks', 'edit'), updateTask)
  .delete(requirePermission('Tasks', 'delete'), deleteTask);

module.exports = router;
