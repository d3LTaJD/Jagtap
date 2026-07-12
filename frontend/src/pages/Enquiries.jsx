import React, { useState, useEffect } from 'react';
import { Plus, Filter, FileText, ChevronRight, Loader2, X, Trash2, RefreshCw, Pencil, XCircle, Download, CalendarDays, Upload, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import AutocompleteSelect from '../components/AutocompleteSelect';
import ToggleSwitch from '../components/ToggleSwitch';
import { Can } from '../context/AbilityContext';

const StatusBadge = ({ status }) => {
  const colors = {
    'New': 'bg-blue-50 text-blue-700 ring-blue-600/20',
    'Technical Review': 'bg-amber-50 text-amber-700 ring-amber-600/20',
    'Quoted': 'bg-purple-50 text-purple-700 ring-purple-600/20',
    'Won': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  };
  const color = colors[status] || 'bg-slate-50 text-slate-700 ring-slate-600/20';
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${color}`}>
      {status || 'Unknown'}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const colors = {
    'Urgent': 'text-red-700 bg-red-50',
    'High': 'text-orange-700 bg-orange-50',
    'Medium': 'text-blue-700 bg-blue-50',
    'Low': 'text-slate-700 bg-slate-50',
  };
  const color = colors[priority] || 'text-slate-700 bg-slate-50';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ${color}`}>
      {priority || 'Normal'}
    </span>
  );
};

