import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { X, UploadCloud, CheckCircle, Shield, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login', 'register', 'verify'
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('intern'); // 'intern' or 'faculty'
  
  // Verification State
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [verificationResult, setVerificationResult] = useState(null); // 'success' | 'failed'
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const resetState = () => {
    setMode('login');
    setName(''); setEmail(''); setPassword(''); setRole('intern');
    setFile(null); setPreviewUrl(null); setScanning(false);
    setScanProgress(0); setVerificationResult(null); setError('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.type.startsWith('image/') || selected.type === 'application/pdf') {
        setFile(selected);
        setVerificationResult(null);
        setError('');
        
        if (selected.type === 'application/pdf') {
          // Render first page as preview
          try {
            const arrayBuffer = await selected.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            setPreviewUrl(canvas.toDataURL());
          } catch (err) {
            console.error('PDF Render error:', err);
            setPreviewUrl(null); // Just show upload icon if rendering fails
          }
        } else {
          setPreviewUrl(URL.createObjectURL(selected));
        }
      } else {
        setError('Please upload a valid image (JPG/PNG) or PDF file.');
      }
    }
  };

  const runOCR = async () => {
    if (!file) return;
    setScanning(true);
    setVerificationResult(null);
    
    try {
      let text = '';
      
      if (file.type === 'application/pdf') {
        setScanProgress(30);
        // Extract text directly from PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        text = textContent.items.map(item => item.str).join(' ').toLowerCase();
        setScanProgress(70);

        // Fallback to OCR if PDF has no selectable text (scanned PDF)
        if (text.trim().length < 20) {
          const result = await Tesseract.recognize(previewUrl || file, 'eng', {
            logger: m => {
              if (m.status === 'recognizing text') {
                setScanProgress(Math.floor(m.progress * 100));
              }
            }
          });
          text = result.data.text.toLowerCase();
        }
      } else {
        const result = await Tesseract.recognize(file, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              setScanProgress(Math.floor(m.progress * 100));
            }
          }
        });
        text = result.data.text.toLowerCase();
      }
      
      // Check for key elements of the Vicharanashala offer letter
      const hasVicharanashala = text.includes('vicharanashala') || text.includes('vled');
      const hasOffer = text.includes('offer of summer internship') || text.includes('summer internship 2026');
      const hasAcceptance = text.includes('acceptance of offer') || text.includes('formally accept the offer');

      if (hasVicharanashala && (hasOffer || hasAcceptance)) {
        setVerificationResult('success');
      } else {
        setVerificationResult('failed');
        setError("Could not verify document. Ensure it is a valid Vicharanashala offer letter.");
      }
    } catch (err) {
      console.error(err);
      setVerificationResult('failed');
      setError("Failed to scan the document. Please try again or upload a clearer image.");
    } finally {
      setScanning(false);
      setScanProgress(100);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        handleClose();
      } else if (mode === 'register' || mode === 'verify') {
        if (role === 'intern' && verificationResult !== 'success') {
          // Move to verification step
          setMode('verify');
        } else {
          // Finalize registration
          await register({
            name, email, password, role,
            is_verified: role === 'faculty' ? 0 : 1 // Faculty manual verification later, interns instant via OCR
          });
          handleClose();
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden bg-slate-900 border border-slate-700/50 shadow-2xl rounded-2xl"
        >
          {/* Top Decorative Glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />
          
          <button 
            onClick={handleClose}
            className="absolute p-2 text-slate-400 transition-colors top-3 right-3 hover:text-white rounded-full hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Join the Community' : 'Verify Identity'}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {mode === 'login' 
                  ? 'Sign in to ask questions and earn SP points.' 
                  : mode === 'register' 
                    ? 'Create your account to start contributing.'
                    : 'Upload your offer letter to unlock intern privileges.'}
              </p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-start p-3 mb-6 text-sm text-red-200 border rounded-lg bg-red-500/10 border-red-500/20"
              >
                <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {mode === 'verify' ? (
              <div className="space-y-6">
                {/* OCR Upload Area */}
                <div 
                  onClick={() => !scanning && fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center p-8 transition-all border-2 border-dashed rounded-xl ${
                    verificationResult === 'success' ? 'border-green-500/50 bg-green-500/5' :
                    verificationResult === 'failed' ? 'border-red-500/50 bg-red-500/5' :
                    scanning ? 'border-blue-500/50 bg-blue-500/5' :
                    'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 cursor-pointer'
                  }`}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf" className="hidden" />
                  
                  {previewUrl ? (
                    <div className="relative w-full h-32 mb-4 overflow-hidden rounded-lg bg-slate-900">
                      <img src={previewUrl} alt="Offer Letter" className="object-cover w-full h-full opacity-50" />
                      
                      {scanning && (
                        <motion.div 
                          initial={{ top: 0 }}
                          animate={{ top: '100%' }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-10"
                        />
                      )}
                      
                      {verificationResult === 'success' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm">
                          <CheckCircle className="w-12 h-12 text-green-400 drop-shadow-md" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <UploadCloud className="w-12 h-12 mb-3 text-slate-400" />
                  )}

                  {scanning ? (
                    <div className="w-full text-center">
                      <div className="flex items-center justify-center mb-2 space-x-2 text-blue-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Scanning Document ({scanProgress}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                      </div>
                    </div>
                  ) : verificationResult === 'success' ? (
                    <span className="text-sm font-medium text-green-400">Verification Successful</span>
                  ) : (
                    <span className="text-sm font-medium text-slate-300">
                      {previewUrl ? 'Click to change image' : 'Upload Offer Letter Image'}
                    </span>
                  )}
                </div>

                {previewUrl && verificationResult !== 'success' && !scanning && (
                  <button 
                    onClick={runOCR}
                    className="w-full py-3 text-sm font-semibold text-white transition-all bg-blue-600 rounded-lg hover:bg-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  >
                    Run AI Verification
                  </button>
                )}

                {verificationResult === 'success' && (
                  <button 
                    onClick={handleSubmit}
                    className="flex items-center justify-center w-full py-3 space-x-2 text-sm font-semibold text-slate-900 transition-all rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Complete Registration</span>
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <>
                    <div className="flex p-1 space-x-1 border rounded-lg bg-slate-800/50 border-slate-700/50">
                      <button
                        type="button"
                        onClick={() => setRole('intern')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'intern' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Intern
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('faculty')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'faculty' ? 'bg-purple-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Faculty
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Full Name</label>
                      <input
                        type="text" required
                        value={name} onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                        placeholder="John Doe"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Email Address</label>
                  <input
                    type="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Password</label>
                  <input
                    type="password" required minLength="6"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                    placeholder="••••••••"
                  />
                </div>

                <button 
                  type="submit" disabled={loading}
                  className="flex items-center justify-center w-full py-3 mt-4 space-x-2 text-sm font-semibold text-white transition-all bg-blue-600 rounded-lg disabled:opacity-50 hover:bg-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  <span>{mode === 'login' ? 'Sign In' : role === 'intern' ? 'Continue to Verification' : 'Create Account'}</span>
                </button>
              </form>
            )}

            {mode !== 'verify' && (
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                  <button 
                    onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                    className="font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
