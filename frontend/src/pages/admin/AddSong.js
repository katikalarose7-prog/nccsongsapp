import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Link2, Upload, X, Music, Loader2 } from 'lucide-react';
import { createSong, updateSong, fetchSong, uploadAudio } from '../../services/api';

const CATEGORIES = ['worship','praise','christmas','resurrection','communion','wedding','goodfriday','thanksgiving','sundayschoolsongs','other'];

const BLANK = {
  title: '', titleTelugu: '', titleHindi: '',
  lyrics: '', lyricsTelugu: '', lyricsHindi: '',
  language: 'english', category: 'worship',
  key: '', bpm: '', tempo: '',
  songNumber: '', youtubeUrl: '', audioUrl: '', chords: '', tags: '',
};

export default function AddSong() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [form, setForm] = useState(BLANK);
  const [tab, setTab]   = useState('english');
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(id);

  // ── Audio source: 'url' (paste a link) or 'upload' (choose a file) ──
  const [audioMode, setAudioMode]       = useState('url');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [audioFileName, setAudioFileName]   = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isEdit) {
      fetchSong(id).then((res) => {
        const s = res.song;
        setForm({ ...BLANK, ...s, tags: (s.tags || []).join(', '), bpm: s.bpm || '' });
        // If the saved audioUrl points to our own /uploads/ folder, it was an upload
        if (s.audioUrl && s.audioUrl.startsWith('/uploads/')) {
          setAudioMode('upload');
          setAudioFileName(s.audioUrl.split('/').pop());
        } else if (s.audioUrl) {
          setAudioMode('url');
        }
      });
    }
  }, [id, isEdit]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Handle MP3 file selection → upload immediately, store returned URL ──
  const handleAudioFile = async (file) => {
    if (!file) return;
    const allowed = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error('Please choose an audio file (mp3, wav, m4a, ogg, aac)');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File too large — max 25MB');
      return;
    }
    setUploadingAudio(true);
    setUploadProgress(0);
    try {
      const res = await uploadAudio(file, setUploadProgress);
      // eslint-disable-next-line no-console
      console.log('Upload response URL:', res.url);
      setForm(f => ({ ...f, audioUrl: res.url }));
      setAudioFileName(file.name);
      console.log("Upload response:", res);
      toast.success('Audio uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingAudio(false);
    }
  };

  const removeAudio = () => {
    setForm(f => ({ ...f, audioUrl: '' }));
    setAudioFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        bpm: Number(form.bpm) || undefined,
      };
      // eslint-disable-next-line no-console
      console.log('Saving song with audioUrl:', payload.audioUrl);
      if (isEdit) await updateSong(id, payload);
      else        await createSong(payload);
      toast.success(isEdit ? 'Song updated!' : 'Song added!');
      navigate('/admin/songs');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving song');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="admin-topbar">
        <h1>{isEdit ? 'Edit Song' : 'Add New Song'}</h1>
        <button className="btn btn-ghost" onClick={() => navigate('/admin/songs')}>← Back</button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Language tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[['english','🇬🇧 English'],['telugu','🇮🇳 Telugu'],['hindi','🕌 Hindi']].map(([key,label]) => (
            <button type="button" key={key}
              className={`modal-tab ${tab === key ? 'active' : ''}`}
              style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 18px' }}
              onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Basic Info */}
        <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 18, color: 'var(--brand-mid)' }}>Song Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Title (English) *</label>
              <input className="form-input" required value={form.title} onChange={set('title')} placeholder="Amazing Grace" />
            </div>
            <div className="form-group">
              <label className="form-label">Song Number</label>
              <input className="form-input" type="number" value={form.songNumber} onChange={set('songNumber')} placeholder="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Telugu Title</label>
              <input className="form-input" style={{ fontFamily: 'var(--font-telugu)' }} value={form.titleTelugu} onChange={set('titleTelugu')} />
            </div>
            <div className="form-group">
              <label className="form-label">Hindi Title</label>
              <input className="form-input" style={{ fontFamily: 'var(--font-hindi)' }} value={form.titleHindi} onChange={set('titleHindi')} />
            </div>
            <div className="form-group">
              <label className="form-label">Language</label>
              <select className="form-select" value={form.language} onChange={set('language')}>
                <option value="english">English</option>
                <option value="telugu">Telugu</option>
                <option value="hindi">Hindi</option>
                <option value="multilingual">Multilingual</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Musical Key</label>
              <input className="form-input" value={form.key} onChange={set('key')} placeholder="G, Am, C…" />
            </div>
            <div className="form-group">
              <label className="form-label">BPM</label>
              <input className="form-input" type="number" value={form.bpm} onChange={set('bpm')} placeholder="72" />
            </div>
            <div className="form-group">
              <label className="form-label">Tempo</label>
              <select className="form-select" value={form.tempo} onChange={set('tempo')}>
                <option value="">— Select —</option>
                <option value="slow">Slow</option>
                <option value="medium">Medium</option>
                <option value="fast">Fast</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">YouTube URL</label>
              <input className="form-input" value={form.youtubeUrl} onChange={set('youtubeUrl')} placeholder="https://youtube.com/…" />
            </div>
            <div className="form-group full">
              <label className="form-label">Audio (MP3)</label>

              {/* Toggle between URL and Upload modes */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                <button type="button"
                  onClick={() => setAudioMode('url')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${audioMode === 'url' ? 'var(--brand-light)' : 'var(--border)'}`,
                    background: audioMode === 'url' ? 'var(--surface-2)' : 'var(--surface-0)',
                    color: audioMode === 'url' ? 'var(--brand-mid)' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                  <Link2 size={14} /> Paste URL
                </button>
                <button type="button"
                  onClick={() => setAudioMode('upload')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${audioMode === 'upload' ? 'var(--brand-light)' : 'var(--border)'}`,
                    background: audioMode === 'upload' ? 'var(--surface-2)' : 'var(--surface-0)',
                    color: audioMode === 'upload' ? 'var(--brand-mid)' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                  <Upload size={14} /> Upload File
                </button>
              </div>

              {/* URL mode */}
              {audioMode === 'url' && (
                <input className="form-input" value={form.audioUrl} onChange={set('audioUrl')}
                  placeholder="https://example.com/song.mp3" />
              )}

              {/* Upload mode */}
              {audioMode === 'upload' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg,.aac,audio/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleAudioFile(e.target.files[0])}
                  />

                  {!form.audioUrl ? (
                    <div
                      onClick={() => !uploadingAudio && fileInputRef.current.click()}
                      style={{
                        border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                        padding: '20px', textAlign: 'center', cursor: uploadingAudio ? 'default' : 'pointer',
                        background: 'var(--surface-1)',
                      }}>
                      {uploadingAudio ? (
                        <>
                          <Loader2 size={22} className="spin-icon" style={{ marginBottom: 6, animation: 'spin 1s linear infinite' }} />
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Uploading… {uploadProgress}%</div>
                          <div style={{
                            height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 8,
                            overflow: 'hidden', maxWidth: 200, margin: '8px auto 0',
                          }}>
                            <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--brand-light)', transition: 'width 0.2s' }} />
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload size={22} color="var(--brand-light)" style={{ marginBottom: 6 }} />
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click to choose an MP3 file</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>mp3, wav, m4a, ogg, aac — max 25MB</div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px', background: 'var(--surface-1)',
                    }}>
                      <Music size={18} color="var(--brand-light)" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {audioFileName || 'Uploaded audio'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ready</div>
                      </div>
                      <audio controls src={
                        form.audioUrl.startsWith('/uploads/')
                          ? `${(process.env.REACT_APP_API_URL || '/api').replace(/\/api\/?$/, '')}${form.audioUrl}`
                          : form.audioUrl
                      } style={{ height: 32, maxWidth: 180 }} />
                      <button type="button" onClick={removeAudio}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="form-group full">
              <label className="form-label">Tags (comma separated)</label>
              <input className="form-input" value={form.tags} onChange={set('tags')} placeholder="cross, salvation, grace" />
            </div>
          </div>
        </div>

        {/* Lyrics */}
        <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 18, color: 'var(--brand-mid)' }}>
            Lyrics — {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </h3>
          {tab === 'english' && (
            <div className="form-group">
              <label className="form-label">English Lyrics *</label>
              <textarea className="form-textarea" required value={form.lyrics} onChange={set('lyrics')}
                placeholder={"Amazing grace! How sweet the sound\nThat saved a wretch like me…"} style={{ minHeight: 240 }} />
            </div>
          )}
          {tab === 'telugu' && (
            <div className="form-group">
              <label className="form-label">Telugu Lyrics</label>
              <textarea className="form-textarea" value={form.lyricsTelugu} onChange={set('lyricsTelugu')}
                style={{ fontFamily: 'var(--font-telugu)', fontSize: 17, minHeight: 240 }} />
            </div>
          )}
          {tab === 'hindi' && (
            <div className="form-group">
              <label className="form-label">Hindi Lyrics</label>
              <textarea className="form-textarea" value={form.lyricsHindi} onChange={set('lyricsHindi')}
                style={{ fontFamily: 'var(--font-hindi)', fontSize: 17, minHeight: 240 }} />
            </div>
          )}
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Chords / Chart</label>
            <textarea className="form-textarea" value={form.chords} onChange={set('chords')}
              style={{ fontFamily: 'monospace', fontSize: 13, minHeight: 100 }}
              placeholder="G  D  Em  C" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 28px' }}>
            {loading ? 'Saving…' : isEdit ? '✓ Update Song' : '+ Add Song'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/songs')}>Cancel</button>
        </div>
      </form>
    </>
  );
}