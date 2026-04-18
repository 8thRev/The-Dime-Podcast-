import { useEffect } from 'react';

export default function ConvertKitEmbed({ formId }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://convertkit.com/assets/CKJS4.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (!formId) {
    return null;
  }

  return (
    <div
      data-form-id={formId}
      className="formkit-form"
      style={{
        boxShadow: 'rgba(255, 255, 255, 0.1) 0px 4px 6px -1px, rgba(255, 255, 255, 0.1) 0px 2px 4px -1px',
      }}
    />
  );
}
