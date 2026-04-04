import { useState } from 'react';
import { Search } from 'lucide-react';

function defaultLogoUrl(logoSrc) {
  if (logoSrc.startsWith('http') || logoSrc.startsWith('data:')) return logoSrc;
  const base = import.meta.env.BASE_URL || '/';
  const path = logoSrc.replace(/^\//, '');
  return `${base}${path}`.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * Search input on the Patients page: logo from `public/assets/logo.png` inside the search bar.
 */
export function SearchInputWithLogo({ className = '', logoSrc = 'assets/logo.png', ...inputProps }) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedSrc = defaultLogoUrl(logoSrc);

  return (
    <div className={`search-field ${className}`.trim()}>
      <span className="search-field__logo-wrap" aria-hidden>
        {!imgFailed ? (
          <img
            className="search-field__logo"
            src={resolvedSrc}
            alt=""
            width={36}
            height={36}
            decoding="async"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Search className="search-field__fallback-icon" size={20} strokeWidth={2} />
        )}
      </span>
      <input className="input search-field__input" {...inputProps} />
    </div>
  );
}
