import { useState, useEffect } from 'react';

/**
 * Hook to manage privacy mode based on URL parameter
 */
export function usePrivacyMode() {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  useEffect(() => {
    // Check for privacy parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const privacyParam = urlParams.get('privacy');
    setIsPrivacyMode(privacyParam === 'true');
  }, []);

  const togglePrivacyMode = () => {
    const newPrivacyMode = !isPrivacyMode;
    setIsPrivacyMode(newPrivacyMode);
    
    // Update URL without page reload
    const url = new URL(window.location.href);
    if (newPrivacyMode) {
      url.searchParams.set('privacy', 'true');
    } else {
      url.searchParams.delete('privacy');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const getPrivacyUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('privacy', 'true');
    return url.toString();
  };

  const getPublicUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('privacy');
    return url.toString();
  };

  return {
    isPrivacyMode,
    togglePrivacyMode,
    getPrivacyUrl,
    getPublicUrl
  };
}
