import { useState, useEffect, useCallback, cache } from 'react'
import { supabase } from '../lib/supabase'
import { getAuthUserId } from '../lib/authStore'

const BUCKET = 'user-uploads'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export default function useFileUploads() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const fetchFiles = useCallback(async () => {
    const userId = getAuthUserId()
    setLoading(true)
    setError(null)
    try {
        const { data, error: qErr } = await supabase
          .from('user_uploads')
          .select('id, file_name, storage_path, size_bytes, mime_type, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        
        if (qErr) throw qErr
        setFiles(data || [])
    } catch (e) {
        setError(e.message || 'Could not load files.')
    } finally {
        setLoading(false)
    }
  }, [])
  
  useEffect(() => { void fetchFiles() }, [fetchFiles])

  async function uploadFile(file) {
    if (!file) throw new Error('No file selected.')
    if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Only .zip files are allowed.')
    }
    if (file.size > MAX_SIZE) {
        throw new Error('File size exceeds 5MB limit.')
    }

    const userId = getAuthUserId()
    const storagePath = userId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { cacheControl: '3600', upsert: false })

    if (uploadErr) throw uploadErr

    const { data: row, error: insertErr } = await supabase
      .from('user_uploads')
      .insert([{
        user_id: userId,
        file_name: file.name,
        storage_path: storagePath,
        size_bytes: file.size,
        mime_type: file.type || 'application/zip',
      }])
      .select('id, file_name, storage_path, size_bytes, mime_type, created_at')
      .single()

    if (insertErr) throw insertErr

    setFiles(prev => [row, ...prev])
    return row
  }

  async function deleteFile(upload) {
    if (!upload?.id) return

    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .remove([upload.storage_path])

    if (storageErr) console.warn('Storage delete failed (may already be removed):', storageErr.message)

    const { error: dbErr } = await supabase
      .from('user_uploads')
      .delete()
      .eq('id', upload.id)
      .eq('user_id', getAuthUserId())

    if (dbErr) throw dbErr

    setFiles(prev => prev.filter((f) => f.id !== upload.id))
  }

  async function downloadFile(upload) {
    if (!upload?.storage_path) return

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(upload.storage_path)

    if (dlErr) throw dlErr

    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = upload.file_name || 'download.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return { files, loading, error, uploadFile, deleteFile, downloadFile, refresh: fetchFiles }
}
