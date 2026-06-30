import React, { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Building2, MapPin,
  Calendar, DollarSign, Users, Award, BookOpen, FileText, Layers, ClipboardList
} from 'lucide-react';

const FieldValue = ({ value, label }) => {
  const isEmpty = value === null || value === undefined || value === '' ||
    (Array.isArray(value) && value.length === 0);
  return (
    <div>
      <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">{label}</p>
      {isEmpty ? (
        <p className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="italic">Not found in document</span>
        </p>
      ) : (
        <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          {Array.isArray(value) ? value.join(', ') : String(value)}
        </p>
      )}
    </div>
  );
};

const Section = ({ title, icon: Icon, iconColor = 'text-brand-500', children, defaultOpen = true, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50/80 hover:bg-slate-100/80 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
          <span className="font-bold text-slate-800 text-sm">{title}</span>
          {badge && (
            <span className="text-[10px] font-bold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="p-5 border-t border-slate-100">{children}</div>}
    </div>
  );
};

const TenderIntelligencePanel = ({ tenderIntelligence }) => {
  if (!tenderIntelligence) return null;

  const ti = tenderIntelligence;
  const td = ti.tenderDetails || {};
  const pi = ti.projectInformation || {};
  const sos = ti.scopeOfSupply || {};
  const tl = ti.tenderTimeline || {};
  const ct = ti.commercialTerms || {};
  const qc = ti.qualificationCriteria || {};
  const contacts = ti.contactPersons || [];
  const standards = ti.applicableStandards || [];
  const annexures = ti.annexures || [];
  const sorSchedules = ti.scheduleOfRates || [];
  const summaryBySchedule = ti.productSummaryBySchedule || [];
  const missingFields = ti.missingFields || [];
  const meta = ti.metadata || {};

  const totalSORItems = sorSchedules.reduce((sum, sch) => sum + (sch.items?.length || 0), 0);
  const totalSORQty = sorSchedules.reduce((sum, sch) =>
    sum + (sch.items || []).reduce((s, item) => s + (item.quantity || 0), 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <ClipboardList className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">Tender Intelligence</h2>
            <p className="text-[11px] text-slate-400 font-medium">
              AI-extracted from {meta.sourceFiles?.length || 0} document(s) • Confidence: {meta.extractionConfidence || 0}%
            </p>
          </div>
        </div>
        {missingFields.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} missing
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* 1. Tender Details */}
        <Section title="Tender Details" icon={FileText} iconColor="text-blue-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldValue label="Tender Name" value={td.tenderName} />
            <FieldValue label="Customer" value={td.customer} />
            <FieldValue label="EPCM Consultant" value={td.epcmConsultant} />
            <FieldValue label="Project No" value={td.projectNo} />
            <FieldValue label="GeM Tender No" value={td.gemTenderNo} />
            <FieldValue label="Document No" value={td.documentNo} />
            <FieldValue label="Tender Type" value={td.tenderType} />
            <FieldValue label="Date" value={td.date} />
            <FieldValue label="Industry" value={td.industry} />
            <FieldValue label="Procurement" value={td.procurement} />
          </div>
        </Section>

        {/* 2. Project Information */}
        <Section title="Project Information" icon={Building2} iconColor="text-violet-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldValue label="Project Name" value={pi.projectName} />
            <FieldValue label="Project Scope" value={pi.projectScope} />
            <FieldValue label="Pipelines" value={pi.pipelines} />
            <FieldValue label="Locations" value={pi.locations} />
          </div>
        </Section>

        {/* 3. Scope of Supply */}
        <Section title="Scope of Supply" icon={Layers} iconColor="text-teal-500" defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldValue label="Scope Summary" value={sos.scopeSummary} />
            <FieldValue label="Delivery Terms" value={sos.deliveryTerms} />
            <FieldValue label="Inspection Requirements" value={sos.inspectionRequirements} />
            <FieldValue label="Packaging Requirements" value={sos.packagingRequirements} />
            <FieldValue label="Installation Scope" value={sos.installationScope} />
          </div>
        </Section>

        {/* 4. Schedule of Rates (SOR) */}
        <Section title="Schedule of Rates" icon={ClipboardList} iconColor="text-orange-500"
          badge={`${totalSORItems} items • ${totalSORQty} qty`}>
          {sorSchedules.length === 0 ? (
            <p className="flex items-center gap-2 text-amber-600 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              No SOR table found in the tender documents
            </p>
          ) : (
            <div className="space-y-4">
              {sorSchedules.map((sch, schIdx) => (
                <div key={schIdx} className="border border-slate-100 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-700">{sch.scheduleNo || `Schedule ${schIdx + 1}`}</span>
                    <span className="text-xs text-slate-500 font-medium">{sch.scheduleName || ''} • {sch.items?.length || 0} items</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-25 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          <th className="px-3 py-2 text-left w-8">#</th>
                          <th className="px-3 py-2 text-left">Size</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Body</th>
                          <th className="px-3 py-2 text-left">Ball/Stem</th>
                          <th className="px-3 py-2 text-left">End Conn.</th>
                          <th className="px-3 py-2 text-left">Class</th>
                          <th className="px-3 py-2 text-left">Operation</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(sch.items || []).map((item, itemIdx) => (
                          <tr key={itemIdx} className="hover:bg-blue-50/30 transition-colors text-slate-700">
                            <td className="px-3 py-2 text-slate-400 font-bold">{item.srNo || itemIdx + 1}</td>
                            <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">{item.size || '—'}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate" title={item.description}>{item.description || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.bodyMaterial || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.ballStemMaterial || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.endConnection || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-bold">{item.classRating || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.operationType || '—'}</td>
                            <td className="px-3 py-2 text-right font-black text-brand-600">{item.quantity}</td>
                            <td className="px-3 py-2 text-slate-500">{item.unit || 'Nos.'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Schedule Summary */}
              {summaryBySchedule.length > 0 && (
                <div className="mt-3 bg-slate-50 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Summary by Schedule</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {summaryBySchedule.map((s, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                        <div className="font-bold text-xs text-slate-800">{s.scheduleNo}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {s.totalItems} items • {s.totalQuantity} qty
                          {s.sizeRange && ` • ${s.sizeRange}`}
                          {s.classRange && ` • ${s.classRange}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 5. Tender Timeline */}
        <Section title="Tender Timeline" icon={Calendar} iconColor="text-indigo-500" defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldValue label="Bid Submission Date" value={tl.bidSubmissionDate} />
            <FieldValue label="Bid Opening Date" value={tl.bidOpeningDate} />
            <FieldValue label="Delivery Period" value={tl.deliveryPeriodDays ? `${tl.deliveryPeriodDays} days` : null} />
            <FieldValue label="Warranty Period" value={tl.warrantyPeriod} />
            <FieldValue label="Pre-Dispatch Inspection" value={tl.preDispatchInspection === true ? 'Yes' : tl.preDispatchInspection === false ? 'No' : null} />
            <FieldValue label="Start Date" value={tl.startDate} />
            <FieldValue label="Completion Date" value={tl.completionDate} />
          </div>
        </Section>

        {/* 6. Commercial Terms */}
        <Section title="Commercial Terms" icon={DollarSign} iconColor="text-emerald-500" defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldValue label="EMD Amount" value={ct.emdAmount ? `${ct.emdCurrency || 'INR'} ${ct.emdAmount.toLocaleString()}` : null} />
            <FieldValue label="Bid Validity" value={ct.bidValidity} />
            <FieldValue label="Performance Guarantee" value={ct.performanceGuarantee} />
            <FieldValue label="Liquidated Damages" value={ct.liquidatedDamages} />
            <FieldValue label="Payment Terms" value={ct.paymentTerms} />
            <FieldValue label="Price Variation Clause" value={ct.priceVariationClause} />
            <FieldValue label="Retention Money" value={ct.retentionMoney} />
            <FieldValue label="Security Deposit" value={ct.securityDeposit} />
          </div>
        </Section>

        {/* 7. Contact Persons */}
        <Section title="Contact Persons" icon={Users} iconColor="text-pink-500" defaultOpen={false}
          badge={contacts.length > 0 ? `${contacts.length}` : undefined}>
          {contacts.length === 0 ? (
            <p className="flex items-center gap-2 text-amber-600 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              No contact persons found in the tender documents
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="pb-2 text-left">Name</th>
                    <th className="pb-2 text-left">Designation</th>
                    <th className="pb-2 text-left">Email</th>
                    <th className="pb-2 text-left">Phone</th>
                    <th className="pb-2 text-left">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contacts.map((c, i) => (
                    <tr key={i} className="text-slate-700">
                      <td className="py-2 font-bold">{c.name || '—'}</td>
                      <td className="py-2">{c.designation || '—'}</td>
                      <td className="py-2 text-blue-600">{c.email || '—'}</td>
                      <td className="py-2">{c.phone || '—'}</td>
                      <td className="py-2">{c.department || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 8. Qualification Criteria */}
        <Section title="Qualification Criteria" icon={Award} iconColor="text-yellow-500" defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldValue label="Turnover Requirement" value={qc.turnoverRequirement} />
            <FieldValue label="Experience (Years)" value={qc.experienceYears} />
            <FieldValue label="Similar Work Experience" value={qc.similarWorkExperience} />
            <FieldValue label="ISO Requirements" value={qc.isoRequirements} />
            <FieldValue label="Other Certifications" value={qc.otherCertifications} />
            <FieldValue label="Technical Capability" value={qc.technicalCapability} />
            <FieldValue label="Financial Capability" value={qc.financialCapability} />
          </div>
        </Section>

        {/* 9. Applicable Standards */}
        <Section title="Applicable Standards" icon={BookOpen} iconColor="text-cyan-500" defaultOpen={false}
          badge={standards.length > 0 ? `${standards.length}` : undefined}>
          {standards.length === 0 ? (
            <p className="flex items-center gap-2 text-amber-600 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              No applicable standards found
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {standards.map((std, i) => (
                <span key={i} className="inline-flex items-center rounded-lg bg-cyan-50 border border-cyan-200 px-3 py-1.5 text-xs font-bold text-cyan-800">
                  {std}
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* 10. Annexures */}
        {annexures.length > 0 && (
          <Section title="Annexures / Appendices" icon={FileText} iconColor="text-slate-500" defaultOpen={false}
            badge={`${annexures.length}`}>
            <div className="space-y-2">
              {annexures.map((ann, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-lg px-4 py-2.5">
                  <span className="font-black text-xs text-brand-600 mt-0.5 whitespace-nowrap">{ann.annexureNo}</span>
                  <div>
                    <span className="font-bold text-sm text-slate-800">{ann.title || 'Untitled'}</span>
                    {ann.description && <p className="text-xs text-slate-500 mt-0.5">{ann.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Missing Fields Summary */}
        {missingFields.length > 0 && (
          <Section title="Missing / Not Extracted" icon={AlertTriangle} iconColor="text-amber-500" defaultOpen={false}
            badge={`${missingFields.length}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {missingFields.map((mf, i) => (
                <div key={i} className="flex items-center gap-2 bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-amber-800">{mf.label}</span>
                    <span className="text-[10px] text-amber-600 ml-1.5">— {mf.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Metadata footer */}
        <div className="text-[10px] text-slate-400 font-medium text-right pt-2">
          Extracted at {meta.extractedAt ? new Date(meta.extractedAt).toLocaleString('en-IN') : '—'} •
          {' '}{meta.totalPasses || 0} AI passes •
          {' '}{meta.textLength?.toLocaleString() || 0} chars processed
        </div>
      </div>
    </div>
  );
};

export default TenderIntelligencePanel;
