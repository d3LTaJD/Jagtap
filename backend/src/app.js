const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.length === 0 ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1|129\.121\.101\.36)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    // Fallback: allow request origin
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.options('*', cors());

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running' });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/enquiries', require('./routes/enquiryRoutes'));
app.use('/api/quotations', require('./routes/quotationRoutes'));
app.use('/api/qaps', require('./routes/qapRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/fields', require('./routes/fieldRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/follow-ups', require('./routes/followUpRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/files', require('./routes/uploadRoutes'));
app.use('/api/email', require('./routes/emailRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/master-data', require('./routes/masterDataRoutes'));
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/drawings', require('./routes/drawingRoutes'));
app.use('/api/work-orders', require('./routes/workOrderRoutes'));
app.use('/api/bom', require('./routes/bomRoutes'));
app.use('/api/purchase', require('./routes/purchaseRoutes'));
app.use('/api/proforma-invoices', require('./routes/proformaInvoiceRoutes'));

// Global Search
const { protect } = require('./middleware/auth');
const { globalSearch } = require('./controllers/searchController');
app.get('/api/search', protect, globalSearch);


// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
