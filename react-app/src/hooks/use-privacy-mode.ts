import { useState } from 'react';

const isPrivacyEnabledInUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('privacy') === 'true';
};

/**
 * Hook to manage privacy mode based on URL parameter
 */
export function usePrivacyMode() {
  // Read the URL during the initial render so private values never appear for a
  // frame before an effect has a chance to enable privacy mode.
  const [isPrivacyMode, setIsPrivacyMode] = useState(isPrivacyEnabledInUrl);

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
