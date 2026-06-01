/* ==========================================================================
   ResumeWindow — shows Andy's résumé inside a System 1 window. The PDF is
   embedded for desktop browsers (which have built-in viewers); a clear
   open / download link is always available as the mobile-friendly fallback.
   ========================================================================== */

import resumeUrl from '../assets/Xu_Andy Resume.pdf';

const DOWNLOAD_NAME = 'Andy_Xu_Resume.pdf';

export default function ResumeWindow() {
  return (
    <div className="resume-root">
      <div className="resume-bar">
        <span>Andy Xu — Résumé</span>
        <a href={resumeUrl} download={DOWNLOAD_NAME}>
          Download
        </a>
        <a href={resumeUrl} target="_blank" rel="noreferrer">
          Open in new tab
        </a>
      </div>
      <iframe
        className="resume-frame"
        src={`${resumeUrl}#toolbar=0&view=FitH`}
        title="Andy Xu résumé"
      />
    </div>
  );
}
