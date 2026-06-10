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
      const { url } = res.data.data;
      
      // Open signed URL in new tab directly (AWS will handle content-disposition usually)
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to get download URL', err);
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
      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {uploadedFiles.map((file, idx) => {
            // Support both old string URLs and new FileMetadata objects
            const isLegacy = typeof file === 'string';
            const fileName = isLegacy ? file.split('/').pop() : file.fileName;
            const fileSize = isLegacy ? '' : (file.size / 1024 / 1024).toFixed(2) + ' MB';
            const fileId = isLegacy ? null : file._id;

            return (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-brand-50 text-brand-600 rounded-lg shrink-0">
                    <File className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 truncate" title={fileName}>{fileName}</p>
                    <p className="text-[10px] text-slate-500">{fileSize || 'Legacy attachment'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 pl-2">
                  {fileId ? (
                    <button 
                      onClick={(e) => { e.preventDefault(); downloadFile(fileId, fileName); }}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-brand-600 transition-colors"
                      title="Download securely"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  ) : (
                    <a 
                      href={file} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-brand-600 transition-colors"
                      title="Download legacy file"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  {/* We could add delete logic here if not readOnly */}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {uploadedFiles.length === 0 && readOnly && (
        <p className="text-sm text-slate-500 italic">No attachments found.</p>
      )}
    </div>
  );
};

export default AttachmentManager;
