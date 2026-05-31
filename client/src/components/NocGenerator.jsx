import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, X, Download, Printer, Calendar, Building2, User, GraduationCap,
  CheckCircle, AlertCircle, Info,
} from 'lucide-react';

// ─── NOC Auto-Generator ───────────────────────────────────────────────────
// Generates a printable No Objection Certificate for Vicharanashala
// internship. Uses window.print() with @media print CSS for clean PDF.

const MAX_END_DATE = new Date('2026-12-31');

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d;
}

export default function NocGenerator({ open, onClose }) {
  const [form, setForm] = useState({
    studentName: '',
    collegeName: '',
    department: '',
    hodName: '',
    hodDesignation: 'HOD',
    hodEmail: '',
    startDate: '',
    endDate: '',
    studentSignature: '',
  });
  const [errors, setErrors] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));

    // Auto-compute end date (2 months from start)
    if (key === 'startDate' && value) {
      const end = addMonths(value, 2);
      if (end <= MAX_END_DATE) {
        setForm(prev => ({ ...prev, startDate: value, endDate: end.toISOString().split('T')[0] }));
      }
    }
  };

  const validate = () => {
    const e = {};
    if (!form.studentName.trim()) e.studentName = 'Required';
    if (!form.collegeName.trim()) e.collegeName = 'Required';
    if (!form.department.trim()) e.department = 'Required';
    if (!form.hodName.trim()) e.hodName = 'Required';
    if (!form.startDate) e.startDate = 'Required';
    if (!form.endDate) e.endDate = 'Required';

    if (form.endDate && new Date(form.endDate) > MAX_END_DATE) {
      e.endDate = 'End date must be on or before 31 December 2026';
    }

    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      if (diffMonths > 3) {
        e.endDate = 'Maximum duration is 3 months (2 months + 1 month grace)';
      }
      if (diffMonths < 2) {
        e.endDate = 'Minimum duration is 2 months';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGenerate = () => {
    if (validate()) setShowPreview(true);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('noc-print-area');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>NOC - ${form.studentName}</title>
        <style>
          @page { margin: 2.5cm; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.8; color: #000; margin: 0; padding: 40px; }
          .noc-header { text-align: center; margin-bottom: 30px; }
          .noc-header h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 3px; border-bottom: 2px solid #000; display: inline-block; padding-bottom: 5px; margin-bottom: 10px; }
          .noc-header p { font-size: 12px; color: #555; margin: 4px 0; }
          .noc-body { margin: 20px 0; text-align: justify; }
          .noc-body p { margin: 12px 0; }
          .noc-field { font-weight: bold; text-decoration: underline; }
          .noc-signatures { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
          .noc-sig-block { text-align: center; width: 45%; }
          .noc-sig-block .line { border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; }
          .noc-footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 15px; font-size: 11px; color: #666; }
          .noc-stamp { border: 2px dashed #999; width: 120px; height: 80px; margin: 10px auto; display: flex; align-items: center; justify-content: center; color: #999; font-size: 11px; }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="relative glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-lg border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-outfit text-lg font-bold">NOC Generator</h3>
              <p className="text-[11px] text-gray-500">Generate a printable No Objection Certificate</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {!showPreview ? (
          /* ── Form ── */
          <div className="p-6 flex flex-col gap-5">
            {/* Info banner */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-gray-400 leading-relaxed">
              <Info size={16} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-300 mb-1">NOC Guidelines (from official FAQ):</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                  <li>Get it signed by HOD, Principal, Dean, or T&P Officer</li>
                  <li>Must have handwritten signature + institutional seal/stamp</li>
                  <li>Upload as PDF (max 1MB) on samagama.in dashboard</li>
                  <li>End date must be on or before 31 December 2026</li>
                </ul>
              </div>
            </div>

            {/* Student info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Student Name *</label>
                <input className="input-field" placeholder="Full name as per records" value={form.studentName} onChange={e => update('studentName', e.target.value)} />
                {errors.studentName && <p className="text-[10px] text-warn mt-1">{errors.studentName}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Department *</label>
                <input className="input-field" placeholder="e.g. Computer Science" value={form.department} onChange={e => update('department', e.target.value)} />
                {errors.department && <p className="text-[10px] text-warn mt-1">{errors.department}</p>}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">College / University Name *</label>
              <input className="input-field" placeholder="Full institution name" value={form.collegeName} onChange={e => update('collegeName', e.target.value)} />
              {errors.collegeName && <p className="text-[10px] text-warn mt-1">{errors.collegeName}</p>}
            </div>

            {/* Authority info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Signing Authority Name *</label>
                <input className="input-field" placeholder="HOD / Principal / Dean" value={form.hodName} onChange={e => update('hodName', e.target.value)} />
                {errors.hodName && <p className="text-[10px] text-warn mt-1">{errors.hodName}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Designation</label>
                <select className="input-field" value={form.hodDesignation} onChange={e => update('hodDesignation', e.target.value)}>
                  <option value="HOD">Head of Department</option>
                  <option value="Principal">Principal</option>
                  <option value="Dean">Dean</option>
                  <option value="Director">Director</option>
                  <option value="T&P Officer">Training & Placement Officer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Authority's Official Email</label>
              <input className="input-field" type="email" placeholder="institutional email (not personal Gmail)" value={form.hodEmail} onChange={e => update('hodEmail', e.target.value)} />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
                  <Calendar size={11} /> Start Date *
                </label>
                <input className="input-field" type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} min="2026-05-01" max="2026-10-31" />
                {errors.startDate && <p className="text-[10px] text-warn mt-1">{errors.startDate}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
                  <Calendar size={11} /> End Date *
                </label>
                <input className="input-field" type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} max="2026-12-31" />
                {errors.endDate && <p className="text-[10px] text-warn mt-1">{errors.endDate}</p>}
                <p className="text-[10px] text-gray-600 mt-1">2 months + 1 month grace max. Must end by 31 Dec 2026.</p>
              </div>
            </div>

            {/* Generate button */}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="btn-ghost">Cancel</button>
              <button onClick={handleGenerate} className="btn-primary flex items-center gap-2">
                <FileText size={14} />
                Generate NOC
              </button>
            </div>
          </div>
        ) : (
          /* ── Preview ── */
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowPreview(false)} className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer flex items-center gap-1">
                ← Back to edit
              </button>
              <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
                <Printer size={14} />
                Print / Save as PDF
              </button>
            </div>

            {/* Print area */}
            <div className="bg-white rounded-xl p-8 text-black" id="noc-print-area">
              <div className="noc-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '18px', textTransform: 'uppercase', letterSpacing: '3px', borderBottom: '2px solid #000', display: 'inline-block', paddingBottom: '5px', margin: '0 0 8px', fontWeight: 'bold' }}>
                  No Objection Certificate
                </h1>
                <p style={{ fontSize: '12px', color: '#555', margin: '4px 0' }}>{form.collegeName}</p>
                <p style={{ fontSize: '12px', color: '#555', margin: '4px 0' }}>Department of {form.department}</p>
              </div>

              <div style={{ textAlign: 'justify', lineHeight: '2', fontSize: '14px', fontFamily: "'Times New Roman', Times, serif" }}>
                <p style={{ margin: '0 0 16px', textAlign: 'right', fontSize: '13px', color: '#555' }}>
                  Date: _______________
                </p>

                <p style={{ margin: '12px 0' }}>To,</p>
                <p style={{ margin: '0 0 4px' }}>Prof. Sudarshan Iyengar</p>
                <p style={{ margin: '0 0 4px' }}>Vicharanashala Lab for Education Design</p>
                <p style={{ margin: '0 0 16px' }}>Indian Institute of Technology Ropar</p>

                <p style={{ margin: '16px 0' }}>
                  Subject: <strong>No Objection Certificate for Summer Internship 2026</strong>
                </p>

                <p style={{ margin: '16px 0' }}>Dear Sir,</p>

                <p style={{ margin: '16px 0' }}>
                  This is to certify that <strong style={{ textDecoration: 'underline' }}>{form.studentName}</strong>,
                  a student of the Department of <strong>{form.department}</strong> at <strong>{form.collegeName}</strong>,
                  has been granted permission by the undersigned to undertake the Vicharanashala Summer Internship 2026
                  (VINS programme) under your supervision.
                </p>

                <p style={{ margin: '16px 0' }}>
                  The period of internship shall be from <strong>{formatDate(form.startDate)}</strong> to <strong>{formatDate(form.endDate)}</strong>.
                  This institution has no objection to the above-named student participating in this programme
                  during the said period.
                </p>

                <p style={{ margin: '16px 0' }}>
                  We understand that this is a full-time internship requiring six to ten hours per day,
                  and the student will not have any conflicting academic commitments during this period.
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
                  <div style={{ textAlign: 'center', width: '40%' }}>
                    <div style={{ borderTop: '1px solid #000', marginTop: '50px', paddingTop: '5px' }}>
                      {form.studentName}
                    </div>
                    <p style={{ fontSize: '12px', color: '#555', margin: '4px 0' }}>Student Signature</p>
                  </div>
                  <div style={{ textAlign: 'center', width: '40%' }}>
                    <div style={{ border: '2px dashed #999', width: '100px', height: '60px', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '11px' }}>
                      Institutional Seal
                    </div>
                    <div style={{ borderTop: '1px solid #000', marginTop: '5px', paddingTop: '5px' }}>
                      {form.hodName}
                    </div>
                    <p style={{ fontSize: '12px', color: '#555', margin: '4px 0' }}>{form.hodDesignation}</p>
                    {form.hodEmail && <p style={{ fontSize: '11px', color: '#555', margin: '2px 0' }}>Email: {form.hodEmail}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-lg bg-secondary/5 border border-secondary/15 text-xs text-gray-400">
              <AlertCircle size={13} className="text-secondary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-300">Next steps:</p>
                <ol className="list-decimal list-inside space-y-0.5 mt-1 text-gray-500">
                  <li>Print this document</li>
                  <li>Get your {form.hodDesignation}'s handwritten signature + institutional seal</li>
                  <li>Scan the signed document as PDF (max 1MB)</li>
                  <li>Upload on your dashboard at samagama.in</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
