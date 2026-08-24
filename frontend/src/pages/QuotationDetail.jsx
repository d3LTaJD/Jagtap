import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FileText, Download, User as UserIcon, CheckCircle, CheckCircle2,
  Clock, AlertCircle, ArrowLeft, Loader2, IndianRupee,
  Send, GitBranch, History, Printer, Lock, X, AlertTriangle, Save, File,
  Edit, Sliders, Shield, FileSpreadsheet, Settings, HelpCircle, Plus, Trash2, RefreshCw,
  ClipboardCheck, LayoutGrid, Table2, Upload, Sparkles
} from 'lucide-react';
import api from '../api/client';
import { getRoleCode, useAbility } from '../context/AbilityContext';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import AutocompleteSelect from '../components/AutocompleteSelect';
import AttachmentManager from '../components/AttachmentManager';
import EmailComposerModal from '../components/EmailComposerModal';
import ContractReviewMatrix from '../components/ContractReviewMatrix';
import PriceTableGrid from '../components/PriceTableGrid';
import BulkActionsToolbar from '../components/BulkActionsToolbar';
import CopySpecsModal from '../components/CopySpecsModal';
import ExcelImportModal from '../components/ExcelImportModal';
import RevisionHistoryModal from '../components/RevisionHistoryModal';
import { formatTextToMm } from '../utils/valveFormatter';
import { calculateQuotationPricing, calculateItemPricing } from '../utils/quotationCalculator';
import { applyBulkPricing, applySelectiveSpecCloning } from '../utils/quotationBulkOperations';

