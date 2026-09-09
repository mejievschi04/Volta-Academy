import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './TestAttemptFooter.css';

export default function TestAttemptFooter({ currentIndex, total, onNavigate, onSubmit, submitting = false, canSubmit = true, submitted = false, backTo, children }) {
    const footerRef = useRef(null);
    const [height, setHeight] = useState(160);
    useLayoutEffect(() => {
        const footer = footerRef.current;
        const observer = new ResizeObserver(() => setHeight(footer.getBoundingClientRect().height));
        observer.observe(footer);
        setHeight(footer.getBoundingClientRect().height);
        return () => observer.disconnect();
    }, []);

    return <>
        <div aria-hidden="true" style={{ height, flexShrink: 0 }} />
        {createPortal(
            <footer ref={footerRef} className="test-attempt-footer">
                <div className="test-attempt-footer-back">
                    {backTo && <Link to={backTo} className="lms-btn-secondary">Înapoi la curs</Link>}
                </div>
                {!submitted && total > 0 && <nav className="test-attempt-footer-navigation" aria-label="Navigare întrebări">
                    <button type="button" className="lms-btn-secondary" aria-label="Întrebarea anterioară"
                        disabled={submitting || currentIndex === 0} onClick={() => onNavigate(currentIndex - 1)}>←</button>
                    <span aria-live="polite">{currentIndex + 1} / {total}</span>
                    <button type="button" className="lms-btn-secondary" aria-label="Întrebarea următoare"
                        disabled={submitting || currentIndex >= total - 1} onClick={() => onNavigate(currentIndex + 1)}>→</button>
                </nav>}
                <div className="test-attempt-footer-submit">
                    {!submitted && total > 0 && currentIndex === total - 1 && <button type="button"
                        className="lms-btn-primary" disabled={submitting || !canSubmit} onClick={onSubmit}>
                        {submitting ? 'Se trimite…' : 'Trimite testul'}
                    </button>}
                    {children}
                </div>
            </footer>, document.body,
        )}
    </>;
}
