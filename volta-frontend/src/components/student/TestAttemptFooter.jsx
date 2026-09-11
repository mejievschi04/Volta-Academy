import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './TestAttemptFooter.css';

export default function TestAttemptFooter({
    currentIndex,
    total,
    onNavigate,
    onSubmit,
    submitting = false,
    canSubmit = true,
    submitted = false,
    backTo,
    children,
    confirmOpen = false,
    answeredCount = 0,
    unansweredCount = 0,
    flaggedCount = 0,
    onRequestSubmit,
    onConfirmSubmit,
    onCancelConfirm,
    onJumpUnanswered,
}) {
    const footerRef = useRef(null);
    const [height, setHeight] = useState(160);
    useLayoutEffect(() => {
        const footer = footerRef.current;
        const observer = new ResizeObserver(() => setHeight(footer.getBoundingClientRect().height));
        observer.observe(footer);
        setHeight(footer.getBoundingClientRect().height);
        return () => observer.disconnect();
    }, [confirmOpen]);

    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;
        const update = () => {
            const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            footerRef.current?.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
        };
        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        update();
        return () => {
            viewport.removeEventListener('resize', update);
            viewport.removeEventListener('scroll', update);
        };
    }, []);

    const showSubmit = !submitted && total > 0 && (confirmOpen || currentIndex === total - 1);
    const submitHandler = onRequestSubmit || onSubmit;

    return <>
        <div aria-hidden="true" style={{ height, flexShrink: 0 }} />
        {createPortal(
            <footer ref={footerRef} className={`test-attempt-footer${confirmOpen ? ' test-attempt-footer--confirm' : ''}`}>
                {confirmOpen && !submitted ? (
                    <div className="test-attempt-footer-confirm" role="region" aria-label="Confirmare trimitere">
                        <p className="test-attempt-footer-confirm-lead">
                            Ai răspuns la {answeredCount} din {total} întrebări.
                        </p>
                        <p className="test-attempt-footer-confirm-meta">
                            {unansweredCount} fără răspuns · {flaggedCount} marcate pentru revizie.
                        </p>
                        <div className="test-attempt-footer-confirm-actions">
                            {unansweredCount > 0 && onJumpUnanswered ? (
                                <button type="button" className="lms-btn-secondary" disabled={submitting} onClick={onJumpUnanswered}>
                                    Vezi întrebările fără răspuns
                                </button>
                            ) : null}
                            {onCancelConfirm ? (
                                <button type="button" className="lms-btn-secondary" disabled={submitting} onClick={onCancelConfirm}>
                                    Continuă testul
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="lms-btn-primary"
                                disabled={submitting || !canSubmit}
                                onClick={onConfirmSubmit || onSubmit}
                            >
                                {submitting ? 'Se trimite…' : 'Trimite definitiv'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
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
                            {showSubmit && <button type="button"
                                className="lms-btn-primary" disabled={submitting || !canSubmit} onClick={submitHandler}>
                                {submitting ? 'Se trimite…' : 'Trimite testul'}
                            </button>}
                            {children}
                        </div>
                    </>
                )}
            </footer>, document.body,
        )}
    </>;
}
