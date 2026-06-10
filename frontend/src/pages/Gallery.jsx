import React, { useState, useEffect } from 'react';
import { File, FileText, Image as ImageIcon, Download, Search, Filter, Loader2, Link as LinkIcon, ExternalLink } from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from '../components/AutocompleteSelect';

const Gallery = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  
  const modules = ['Enquiry', 'Quotation', 'QAP', 'FollowUp', 'Temp'];

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (moduleFilter) params.append('module', moduleFilter);
      params.append('limit', 50);

      const res = await api.get(`/files?${params.toString()}`);
      if (res.data.data?.files) {
        setFiles(res.data.data.files);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search slightly
    const timeoutId = setTimeout(() => {
      fetchFiles();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, moduleFilter]);

  const handleDownload = async (fileId, fileName) => {
    setDownloadingId(fileId);
    try {
      const res = await api.get(`/files/${fileId}/download-url`);
      const { url } = res.data.data;
      
      // Open in new tab (secure local storage link)
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to get download link');
    } finally {
      setDownloadingId(null);
    }
  };

  const isImage = (mime) => mime?.startsWith('image/');
  const isPdf = (mime) => mime?.includes('pdf');

  const getFileIcon = (mime) => {
    if (isImage(mime)) return <ImageIcon className="w-10 h-10 text-brand-500" />;
    if (isPdf(mime)) return <FileText className="w-10 h-10 text-red-500" />;
    return <File className="w-10 h-10 text-slate-400" />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gallery & Files</h1>
          <p className="text-sm text-slate-500 mt-1">Global repository of all uploaded documents, drawings, and PDFs.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search files by original name..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-64">
          <AutocompleteSelect
            options={modules}
            value={moduleFilter}
            onChange={v => setModuleFilter(v)}
            placeholder="All Contexts"
            allowClear={true}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white border text-center border-slate-200 rounded-2xl p-12 shadow-sm">
          <File className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No files found</h3>
          <p className="text-slate-500 text-sm mt-2">Try adjusting your filters or uploading completely new files to any module.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {files.map(file => (
            <div key={file._id} className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-brand-300 flex flex-col">
              
              {/* File Preview Area */}
              <div className="h-40 bg-slate-50/80 flex items-center justify-center border-b border-slate-100 p-6 relative overflow-hidden">
                {getFileIcon(file.mimeType)}
                
                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                  <button 
                    onClick={() => handleDownload(file._id, file.originalName)}
                    disabled={downloadingId === file._id}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-900 rounded-lg text-xs font-bold shadow-lg hover:scale-105 transition-transform"
                  >
                    {downloadingId === file._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    Open File
                  </button>
                </div>
              </div>

              {/* File Info */}
              <div className="p-4 flex-1 flex flex-col">
                <p className="font-bold text-slate-800 text-sm mb-1 truncate" title={file.originalName}>
                  {file.originalName}
                </p>
                <div className="flex items-center justify-between text-xs mt-auto">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                    {formatSize(file.size)}
                  </span>
                  <span className="font-semibold text-brand-600">
                    {file.module}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 flex justify-between">
                  <span>{file.uploadedBy?.fullName || 'System'}</span>
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;
