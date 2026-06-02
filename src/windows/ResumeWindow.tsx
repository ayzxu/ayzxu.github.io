/* ==========================================================================
   ResumeWindow — shows Andy's résumé inside a System 1 window. The PDF is
   embedded with <object> so browsers that can render PDFs inline do so, while
   those that can't (notably most mobile browsers) fall back to a clear
   open / download prompt instead of a blank or broken frame.
   ========================================================================== */

import resumeUrl from '../assets/Andy_Xu_Resume.pdf';

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
      <object
        className="resume-frame"
        data={`${resumeUrl}#toolbar=0&view=FitH`}
        type="application/pdf"
        aria-label="Andy Xu résumé"
      >
        <div className="resume-fallback">
          <p>This browser can&apos;t show the PDF inline.</p>
          <p>
            <a href={resumeUrl} target="_blank" rel="noreferrer">
              Open the résumé in a new tab
            </a>{' '}
            or{' '}
            <a href={resumeUrl} download={DOWNLOAD_NAME}>
              download it
            </a>
            .
          </p>
        </div>
      </object>
    </div>
  );
}