const SourceTypeBadge = ({ sourceType }) => {
  const config = {
    'Tender': { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'ring-amber-500/30', icon: '📋' },
    'Direct Enquiry': { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-500/20', icon: '📩' },
    'Follow-up Reply': { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-500/20', icon: '↩️' },
    'Manual Entry': { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-500/20', icon: '✏️' },
  };
  const c = config[sourceType] || config['Direct Enquiry'];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${c.bg} ${c.text} ${c.ring}`}>
      {c.icon} {sourceType || 'Enquiry'}
    </span>
  );
};

const Enquiries = () => {
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // AI Suggestions states
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  // Tender Import states
  const [importLoading, setImportLoading] = useState(false);
  const [boqFiles, setBoqFiles] = useState([]);
  const [specFiles, setSpecFiles] = useState([]);

  const [formData, setFormData] = useState({
    companyName: '', primaryContactName: '', mobileNumber: '', emailAddress: '',
    sourceChannel: 'Email', emailAccount: 'info@', indiaMartLeadId: '', exhibitionName: '', gemTenderNo: '',
    sourceType: 'Manual Entry', tenderNumber: '', tenderDeadline: '',
    productCategory: 'Pressure Vessel',
    productDescription: '', quantity: 1, unit: 'NOS', priority: 'Medium',
    requiredDeliveryWeeks: '', requiredDeliveryDate: '',
    budgetFrom: '', budgetTo: '', estimatedValue: '',
    standardCode: '', thirdPartyInspection: false, specialRequirements: '',
    leadGenuineness: 'Likely Genuine', detailsSharedByLead: false, indiaMartContactMethod: 'Call',
    internalNotes: '',
    dynamicFields: {},
    products: [],
    tenderIntelligence: null
  });
  const [editingEnquiry, setEditingEnquiry] = useState(null); // null = create mode; enquiry object = edit mode
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const fetchEnquiries = async () => {
    setLoading(true); // always show spinner on refresh
    try {
      const res = await api.get('/enquiries');
      if (res.data.data && res.data.data.enquiries) {
        setEnquiries(res.data.data.enquiries);
      }
    } catch (err) {
      console.error('Failed to fetch enquiries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/customers');
        if (res.data?.data?.customers) {
          setCustomers(res.data.data.customers);
        }
      } catch (err) {
        console.error('Failed to fetch customers', err);
      }
    };
    if (showNewModal) {
      fetchCustomers();
    }
  }, [showNewModal]);

  const handleCustomerSelect = (customerId) => {
    setSelectedCustomerId(customerId);
    setAiSuggested(false);
    const selected = customers.find(c => c._id === customerId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        companyName: selected.companyName || '',
        primaryContactName: selected.primaryContactName || '',
        mobileNumber: selected.mobileNumber || '',
        emailAddress: selected.emailAddress || ''
      }));
    }
  };

  const handleAISuggest = async () => {
    if (!formData.productDescription) {
      alert('Please enter a Product Description first!');
      return;
    }
    setAiSuggestLoading(true);
    try {
      const payload = {
        customerId: selectedCustomerId || undefined,
        productCategory: formData.productCategory,
        productDescription: formData.productDescription,
        mobileNumber: formData.mobileNumber || undefined,
        emailAddress: formData.emailAddress || undefined
      };
      
      const res = await api.post('/enquiries/suggest-fields', payload);
      if (res.data?.data?.suggestions) {
        const { suggestions } = res.data.data;
        setFormData(prev => ({
          ...prev,
          standardCode: suggestions.standardCode || prev.standardCode,
          quantity: suggestions.quantity || prev.quantity,
          unit: suggestions.unit || prev.unit,
          priority: suggestions.priority || prev.priority,
          specialRequirements: suggestions.specialRequirements || prev.specialRequirements,
          dynamicFields: {
            ...prev.dynamicFields,
            ...(suggestions.dynamicFields || {})
          }
        }));
        setAiSuggested(true);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to fetch suggestions from AI.');
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const handleTenderImport = async () => {
    if (boqFiles.length === 0 && specFiles.length === 0) {
      alert('Please select at least a BOQ file or a Spec PDF file to import.');
      return;
    }
    setImportLoading(true);
    try {
      const formDataPayload = new FormData();
      boqFiles.forEach(file => formDataPayload.append('boqFiles', file));
      specFiles.forEach(file => formDataPayload.append('specFiles', file));

      const res = await api.post('/enquiries/import-tender', formDataPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.status === 'success') {
        const { products, specifications, tenderIntelligence } = res.data.data;
        
        setFormData(prev => {
          const updated = { ...prev };
          updated.sourceType = 'Tender';
          updated.sourceChannel = 'GEM Portal';
          updated.tenderIntelligence = tenderIntelligence;

          if (tenderIntelligence) {
            const td = tenderIntelligence.tenderDetails || {};
            const tl = tenderIntelligence.tenderTimeline || {};
            const contacts = tenderIntelligence.contactPersons || [];

            // Populate Customer Details
            if (td.customer) updated.companyName = td.customer;
            if (contacts.length > 0) {
              if (contacts[0].name) updated.primaryContactName = contacts[0].name;
              if (contacts[0].phone) updated.mobileNumber = contacts[0].phone;
              if (contacts[0].email) updated.emailAddress = contacts[0].email;
            }

            // Populate Tender Metadata
            if (td.gemTenderNo) {
              updated.tenderNumber = td.gemTenderNo;
              updated.gemTenderNo = td.gemTenderNo;
            }
            if (tl.bidSubmissionDate) {
              updated.tenderDeadline = tl.bidSubmissionDate;
            }
            if (tl.deliveryPeriodDays) {
              updated.requiredDeliveryWeeks = Math.ceil(tl.deliveryPeriodDays / 7);
            }
          }
          
          let firstProductSpecs = {};
          if (products && products.length > 0) {
            updated.productDescription = products[0].description;
            updated.quantity = products[0].quantity;
            updated.unit = products[0].unit;
            updated.productCategory = products[0].category || 'Piping';
            updated.products = products;
            firstProductSpecs = products[0].dynamicFields || {};
          }
          
          updated.dynamicFields = { 
            ...prev.dynamicFields, 
            ...firstProductSpecs,
            ...(specifications || {}) 
          };
          
          return updated;
        });

        const totalFiles = boqFiles.length + specFiles.length;
        alert(`✨ ${totalFiles} file(s) imported successfully! ${products?.length || 0} product(s) extracted.`);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to import tender files.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const dynamicObj = Array.isArray(formData.dynamicFields)
        ? formData.dynamicFields.reduce((acc, f) => { if(f.key) acc[f.key] = f.value; return acc; }, {})
        : formData.dynamicFields || {};
      
      if (editingEnquiry) {
        // EDIT mode — PATCH the existing enquiry
        await api.patch(`/enquiries/${editingEnquiry._id}`, {
          sourceChannel: formData.sourceChannel,
          sourceType: formData.sourceType,
          tenderNumber: formData.sourceType === 'Tender' ? formData.tenderNumber : undefined,
          tenderDeadline: formData.sourceType === 'Tender' && formData.tenderDeadline ? formData.tenderDeadline : undefined,
          productCategory: formData.productCategory,
          productDescription: formData.productDescription,
          quantity: formData.quantity,
          unit: formData.unit,
          priority: formData.priority,
          // Add other fields that can be edited
          indiaMartLeadId: formData.sourceChannel === 'IndiaMart' ? formData.indiaMartLeadId : undefined,
          leadGenuineness: formData.sourceChannel === 'IndiaMart' ? formData.leadGenuineness : undefined,
          detailsSharedByLead: formData.sourceChannel === 'IndiaMart' ? formData.detailsSharedByLead : undefined,
          indiaMartContactMethod: formData.sourceChannel === 'IndiaMart' ? formData.indiaMartContactMethod : undefined,
          requiredDeliveryWeeks: formData.requiredDeliveryWeeks,
          requiredDeliveryDate: formData.requiredDeliveryDate,
          budgetFrom: formData.budgetFrom,
          budgetTo: formData.budgetTo,
          estimatedValue: formData.estimatedValue,
          standardCode: formData.standardCode || undefined,
          thirdPartyInspection: formData.thirdPartyInspection,
          specialRequirements: formData.specialRequirements,
          internalNotes: formData.internalNotes,
          dynamicFields: dynamicObj,
          products: formData.products || [],
          tenderIntelligence: formData.tenderIntelligence || null
        });
      } else {
        // CREATE mode
        const payload = {
          customerData: {
            companyName: formData.companyName,
            primaryContactName: formData.primaryContactName,
            mobileNumber: formData.mobileNumber,
            emailAddress: formData.emailAddress,
          },
          enquiryData: {
            sourceChannel: formData.sourceChannel,
            sourceType: formData.sourceType || 'Manual Entry',
            tenderNumber: formData.sourceType === 'Tender' ? formData.tenderNumber : undefined,
            tenderDeadline: formData.sourceType === 'Tender' && formData.tenderDeadline ? formData.tenderDeadline : undefined,
            emailAccount: formData.sourceChannel === 'Email' ? formData.emailAccount : undefined,
            indiaMartLeadId: formData.sourceChannel === 'IndiaMart' ? formData.indiaMartLeadId : undefined,
            leadGenuineness: formData.sourceChannel === 'IndiaMart' ? formData.leadGenuineness : undefined,
            detailsSharedByLead: formData.sourceChannel === 'IndiaMart' ? formData.detailsSharedByLead : undefined,
            indiaMartContactMethod: formData.sourceChannel === 'IndiaMart' ? formData.indiaMartContactMethod : undefined,
            exhibitionName: formData.sourceChannel === 'Exhibition' ? formData.exhibitionName : undefined,
            gemTenderNo: formData.sourceChannel === 'GEM Portal' ? formData.gemTenderNo : undefined,
            contactPerson: formData.primaryContactName,
            contactMobile: formData.mobileNumber,
            contactEmail: formData.emailAddress,
            productCategory: formData.productCategory,
            productDescription: formData.productDescription,
            quantity: formData.quantity,
            unit: formData.unit,
            requiredDeliveryWeeks: formData.requiredDeliveryWeeks,
            requiredDeliveryDate: formData.requiredDeliveryDate,
            budgetFrom: formData.budgetFrom,
            budgetTo: formData.budgetTo,
            estimatedValue: formData.estimatedValue,
            standardCode: formData.standardCode || undefined,
            thirdPartyInspection: formData.thirdPartyInspection,
            specialRequirements: formData.specialRequirements,
            internalNotes: formData.internalNotes,
            priority: formData.priority,
            dynamicFields: dynamicObj,
            products: formData.products || [],
            tenderIntelligence: formData.tenderIntelligence || null
          }
        };
        await api.post('/enquiries', payload);
      }
      setShowNewModal(false);
      setEditingEnquiry(null);
      setSelectedCustomerId('');
      setAiSuggested(false);
      setBoqFiles([]);
      setSpecFiles([]);
      fetchEnquiries();
      setFormData({
        companyName: '', primaryContactName: '', mobileNumber: '', emailAddress: '',
        sourceChannel: 'Email', emailAccount: 'info@', indiaMartLeadId: '', exhibitionName: '', gemTenderNo: '',
        sourceType: 'Manual Entry', tenderNumber: '', tenderDeadline: '',
        productCategory: 'Pressure Vessel',
        productDescription: '', quantity: 1, unit: 'NOS', priority: 'Medium',
        requiredDeliveryWeeks: '', requiredDeliveryDate: '',
        budgetFrom: '', budgetTo: '', estimatedValue: '',
        standardCode: '', thirdPartyInspection: false, specialRequirements: '',
        leadGenuineness: 'Likely Genuine', detailsSharedByLead: false, indiaMartContactMethod: 'Call',
        internalNotes: '',
        dynamicFields: {},
        products: [],
        tenderIntelligence: null
      });
    } catch(err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error saving enquiry');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDynamicChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [fieldName]: value }
    }));
  };

  const openEdit = (e, enq) => {
    e.stopPropagation(); // don't navigate to detail
    setEditingEnquiry(enq);
    setSelectedCustomerId(enq.customer?._id || '');
    setAiSuggested(false);
    setFormData({
      companyName: enq.customer?.companyName || '',
      primaryContactName: enq.customer?.primaryContactName || '',
      mobileNumber: enq.customer?.mobileNumber || '',
      emailAddress: enq.customer?.emailAddress || '',
      sourceChannel: enq.sourceChannel || 'Email',
      sourceType: enq.sourceType || 'Manual Entry',
      tenderNumber: enq.tenderNumber || '',
      tenderDeadline: enq.tenderDeadline ? new Date(enq.tenderDeadline).toISOString().split('T')[0] : '',
      emailAccount: enq.emailAccount || 'info@',
      indiaMartLeadId: enq.indiaMartLeadId || '',
      exhibitionName: enq.exhibitionName || '',
      gemTenderNo: enq.gemTenderNo || '',
      productCategory: enq.productCategory || 'Pressure Vessel',
      productDescription: enq.productDescription || '',
      quantity: enq.quantity || 1,
      unit: enq.unit || 'NOS',
      priority: enq.priority || 'Medium',
      requiredDeliveryWeeks: enq.requiredDeliveryWeeks || '',
      requiredDeliveryDate: enq.requiredDeliveryDate ? new Date(enq.requiredDeliveryDate).toISOString().split('T')[0] : '',
      budgetFrom: enq.budgetFrom || '',
      budgetTo: enq.budgetTo || '',
      estimatedValue: enq.estimatedValue || '',
      standardCode: enq.standardCode || '',
      thirdPartyInspection: enq.thirdPartyInspection || false,
      specialRequirements: enq.specialRequirements || '',
      leadGenuineness: enq.leadGenuineness || 'Likely Genuine',
      detailsSharedByLead: enq.detailsSharedByLead || false,
      indiaMartContactMethod: enq.indiaMartContactMethod || 'Call',
      internalNotes: enq.internalNotes || '',
      dynamicFields: enq.dynamicFields || {},
      products: enq.products || []
    });
    setShowNewModal(true);
  };

  // Export all visible enquiries to CSV
  const exportAllCSV = () => {
    const headers = ['Enquiry ID','Customer','Product Category','Status','Priority','Source','Assigned To','Created','Next Follow-up'];
    const rows = filteredEnquiries.map(enq => [
      enq.enquiryId,
      enq.customer?.companyName || '',
      enq.productCategory || '',
      enq.status || '',
      enq.priority || '',
      enq.sourceChannel || '',
      enq.assignedTo?.name || '',
      new Date(enq.createdAt).toLocaleDateString('en-IN'),
      enq.nextFollowUpDate ? new Date(enq.nextFollowUpDate).toLocaleDateString('en-IN') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `enquiries_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // Filtered list
  const filteredEnquiries = enquiries.filter(enq => {
    if (filterStatus && enq.status !== filterStatus) return false;
    if (filterCategory && enq.productCategory !== filterCategory) return false;
    return true;
  });

  useEffect(() => {
    fetchEnquiries();
    const interval = setInterval(fetchEnquiries, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enquiries</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all incoming leads and technical requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchEnquiries}
            className="p-2 text-slate-500 bg-white border border-slate-200 rounded-xl hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-500' : ''}`} />
          </button>
          <Can I="export" a="Enquiry">
            <button onClick={exportAllCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </Can>
          <button
            onClick={() => setShowFilter(f => !f)}
            className={`inline-flex items-center justify-center px-4 py-2 border rounded-xl text-sm font-medium transition-all shadow-sm ${
              showFilter || filterStatus || filterCategory
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter {(filterStatus || filterCategory) ? '(Active)' : ''}
          </button>
          <Can I="create" a="Enquiry">
            <button onClick={() => { setEditingEnquiry(null); setShowNewModal(true); }} className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium shadow-sm shadow-brand-500/30 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              New Enquiry
            </button>
          </Can>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="mb-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4 animate-in slide-in-from-top-2 duration-200">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <AutocompleteSelect
              options={['New','Confirmed','Technical Review','Quoted','Negotiating','Won','Lost','On Hold','Abandoned']}
              value={filterStatus}
              onChange={v => setFilterStatus(v)}
              placeholder="All Statuses"
              allowClear={true}
              className="min-w-[180px]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Category</label>
            <AutocompleteSelect
              options={['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Valves', 'Piping / Pipe Fabrication', 'Structural Fabrication', 'Custom Fabrication', 'Structural', 'Custom', 'Multiple']}
              value={filterCategory}
              onChange={v => setFilterCategory(v)}
              placeholder="All Categories"
              allowClear={true}
              className="min-w-[200px]"
            />
          </div>
          <button
            onClick={() => { setFilterStatus(''); setFilterCategory(''); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" /> Clear
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Enquiry ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Product Category</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Follow-up</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredEnquiries.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-8 text-center text-sm text-slate-500">
                      {enquiries.length === 0 ? 'No enquiries found. Click "New Enquiry" to create one.' : 'No enquiries match the current filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredEnquiries.map((enq) => (
                    <tr 
                      key={enq._id} 
                      onClick={() => navigate(`/app/enquiries/${enq._id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand-600">
                        {enq.enquiryId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">
                        {enq.customer?.companyName || 'Unknown Customer'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {enq.productCategory || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <SourceTypeBadge sourceType={enq.sourceType} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={enq.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PriorityBadge priority={enq.priority} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {enq.extractionConfidence !== undefined ? (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${
                            enq.extractionConfidence >= 80 ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                            enq.extractionConfidence >= 50 ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                            'bg-rose-50 text-rose-700 ring-rose-600/20'
                          }`}>
                            🎯 {enq.extractionConfidence}%
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {enq.nextFollowUpDate ? (() => {
                          const d = new Date(enq.nextFollowUpDate);
                          const isOverdue = d < new Date();
                          const isDueSoon = !isOverdue && (d - new Date()) < 86400000 * 2;
                          return (
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                              isOverdue ? 'bg-red-100 text-red-700' : isDueSoon ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              <CalendarDays className="w-3 h-3" />
                              {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          );
                        })() : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium font-mono">
                        {new Date(enq.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Can I="edit" a="Enquiry">
                          <button
                            onClick={e => openEdit(e, enq)}
                            className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg hover:bg-brand-50 transition-colors inline-flex items-center gap-1 opacity-0 group-hover:opacity-100"
                            title="Edit Enquiry"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </Can>
                        <ChevronRight className="w-5 h-5 inline text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* New / Edit Enquiry Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEnquiry ? `Edit Enquiry — ${editingEnquiry.enquiryId}` : 'Create New Enquiry'}
              </h2>
              <button onClick={() => { setShowNewModal(false); setEditingEnquiry(null); setSelectedCustomerId(''); setAiSuggested(false); setBoqFiles([]); setSpecFiles([]); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form id="new-enquiry-form" onSubmit={handleSubmit} className="space-y-8">
                
                {!editingEnquiry && (
                  <div className="p-5 bg-brand-50/40 border border-brand-100 rounded-2xl shadow-sm mb-6 animate-in slide-in-from-top-3 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-sm font-black text-brand-900 flex items-center gap-1.5">
                          <span>⚡</span> AI Tender & BOQ Importer
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">Upload multiple tender files to automatically extract and populate the enquiry.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTenderImport}
                        disabled={importLoading || (boqFiles.length === 0 && specFiles.length === 0)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-500/20 hover:shadow-brand-500/30 transition-all cursor-pointer"
                      >
                        {importLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Run AI Import {(boqFiles.length + specFiles.length) > 0 && `(${boqFiles.length + specFiles.length} files)`}
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* BOQ Files Drop Zone */}
                      <div className="p-4 bg-white border border-slate-200 hover:border-brand-200 rounded-xl transition-all relative flex flex-col justify-center items-center text-center group min-h-[80px]">
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          multiple
                          onChange={e => {
                            const newFiles = Array.from(e.target.files);
                            setBoqFiles(prev => {
                              const existingNames = new Set(prev.map(f => f.name));
                              const unique = newFiles.filter(f => !existingNames.has(f.name));
                              return [...prev, ...unique];
                            });
                            e.target.value = '';
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {boqFiles.length > 0 ? (
                          <div className="w-full space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">BOQ Files ({boqFiles.length})</span>
                            {boqFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  <span className="text-xs font-medium text-emerald-700 truncate">{file.name}</span>
                                </div>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setBoqFiles(prev => prev.filter((_, i) => i !== idx)); }} className="p-0.5 text-slate-400 hover:text-red-500 transition-colors z-20 relative">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <span className="text-[10px] text-slate-400">Click to add more</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-slate-400 font-medium text-xs mb-1 group-hover:text-brand-600 transition-colors">Select BOQ Files (Excel/CSV)</span>
                            <span className="text-[10px] text-slate-400">Multiple files supported</span>
                          </div>
                        )}
                      </div>

                      {/* Spec Files Drop Zone */}
                      <div className="p-4 bg-white border border-slate-200 hover:border-brand-200 rounded-xl transition-all relative flex flex-col justify-center items-center text-center group min-h-[80px]">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          multiple
                          onChange={e => {
                            const newFiles = Array.from(e.target.files);
                            setSpecFiles(prev => {
                              const existingNames = new Set(prev.map(f => f.name));
                              const unique = newFiles.filter(f => !existingNames.has(f.name));
                              return [...prev, ...unique];
                            });
                            e.target.value = '';
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {specFiles.length > 0 ? (
                          <div className="w-full space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Spec Files ({specFiles.length})</span>
                            {specFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  <span className="text-xs font-medium text-emerald-700 truncate">{file.name}</span>
                                </div>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setSpecFiles(prev => prev.filter((_, i) => i !== idx)); }} className="p-0.5 text-slate-400 hover:text-red-500 transition-colors z-20 relative">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <span className="text-[10px] text-slate-400">Click to add more</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-slate-400 font-medium text-xs mb-1 group-hover:text-brand-600 transition-colors">Select Spec PDFs / Docs</span>
                            <span className="text-[10px] text-slate-400">Multiple files supported</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                
                {/* Customer Section */}
                <section>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Customer Details</h3>
                    <div className="w-full sm:w-72">
                      <AutocompleteSelect
                        options={customers.map(c => ({ value: c._id, label: `${c.companyName} (${c.primaryContactName})` }))}
                        value={selectedCustomerId}
                        onChange={handleCustomerSelect}
                        placeholder="Or select existing customer..."
                        allowClear={true}
                      />
                    </div>
                  </div>

                  {aiSuggested && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4 animate-in slide-in-from-top-2">
                      <span>✨ AI suggestions applied successfully from this customer's previous history!</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                      <input type="text" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" placeholder="Acme Corp" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                      <input type="text" required value={formData.primaryContactName} onChange={e => setFormData({...formData, primaryContactName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                      <input type="text" required value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" placeholder="9876543210" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-slate-400 font-normal">(Optional)</span></label>
                      <input type="email" value={formData.emailAddress} onChange={e => setFormData({...formData, emailAddress: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" placeholder="john@acme.com" />
                    </div>
                  </div>
                </section>

                <hr className="border-slate-100" />

                {/* Enquiry Details Section */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-brand-600 uppercase tracking-wider">Request Information</h3>
                    <button
                      type="button"
                      onClick={handleAISuggest}
                      disabled={aiSuggestLoading || !formData.productDescription}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 border border-brand-200 text-brand-700 rounded-lg text-xs font-black hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {aiSuggestLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Suggesting...
                        </>
                      ) : (
                        <>
                          ✨ Suggest Specs via AI
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Product Category</label>
                      <AutocompleteSelect
                        options={['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Valves', 'Structural', 'Custom', 'Multiple']}
                        value={formData.productCategory}
                        onChange={v => setFormData({...formData, productCategory: v})}
                        placeholder="Select category..."
                        allowClear={false}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Source Channel</label>
                      <AutocompleteSelect
                        options={['IndiaMart', 'GEM Portal', 'Email', 'WhatsApp', 'Reference', 'Exhibition', 'Verbal/Phone', 'Website', 'Cold Call', 'Walk-in']}
                        value={formData.sourceChannel}
                        onChange={v => setFormData({...formData, sourceChannel: v})}
                        placeholder="Select source..."
                        allowClear={false}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Source Type</label>
                      <AutocompleteSelect
                        options={['Direct Enquiry', 'Tender', 'Follow-up Reply', 'Manual Entry']}
                        value={formData.sourceType}
                        onChange={v => setFormData({...formData, sourceType: v})}
                        placeholder="Select source type..."
                        allowClear={false}
                      />
                    </div>

                    {formData.sourceType === 'Tender' && (
                      <div className="md:col-span-2 p-3 bg-amber-50/50 rounded-lg border border-amber-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-amber-800 mb-1">Tender Number</label>
                          <input type="text" value={formData.tenderNumber} onChange={e => setFormData({...formData, tenderNumber: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm" placeholder="e.g. NIT-1234" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-amber-800 mb-1">Tender Deadline</label>
                          <input type="date" value={formData.tenderDeadline} onChange={e => setFormData({...formData, tenderDeadline: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm" />
                        </div>
                      </div>
                    )}

                    {/* Conditional Source Fields */}
                    {formData.sourceChannel === 'Email' && (
                      <div className="md:col-span-2 p-3 bg-brand-50/50 rounded-lg border border-brand-100 flex items-center gap-4">
                        <label className="text-sm font-medium text-brand-800 whitespace-nowrap">Received On:</label>
                        <AutocompleteSelect
                          options={['info@', 'sales@', 'support@']}
                          value={formData.emailAccount}
                          onChange={v => setFormData({...formData, emailAccount: v})}
                          placeholder="Select account..."
                          allowClear={false}
                          className="flex-1"
                        />
                      </div>
                    )}
                    {formData.sourceChannel === 'IndiaMart' && (
                      <>
                        <div className="md:col-span-2 p-3 bg-orange-50/50 rounded-lg border border-orange-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-orange-800 mb-1">IndiaMart Lead ID *</label>
                            <input type="text" required value={formData.indiaMartLeadId} onChange={e => setFormData({...formData, indiaMartLeadId: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-orange-200 rounded-lg text-sm" placeholder="e.g. 12345678" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-orange-800 mb-1">Lead Genuineness</label>
                            <AutocompleteSelect
                              options={['Genuine', 'Likely Genuine', 'Suspect', 'Junk']}
                              value={formData.leadGenuineness}
                              onChange={v => setFormData({...formData, leadGenuineness: v})}
                              placeholder="Select..."
                              allowClear={false}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-orange-800 mb-1">First Contact Method</label>
                            <AutocompleteSelect
                              options={['Call', 'Message', 'Both']}
                              value={formData.indiaMartContactMethod}
                              onChange={v => setFormData({...formData, indiaMartContactMethod: v})}
                              placeholder="Select..."
                              allowClear={false}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 mt-6">
                            <span className="text-sm text-slate-700 font-medium">Details Shared by Lead?</span>
                            <ToggleSwitch checked={formData.detailsSharedByLead} onChange={v => setFormData({...formData, detailsSharedByLead: v})} />
                          </div>
                        </div>
                      </>
                    )}
                    {formData.sourceChannel === 'Exhibition' && (
                      <div className="md:col-span-2 p-3 bg-violet-50/50 rounded-lg border border-violet-100 flex items-center gap-4">
                        <label className="text-sm font-medium text-violet-800 whitespace-nowrap">Exhibition:</label>
                        <input type="text" required value={formData.exhibitionName} onChange={e => setFormData({...formData, exhibitionName: e.target.value})} className="px-3 py-1.5 bg-white border border-violet-200 rounded-lg text-sm flex-1" placeholder="Name of Exhibition" />
                      </div>
                    )}
                    {formData.sourceChannel === 'GEM Portal' && (
                      <div className="md:col-span-2 p-3 bg-slate-50/50 rounded-lg border border-slate-200 flex items-center gap-4">
                        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Tender No:</label>
                        <input type="text" required value={formData.gemTenderNo} onChange={e => setFormData({...formData, gemTenderNo: e.target.value})} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm flex-1" placeholder="GEM Tender Number" />
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Product Description</label>
                      <textarea required maxLength="200" value={formData.productDescription} onChange={e => setFormData({...formData, productDescription: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 min-h-[80px]" placeholder="Briefly describe the requested equipment (Max 200 chars)"></textarea>
                    </div>



                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input type="number" min="1" step="any" required placeholder=" " value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                        <AutocompleteSelect
                          options={['NOS', 'SET', 'MT', 'KG', 'M', 'M2', 'Job']}
                          value={formData.unit}
                          onChange={v => setFormData({...formData, unit: v})}
                          placeholder="Select unit..."
                          allowClear={false}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                      <AutocompleteSelect
                        options={['Low', 'Medium', 'High', 'Urgent']}
                        value={formData.priority}
                        onChange={v => setFormData({...formData, priority: v})}
                        placeholder="Select priority..."
                        allowClear={false}
                      />
                    </div>

                    {/* Budget */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Budget From (₹)</label>
                      <input type="number" min="0" value={formData.budgetFrom} onChange={e => setFormData({...formData, budgetFrom: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="Optional" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Budget To (₹)</label>
                      <input type="number" min="0" value={formData.budgetTo} onChange={e => setFormData({...formData, budgetTo: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="Optional" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Special Requirements</label>
                      <textarea maxLength="400" value={formData.specialRequirements} onChange={e => setFormData({...formData, specialRequirements: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 min-h-[60px]" placeholder="Max 400 chars"></textarea>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Value (₹) <span className="text-slate-400 font-normal">(Internal)</span></label>
                      <input type="number" min="0" value={formData.estimatedValue} onChange={e => setFormData({...formData, estimatedValue: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="Rough pipeline estimate" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes <span className="text-slate-400 font-normal">(Not visible on documents)</span></label>
                      <textarea maxLength="300" value={formData.internalNotes} onChange={e => setFormData({...formData, internalNotes: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 min-h-[60px]" placeholder="Max 300 chars"></textarea>
                    </div>

                  </div>
                </section>
              </form>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowNewModal(false); setEditingEnquiry(null); setSelectedCustomerId(''); setAiSuggested(false); setBoqFiles([]); setSpecFiles([]); }} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="new-enquiry-form" disabled={submitLoading} className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center">
                {submitLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Enquiry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Enquiries;
