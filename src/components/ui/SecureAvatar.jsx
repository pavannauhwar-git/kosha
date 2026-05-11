import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const avatarCache = new Map();

export default function SecureAvatar({ src, alt, className, fallbackInitial }) {
  const [url, setUrl] = useState(null);

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
    if (avatarCache.has(src)) {
      setUrl(avatarCache.get(src));
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
          if (avatarCache.size > 50) {
            const firstKey = avatarCache.keys().next().value
            avatarCache.delete(firstKey)
          }
          avatarCache.set(src, data.signedUrl);
          setUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Failed to load secure avatar', err);
      }
    }

    fetchSignedUrl();
    return () => { isMounted = false; };
  }, [src]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-kosha-surface-2 text-ink-3 font-medium ${className || ''}`}>
        {fallbackInitial || '?'}
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} onError={() => setUrl(null)} />;
}
