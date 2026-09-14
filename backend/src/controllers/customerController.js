const Customer = require('../models/Customer');
const { logActivity } = require('../utils/logger');

// Pad number for auto ID: CUS-0001
const padId = (n) => `CUS-${String(n).padStart(4, '0')}`;

// GET /api/customers
exports.getCustomers = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { primaryContactName: { $regex: search, $options: 'i' } },
        { emailAddress: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    const customers = await Customer.find(filter).sort('-createdAt');
    res.status(200).json({ status: 'success', data: { customers } });
  } catch (err) { next(err); }
};

// GET /api/customers/:id
exports.getCustomer = async (req, res, next) => {
  try {
    const cust = await Customer.findById(req.params.id);
    if (!cust) return res.status(404).json({ status: 'fail', message: 'Customer not found' });
    res.status(200).json({ status: 'success', data: { customer: cust } });
  } catch (err) { next(err); }
};

// POST /api/customers
exports.createCustomer = async (req, res, next) => {
  try {
    const count = (await Customer.countDocuments()) + 1;
    const customerId = padId(count);
    const customer = await Customer.create({ ...req.body, customerId });
    
    await logActivity({
      req,
      action: 'CREATE',
      module: 'CUSTOMER',
      resourceId: customer._id,
      resourceName: customer.companyName,
      newState: customer.toObject(),
      details: `Created customer: ${customer.companyName}`
    });

    res.status(201).json({ status: 'success', data: { customer } });
  } catch (err) { next(err); }
};

// PATCH /api/customers/:id
exports.updateCustomer = async (req, res, next) => {
  try {
    const originalCustomer = await Customer.findById(req.params.id);
    const customer = await Customer.findByIdAndUpdate(
      req.params.id, { $set: req.body }, { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ status: 'fail', message: 'Customer not found' });

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'CUSTOMER',
      resourceId: customer._id,
      resourceName: customer.companyName,
      previousState: originalCustomer.toObject(),
      newState: customer.toObject(),
      details: `Updated customer: ${customer.companyName}`
    });

    res.status(200).json({ status: 'success', data: { customer } });
  } catch (err) { next(err); }
};

// DELETE /api/customers/:id  (soft delete — set isActive false)
exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ status: 'fail', message: 'Customer not found' });
    }

    await Customer.findByIdAndDelete(req.params.id);

    await logActivity({
      req,
      action: 'DELETE',
      module: 'CUSTOMER',
      resourceId: customer._id,
      resourceName: customer.companyName,
      previousState: customer.toObject(),
      newState: null,
      details: `Permanently deleted customer: ${customer.companyName}`
    });

    res.status(200).json({ status: 'success', message: 'Customer deleted permanently' });
  } catch (err) { next(err); }
};