const StatusBadge = ({ status }) => {
  const colors = {
    'DRAFT': 'bg-slate-100 text-slate-700 border-slate-300',
    'TECH_REVIEW': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'CHECKER_REVIEW': 'bg-purple-50 text-purple-700 border-purple-200',
    'PENDING_APPROVAL': 'bg-amber-50 text-amber-700 border-amber-200',
    'APPROVED': 'bg-emerald-50 text-emerald-700 border-emerald-300',
    'SENT': 'bg-blue-50 text-blue-700 border-blue-200',
    'REVISION_REQUESTED': 'bg-rose-50 text-rose-700 border-rose-300',
    'REJECTED': 'bg-red-50 text-red-700 border-red-200',
  };
  const labels = {
    'DRAFT': 'Step 1: Draft (Sales Maker)',
    'TECH_REVIEW': 'Step 2: QC Tech Review',
    'CHECKER_REVIEW': 'Step 4: Checker Review (MGR)',
    'PENDING_APPROVAL': 'Step 5: Pending Director Sign-off',
    'APPROVED': 'Approved by Director',
    'SENT': 'Step 6: Sent to Client',
    'REVISION_REQUESTED': 'Step 7: Client Reply / Revision',
    'REJECTED': 'Returned for Revision'
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colors[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {labels[status] || status}
    </span>
  );
};

export const WORKFLOW_STEPS = [
  { stepNo: 1, key: 'DRAFT', label: '1. AI Pre-Fill & Draft', by: 'AI + Sales (Maker)' },
  { stepNo: 2, key: 'ROUTED_QC', label: '2. Route to QC', by: 'Sales' },
  { stepNo: 3, key: 'TECH_REVIEW', label: '3. QC Validate & Lock', by: 'QC Supervisor' },
  { stepNo: 4, key: 'CHECKER_REVIEW', label: '4. Manager Review', by: 'Sales Manager (Checker)' },
  { stepNo: 5, key: 'APPROVED', label: '5. Director Sign-off', by: 'Director (Approver)' },
  { stepNo: 6, key: 'SENT', label: '6. Email Branded PDF', by: 'Sales (1-click)' },
  { stepNo: 7, key: 'REVISION_REQUESTED', label: '7. Client Reply & Rev', by: 'Gmail AI' }
];

export const getStepOrder = (status) => {
  const s = String(status || '').trim().toUpperCase();
  switch (s) {
    case 'DRAFT': return 1;
    case 'TECH_REVIEW': case 'PENDING TECHNICAL REVIEW': return 3;
    case 'CHECKER_REVIEW': case 'PENDING COMMERCIAL REVIEW': return 4;
    case 'PENDING_APPROVAL': return 5;
    case 'APPROVED': return 5;
    case 'SENT': return 6;
    case 'REVISION_REQUESTED': case 'REVISED': case 'NEGOTIATING': return 7;
    case 'ACCEPTED': return 7;
    default: return 1;
  }
};

const QuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const ability = useAbility();
  const [quotation, setQuotation] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showRevisionHistoryModal, setShowRevisionHistoryModal] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(null); // 'ROUTE_QC' | 'SUBMIT_QC' | 'CHECKER_REVIEW' | 'DIRECTOR_APPROVE'
  const [workflowNote, setWorkflowNote] = useState('');
  const [checkerDecision, setCheckerDecision] = useState('APPROVE');
  const [liveDiffInfo, setLiveDiffInfo] = useState(null);
  const [revisionNote, setRevisionNote] = useState('');
  
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState('technical'); // 'technical' | 'pricing' | 'commercial'
  const [activeItemIndex, setActiveItemIndex] = useState(null); // for item specs drawer

  // Local state for editable parts
  const [items, setItems] = useState([]);
  const [techFields, setTechFields] = useState({
    offerNo: '',
    offerDate: '',
    customerName: '',
    customerAddress: '',
    contactNo: '',
    emailId: '',
    kindAttention: '',
    enquiryRefText: '',
    projectName: '',
    subjectText: 'Offer for valves as per your requirements.',
    salutationOpeningText: 'We acknowledge with thanks the receipt of your above referred enquiry and we are pleased to submit our proposal as under.',
    technicalSpecificationClause: 'We offered our valves as per Specification given in Contract Review Checklist.',
    technicalDeviations: 'No deviation / As per client specification'
  });
  const [commFields, setCommFields] = useState({
    priceBasis: '',
    packingForwardingTerms: '',
    freightTerms: '',
    taxDutyTerms: '',
    validityTerms: '',
    tpiTerms: '',
    transitInsurance: '',
    guaranteeTerms: '',
    paymentTerms: '',
    deliverySchedule: ''
  });

  const [priceFields, setPriceFields] = useState({
    pricePartNotice: 'We offer our Valves as below, considering Contract Review Check (Format No. R/S.1.3.5/2 Rev04).',
    ndtRequirementText: 'Any NDT Requirement (i.e. RT, UT, MPT) then charges will be Extra at actual to your account.',
    specialTestingRequirementText: 'If any Special Testing Requirement (i.e. Helium, Nitrogen, Vacuum, IGC, PMI, NACE, Paint) then charges will be Extra at actual to your account.',
    sparesMandayChargesText: 'Spares, Manday required then charges will be Extra at actual to your account.',
    cert32Terms: 'Extra for 3.2 Certification Charges (5%)',
    cert32Percent: 5,
    pfTerms: 'Extra for Packing & Forwarding Charges (5%)',
    pfPercent: 5,
    tpiaNoticeText: 'Third Party Inspection (TPIA) required then charges will be Extra to your account.'
  });

  const [priceViewMode, setPriceViewMode] = useState('table'); // 'table' | 'card'
  const [selectedItemIndices, setSelectedItemIndices] = useState([]);
  const [pricingSuggestions, setPricingSuggestions] = useState({});
  const [copySpecsModalState, setCopySpecsModalState] = useState({ isOpen: false, sourceIdx: 0 });
  const [excelImportModalOpen, setExcelImportModalOpen] = useState(false);

  const savedSnapshotRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qRes = await api.get(`/quotations/${id}`);
        if (qRes.data.data?.quotation) {
          const q = qRes.data.data.quotation;
          setQuotation(q);
          const populatedItems = (q.items || []).map(item => ({
            ...item,
            productCategory: item.productCategory || q.enquiry?.productCategory || 'Valves'
          }));
          setItems(populatedItems);
          
          const initialTech = {
            offerNo: q.quotationId || '',
            offerDate: q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
            customerName: q.customerName || q.customer?.companyName || q.customer?.customerName || q.senderCompany || q.enquiry?.senderCompany || '',
            customerAddress: q.customerAddress || q.customer?.address || q.customer?.city || q.enquiry?.location || '',
            contactNo: q.contactMobile || q.contactNo || q.customer?.mobileNumber || q.customer?.phoneNumber || q.enquiry?.contactMobile || '',
            emailId: q.contactEmail || q.emailId || q.customer?.emailAddress || q.enquiry?.contactEmail || '',
            kindAttention: q.kindAttention || q.customer?.primaryContactName || q.enquiry?.contactPerson || '',
            enquiryRefText: q.enquiryRefText || `Your Enquiry by E-Mail on DT. ${q.enquiry?.createdAt ? new Date(q.enquiry.createdAt).toLocaleDateString('en-GB') : 'N/A'}`,
            projectName: q.projectName || q.enquiry?.projectName || q.enquiry?.subject || '',
            subjectText: q.subjectText || 'Offer for valves as per your requirements.',
            salutationOpeningText: q.salutationOpeningText || 'We acknowledge with thanks the receipt of your above referred enquiry and we are pleased to submit our proposal as under.',
            technicalSpecificationClause: q.technicalSpecificationClause || 'We offered our valves as per Specification given in Contract Review Checklist.',
            technicalDeviations: q.technicalDeviations || 'No deviation / As per client specification'
          };
          setTechFields(initialTech);

          const initialPrice = {
            pricePartNotice: q.pricePartNotice || 'We offer our Valves as below, considering Contract Review Check (Format No. R/S.1.3.5/2 Rev04).',
            ndtRequirementText: q.ndtRequirementText || 'Any NDT Requirement (i.e. RT, UT, MPT) then charges will be Extra at actual to your account.',
            specialTestingRequirementText: q.specialTestingRequirementText || 'If any Special Testing Requirement (i.e. Helium, Nitrogen, Vacuum, IGC, PMI, NACE, Paint) then charges will be Extra at actual to your account.',
            sparesMandayChargesText: q.sparesMandayChargesText || 'Spares, Manday required then charges will be Extra at actual to your account.',
            cert32Terms: q.cert32Terms || 'Extra for 3.2 Certification Charges (5%)',
            cert32Percent: q.cert32Percent !== undefined ? q.cert32Percent : 5,
            pfTerms: q.pfTerms || 'Extra for Packing & Forwarding Charges (5%)',
            pfPercent: q.pfPercent !== undefined ? q.pfPercent : 5,
            tpiaNoticeText: q.tpiaNoticeText || 'Third Party Inspection (TPIA) required then charges will be Extra to your account.'
          };
          setPriceFields(initialPrice);

          const initialComm = {
            priceBasis: q.priceBasis || 'Ex Works Ahmedabad.',
            packingForwardingTerms: q.packingForwardingTerms || 'Extra as given in Price Part - II, If required in wooden box packing & NIL for loose Plastic packing.',
            freightTerms: q.freightTerms || 'Extra at actual to your account.',
            taxDutyTerms: q.taxDutyTerms || 'Extra at actual to your account (18% GST) as given in Price Part - II.',
            validityTerms: q.validityTerms || 'Three Month from the date of Quote',
            tpiTerms: q.tpiTerms || 'We will offer valves to your nominated TPIA, charges towards TPIA fees will be Extra at actual to your account as given in Price Part - II.',
            certificationChargesTerms: q.certificationChargesTerms || 'Extra as given in Price Part - II for 3.2 Certificates.',
            transitInsurance: q.transitInsurance || 'In your scope only.',
            guaranteeTerms: q.guaranteeTerms || '12 months from the date of commissioning or 18 months from the date of last shipment which ever is earlier.',
            paymentTerms: q.paymentTerms || '10% Advance along with PO & 20% with approved QAP & GAD Balance against Performa Invoice prior to dispatch.',
            deliverySchedule: q.deliverySchedule || '12 weeks as per certification from the date of approval of technical documents and advance payment.',
            commercialNotes: q.commercialNotes || 'If RT, UT, PMI, IGC, NACE, Valves or Actuator Spares, Helium & Nitrogen tests required then charges will be extra at actual to your account as given in Price Part - II.\nIf API monogram required then price increase of 25% extra at actual.\nWe offer valves as per API-6D without any QSL requirements, if required in QSL-2 to 4b price increase upto 15% subject to QSL levels.',
            cancellationTerms: q.cancellationTerms || 'PO Cancellation or Modified (qty reduced) charges are as follows:\n• After order acknowledgement - 30%\n• After Manufacturing clearance - 50%\n• After receipt of Raw material - 100%',
            jurisdictionTerms: q.jurisdictionTerms || 'Subject to Ahmedabad Jurisdiction only.',
            signatoryName: q.signatoryName || 'Shubh Patel',
            signatoryDesignation: q.signatoryDesignation || '(Marketing & Projects)',
            signatoryPhone: q.signatoryPhone || '9979713788'
          };
          setCommFields(initialComm);

          savedSnapshotRef.current = JSON.stringify({
            items: populatedItems,
            techFields: initialTech,
            priceFields: initialPrice,
            commFields: initialComm
          });
        }
        
        api.get('/auth/users')
          .then(res => { if (res.data.data?.users) setUsers(res.data.data.users); })
          .catch(err => console.error('Failed to fetch users:', err));

        fetchLiveDiff();
        fetchPricingSuggestions();
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const fetchPricingSuggestions = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/quotations/${id}/pricing-suggestions`);
      if (res.data?.data?.suggestions) {
        setPricingSuggestions(res.data.data.suggestions);
      }
    } catch (err) {
      console.log('Historical pricing suggestions not available:', err?.message);
    }
  };

  const fetchLiveDiff = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/quotations/${id}/diff-since-last-sent`);
      setLiveDiffInfo(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load live diff:', err);
    }
  };

  const handleAddItem = () => {
    const newItem = {
      itemNo: items.length + 1,
      description: 'Valve Item Specification',
      productCategory: 'Valves',
      materialGrade: 'A216 WCB',
      applicableStandard: 'API 6D',
      quantity: 1,
      unit: 'NOS',
      unitPrice: 0,
      ndtCharges: 0,
      specialTestingCharges: 0,
      sparesCharges: 0,
      cert32Charges: 0,
      pfCharges: 0,
      tpiCharges: 0,
      discountPercent: 0,
      lineTotalExclGST: 0,
      dynamicFields: {}
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemPricingChange = (idx, field, val) => {
    const newItems = [...items];
    if (field === 'description' || field === 'productCategory' || field === 'materialGrade' || field === 'applicableStandard' || field === 'unit') {
      newItems[idx][field] = val;
    } else {
      newItems[idx][field] = Number(val) || 0;
    }
    
    // Recalculate item using centralized helper
    newItems[idx] = calculateItemPricing(newItems[idx]);
    setItems(newItems);
  };

  const getCalculatedPricing = () => {
    return calculateQuotationPricing(items, {
      cert32Percent: priceFields.cert32Percent,
      pfPercent: priceFields.pfPercent,
      gstRate: 18,
      tpiCharges: quotation?.tpiCharges || quotation?.commercialTotals?.tpiAmount || quotation?.commercialTotals?.totalInspectionCharges || 0
    });
  };

  const handleMatrixFieldChange = (itemIdx, fieldKey, value) => {
    setItems(prevItems => {
      const updated = [...prevItems];
      const targetItem = { ...updated[itemIdx] };
      const dynamic = { ...(targetItem.dynamicFields || {}) };
      const norm = { ...(targetItem.normalizedSpecifications || {}) };

      dynamic[fieldKey] = value;
      norm[fieldKey] = value;

      // Synchronize key direct properties
      if (fieldKey === 'valve_size') {
        targetItem.size = value;
        dynamic.size = value;
      }
      if (fieldKey === 'valve_class') {
        targetItem.pressureClass = value;
        dynamic.pressure_class = value;
      }
      if (fieldKey === 'valve_body_moc') {
        targetItem.materialGrade = value;
        dynamic.body_material = value;
      }
      if (fieldKey === 'valve_design_std') {
        targetItem.applicableStandard = value;
      }

      targetItem.dynamicFields = dynamic;
      targetItem.normalizedSpecifications = norm;
      updated[itemIdx] = targetItem;
      return updated;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIndices.length === items.length) {
      setSelectedItemIndices([]);
    } else {
      setSelectedItemIndices(items.map((_, i) => i));
    }
  };

  const handleToggleSelectItem = (idx) => {
    setSelectedItemIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleBulkAction = (actionConfig) => {
    const updated = applyBulkPricing(items, actionConfig);
    setItems(updated);
    showToast(`Bulk pricing applied to ${actionConfig.targetIndices?.length || items.length} item(s)!`);
  };

  const handleApplyAiSuggestedPrices = () => {
    if (selectedItemIndices.length === 0) return;
    const updatedItems = [...items];
    let appliedCount = 0;

    selectedItemIndices.forEach(idx => {
      const it = updatedItems[idx];
      if (!it) return;
      const lineId = it.lineItemId || `idx_${idx}`;
      const sugg = pricingSuggestions[lineId] || pricingSuggestions[it.lineItemId] || pricingSuggestions[`idx_${idx}`] || pricingSuggestions[idx];
      if (sugg && sugg.avgPrice > 0) {
        updatedItems[idx] = {
          ...it,
          unitPrice: sugg.avgPrice
        };
        appliedCount++;
      }
    });

    setItems(updatedItems);
    showToast(`Auto-applied AI benchmark avg rates to ${appliedCount} selected item(s)!`, 'success');
  };

  const handleApplyCloning = (cloneConfig) => {
    const updated = applySelectiveSpecCloning(items, cloneConfig);
    setItems(updated);
    showToast(`Specifications cloned to ${cloneConfig.targetIndices?.length || 0} item(s)!`);
  };

  const handleExportPricingExcel = async () => {
    try {
      const res = await api.get(`/quotations/${id}/export-excel`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Quotation_${quotation?.quotationId || id}_Pricing.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      showToast('Pricing spreadsheet downloaded successfully!');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to export Excel', 'error');
    }
  };

  const handleExcelImportSuccess = (updatedQuotation) => {
    setQuotation(updatedQuotation);
    if (updatedQuotation?.items) {
      setItems(updatedQuotation.items);
    }
    showToast('Pricing spreadsheet imported successfully!');
  };

  const saveAllDetails = async () => {
    setUpdateLoading(true);
    const calculated = getCalculatedPricing();
    const payload = {
      items: calculated.items,
      ...techFields,
      contactMobile: techFields.contactNo,
      contactEmail: techFields.emailId,
      customerName: techFields.customerName,
      customerAddress: techFields.customerAddress,
      ...priceFields,
      ...commFields,
      commercialTotals: calculated.commercialTotals
    };
    try {
      const res = await api.patch(`/quotations/${id}/status`, payload);
      setQuotation(res.data.data.quotation);
      if (res.data.data.quotation?.items) {
        setItems(res.data.data.quotation.items);
      }
      savedSnapshotRef.current = JSON.stringify({ items: res.data.data.quotation?.items || items, techFields, priceFields, commFields });
      showToast('Quotation details saved successfully!');
    } catch (err) {
      showToast('Failed to save details: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const [syncLoading, setSyncLoading] = useState(false);

  const handleSyncEnquiryItems = async () => {
    setSyncLoading(true);
    try {
      const res = await api.post(`/quotations/${id}/sync-enquiry`);
      if (res.data?.data?.quotation?.items) {
        setItems(res.data.data.quotation.items);
        setQuotation(res.data.data.quotation);
        savedSnapshotRef.current = JSON.stringify({ items: res.data.data.quotation.items, techFields, priceFields, commFields });
        showToast(res.data.message || 'Successfully extracted items from enquiry!');
      }
    } catch (err) {
      showToast('Failed to sync items: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleUpdate = async (update) => {
    setUpdateLoading(true);
    try {
      const res = await api.patch(`/quotations/${id}/status`, update);
      setQuotation(res.data.data.quotation);
      showToast('Quotation updated successfully!');
    } catch (err) {
      showToast('Update failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleRouteToQc = async () => {
    if (hasUnsavedChanges) {
      showToast('Please save your changes first before routing to QC.', 'error');
      return;
    }
    setUpdateLoading(true);
    try {
      const res = await api.post(`/quotations/${id}/route-to-qc`);
      setQuotation(res.data.data.quotation);
      showToast('Quotation successfully routed to QC Supervisor for Technical Review!', 'success');
    } catch (err) {
      showToast('Failed to route to QC: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleSubmitTechReview = async (notes) => {
    setUpdateLoading(true);
    try {
      const res = await api.post(`/quotations/${id}/submit-tech-review`, { notes });
      setQuotation(res.data.data.quotation);
      setShowWorkflowModal(null);
      showToast('Technical review locked and forwarded to Sales Manager (Checker)!', 'success');
    } catch (err) {
      showToast('Failed to submit technical review: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCheckerReview = async (decision, notes) => {
    setUpdateLoading(true);
    try {
      const res = await api.post(`/quotations/${id}/checker-review`, { decision, notes });
      setQuotation(res.data.data.quotation);
      setShowWorkflowModal(null);
      if (decision === 'APPROVE') {
        showToast('Quotation approved by Checker and forwarded to Director for sign-off!', 'success');
      } else {
        showToast('Quotation returned for revision with comments.', 'warning');
      }
    } catch (err) {
      showToast('Checker review failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDirectorFinalApprove = async (notes) => {
    setUpdateLoading(true);
    try {
      const res = await api.post(`/quotations/${id}/director-approve`, { notes });
      setQuotation(res.data.data.quotation);
      setShowWorkflowModal(null);
      showToast('Quotation officially approved by Director! PDF & Email are now unlocked.', 'success');
    } catch (err) {
      showToast('Director approval failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleUnlockTech = async () => {
    if (!confirm('Unlock technical specifications for editing?')) return;
    setUpdateLoading(true);
    try {
      const res = await api.post(`/quotations/${id}/unlock-tech`);
      setQuotation(res.data.data.quotation);
      showToast('Technical specifications unlocked!', 'success');
    } catch (err) {
      showToast('Failed to unlock: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (hasUnsavedChanges) {
      showToast('Please click "Save Quotation" first before downloading the PDF to prevent mismatch.', 'error');
      return;
    }
    try {
      showToast('Preparing PDF download...', 'success');
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${quotation?.quotationId || 'Quotation'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showToast('PDF download failed: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleGeneratePdf = async () => {
    if (hasUnsavedChanges) {
      showToast('Please click "Save Quotation" first before generating the PDF to prevent data mismatch.', 'error');
      return;
    }
    setUpdateLoading(true);
    try {
      showToast('Generating official modern PDF...', 'success');
      const res = await api.post(`/quotations/${id}/generate-pdf`);
      setQuotation(res.data.data.quotation);
      showToast('Official PDF generated! Opening & downloading...', 'success');
      await handleDownloadPdf();
    } catch (err) {
      showToast('Generation failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Enter rejection reason (optional):');
    await handleUpdate({ status: 'REJECTED', rejectionReason: reason || '' });
  };

  const handleSaveRevision = async () => {
    if (!revisionNote.trim()) return;
    setUpdateLoading(true);
    try {
      const existing = quotation.revisionNotes || [];
      const newNote = { note: revisionNote, addedBy: currentUser.name, addedAt: new Date().toISOString() };
      const res = await api.patch(`/quotations/${id}/status`, { revisionNotes: [...existing, newNote] });
      setQuotation(res.data.data.quotation);
      setRevisionNote('');
      setShowRevisionPanel(false);
      showToast('Revision note added');
    } catch (err) {
      showToast('Failed to save revision', 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
    </div>
  );

  if (!quotation) return <div className="p-8 text-center text-slate-500 font-medium">Quotation not found.</div>;

  const userRoleCode = getRoleCode(currentUser.role);
  const userSecRoleCode = getRoleCode(currentUser.secondaryRole);
  const userRoles = [userRoleCode, userSecRoleCode].filter(Boolean);
  const isDirector = ability.can('approve', 'Quotation');
  const canSeePricing = ability.can('viewPricing', 'Quotation');
  const isApproved = quotation.status === 'APPROVED';
  
  const pricing = getCalculatedPricing();

  const currentSnapshot = JSON.stringify({ items, techFields, priceFields, commFields });
  const hasUnsavedChanges = savedSnapshotRef.current !== null && savedSnapshotRef.current !== currentSnapshot;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Back to List</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{quotation.quotationId || 'Draft'}</h1>
            <StatusBadge status={quotation.status} />
            
            {/* Revision Milestone Badge */}
            <button
              type="button"
              onClick={() => setShowRevisionHistoryModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-full shadow-xs cursor-pointer transition-all"
              title="Click to view full revision history, notes, and change timeline"
            >
              <History className="w-3.5 h-3.5 text-brand-400" />
              {`Rev ${String(quotation.revisionNumber || 0).padStart(2, '0')}`}
            </button>

            {/* Live Unsent Modifications Chip (Editing ≠ Revision) */}
            {liveDiffInfo?.diffResult?.hasChanges && (
              <button
                type="button"
                onClick={() => setShowRevisionHistoryModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs rounded-full shadow-xs cursor-pointer transition-all animate-pulse"
                title="Working draft contains modifications since last customer milestone. Click to review diff."
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                {liveDiffInfo.diffResult.totalChangeCount} working change(s)
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-x-4">
            <span>
              Ref Enquiry:{' '}
              {quotation.enquiry?.enquiryId ? (
                <Link
                  to={`/app/enquiries/${quotation.enquiry._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-700 font-semibold hover:underline ml-1 inline-flex items-center gap-1"
                >
                  {quotation.enquiry.enquiryId}
                  <span className="text-[10px] text-slate-400 font-normal">(opens in new tab)</span>
                </Link>
              ) : (
                'N/A'
              )}
            </span>
            {(quotation.pmcConsultant || quotation.enquiry?.pmcConsultant || techFields.pmcConsultant) && (
              <span>
                PMC / Consultant: <strong className="text-slate-700">{quotation.pmcConsultant || quotation.enquiry?.pmcConsultant || techFields.pmcConsultant}</strong>
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 flex-wrap">
          {updateLoading && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}
          
          <button 
            onClick={saveAllDetails} 
            disabled={updateLoading || isApproved || (!ability.can('editTechnical', 'Quotation') && !ability.can('editCommercial', 'Quotation'))}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer ${
              hasUnsavedChanges 
                ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400 ring-offset-2 shadow-amber-200' 
                : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            <Save className="w-4 h-4" /> {hasUnsavedChanges ? 'Save Changes *' : 'Save Quotation'}
          </button>

          {/* STEP 2 ACTION: Sales routes to QC */}
          {(quotation.status === 'DRAFT' || quotation.status === 'REJECTED' || !quotation.status) && ability.can('routeToQc', 'Quotation') && (
            <button 
              onClick={handleRouteToQc}
              disabled={updateLoading || hasUnsavedChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer"
              title="Forward technical specifications to QC Supervisor for validation"
            >
              <Send className="w-4 h-4" /> Route to QC (QCS)
            </button>
          )}

          {/* STEP 3 ACTION: QC Supervisor validates & locks */}
          {quotation.status === 'TECH_REVIEW' && ability.can('submitTechnicalReview', 'Quotation') && (
            <button 
              onClick={() => { setWorkflowNote(''); setShowWorkflowModal('SUBMIT_QC'); }}
              disabled={updateLoading || hasUnsavedChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer animate-pulse"
              title="Lock technical specs and forward to Sales Manager for Checker review"
            >
              <Shield className="w-4 h-4" /> Validate & Lock Tech Specs
            </button>
          )}

          {/* STEP 4 ACTION: Sales Manager Checker Review */}
          {quotation.status === 'CHECKER_REVIEW' && ability.can('checkerReview', 'Quotation') && (
            <button 
              onClick={() => { setWorkflowNote(''); setCheckerDecision('APPROVE'); setShowWorkflowModal('CHECKER_REVIEW'); }}
              disabled={updateLoading || hasUnsavedChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer"
              title="Review commercial proposal: Approve to Director or Return for correction"
            >
              <CheckCircle2 className="w-4 h-4" /> Checker Review (Approve / Return)
            </button>
          )}

          {/* STEP 5 ACTION: Director Final Approval */}
          {quotation.status === 'PENDING_APPROVAL' && ability.can('approve', 'Quotation') && (
            <button 
              onClick={() => { setWorkflowNote(''); setShowWorkflowModal('DIRECTOR_APPROVE'); }}
              disabled={updateLoading || hasUnsavedChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer animate-bounce"
              title="Director final approval to unlock PDF & Email dispatch"
            >
              <CheckCircle2 className="w-4 h-4" /> Director Final Sign-off
            </button>
          )}

          <button onClick={() => setShowRevisionHistoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer shadow-xs">
            <History className="w-4 h-4 text-brand-600" /> Revision History ({quotation.revisions?.length || 0})
          </button>

          {/* STEP 6 ACTION: 1-Click Client Email Dispatch */}
          <button 
            onClick={() => setShowEmailModal(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer border ${
              isApproved || quotation.status === 'SENT' 
                ? 'bg-brand-600 hover:bg-brand-700 text-white border-transparent' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Send className={`w-4 h-4 ${isApproved || quotation.status === 'SENT' ? 'text-white' : 'text-brand-600'}`} /> Email Quotation
          </button>

          <button 
            onClick={handleGeneratePdf} 
            disabled={updateLoading || hasUnsavedChanges}
            title={hasUnsavedChanges ? 'Please save quotation before generating PDF to prevent mismatch' : 'Generate official PDF'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer ${
              hasUnsavedChanges 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 border border-slate-200' 
                : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
            }`}
          >
            {updateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate PDF
          </button>

          <button 
            onClick={handleDownloadPdf} 
            disabled={updateLoading || hasUnsavedChanges}
            title={hasUnsavedChanges ? 'Please save quotation before viewing PDF to prevent mismatch' : 'Download or view generated PDF'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer ${
              hasUnsavedChanges 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Download className="w-4 h-4 text-slate-600" /> View / Download PDF
          </button>
        </div>
      </div>

      {/* 7-Step Workflow Lifecycle Progress Stepper (SOW Specification) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[840px] gap-2">
          {WORKFLOW_STEPS.map((step, sIdx) => {
            const currentOrder = getStepOrder(quotation.status);
            const isCompleted = currentOrder > step.stepNo || (currentOrder === 6 && step.stepNo === 6);
            const isCurrent = currentOrder === step.stepNo;
            
            return (
              <div key={step.key} className="flex-1 flex items-center gap-1.5">
                <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold transition-all w-full border ${
                  isCurrent 
                    ? 'bg-brand-50 text-brand-900 border-brand-300 ring-2 ring-brand-500/20 shadow-xs' 
                    : isCompleted 
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs' 
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isCurrent 
                      ? 'bg-brand-600 text-white' 
                      : isCompleted 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-300 text-slate-600'
                  }`}>
                    {isCompleted ? '✓' : step.stepNo}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold leading-tight">{step.label}</p>
                    <p className={`text-[10px] font-medium truncate ${isCompleted ? 'text-emerald-700' : isCurrent ? 'text-brand-700' : 'text-slate-400'}`}>
                      {step.by}
                    </p>
                  </div>
                </div>
                {sIdx < WORKFLOW_STEPS.length - 1 && (
                  <span className={`text-xs shrink-0 font-black ${isCompleted ? 'text-emerald-500' : 'text-slate-300'}`}>→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Return Reason Banner (if returned by Checker) */}
      {quotation.returnReason && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs font-bold animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1">
            <span className="font-black text-rose-950 uppercase tracking-wide">Returned for Revision by Checker:</span>
            <p className="text-rose-800 font-medium mt-0.5">{quotation.returnReason}</p>
          </div>
        </div>
      )}

      {/* Technical Locked Banner */}
      {quotation.technicalLocked && (
        <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-2xl text-xs font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-400 shrink-0" />
            <span>Technical Specifications are validated & locked by QC Supervisor. (Parameters are protected against accidental edits).</span>
          </div>
          {ability.can('unlockTechnical', 'Quotation') && (
            <button 
              onClick={handleUnlockTech}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold border border-slate-700 cursor-pointer"
            >
              Unlock Specs
            </button>
          )}
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>You have unsaved changes. Please click <strong>Save Changes</strong> before generating or downloading the PDF to prevent any data mismatch.</span>
          </div>
          <button
            onClick={saveAllDetails}
            disabled={updateLoading}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            Save Now
          </button>
        </div>
      )}

      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 bg-brand-900 text-white`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast.msg}
        </div>
      )}

      {/* 4 Tabs Matching Excel Sheets */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('technical')}
          className={`pb-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'technical'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> 1. Technical Part-I
          </div>
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`pb-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'checklist'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" /> 2. Contract Review Checklist
          </div>
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`pb-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'pricing'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4" /> 3. Price Part-II
          </div>
        </button>
        <button
          onClick={() => setActiveTab('commercial')}
          className={`pb-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'commercial'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> 4. Commercial Part-III
          </div>
        </button>
      </div>

      {activeTab === 'checklist' ? (
        <div className="space-y-6">
          <ContractReviewMatrix
            quotation={quotation}
            items={items}
            onItemFieldChange={handleMatrixFieldChange}
            onOpenCopySpecs={(idx) => setCopySpecsModalState({ isOpen: true, sourceIdx: idx })}
            readOnly={isApproved || !ability.can('editTechnical', 'Quotation')}
            onSave={saveAllDetails}
          />
        </div>
      ) : activeTab === 'pricing' ? (
        <div className="space-y-6">
          {/* Notice / Intro Banner matching Excel Format */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Price Part - II (Commercial Pricing Schedule)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Specify basic pricing, contract review notice, NDT charges, special testing breakdown, and view dynamic specifications.</p>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Contract Review Checklist Notice / Header Statement</label>
              <textarea
                rows={2}
                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                value={priceFields.pricePartNotice}
                onChange={e => setPriceFields({ ...priceFields, pricePartNotice: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
              />
            </div>
          </div>

          {/* Full-Width Line Items Schedule */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Quotation Line Items</h2>
                <p className="text-xs text-slate-500 mt-0.5">{items.length} item(s) in this quotation schedule</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* View Switcher Toggle */}
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPriceViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      priceViewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    Table View
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceViewMode('card')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      priceViewMode === 'card' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Card View
                  </button>
                </div>

                {!isApproved && ability.can('editCommercial', 'Quotation') && (
                  <>
                    <button
                      onClick={handleSyncEnquiryItems}
                      disabled={syncLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all shadow-xs disabled:opacity-50"
                      title="Re-extract line items from linked enquiry emails, products, and attachments"
                    >
                      {syncLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />}
                      Sync from Enquiry
                    </button>
                    <button
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                  </>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-4 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
                  <IndianRupee className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">No Line Items Added Yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    This quotation currently has no line items. Click <strong>Sync / Extract from Enquiry</strong> to automatically load products and BOQ items extracted from emails and attachments, or add manually.
                  </p>
                </div>
                {!isApproved && ability.can('editCommercial', 'Quotation') && (
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <button
                      onClick={handleSyncEnquiryItems}
                      disabled={syncLoading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                    >
                      {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Sync / Extract Items from Enquiry
                    </button>
                    <button
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Manual Item
                    </button>
                  </div>
                )}
              </div>
            ) : priceViewMode === 'table' ? (
              <>
                <PriceTableGrid
                  items={items}
                  pricingSuggestions={pricingSuggestions}
                  selectedIndices={selectedItemIndices}
                  onToggleSelectAll={handleToggleSelectAll}
                  onToggleSelectItem={handleToggleSelectItem}
                  onItemFieldChange={handleItemPricingChange}
                  onRemoveItem={handleRemoveItem}
                  onOpenCopySpecs={(idx) => setCopySpecsModalState({ isOpen: true, sourceIdx: idx })}
                  onExportExcel={handleExportPricingExcel}
                  onOpenImportModal={() => setExcelImportModalOpen(true)}
                  readOnly={isApproved || !ability.can('editCommercial', 'Quotation')}
                />
                
                {/* Floating Bulk Actions Bar */}
                <BulkActionsToolbar
                  selectedIndices={selectedItemIndices}
                  totalItemsCount={items.length}
                  onClearSelection={() => setSelectedItemIndices([])}
                  onApplyBulkAction={handleBulkAction}
                  onOpenCopySpecs={(idx) => setCopySpecsModalState({ isOpen: true, sourceIdx: idx })}
                  onApplyAiSuggestedPrices={handleApplyAiSuggestedPrices}
                />
              </>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => {
                  const unitPrice = item.unitPrice || 0;
                  const ndt = item.ndtCharges || 0;
                  const spec = item.specialTestingCharges || 0;
                  const spares = item.sparesCharges || 0;
                  const cert = item.cert32Charges || 0;
                  const pf = item.pfCharges || 0;
                  const tpi = item.tpiCharges || 0;
                  const discount = item.discountPercent || 0;

                  const unitRate = (unitPrice + ndt + spec + spares + cert + pf + tpi) * (1 - discount / 100);
                  const totalRate = unitRate * (item.quantity || 1);

                  return (
                    <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-600"></div>
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] font-black rounded uppercase">Enquiry Sr. #{item.itemNo || idx + 1}</span>
                            <input
                              type="text"
                              disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                              value={item.description || ''}
                              onChange={e => handleItemPricingChange(idx, 'description', e.target.value)}
                              className="font-bold text-slate-800 text-sm bg-transparent border-b border-slate-200 focus:border-brand-500 outline-none w-full max-w-lg"
                              placeholder="Valve Description / Title"
                            />
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <div>
                              <span className="font-semibold text-slate-400">Category: </span>
                              <input
                                type="text"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.productCategory || 'Valves'}
                                onChange={e => handleItemPricingChange(idx, 'productCategory', e.target.value)}
                                className="bg-transparent border-b border-slate-200 text-slate-700 font-medium text-xs focus:border-brand-500 outline-none w-24"
                              />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400">MOC: </span>
                              <input
                                type="text"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.materialGrade || ''}
                                onChange={e => handleItemPricingChange(idx, 'materialGrade', e.target.value)}
                                className="bg-transparent border-b border-slate-200 text-slate-700 font-medium text-xs focus:border-brand-500 outline-none w-28"
                                placeholder="e.g. A216 WCB"
                              />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400">Standard: </span>
                              <input
                                type="text"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.applicableStandard || ''}
                                onChange={e => handleItemPricingChange(idx, 'applicableStandard', e.target.value)}
                                className="bg-transparent border-b border-slate-200 text-slate-700 font-medium text-xs focus:border-brand-500 outline-none w-24"
                                placeholder="e.g. API 6D"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveItemIndex(idx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            <Sliders className="w-3.5 h-3.5 text-brand-600" /> {ability.can('editTechnical', 'Quotation') ? 'Edit Specs' : 'View Specs'}
                          </button>
                          {!isApproved && ability.can('editCommercial', 'Quotation') && (
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              title="Remove Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {canSeePricing && (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Quantity</label>
                              <input
                                type="number"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.quantity}
                                onChange={e => handleItemPricingChange(idx, 'quantity', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Unit Price (₹)</label>
                                {(() => {
                                  const lineId = item.lineItemId || `idx_${idx}`;
                                  const sugg = pricingSuggestions[lineId] || pricingSuggestions[item.lineItemId] || pricingSuggestions[idx];
                                  if (!sugg) return null;
                                  return (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={sugg.recommendationNote}>
                                      ✨ Range: {sugg.formattedRange}
                                    </span>
                                  );
                                })()}
                              </div>
                              <input
                                type="number"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.unitPrice}
                                onChange={e => handleItemPricingChange(idx, 'unitPrice', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NDT Charges (₹)</label>
                              <input
                                type="number"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.ndtCharges}
                                onChange={e => handleItemPricingChange(idx, 'ndtCharges', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Special Testing (₹)</label>
                              <input
                                type="number"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.specialTestingCharges}
                                onChange={e => handleItemPricingChange(idx, 'specialTestingCharges', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Spares Charges (₹)</label>
                              <input
                                type="number"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.sparesCharges}
                                onChange={e => handleItemPricingChange(idx, 'sparesCharges', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">P&F Charges (₹)</label>
                              <input
                                type="number"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.pfCharges}
                                onChange={e => handleItemPricingChange(idx, 'pfCharges', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">TPIA Charges (₹)</label>
                              <input
                                type="number"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.tpiCharges}
                                onChange={e => handleItemPricingChange(idx, 'tpiCharges', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Discount %</label>
                              <input
                                type="number"
                                disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                value={item.discountPercent}
                                onChange={e => handleItemPricingChange(idx, 'discountPercent', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                            <span className="text-slate-500 font-medium">Calculated Unit Rate: <strong>₹{Math.round(unitRate).toLocaleString()}</strong></span>
                            <span className="font-bold text-slate-900">Line Total: ₹{Math.round(totalRate).toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Section: Left (Clauses + Attachments) & Right (Commercial Summary & Progress) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Special Testing & Extra Surcharges Breakdown Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Special Testing & Extra Charges Clauses (Price Part - II Table)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Customize standard surcharge text statements printed under the line items table in official PDF offers.</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">NDT Requirement Clause</label>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                      value={priceFields.ndtRequirementText}
                      onChange={e => setPriceFields({ ...priceFields, ndtRequirementText: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Special Testing Requirement Clause (Helium, Nitrogen, PMI, NACE, Paint)</label>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                      value={priceFields.specialTestingRequirementText}
                      onChange={e => setPriceFields({ ...priceFields, specialTestingRequirementText: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Spares & Manday Charges Clause</label>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                      value={priceFields.sparesMandayChargesText}
                      onChange={e => setPriceFields({ ...priceFields, sparesMandayChargesText: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">3.2 Certification Charges Clause</label>
                      <input
                        type="text"
                        disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                        value={priceFields.cert32Terms}
                        onChange={e => setPriceFields({ ...priceFields, cert32Terms: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Packing & Forwarding (P&F) Charges Clause</label>
                      <input
                        type="text"
                        disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                        value={priceFields.pfTerms}
                        onChange={e => setPriceFields({ ...priceFields, pfTerms: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Third Party Inspection (TPIA) Notice Clause</label>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                      value={priceFields.tpiaNoticeText}
                      onChange={e => setPriceFields({ ...priceFields, tpiaNoticeText: e.target.value })}
                      className="w-full px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 font-semibold rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Attachments & Files */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                  <File className="w-5 h-5 text-brand-600" /> Attachments & Files
                </h2>
                <AttachmentManager 
                  moduleName="Quotation"
                  entityId={id}
                  uploadedFiles={[...(quotation.attachments || []), ...(quotation.files || [])]}
                  onUploadComplete={(newFile) => {
                     setQuotation(prev => ({ ...prev, files: [...(prev.files || []), newFile] }));
                     handleUpdate({ files: [...(quotation.files || []).map(f => f._id || f), newFile._id] });
                  }}
                  readOnly={isApproved}
                />
              </div>
            </div>

            {/* Right Side Panel in Tab 3 */}
            <div className="space-y-6">
              {/* Commercial Summary */}
              {canSeePricing ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-full opacity-50 -mr-10 -mt-10"></div>
                  <h2 className="text-lg font-bold text-slate-900 mb-6 relative z-10 flex items-center gap-2">
                     <IndianRupee className="w-5 h-5 text-brand-600" /> Commercial Summary
                  </h2>
                  <div className="space-y-3.5 relative z-10 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Subtotal (Excl. GST)</span>
                      <span className="font-bold text-slate-900">₹{Math.round(pricing.baseTotalRateSum).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">3.2 Certification Charges ({pricing.cert32Percent}%)</span>
                      <span className="font-semibold text-slate-800">₹{Math.round(pricing.cert32Amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">P&F Charges ({pricing.pfPercent}%)</span>
                      <span className="font-semibold text-slate-800">₹{Math.round(pricing.pfAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">TPIA Inspection Charges</span>
                      <span className="font-semibold text-slate-800">₹{Math.round(pricing.tpiAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-semibold text-slate-700">
                      <span>Grand Total Before GST</span>
                      <span>₹{Math.round(pricing.grandTotalBeforeGST).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Estimated GST ({pricing.gstRate}%)</span>
                      <span className="font-semibold text-slate-800">₹{Math.round(pricing.gstAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <hr className="border-slate-200" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-900 font-black uppercase tracking-tight">Grand Total</span>
                      <span className="text-xl font-black text-brand-600">₹{Math.round(pricing.grandTotalWithGST).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Workflow Status */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Workflow Progress</h2>
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.preparedBy ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Quotation Prepared</p>
                      <p className="text-xs text-slate-500">{quotation.preparedBy?.fullName || 'Pending'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.technicalReviewBy ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      {quotation.technicalReviewBy ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Technical Review</p>
                      <p className="text-xs text-slate-500">{quotation.technicalReviewBy?.fullName || 'Pending'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : quotation.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-400'}`}>
                      {quotation.status === 'APPROVED' ? <CheckCircle className="w-5 h-5" /> : quotation.status === 'REJECTED' ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Director Approval</p>
                      <p className="text-xs text-slate-500">{quotation.approvedBy?.fullName || 'Final Step'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

          {/* TAB 1: TECHNICAL PART-I (EXACT EXCEL LETTER FORMAT) */}
          {activeTab === 'technical' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Technical Part - I</h2>
                  <p className="text-xs text-slate-500">Matches the exact Excel cover letter & proposal scope format.</p>
                </div>
                <div className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200 self-start sm:self-auto">
                  Format No. R/S.1.3.5/2
                </div>
              </div>

              {/* Offer Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">Offer No.</label>
                  <input
                    type="text"
                    disabled
                    value={techFields.offerNo || quotation.quotationId || 'PV/S/QTN/P-XXX/26-27'}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                    value={techFields.offerDate}
                    onChange={e => setTechFields({ ...techFields, offerDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-brand-500/20 outline-none"
                    placeholder="DD/MM/YYYY"
                  />
                </div>
              </div>

              {/* Customer / Recipient Box */}
              <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">To,</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700 w-10">M/s.</span>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                      value={techFields.customerName}
                      onChange={e => setTechFields({ ...techFields, customerName: e.target.value })}
                      placeholder="Customer / Client Company Name"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                  <div className="pl-12">
                    <textarea
                      rows={2}
                      disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                      value={techFields.customerAddress}
                      onChange={e => setTechFields({ ...techFields, customerAddress: e.target.value })}
                      placeholder="Customer Address / Plant Location"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 pl-12">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap w-24">Contact No:-</span>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                      value={techFields.contactNo}
                      onChange={e => setTechFields({ ...techFields, contactNo: e.target.value })}
                      placeholder="+91 9876543210"
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap w-20">E-Mail ID:-</span>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                      value={techFields.emailId}
                      onChange={e => setTechFields({ ...techFields, emailId: e.target.value })}
                      placeholder="client@domain.com"
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Reference & Subject Block */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <span className="sm:col-span-3 font-bold text-slate-700">Kind Attention :</span>
                  <div className="sm:col-span-9 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Mr.</span>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                      value={techFields.kindAttention}
                      onChange={e => setTechFields({ ...techFields, kindAttention: e.target.value })}
                      placeholder="Contact Person Name"
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <span className="sm:col-span-3 font-bold text-slate-700">Enquiry Reference :</span>
                  <div className="sm:col-span-9">
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                      value={techFields.enquiryRefText}
                      onChange={e => setTechFields({ ...techFields, enquiryRefText: e.target.value })}
                      placeholder="Your Enquiry by E-Mail on DT. ..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <span className="sm:col-span-3 font-bold text-slate-700">Project :</span>
                  <div className="sm:col-span-9">
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                      value={techFields.projectName}
                      onChange={e => setTechFields({ ...techFields, projectName: e.target.value })}
                      placeholder="Project Name / Tender Reference"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-2 border-t border-slate-200/60">
                  <span className="sm:col-span-3 font-bold text-slate-700">Subject :</span>
                  <div className="sm:col-span-9">
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                      value={techFields.subjectText}
                      onChange={e => setTechFields({ ...techFields, subjectText: e.target.value })}
                      placeholder="Offer for valves as per your requirements."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-brand-700 focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Salutation & Proposal Opening */}
              <div className="space-y-2 pt-2">
                <div className="text-sm font-bold text-slate-800">Dear Sir,</div>
                <textarea
                  rows={2}
                  disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                  value={techFields.salutationOpeningText}
                  onChange={e => setTechFields({ ...techFields, salutationOpeningText: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                />
              </div>

              {/* Technical Part - I Scope Header */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-200 mb-5">
                  <h3 className="text-sm font-black text-slate-800 tracking-wider uppercase">TECHNICAL PART – I</h3>
                </div>

                <div className="space-y-4">
                  {/* Bullet 1: Compliance */}
                  <div className="flex items-start gap-3">
                    <span className="text-slate-800 font-bold text-base mt-1.5">•</span>
                    <div className="flex-1">
                      <input
                        type="text"
                        disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                        value={techFields.technicalSpecificationClause}
                        onChange={e => setTechFields({ ...techFields, technicalSpecificationClause: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Bullet 2: Deviations */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-800 font-bold text-base">•</span>
                      <span className="text-sm font-bold text-slate-800">Deviation, If any</span>
                    </div>

                    <div className="pl-6 space-y-2">
                      <textarea
                        rows={4}
                        disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                        value={techFields.technicalDeviations}
                        onChange={e => setTechFields({ ...techFields, technicalDeviations: e.target.value })}
                        placeholder="Enter deviation lines (one per line, e.g. 'No deviation / As per client specification')..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none resize-none font-mono text-xs leading-relaxed"
                      />
                      <p className="text-[11px] text-slate-400">Each new line in the text area will be printed as an official sub-bullet under Deviation in the generated PDF.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMMERCIAL PART-III */}
          {activeTab === 'commercial' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Commercial Part - III (Terms & Conditions)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Customise commercial clauses and legal boundaries shown on Page 4 of the quotation.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Price Basis</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.priceBasis}
                    onChange={e => setCommFields({ ...commFields, priceBasis: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Packing & Forwarding Terms</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.packingForwardingTerms}
                    onChange={e => setCommFields({ ...commFields, packingForwardingTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Freight Terms</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.freightTerms}
                    onChange={e => setCommFields({ ...commFields, freightTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tax & Duty Terms</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.taxDutyTerms}
                    onChange={e => setCommFields({ ...commFields, taxDutyTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Payment Terms</label>
                  <textarea
                    rows={2}
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.paymentTerms}
                    onChange={e => setCommFields({ ...commFields, paymentTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Validity Terms</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.validityTerms}
                    onChange={e => setCommFields({ ...commFields, validityTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Third Party Inspection (TPIA) Terms</label>
                  <textarea
                    rows={2}
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.tpiTerms}
                    onChange={e => setCommFields({ ...commFields, tpiTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Transit Insurance</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.transitInsurance}
                    onChange={e => setCommFields({ ...commFields, transitInsurance: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Guarantee / Warranty Period</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.guaranteeTerms}
                    onChange={e => setCommFields({ ...commFields, guaranteeTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Certification Charges</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.certificationChargesTerms}
                    onChange={e => setCommFields({ ...commFields, certificationChargesTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Delivery Schedule / Timeline</label>
                  <textarea
                    rows={2}
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.deliverySchedule}
                    onChange={e => setCommFields({ ...commFields, deliverySchedule: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                    placeholder="e.g. Within 12 weeks from receipt of technically clear order..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Special Commercial Notes & Standard Clauses</label>
                  <textarea
                    rows={3}
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.commercialNotes}
                    onChange={e => setCommFields({ ...commFields, commercialNotes: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">PO Cancellation or Modification Penalty Charges</label>
                  <textarea
                    rows={3}
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.cancellationTerms}
                    onChange={e => setCommFields({ ...commFields, cancellationTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Legal Jurisdiction Clause</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.jurisdictionTerms}
                    onChange={e => setCommFields({ ...commFields, jurisdictionTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Signatory Person Name</label>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                      value={commFields.signatoryName}
                      onChange={e => setCommFields({ ...commFields, signatoryName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Designation / Department</label>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                      value={commFields.signatoryDesignation}
                      onChange={e => setCommFields({ ...commFields, signatoryDesignation: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Contact Number</label>
                    <input
                      type="text"
                      disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                      value={commFields.signatoryPhone}
                      onChange={e => setCommFields({ ...commFields, signatoryPhone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attachments & Files */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mt-6">
            <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
              <File className="w-5 h-5 text-brand-600" /> Attachments & Files
            </h2>
            <AttachmentManager 
              moduleName="Quotation"
              entityId={id}
              uploadedFiles={[...(quotation.attachments || []), ...(quotation.files || [])]}
              onUploadComplete={(newFile) => {
                 setQuotation(prev => ({ ...prev, files: [...(prev.files || []), newFile] }));
                 handleUpdate({ files: [...(quotation.files || []).map(f => f._id || f), newFile._id] });
              }}
              readOnly={isApproved}
            />
          </div>
        </div>

        {/* SIDE PANEL */}
        <div className="space-y-6">
          {/* Commercial Summary */}
          {canSeePricing ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-full opacity-50 -mr-10 -mt-10"></div>
              <h2 className="text-lg font-bold text-slate-900 mb-6 relative z-10 flex items-center gap-2">
                 <IndianRupee className="w-5 h-5 text-brand-600" /> Commercial Summary
              </h2>
              <div className="space-y-3.5 relative z-10 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Subtotal (Excl. GST)</span>
                  <span className="font-bold text-slate-900">₹{Math.round(pricing.baseTotalRateSum).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">3.2 Certification Charges ({pricing.cert32Percent}%)</span>
                  <span className="font-semibold text-slate-800">₹{Math.round(pricing.cert32Amount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">P&F Charges ({pricing.pfPercent}%)</span>
                  <span className="font-semibold text-slate-800">₹{Math.round(pricing.pfAmount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">TPIA Inspection Charges</span>
                  <span className="font-semibold text-slate-800">₹{Math.round(pricing.tpiAmount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-semibold text-slate-700">
                  <span>Grand Total Before GST</span>
                  <span>₹{Math.round(pricing.grandTotalBeforeGST).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Estimated GST ({pricing.gstRate}%)</span>
                  <span className="font-semibold text-slate-800">₹{Math.round(pricing.gstAmount).toLocaleString('en-IN')}</span>
                </div>
                <hr className="border-slate-200" />
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-900 font-black uppercase tracking-tight">Grand Total</span>
                  <span className="text-xl font-black text-brand-600">₹{Math.round(pricing.grandTotalWithGST).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 flex items-center gap-3 text-slate-500">
              <Lock className="w-5 h-5" />
              <div>
                <p className="text-sm font-bold text-slate-700">Pricing Hidden</p>
                <p className="text-xs">Pricing details are visible to Accounts, Sales, and Directors only.</p>
              </div>
            </div>
          )}

          {/* Revision History */}
          {(quotation.revisionNotes?.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3">Revision History</h3>
              <div className="space-y-3">
                {quotation.revisionNotes.map((rn, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 border border-amber-100">
                    <p className="text-sm font-medium text-slate-700">{rn.note}</p>
                    <p className="text-xs text-slate-400 mt-1">{rn.addedBy} · {new Date(rn.addedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Status */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Workflow Progress</h2>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.preparedBy ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Quotation Prepared</p>
                  <p className="text-xs text-slate-500">{quotation.preparedBy?.fullName || 'Pending'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.technicalReviewBy ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                  {quotation.technicalReviewBy ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Technical Review</p>
                  <p className="text-xs text-slate-500">{quotation.technicalReviewBy?.fullName || 'Pending'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : quotation.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-400'}`}>
                  {quotation.status === 'APPROVED' ? <CheckCircle className="w-5 h-5" /> : quotation.status === 'REJECTED' ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Director Approval</p>
                  <p className="text-xs text-slate-500">{quotation.approvedBy?.fullName || 'Final Step'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* SPECIFICATIONS DRAWER */}
      {activeItemIndex !== null && (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Contract Checklist Specifications</h3>
                <p className="text-xs text-slate-500 mt-0.5">Item {activeItemIndex + 1}: {formatTextToMm(items[activeItemIndex]?.description)}</p>
              </div>
              <button
                onClick={() => setActiveItemIndex(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <DynamicFormRenderer
                formContext="Quotation"
                values={{
                  productCategory: (items[activeItemIndex]?.productCategory && items[activeItemIndex]?.productCategory !== 'Custom')
                    ? items[activeItemIndex].productCategory
                    : (quotation?.enquiry?.productCategory || 'Valves'),
                  ...(items[activeItemIndex]?.dynamicFields || {}),
                  valve_size: items[activeItemIndex]?.dynamicFields?.valve_size || items[activeItemIndex]?.dynamicFields?.size || items[activeItemIndex]?.dynamicFields?.size_mm || items[activeItemIndex]?.dynamicFields?.valveSize || items[activeItemIndex]?.size || undefined,
                  valve_class: items[activeItemIndex]?.dynamicFields?.valve_class || items[activeItemIndex]?.dynamicFields?.class || items[activeItemIndex]?.dynamicFields?.pressure_class || items[activeItemIndex]?.dynamicFields?.valveClass || items[activeItemIndex]?.pressureClass || undefined,
                  valve_type: items[activeItemIndex]?.dynamicFields?.valve_type || items[activeItemIndex]?.dynamicFields?.type || items[activeItemIndex]?.dynamicFields?.valveType || items[activeItemIndex]?.valveType || undefined,
                  valve_moc_body: items[activeItemIndex]?.dynamicFields?.valve_moc_body || items[activeItemIndex]?.dynamicFields?.valve_body_moc || items[activeItemIndex]?.dynamicFields?.moc || items[activeItemIndex]?.dynamicFields?.body_material || items[activeItemIndex]?.dynamicFields?.shellMaterial || items[activeItemIndex]?.materialGrade || undefined,
                  valve_body_moc: items[activeItemIndex]?.dynamicFields?.valve_body_moc || items[activeItemIndex]?.dynamicFields?.valve_moc_body || items[activeItemIndex]?.dynamicFields?.moc || items[activeItemIndex]?.dynamicFields?.body_material || items[activeItemIndex]?.dynamicFields?.shellMaterial || items[activeItemIndex]?.materialGrade || undefined,
                  valve_operating: items[activeItemIndex]?.dynamicFields?.valve_operating || items[activeItemIndex]?.dynamicFields?.operation || items[activeItemIndex]?.dynamicFields?.operating || items[activeItemIndex]?.dynamicFields?.actuation || undefined,
                  valve_end_connection: items[activeItemIndex]?.dynamicFields?.valve_end_connection || items[activeItemIndex]?.dynamicFields?.end_connection || items[activeItemIndex]?.dynamicFields?.endConnection || undefined
                }}
                onChange={(fieldName, value) => {
                  const newItems = [...items];
                  if (!newItems[activeItemIndex].productCategory) {
                    newItems[activeItemIndex].productCategory = quotation?.enquiry?.productCategory || 'Valves';
                  }
                  if (!newItems[activeItemIndex].dynamicFields) {
                    newItems[activeItemIndex].dynamicFields = {};
                  }
                  newItems[activeItemIndex].dynamicFields[fieldName] = value;
                  setItems(newItems);
                }}
                readOnly={isApproved || !ability.can('editTechnical', 'Quotation')}
                currentUserRole={currentUser.role}
              />
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => setActiveItemIndex(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Close & Keep Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailComposerModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        quotationId={id}
        defaultTo={quotation.contactEmail || quotation.customer?.emailAddress || quotation.customer?.email || ''}
        defaultSubject={`Quotation # ${quotation.quotationId} (Rev ${String(quotation.revisionNumber || 0).padStart(2, '0')}) - ${quotation.customerName || 'Offer'}`}
        availableFiles={[...(quotation.files || []), ...(quotation.attachments || [])]}
        onSendSuccess={(updatedQuote) => {
          if (updatedQuote) setQuotation(updatedQuote);
          fetchLiveDiff();
          showToast('Quotation emailed & revision milestone logged!');
        }}
      />

      {/* REVISION HISTORY & CHANGE TIMELINE MODAL */}
      <RevisionHistoryModal
        isOpen={showRevisionHistoryModal}
        onClose={() => setShowRevisionHistoryModal(false)}
        quotationId={id}
        currentQuotation={quotation}
        onRevisionCreated={(updatedQuote) => {
          if (updatedQuote) setQuotation(updatedQuote);
          fetchLiveDiff();
          showToast('Revision milestone created successfully!');
        }}
      />

      {/* BULK ACTIONS TOOLBAR (when items are selected) */}
      <BulkActionsToolbar
        selectedIndices={selectedItemIndices}
        totalItemsCount={items.length}
        onClearSelection={() => setSelectedItemIndices([])}
        onApplyBulkAction={handleBulkAction}
        onOpenCopySpecs={(idx) => setCopySpecsModalState({ isOpen: true, sourceIdx: idx })}
      />

      {/* SELECTIVE SPEC CLONING MODAL */}
      <CopySpecsModal
        isOpen={copySpecsModalState.isOpen}
        onClose={() => setCopySpecsModalState({ isOpen: false, sourceIdx: 0 })}
        sourceItem={items[copySpecsModalState.sourceIdx]}
        sourceIdx={copySpecsModalState.sourceIdx}
        items={items}
        selectedItemIndices={selectedItemIndices}
        onApplyCloning={handleApplyCloning}
      />

      {/* EXCEL IMPORT MODAL */}
      <ExcelImportModal
        isOpen={excelImportModalOpen}
        onClose={() => setExcelImportModalOpen(false)}
        quotationId={id}
        onImportSuccess={handleExcelImportSuccess}
        onExportTemplate={handleExportPricingExcel}
      />

      {/* ── 7-STEP WORKFLOW DECISION MODAL ───────────────────────────────────── */}
      {showWorkflowModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-brand-50 text-brand-600">
                  {showWorkflowModal === 'SUBMIT_QC' && <Shield className="w-5 h-5" />}
                  {showWorkflowModal === 'CHECKER_REVIEW' && <CheckCircle2 className="w-5 h-5 text-purple-600" />}
                  {showWorkflowModal === 'DIRECTOR_APPROVE' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {showWorkflowModal === 'SUBMIT_QC' && 'Validate & Lock Technical Specs'}
                    {showWorkflowModal === 'CHECKER_REVIEW' && 'Sales Manager Checker Review'}
                    {showWorkflowModal === 'DIRECTOR_APPROVE' && 'Director Final Approval'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {showWorkflowModal === 'SUBMIT_QC' && 'QC Supervisor Sign-off (Step 3)'}
                    {showWorkflowModal === 'CHECKER_REVIEW' && 'Commercial & Proposal Check (Step 4)'}
                    {showWorkflowModal === 'DIRECTOR_APPROVE' && 'Executive Sign-off & Unlock (Step 5)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWorkflowModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Checker Decision Selector */}
            {showWorkflowModal === 'CHECKER_REVIEW' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Decision</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCheckerDecision('APPROVE')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-2xl font-bold text-xs border transition-all cursor-pointer ${
                      checkerDecision === 'APPROVE'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Approve & Forward to Director
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckerDecision('RETURN')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-2xl font-bold text-xs border transition-all cursor-pointer ${
                      checkerDecision === 'RETURN'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Return for Revision
                  </button>
                </div>
              </div>
            )}

            {/* Notes / Reason Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {showWorkflowModal === 'CHECKER_REVIEW' && checkerDecision === 'RETURN'
                  ? 'Mandatory Return Comments / Feedback *'
                  : 'Review Notes & Comments (Optional)'}
              </label>
              <textarea
                value={workflowNote}
                onChange={(e) => setWorkflowNote(e.target.value)}
                placeholder={
                  showWorkflowModal === 'SUBMIT_QC'
                    ? 'e.g. All API 6D annexures, hydrostatic shell test, and NDT requirements verified against client datasheets.'
                    : showWorkflowModal === 'CHECKER_REVIEW' && checkerDecision === 'RETURN'
                    ? 'State clearly what items, margins, or terms need to be corrected by Sales/QC...'
                    : showWorkflowModal === 'CHECKER_REVIEW'
                    ? 'Commercial margins, payment terms, and delivery timeline verified.'
                    : 'Director remarks / special dispatch instructions...'
                }
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWorkflowModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              {showWorkflowModal === 'SUBMIT_QC' && (
                <button
                  type="button"
                  onClick={() => handleSubmitTechReview(workflowNote)}
                  disabled={updateLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Shield className="w-4 h-4" /> Lock Specs & Forward to Checker
                </button>
              )}

              {showWorkflowModal === 'CHECKER_REVIEW' && (
                <button
                  type="button"
                  onClick={() => {
                    if (checkerDecision === 'RETURN' && (!workflowNote || workflowNote.trim() === '')) {
                      showToast('Please enter return comments for the sales engineer.', 'error');
                      return;
                    }
                    handleCheckerReview(checkerDecision, workflowNote);
                  }}
                  disabled={updateLoading}
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer ${
                    checkerDecision === 'APPROVE' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {checkerDecision === 'APPROVE' ? 'Approve & Forward to Director' : 'Return for Correction'}
                </button>
              )}

              {showWorkflowModal === 'DIRECTOR_APPROVE' && (
                <button
                  type="button"
                  onClick={() => handleDirectorFinalApprove(workflowNote)}
                  disabled={updateLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve & Unlock Quotation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationDetail;
