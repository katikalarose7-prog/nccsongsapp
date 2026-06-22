import React, { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { bulkImport, downloadTemplate } from '../../services/api';

export default function BulkImport() {
  const [drag, setDrag]     = useState(false);
  const [file, setFile]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) {
      toast.error('Please upload an Excel (.xlsx/.xls) or CSV file'); return;
    }
    setFile(f); setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await bulkImport(file);
      setResult({ success: true, message: res.message, count: res.count });
      toast.success(res.message);
    } catch (err) {
      const msg = err.response?.data?.message || 'Import failed';
      setResult({ success: false, message: msg });
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="admin-topbar">
        <h1>Bulk Import Songs</h1>
        <button className="btn btn-gold" onClick={downloadTemplate}>
          <Download size={15} /> Download Template
        </button>
      </div>

      {/* Instructions */}
      <div style={{
        background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
        padding: 20, marginBottom: 24, border: '1.5px solid var(--border)',
      }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 12, color: 'var(--brand-mid)' }}>
          How to Import
        </h3>
        <ol style={{ paddingLeft: 20, lineHeight: 2.1, fontSize: 14, color: 'var(--text-secondary)' }}>
          <li>Download the <strong>Excel template</strong> using the button above</li>
          <li>Fill in your songs — each row = one song</li>
          <li>Required columns: <code>title</code>, <code>lyrics</code></li>
          <li>Optional: <code>titleTelugu</code>, <code>lyricsTelugu</code>, <code>titleHindi</code>, <code>lyricsHindi</code>, <code>language</code>, <code>category</code>, <code>author</code>, <code>songNumber</code>, <code>key</code>, <code>tags</code>, <code>youtubeUrl</code></li>
          <li>Upload the filled file below and click <strong>Import Songs</strong></li>
        </ol>
      </div>

      {/* Dropzone */}
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])} />
        <div className="dropzone-icon">
          <FileSpreadsheet size={48} color="var(--brand-light)" />
        </div>
        {file ? (
          <>
            <p style={{ color: 'var(--brand-mid)', fontWeight: 600 }}>📄 {file.name}</p>
            <small>{(file.size / 1024).toFixed(1)} KB — click to change file</small>
          </>
        ) : (
          <>
            <p>Drag &amp; drop your Excel or CSV file here</p>
            <small>or click to browse · .xlsx / .xls / .csv · max 10 MB</small>
          </>
        )}
      </div>

      {file && (
        <button className="btn btn-primary" style={{ marginTop: 20, padding: '12px 32px' }}
          onClick={handleImport} disabled={loading}>
          <Upload size={15} />
          {loading ? 'Importing…' : `Import Songs from ${file.name}`}
        </button>
      )}

      {/* Result */}
      {result && (
        <div style={{
          marginTop: 24, padding: 20, borderRadius: 'var(--radius-md)',
          background: result.success ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${result.success ? '#86efac' : '#fca5a5'}`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {result.success
            ? <CheckCircle size={24} color="#16a34a" />
            : <XCircle    size={24} color="#dc2626" />}
          <div>
            <div style={{ fontWeight: 700, color: result.success ? '#166534' : '#991b1b' }}>
              {result.success ? 'Import Successful!' : 'Import Failed'}
            </div>
            <div style={{ fontSize: 14, color: result.success ? '#166534' : '#991b1b', marginTop: 2 }}>
              {result.message}
            </div>
          </div>
        </div>
      )}
    </>
  );
}