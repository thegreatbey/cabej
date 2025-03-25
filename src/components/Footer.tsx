import { useState, useEffect, useRef } from 'react';

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  const [activePanel, setActivePanel] = useState<'tos' | 'privacy' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setActivePanel(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tosContent = (
    <div className="text-sm text-gray-600 space-y-2">
      <h3 className="font-semibold">Terms of Service</h3>
      <p>By using this application, you agree to the following:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Usage – This app is provided "as is" without warranties. Use at your own discretion.</li>
        <li>Content – We do not guarantee the accuracy of responses and are not responsible for any decisions based on them.</li>
        <li>Data – You agree not to misuse or exploit the app in ways that violate laws or ethical guidelines.</li>
        <li>No Liability – We are not responsible for any outcomes, decisions, or actions taken based on the app's responses.</li>
        <li>Acceptable Use – You agree not to use this app for illegal, harmful, or unethical purposes. Abuse may result in access restrictions.</li>
        <li>Changes – These terms may be updated at any time. Continued use implies acceptance of changes.</li>
      </ul>
    </div>
  );

  const privacyContent = (
    <div className="text-sm text-gray-600 space-y-2">
      <h3 className="font-semibold">Privacy Policy</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Data Collection – We may collect input text and usage data to improve performance. We do not collect personally identifiable information.  We do not store personal information.</li>
        <li>How We Use Your Data – Any collected data is used solely for app improvements and analytics. We do not sell, rent, or trade your information with third parties.</li>
        <li>Third-Party Services – Our app may interact with external APIs, but no personal user data is shared with these services.</li>
        <li>Cookies & Local Storage – We may use cookies or local storage for app functionality, but not for tracking purposes.</li>
        <li>Your Choices and Rights – You can stop using the app at any time. If you have concerns about data usage, you can contact us.</li>
      </ul>
      <p className="mt-2">By continuing, you agree to these terms.</p>
    </div>
  );

  return (
    <footer className={`w-full py-4 sm:py-6 mt-auto text-center pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-6 ${className}`}>
      <div className="relative max-w-full px-4">
        <div className="flex justify-center items-center space-x-2 text-sm text-gray-600 flex-wrap">
          <button
            onClick={() => setActivePanel(activePanel === 'tos' ? null : 'tos')}
            className="text-black hover:underline py-2"
          >
            TOS
          </button>
          <span>•</span>
          <button
            onClick={() => setActivePanel(activePanel === 'privacy' ? null : 'privacy')}
            className="text-black hover:underline py-2"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <span className="py-2">(C) Dr. Nelson R. Cabej / CABEJ.APP 2025-</span>
        </div>
        
        {/* Expandable panels */}
        {(activePanel === 'tos' || activePanel === 'privacy') && (
          <div 
            ref={panelRef}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-[calc(100vw-2rem)] max-w-md max-h-[60vh] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-4 mx-auto"
          >
            {activePanel === 'tos' ? tosContent : privacyContent}
          </div>
        )}
      </div>
    </footer>
  );
} 