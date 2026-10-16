import React, { useState } from 'react';
import { X, FileText, CheckCircle2, Download, ArrowRight, Loader2, IndianRupee, ShieldCheck } from 'lucide-react';
import api from '../api/client';

export default function OrderAcceptanceModal({ quotation, isOpen, onClose, onSuccess }) {
  if (!isOpen || !quotation) return null;

  const today = new Date().toISOString().split('T')[0];
  const defaultDelivery = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [customerPoNumber, setCustomerPoNumber] = useState('');
  const [customerPoDate, setCustomerPoDate] = useState(today);
  const [customerDeliveryDate, setCustomerDeliveryDate] = useState(defaultDelivery);
  const [tpiaScope, setTpiaScope] = useState('Self');
  const [tpiaAgencyName, setTpiaAgencyName] = useState('');
  const [ldApplicable, setLdApplicable] = useState(false);
  const [termsOfPayment, setTermsOfPayment] = useState('10% Advance along with PO, Balance against Proforma Invoice / Dispatch.');
  const [priceBasis, setPriceBasis] = useState('Ex Works Ahmedabad');
  const [deliveryTerms, setDeliveryTerms] = useState('4-6 Weeks from receipt of order & approved GAD/QAP.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  const subtotal = Number(
    quotation.commercialTotals?.subtotalExclGST ||
    quotation.commercialTotals?.grandTotalBeforeGST ||
    quotation.subtotal ||
    (quotation.items || []).reduce((sum, it) => sum + (Number(it.lineTotalExclGST) || (Number(it.quantity || 1) * Number(it.unitPrice || it.unitRate || 0))), 0) ||
    quotation.commercialTotals?.grandTotal ||
    quotation.grandTotal ||
    0
  );
  const advanceAmount = Math.round(subtotal * 0.10);
  const advanceGst = Math.round(advanceAmount * 0.18);
  const advanceTotal = advanceAmount + advanceGst;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerPoNumber.trim()) {
      setError('Customer PO Number is required.');
      return;
    }
    if (!customerDeliveryDate) {
      setError('Customer Delivery Date (CDD) is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        quotationId: quotation._id,
        customerPoNumber: customerPoNumber.trim(),
        customerPoDate,
        customerDeliveryDate,
        tpiaScope,
        tpiaAgencyName: tpiaScope === 'Third Party' ? tpiaAgencyName : '',
        ldApplicable,
        termsOfPayment,
        priceBasis,
        deliveryTerms
      };

      const res = await api.post('/order-acceptances/from-po', payload);
      setSuccessData(res.data.data);
      if (onSuccess) {
        onSuccess(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create Order Acceptance');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOaPdf = async () => {
    if (!successData?.orderAcceptance?._id) return;
    const token = localStorage.getItem('token') || '';
    window.open(`/api/order-acceptances/${successData.orderAcceptance._id}/pdf?token=${encodeURIComponent(token)}`, '_blank');
  };

  const handleDownloadPiPdf = async () => {
    if (!successData?.proformaInvoice?._id) return;
    const token = localStorage.getItem('token') || '';
    window.open(`/api/order-acceptances/proforma-invoice/${successData.proformaInvoice._id}/pdf?token=${encodeURIComponent(token)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-300 border border-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Record Customer PO & Generate Order Documents</h2>
              <p className="text-xs text-indigo-200/80 font-medium">Stage 1: Generates Order Acceptance (OA), 10% Advance PI & Work Order</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {successData ? (
            /* Success View */
            <div className="space-y-5 py-3 text-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Order Acceptance & 10% Advance PI Generated!</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Customer PO #{customerPoNumber} has been recorded. Work Order <strong>{successData.workOrder?.workOrderId}</strong> is drafted in Stage 1 awaiting 10% advance clearance.
                </p>
              </div>

              {/* Generated Docs Action Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Order Acceptance</span>
                    <p className="text-sm font-black text-slate-900">{successData.orderAcceptance?.oaNumber}</p>
                  </div>
                  <button
                    onClick={handleDownloadOaPdf}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download OA PDF
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">10% Advance Proforma Invoice</span>
                    <p className="text-sm font-black text-slate-900">{successData.proformaInvoice?.piNumber} (₹{successData.proformaInvoice?.grandTotal?.toLocaleString('en-IN')})</p>
                  </div>
                  <button
                    onClick={handleDownloadPiPdf}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download 10% PI PDF
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Close & Refresh Quotation
                </button>
              </div>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Order Advance Preview Banner */}
              <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">Basic Order Value</span>
                  <p className="text-lg font-black text-slate-900">₹{subtotal.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">10% Advance Payable (Incl. 18% GST)</span>
                  <p className="text-lg font-black text-emerald-700">₹{advanceTotal.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-500 font-medium">(Basic: ₹{advanceAmount.toLocaleString('en-IN')} + GST: ₹{advanceGst.toLocaleString('en-IN')})</p>
                </div>
              </div>

              {/* Grid 1: PO Number & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Customer PO Number <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomerPoNumber('PTIS/HT/2026-27/JULY/47')}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                      title="Click to fill test PO number"
                    >
                      Fill Sample PO
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={customerPoNumber}
                    onChange={(e) => setCustomerPoNumber(e.target.value)}
                    placeholder="e.g. PTIS/HT/2026-27/JULY/47"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Client's PO ref from order email (or click 'Fill Sample PO')
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Customer PO Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={customerPoDate}
                    onChange={(e) => setCustomerPoDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Agreed Delivery Date (CDD) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={customerDeliveryDate}
                    onChange={(e) => setCustomerDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Grid 2: Inspection & LD */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Inspection (TPIA) Scope
                  </label>
                  <select
                    value={tpiaScope}
                    onChange={(e) => setTpiaScope(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Self">Self (Internal PVPL QC)</option>
                    <option value="Client">Client Representative</option>
                    <option value="Third Party">Third Party Inspection (TPIA)</option>
                  </select>
                </div>

                {tpiaScope === 'Third Party' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      TPI Agency Name
                    </label>
                    <input
                      type="text"
                      value={tpiaAgencyName}
                      onChange={(e) => setTpiaAgencyName(e.target.value)}
                      placeholder="e.g. TUV India / BV / DNV"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Liquidated Damages (LD)
                    </label>
                    <select
                      value={ldApplicable ? 'Yes' : 'No'}
                      onChange={(e) => setLdApplicable(e.target.value === 'Yes')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="No">No (Standard Delivery)</option>
                      <option value="Yes">Yes (LD Applicable)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Price Basis
                  </label>
                  <input
                    type="text"
                    value={priceBasis}
                    onChange={(e) => setPriceBasis(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Terms of Payment */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Agreed Payment Terms
                </label>
                <input
                  type="text"
                  value={termsOfPayment}
                  onChange={(e) => setTermsOfPayment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate Order Acceptance & 10% PI
                </button>
              </div>

            </form>
          )}

        </div>
      </div>
    </div>
  );
}
