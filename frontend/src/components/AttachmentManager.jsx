import React, { useState, useRef } from 'react';
import { UploadCloud, X, File, Loader2, CheckCircle2, Download } from 'lucide-react';
import api from '../api/client';

const AttachmentManager = ({ moduleName, entityId = null, onUploadComplete, uploadedFiles = [], readOnly = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (readOnly) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files) => {
    setUploading(true);
    
    // We process them sequentially for simplicity and safety, but could use Promise.all
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('module', moduleName);
      if (entityId) formData.append('entityId', entityId);

      try {
        const res = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (onUploadComplete) {
          onUploadComplete(res.data.data.file);
        }
      } catch (err) {
        console.error('File upload failed', err);
        // Could show a toast notification here
      }
    }
    
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadFile = async (fileId, fileName) => {
    try {
      const res = await api.get(`/files/${fileId}/download-url`);
      const { url, fileName: fetchedFileName } = res.data.data;
      
      const fileRes = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([fileRes.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName || fetchedFileName || 'attachment');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download file', err);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Upload Zone */}
      {!readOnly && (
        <div 
          className={`border-2 border-dashed rounded-xl p-6 transition-all text-center ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            multiple 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            disabled={uploading}
          />
          
          <div className="flex flex-col items-center justify-center gap-2 cursor-pointer">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-2">
                <UploadCloud className="w-6 h-6 text-brand-500" />
              </div>
            )}
            <h4 className="text-sm font-bold text-slate-800">
              {uploading ? 'Uploading securely...' : 'Click or drag files here'}
            </h4>
            <p className="text-xs text-slate-500">Stored securely on local server.</p>
          </div>
        </div>
      )}

      {/* File List */}
      {uploadedFiles.length > 0 && (() => {
        // Find latest generated PDF index
        let latestPdfId = null;
        let latestPdfTime = 0;
        
        uploadedFiles.forEach((file) => {
          if (!file) return;
          const fileName = typeof file === 'string' ? file.split('/').pop() : file.fileName || file.originalName || '';
          const isPdf = fileName.toLowerCase().endsWith('.pdf');
          if (isPdf) {
            const time = file.createdAt ? new Date(file.createdAt).getTime() : 0;
            if (time >= latestPdfTime) {
              latestPdfTime = time;
              latestPdfId = typeof file === 'string' ? file : (file._id || fileName);
            }
          }
        });

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {uploadedFiles.map((file, idx) => {
              if (!file) return null;
              const isLegacy = typeof file === 'string';
              const fileName = isLegacy ? file.split('/').pop() : (file.originalName || file.fileName);
              const fileSize = isLegacy ? '' : (file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '');
              const fileId = isLegacy ? null : file._id;
              const createdAt = isLegacy ? null : file.createdAt;

              // Check if file has revision in name or metadata
              const revMatch = fileName.match(/_Rev(\d+)/i) || fileName.match(/Rev\s*(\d+)/i);
              const revLabel = revMatch ? `Rev ${revMatch[1].padStart(2, '0')}` : (file.revisionNumber !== undefined ? `Rev ${String(file.revisionNumber).padStart(2, '0')}` : null);
              
              const isLatestPdf = (isLegacy ? file === latestPdfId : file._id === latestPdfId) && fileName.toLowerCase().endsWith('.pdf');

              return (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isLatestPdf 
                      ? 'border-emerald-300 bg-emerald-50/40 shadow-xs' 
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className={`p-2.5 rounded-xl shrink-0 ${isLatestPdf ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-600'}`}>
                      <File className="w-4 h-4" />
                    </div>
                    <div className="truncate flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-slate-800 truncate" title={fileName}>{fileName}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {revLabel && (
                          <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded">
                            {revLabel}
                          </span>
                        )}
                        {isLatestPdf ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-300">
                            ★ Latest PDF
                          </span>
                        ) : revLabel ? (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-semibold rounded border border-slate-200">
                            Previous Version
                          </span>
                        ) : null}

                        <span className="text-[10px] text-slate-400">
                          {fileSize}
                        </span>

                        {createdAt && (
                          <span className="text-[10px] text-slate-400">
                            • {new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 pl-2">
                    {fileId ? (
                      <button 
                        onClick={(e) => { e.preventDefault(); downloadFile(fileId, fileName); }}
                        className="p-2 rounded-xl hover:bg-white text-slate-500 hover:text-brand-600 border border-transparent hover:border-slate-200 transition-all shadow-xs"
                        title="Download securely"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    ) : (
                      <a 
                        href={file} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 rounded-xl hover:bg-white text-slate-500 hover:text-brand-600 border border-transparent hover:border-slate-200 transition-all shadow-xs"
                        title="Download legacy file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {uploadedFiles.length === 0 && readOnly && (
        <p className="text-sm text-slate-500 italic">No attachments found.</p>
      )}
    </div>
  );
};

export default AttachmentManager;
