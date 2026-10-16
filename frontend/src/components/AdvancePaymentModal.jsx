import React, { useState } from 'react';
import { X, CheckCircle2, Loader2, IndianRupee, ShieldCheck } from 'lucide-react';
import api from '../api/client';

export default function AdvancePaymentModal({ proformaInvoice, workOrder, isOpen, onClose, onSuccess }) {
  if (!isOpen || !proformaInvoice) return null;

  const today = new Date().toISOString().split('T')[0];
  const expectedAmount = proformaInvoice.grandTotal || 0;

  const [paymentReference, setPaymentReference] = useState('');
  const [amount, setAmount] = useState(expectedAmount);
  const [paymentDate, setPaymentDate] = useState(today);
  const [bankName, setBankName] = useState('HDFC BANK');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!paymentReference.trim()) {
      setError('Payment Reference / UTR Number is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        proformaInvoiceId: proformaInvoice._id,
        amount: Number(amount),
        paymentDate,
        paymentReference: paymentReference.trim(),
        bankName,
        notes
      };

      const res = await api.post('/order-acceptances/record-advance', payload);
      if (onSuccess) {
        onSuccess(res.data.data);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to record advance payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-300 border border-emerald-500/30">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Record 10% Advance Payment</h2>
              <p className="text-xs text-emerald-200/80 font-medium">Stage 2: Clears Advance Gate to unlock GAD & QAP Submittals</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {/* Reference Info */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">PI Reference</span>
              <p className="text-sm font-black text-slate-900">{proformaInvoice.piNumber}</p>
              <p className="text-[11px] text-slate-500 font-medium">PO #{proformaInvoice.customerPoNumber}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Expected 10% Advance</span>
              <p className="text-base font-black text-emerald-700">₹{expectedAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Bank UTR / Transaction No. <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. HDFCR5202610070014285"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Amount Received (INR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Payment Received Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Remitting Bank / Mode
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. HDFC Bank RTGS / SBI NEFT"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Remarks / Verification Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Verified in HDFC Current A/c statements..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
            />
          </div>

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
              Confirm Advance Received
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
