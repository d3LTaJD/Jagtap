const MasterData = require('../models/MasterData');
const FieldDefinition = require('../models/FieldDefinition');
const { logActivity } = require('../utils/logger');

// @desc    Get all master data categories
// @route   GET /api/master-data
exports.getAllMasterData = async (req, res) => {
  try {
    const filter = { isActive: true };

    const categories = await MasterData.find(filter)
      .populate('linkedFields', 'fieldLabel fieldName formContext')
      .populate('createdBy', 'name')
      .sort({ name: 1 });

    res.status(200).json({ status: 'success', data: { categories } });
  } catch (error) {
    console.error('Get master data error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Get a single master data category with items
// @route   GET /api/master-data/:id
exports.getMasterData = async (req, res) => {
  try {
    const category = await MasterData.findById(req.params.id)
      .populate('linkedFields', 'fieldLabel fieldName formContext')
      .populate('createdBy', 'name');

    if (!category) {
      return res.status(404).json({ status: 'error', message: 'Master data not found' });
    }

    res.status(200).json({ status: 'success', data: { category } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Get items by slug (for dropdown population)
// @route   GET /api/master-data/slug/:slug
exports.getMasterDataBySlug = async (req, res) => {
  try {
    const category = await MasterData.findOne({ slug: req.params.slug, isActive: true });
    if (!category) {
      return res.status(404).json({ status: 'error', message: 'Master data not found' });
    }

    const activeItems = category.items.filter(i => i.isActive);
    res.status(200).json({
      status: 'success',
      data: { items: activeItems.sort((a, b) => a.sortOrder - b.sortOrder) }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Create master data category
// @route   POST /api/master-data
exports.createMasterData = async (req, res) => {
  try {
    const { name, description, icon, items } = req.body;

    const category = await MasterData.create({
      name,
      description,
      icon,
      items: (items || []).map((item, i) => ({
        label: item.label,
        value: item.value || item.label.toLowerCase().replace(/\s+/g, '_'),
        description: item.description || '',
        sortOrder: item.sortOrder ?? i,
      })),
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      action: 'CREATE',
      module: 'MASTER_DATA',
      resourceId: category._id,
      resourceName: category.name,
      newState: category.toObject(),
      details: `Created master data category: ${category.name}`
    });

    res.status(201).json({ status: 'success', data: { category } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ status: 'error', message: 'A master data category with this name already exists.' });
    }
    console.error('Create master data error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Update master data category (name, description, assignedTo, items)
// @route   PATCH /api/master-data/:id
exports.updateMasterData = async (req, res) => {
  try {
    const updates = { ...req.body };

    // If items are provided, process them
    if (updates.items) {
      updates.items = updates.items.map((item, i) => ({
        ...item,
        value: item.value || item.label.toLowerCase().replace(/\s+/g, '_'),
        sortOrder: item.sortOrder ?? i,
      }));
    }

    const originalCategory = await MasterData.findById(req.params.id);
    const category = await MasterData.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true
    })
      .populate('linkedFields', 'fieldLabel fieldName formContext')
      .populate('createdBy', 'name');

    if (!category) {
      return res.status(404).json({ status: 'error', message: 'Master data not found' });
    }

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'MASTER_DATA',
      resourceId: category._id,
      resourceName: category.name,
      previousState: originalCategory.toObject(),
      newState: category.toObject(),
      details: `Updated master data category: ${category.name}`
    });

    // If items changed and there are linked fields, sync field options
    if (updates.items && category.linkedFields?.length > 0) {
      const activeOptions = category.items.filter(i => i.isActive).map(i => `${i.value} - ${i.label}`);
      await FieldDefinition.updateMany(
        { _id: { $in: category.linkedFields } },
        { $set: { options: activeOptions } }
      );
    }

    res.status(200).json({ status: 'success', data: { category } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ status: 'error', message: 'A master data category with this name already exists.' });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Link a master data category to a field definition
// @route   POST /api/master-data/:id/link-field
exports.linkField = async (req, res) => {
  try {
    const { fieldId } = req.body;
    const category = await MasterData.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ status: 'error', message: 'Master data not found' });
    }

    // Add to linkedFields if not already present
    if (!category.linkedFields.includes(fieldId)) {
      category.linkedFields.push(fieldId);
      await category.save();
    }

    // Sync options to the field
    const activeOptions = category.items.filter(i => i.isActive).map(i => `${i.value} - ${i.label}`);
    await FieldDefinition.findByIdAndUpdate(fieldId, { $set: { options: activeOptions } });

    const updated = await MasterData.findById(req.params.id)
      .populate('linkedFields', 'fieldLabel fieldName formContext');

    res.status(200).json({ status: 'success', data: { category: updated } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Unlink a field from master data
// @route   DELETE /api/master-data/:id/link-field/:fieldId
exports.unlinkField = async (req, res) => {
  try {
    const category = await MasterData.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ status: 'error', message: 'Master data not found' });
    }

    category.linkedFields = category.linkedFields.filter(
      f => f.toString() !== req.params.fieldId
    );
    await category.save();

    res.status(200).json({ status: 'success', message: 'Field unlinked' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Delete (soft) a master data category
// @route   DELETE /api/master-data/:id
exports.deleteMasterData = async (req, res) => {
  try {
    const category = await MasterData.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!category) {
      return res.status(404).json({ status: 'error', message: 'Master data not found' });
    }

    await logActivity({
      req,
      action: 'DELETE',
      module: 'MASTER_DATA',
      resourceId: category._id,
      resourceName: category.name,
      details: `Archived master data category: ${category.name}`
    });

    res.status(200).json({ status: 'success', message: 'Master data archived' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
