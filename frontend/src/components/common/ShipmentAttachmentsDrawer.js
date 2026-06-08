import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  XMarkIcon, PaperClipIcon, ArrowDownTrayIcon, TrashIcon,
  DocumentIcon, PhotoIcon, TableCellsIcon,
} from '@heroicons/react/24/outline';

function fileIcon(mime = '') {
  if (mime.startsWith('image/'))        return <PhotoIcon className="w-4 h-4 text-blue-400" />;
  if (mime.includes('pdf'))             return <DocumentIcon className="w-4 h-4 text-red-400" />;
  if (mime.includes('sheet') || mime.includes('excel'))
                                        return <TableCellsIcon className="w-4 h-4 text-green-400" />;
  return <DocumentIcon className="w-4 h-4 text-slate-400" />;
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ShipmentAttachmentsDrawer({ shipment, onClose }) {
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef                 = useRef(null);

  const load = useCallback(async () => {
    if (!shipment) return;
    setLoading(true);
    try {
      const res = await api.get(`/shipments/${shipment.id}/attachments`);
      setFiles(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [shipment]);

  useEffect(() => { load(); }, [load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const upload = async (selectedFiles) => {
    if (!selectedFiles.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(selectedFiles).forEach(f => fd.append('files', f));
      await api.post(`/shipments/${shipment.id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} uploaded`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const remove = async (att) => {
    if (!window.confirm(`Delete "${att.filename}"?`)) return;
    try {
      await api.delete(`/shipments/${shipment.id}/attachments/${att.id}`);
      toast.success('Deleted');
      setFiles(prev => prev.filter(f => f.id !== att.id));
    } catch (_) { toast.error('Failed to delete'); }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files);
  };

  const apiBase = process.env.REACT_APP_API_URL || '';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-navy-900 shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <PaperClipIcon className="w-5 h-5 text-gold-500 flex-shrink-0" />
              Attachments
            </h2>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 truncate">
              {shipment.reference || shipment.booking_no || shipment.id}
              {shipment.pol && shipment.pod && ` · ${shipment.pol} → ${shipment.pod}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors flex-shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          className={`mx-4 mt-4 border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-gold-400 bg-gold-50 dark:bg-gold-900/20'
              : 'border-slate-300 dark:border-navy-600 hover:border-gold-400 dark:hover:border-gold-500'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <PaperClipIcon className="w-7 h-7 mx-auto text-slate-400 dark:text-gray-500 mb-2" />
          {uploading ? (
            <p className="text-sm text-gold-600 dark:text-gold-400 font-medium">Uploading…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">
                {dragging ? 'Drop to upload' : 'Click or drag & drop files'}
              </p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Any file type · max 20 MB each</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={e => { upload(e.target.files); e.target.value = ''; }} />

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="space-y-2 mt-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-navy-800 animate-pulse" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <PaperClipIcon className="w-10 h-10 text-slate-200 dark:text-navy-700 mb-2" />
              <p className="text-sm text-slate-400 dark:text-gray-600">No attachments yet</p>
              <p className="text-xs text-slate-300 dark:text-gray-700 mt-0.5">Upload files using the zone above</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {files.map(att => (
                <li key={att.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:border-gold-300 dark:hover:border-gold-700 transition-colors group">
                  <div className="flex-shrink-0">{fileIcon(att.mime)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate">{att.filename}</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                      {fmtSize(att.size)}
                      {att.uploaded_by_name && ` · ${att.uploaded_by_name}`}
                      {att.created_at && ` · ${new Date(att.created_at).toLocaleDateString('en-GB')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={`${apiBase}${att.url}`} target="_blank" rel="noreferrer" download={att.filename}
                      aria-label={`Download ${att.filename}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </a>
                    <button onClick={() => remove(att)} aria-label={`Delete ${att.filename}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer count */}
        {files.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-navy-800 text-xs text-slate-400 dark:text-gray-500">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </>
  );
}
