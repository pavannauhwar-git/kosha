import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const AVATAR_CACHE_KEY = 'kosha:avatar-urls'
const AVATAR_CACHE_MAX = 50
const AVATAR_CACHE_TTL_MS = 6 * 24 * 60 * 60 * 1000 // 6 days (less than 7-day signed URL TTL)

function readAvatarCache() {
  try {
    const raw = localStorage.getItem(AVATAR_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function writeAvatarCache(map) {
  try {
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(map))
  } catch {
    // Quota exceeded or storage unavailable — silently degrade to no-cache.
  }
}

function getCachedAvatarUrl(src) {
  const cache = readAvatarCache()
  const entry = cache[src]
  if (!entry) return null
  if (Date.now() - entry.t > AVATAR_CACHE_TTL_MS) {
    delete cache[src]
    writeAvatarCache(cache)
    return null
  }
  return entry.u
}

function setCachedAvatarUrl(src, signedUrl) {
  const cache = readAvatarCache()
  const keys = Object.keys(cache)
  if (keys.length >= AVATAR_CACHE_MAX) {
    // Evict the oldest entry (by timestamp).
    let oldestKey = keys[0]
    let oldestT = cache[oldestKey]?.t || 0
    for (const k of keys) {
      if ((cache[k]?.t || 0) < oldestT) {
        oldestT = cache[k].t
        oldestKey = k
      }
    }
    delete cache[oldestKey]
  }
  cache[src] = { u: signedUrl, t: Date.now() }
  writeAvatarCache(cache)
}

function deleteCachedAvatarUrl(src) {
  const cache = readAvatarCache()
  if (src in cache) {
    delete cache[src]
    writeAvatarCache(cache)
  }
}

export default function SecureAvatar({ src, alt, className, fallbackInitial }) {
  const [url, setUrl] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const retryCountRef = useRef(0);

  useEffect(() => {
    retryCountRef.current = 0
  }, [src])

  useEffect(() => {
    if (!src) {
      setUrl(null);
      return;
    }

    // If it's already a full URL (legacy public URL or external)
    if (src.startsWith('http')) {
      setUrl(src);
      return;
    }

    // Check cache
    const cached = getCachedAvatarUrl(src)
    if (cached) {
      setUrl(cached);
      return;
    }

    let isMounted = true;
    async function fetchSignedUrl() {
      try {
        const { data, error } = await supabase.storage
          .from('avatars')
          .createSignedUrl(src, 60 * 60 * 24 * 7); // 7 days expiry

        if (error) {
          console.error('Error fetching signed avatar url:', error);
          return;
        }

        if (isMounted && data?.signedUrl) {
          setCachedAvatarUrl(src, data.signedUrl);
          setUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Failed to load secure avatar', err);
      }
    }

    fetchSignedUrl();
    return () => { isMounted = false; };
  }, [src, retryNonce]);

  const derivedInitial = (fallbackInitial || (alt && String(alt).trim()[0]) || '').toUpperCase()

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-kosha-surface-2 text-ink-3 font-medium ${className || ''}`}
        aria-label={alt || undefined}
      >
        {derivedInitial}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => {
        if (!src || retryCountRef.current >= 1) {
          setUrl(null)
          return
        }
        retryCountRef.current += 1
        if (!src.startsWith('http')) {
          deleteCachedAvatarUrl(src)
        }
        setUrl(null)
        setRetryNonce((n) => n + 1)
      }}
    />
  );
}
