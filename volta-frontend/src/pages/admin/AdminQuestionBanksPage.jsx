import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/common/Modal';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import FolderCard from '../../components/admin/question-banks/FolderCard';
import { useAuth } from '../../contexts/AuthContext';
import './AdminQuestionBanksPage.css';

function stripHtmlPreview(raw, maxLen = 140) {
  if (raw == null || raw === '') return '';
  const plain = String(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen)}…`;
}

const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Grilă',
  single_choice: 'Alegere unică',
  true_false: 'A/F',
  matching: 'Asocieri',
  ordering: 'Ordonare',
};

function typeLabel(type) {
  const t = String(type || '').trim();
  return QUESTION_TYPE_LABELS[t] || t || '—';
}

/** Întrebări puse direct pe test, încă fără folder — pot fi mutate într-o bancă nouă. */
function isOrphanTestQuestion(row) {
  if (!row || row.question_bank_id != null) return false;
  return row.test_id != null;
}

const AdminQuestionBanksPage = ({ embedded = false }) => {
  const { canMutateInAdminArea } = useAuth();
  const { success, error } = useToast();
  const [hubTab, setHubTab] = useState('folders');
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', tagsText: '' });
  const [createLoading, setCreateLoading] = useState(false);

  const [catalogSearchInput, setCatalogSearchInput] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPerPage, setCatalogPerPage] = useState(20);
  const [catalogScope, setCatalogScope] = useState('all');
  const [catalogTick, setCatalogTick] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogResponse, setCatalogResponse] = useState(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [createFromSelectionOpen, setCreateFromSelectionOpen] = useState(false);
  const [createFromSelectionForm, setCreateFromSelectionForm] = useState({ title: '', description: '', tagsText: '' });
  const [createFromSelectionLoading, setCreateFromSelectionLoading] = useState(false);
  const [moveToExistingOpen, setMoveToExistingOpen] = useState(false);
  const [moveTargetBankId, setMoveTargetBankId] = useState('');
  const [moveToExistingLoading, setMoveToExistingLoading] = useState(false);
  const catalogSelectAllRef = useRef(null);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const data = await adminService.getQuestionBanks(search.trim() ? { search: search.trim() } : {});
      setFolders(Array.isArray(data) ? data : []);
    } catch {
      error('Nu am putut încărca folderele.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    const id = setTimeout(loadFolders, 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const id = setTimeout(() => setCatalogSearch(catalogSearchInput), 300);
    return () => clearTimeout(id);
  }, [catalogSearchInput]);

  useEffect(() => {
    setCatalogPage(1);
  }, [catalogSearch, catalogScope]);

  useEffect(() => {
    if (hubTab !== 'catalog') return undefined;
    let cancelled = false;
    const run = async () => {
      setCatalogLoading(true);
      try {
        const res = await adminService.listQuestions({
          search: catalogSearch.trim() || undefined,
          page: catalogPage,
          per_page: catalogPerPage,
          ...(catalogScope === 'test_no_folder' ? { test_attached_no_folder: 1 } : {}),
        });
        if (!cancelled) setCatalogResponse(res);
      } catch {
        if (!cancelled) {
          error('Nu am putut încărca catalogul de întrebări.');
          setCatalogResponse(null);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [hubTab, catalogSearch, catalogPage, catalogPerPage, catalogScope, catalogTick]);

  useEffect(() => {
    setSelectedQuestionIds([]);
  }, [catalogScope, catalogSearch]);

  useEffect(() => {
    if (hubTab !== 'catalog') setSelectedQuestionIds([]);
  }, [hubTab]);

  const catalogRows = Array.isArray(catalogResponse?.data) ? catalogResponse.data : [];
  const catalogLastPage = Math.max(1, Number(catalogResponse?.last_page) || 1);
  const catalogTotalRaw = catalogResponse?.total;
  const catalogTotal =
    catalogTotalRaw != null && Number.isFinite(Number(catalogTotalRaw)) ? Number(catalogTotalRaw) : 0;

  const normalizedTags = useMemo(
    () =>
      createForm.tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [createForm.tagsText]
  );

  const normalizedSelectionTags = useMemo(
    () =>
      createFromSelectionForm.tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [createFromSelectionForm.tagsText]
  );

  const selectableRowsOnPage = useMemo(
    () => catalogRows.filter((r) => isOrphanTestQuestion(r)),
    [catalogRows]
  );

  const moveTargetFolders = useMemo(
    () => folders.filter((folder) => folder && folder.id != null),
    [folders]
  );

  useEffect(() => {
    const el = catalogSelectAllRef.current;
    if (!el || hubTab !== 'catalog') return;
    const selectIds = new Set(selectableRowsOnPage.map((r) => r.id));
    const selectedOnPage = selectedQuestionIds.filter((id) => selectIds.has(id));
    el.indeterminate = selectedOnPage.length > 0 && selectedOnPage.length < selectIds.size;
  }, [hubTab, selectedQuestionIds, selectableRowsOnPage]);

  const toggleQuestionSelected = (id) => {
    setSelectedQuestionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllOnPage = () => {
    const ids = selectableRowsOnPage.map((r) => r.id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedQuestionIds.includes(id));
    if (allSelected) {
      setSelectedQuestionIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const openCreateFromSelectionModal = () => {
    if (selectedQuestionIds.length < 1) {
      error('Selectează cel puțin o întrebare din catalog.');
      return;
    }
    setCreateFromSelectionForm((prev) => ({
      ...prev,
      title:
        prev.title.trim() ||
        `Întrebări din teste · ${new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    }));
    setCreateFromSelectionOpen(true);
  };

  const openMoveToExistingModal = () => {
    if (selectedQuestionIds.length < 1) {
      error('Selectează cel puțin o întrebare din catalog.');
      return;
    }
    if (!moveTargetFolders.length) {
      error('Nu există niciun folder disponibil.');
      return;
    }
    setMoveTargetBankId((prev) => {
      if (prev && moveTargetFolders.some((folder) => String(folder.id) === String(prev))) {
        return prev;
      }
      return String(moveTargetFolders[0].id);
    });
    setMoveToExistingOpen(true);
  };

  const createFolderFromSelection = async () => {
    if (!createFromSelectionForm.title.trim()) {
      error('Numele folderului este obligatoriu.');
      return;
    }
    if (selectedQuestionIds.length < 1) {
      error('Selectează cel puțin o întrebare.');
      return;
    }
    setCreateFromSelectionLoading(true);
    try {
      const created = await adminService.createQuestionBank({
        title: createFromSelectionForm.title.trim(),
        description: createFromSelectionForm.description.trim() || null,
        tags: normalizedSelectionTags,
      });
      const bankId = created?.bank?.id;
      if (!bankId) {
        error('Răspuns neașteptat de la server.');
        return;
      }
      await adminService.moveQuestionsToFolderBulk(selectedQuestionIds, bankId);
      success(`Folder creat: ${selectedQuestionIds.length} întrebări mutate în bancă.`);
      setCreateFromSelectionOpen(false);
      setCreateFromSelectionForm({ title: '', description: '', tagsText: '' });
      setSelectedQuestionIds([]);
      await loadFolders();
      setCatalogTick((t) => t + 1);
    } catch (e) {
      error(e?.response?.data?.error || e?.response?.data?.message || 'Operațiunea a eșuat.');
    } finally {
      setCreateFromSelectionLoading(false);
    }
  };

  const moveSelectionToExistingFolder = async () => {
    if (!moveTargetBankId) {
      error('Selectează un folder existent.');
      return;
    }
    if (selectedQuestionIds.length < 1) {
      error('Selectează cel puțin o întrebare.');
      return;
    }
    setMoveToExistingLoading(true);
    try {
      await adminService.moveQuestionsToFolderBulk(selectedQuestionIds, Number(moveTargetBankId));
      const targetFolder = moveTargetFolders.find((folder) => String(folder.id) === String(moveTargetBankId));
      success(`Au fost mutate ${selectedQuestionIds.length} întrebări în folderul existent${targetFolder?.title ? `: ${targetFolder.title}` : ''}.`);
      setMoveToExistingOpen(false);
      setSelectedQuestionIds([]);
      setCatalogTick((t) => t + 1);
      await loadFolders();
    } catch (e) {
      error(e?.response?.data?.error || e?.response?.data?.message || 'Operațiunea a eșuat.');
    } finally {
      setMoveToExistingLoading(false);
    }
  };

  const createFolder = async () => {
    if (!createForm.title.trim()) {
      error('Numele folderului este obligatoriu.');
      return;
    }
    setCreateLoading(true);
    try {
      await adminService.createQuestionBank({
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        tags: normalizedTags,
      });
      success('Folder creat.');
      setCreateOpen(false);
      setCreateForm({ title: '', description: '', tagsText: '' });
      await loadFolders();
    } catch (e) {
      error(e?.response?.data?.error || 'Nu am putut crea folderul.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className={`qb-page qb-page-v2 ${embedded ? 'qb-page-embedded' : ''}`}>
      <div className="qb-shell">
        <header className="qb-page-hero va-card-shell">
          <div className="qb-page-hero-text">
            <p className="qb-page-eyebrow">Conținut reutilizabil</p>
            <h1>Întrebări</h1>
            <p className="qb-page-lead">
              Foldere (bănci) pentru material reutilizabil și catalog complet — inclusiv întrebări puse direct pe{' '}
              <strong>teste</strong>. Poți crea un folder nou și muta acolo întrebările din teste care nu sunt încă într-o
              mapă.
            </p>
          </div>
          {canMutateInAdminArea && hubTab === 'folders' ? (
            <button type="button" className="lms-btn-primary qb-hero-cta" onClick={() => setCreateOpen(true)}>
              + Folder nou
            </button>
          ) : null}
        </header>

        <div className="qb-kpis" role="group" aria-label="Rezumat">
          <div className="qb-kpi va-card-shell">
            <span className="qb-kpi-value">{loading && hubTab === 'folders' ? '…' : folders.length}</span>
            <span className="qb-kpi-label">Foldere</span>
          </div>
          <div className="qb-kpi va-card-shell">
            <span className="qb-kpi-value">{hubTab === 'catalog' ? (catalogLoading ? '…' : catalogTotal) : '—'}</span>
            <span className="qb-kpi-label">
              În catalog
              {hubTab === 'catalog' && catalogScope === 'test_no_folder' ? ' · doar din teste, fără folder' : ''}
            </span>
          </div>
          {hubTab === 'catalog' && canMutateInAdminArea ? (
            <div className={`qb-kpi va-card-shell ${selectedQuestionIds.length ? 'qb-kpi--accent' : ''}`}>
              <span className="qb-kpi-value">{selectedQuestionIds.length}</span>
              <span className="qb-kpi-label">Selectate pentru folder nou</span>
            </div>
          ) : null}
        </div>

        <div className="qb-hub-tabs qb-hub-tabs--v2" role="tablist" aria-label="Vizualizare întrebări">
          <button
            type="button"
            role="tab"
            aria-selected={hubTab === 'folders'}
            className={`qb-hub-tab ${hubTab === 'folders' ? 'is-active' : ''}`}
            onClick={() => setHubTab('folders')}
          >
            Foldere
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={hubTab === 'catalog'}
            className={`qb-hub-tab ${hubTab === 'catalog' ? 'is-active' : ''}`}
            onClick={() => setHubTab('catalog')}
          >
            Catalog întrebări
          </button>
        </div>

        {hubTab === 'folders' ? (
          <>
            <div className="qb-search-card va-card-shell">
              <label className="qb-sr-only" htmlFor="qb-folder-search">
                Caută foldere
              </label>
              <input
                id="qb-folder-search"
                className="admin-form-input qb-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caută foldere după nume..."
              />
            </div>

            <section className="qb-folder-list" aria-label="Lista folderelor">
              {loading ? (
                <div className="qb-catalog-loading qb-catalog-loading--inline">
                  <span className="qb-spinner" aria-hidden />
                  Se încarcă folderele...
                </div>
              ) : folders.length ? (
                folders.map((folder) => <FolderCard key={folder.id} folder={folder} />)
              ) : (
                <div className="qb-empty">
                  <div className="qb-empty-icon" aria-hidden>
                    📂
                  </div>
                  <p className="qb-empty-title">Niciun folder nu se potrivește</p>
                  <p className="qb-empty-hint">Creează un folder gol sau adună întrebări din catalog (din teste, fără folder).</p>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="qb-catalog-intro">
              <p className="qb-catalog-lead">
                Vezi întrebările din <strong>foldere</strong> și pe cele lipite direct de un <strong>test</strong>. Pentru
                editare în contextul cursului, deschide builder-ul și testul din bara laterală.
              </p>
              <div className="qb-catalog-scope" role="group" aria-label="Filtru catalog">
                <button
                  type="button"
                  className={`qb-scope-chip ${catalogScope === 'all' ? 'is-active' : ''}`}
                  onClick={() => setCatalogScope('all')}
                >
                  Toate
                </button>
                <button
                  type="button"
                  className={`qb-scope-chip ${catalogScope === 'test_no_folder' ? 'is-active' : ''}`}
                  onClick={() => setCatalogScope('test_no_folder')}
                >
                  Din teste, fără folder
                </button>
              </div>
            </div>

            <div className="qb-search-card va-card-shell">
              <label className="qb-sr-only" htmlFor="qb-catalog-search">
                Caută în catalog
              </label>
              <input
                id="qb-catalog-search"
                className="admin-form-input qb-search-input"
                value={catalogSearchInput}
                onChange={(e) => setCatalogSearchInput(e.target.value)}
                placeholder="Caută în textul întrebării..."
              />
            </div>

            {canMutateInAdminArea ? (
              <div className="qb-catalog-toolbar va-card-shell">
                <p className="qb-catalog-toolbar-hint">
                  Bifează întrebările din teste fără folder, apoi le poți muta într-un folder existent sau crea unul nou.
                  Selecția se păstrează la schimbarea paginii.
                </p>
                <div className="qb-catalog-toolbar-actions">
                  <button
                    type="button"
                    className="lms-btn-secondary"
                    disabled={selectedQuestionIds.length === 0}
                    onClick={() => setSelectedQuestionIds([])}
                  >
                    Golește selecția
                  </button>
                  <button
                    type="button"
                    className="lms-btn-primary"
                    disabled={selectedQuestionIds.length === 0}
                    onClick={openCreateFromSelectionModal}
                  >
                    Folder nou din selecție ({selectedQuestionIds.length})
                  </button>
                  <button
                    type="button"
                    className="lms-btn-secondary"
                    disabled={selectedQuestionIds.length === 0 || moveTargetFolders.length === 0}
                    onClick={openMoveToExistingModal}
                  >
                    Adaugă în folder existent
                  </button>
                </div>
              </div>
            ) : null}

            {catalogLoading ? (
              <div className="qb-catalog-loading">
                <span className="qb-spinner" aria-hidden />
                Se încarcă catalogul...
              </div>
            ) : catalogRows.length === 0 ? (
              <div className="qb-empty qb-empty--soft">
                <div className="qb-empty-icon" aria-hidden>
                  📋
                </div>
                <p className="qb-empty-title">Nicio întrebare</p>
                <p className="qb-empty-hint">Încearcă alt filtru sau alt termen de căutare.</p>
              </div>
            ) : (
              <>
                <div className="qb-catalog-table-wrap va-card-shell">
                  <table className="qb-catalog-table">
                    <thead>
                      <tr>
                        {canMutateInAdminArea ? (
                          <th className="qb-col-check" scope="col">
                            <input
                              ref={catalogSelectAllRef}
                              type="checkbox"
                              checked={
                                selectableRowsOnPage.length > 0 &&
                                selectableRowsOnPage.every((r) => selectedQuestionIds.includes(r.id))
                              }
                              onChange={toggleSelectAllOnPage}
                              disabled={selectableRowsOnPage.length === 0}
                              aria-label="Selectează pe pagină întrebările din teste fără folder"
                            />
                          </th>
                        ) : null}
                        <th scope="col">Întrebare</th>
                        <th scope="col">Tip</th>
                        <th scope="col">Puncte</th>
                        <th scope="col">Proveniență</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogRows.map((row) => {
                        const usage = row.usage || {};
                        const src = usage.source;
                        const bank = row.question_bank || row.questionBank;
                        const testMeta = Array.isArray(usage.tests) && usage.tests[0] ? usage.tests[0] : null;
                        const orphan = isOrphanTestQuestion(row);
                        return (
                          <tr key={row.id} className={orphan && selectedQuestionIds.includes(row.id) ? 'is-selected' : ''}>
                            {canMutateInAdminArea ? (
                              <td className="qb-col-check">
                                {orphan ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedQuestionIds.includes(row.id)}
                                    onChange={() => toggleQuestionSelected(row.id)}
                                    aria-label={`Selectează întrebarea #${row.id}`}
                                  />
                                ) : (
                                  <span className="qb-check-placeholder" title="Doar întrebările din teste fără folder">
                                    —
                                  </span>
                                )}
                              </td>
                            ) : null}
                            <td className="qb-catalog-cell-preview">{stripHtmlPreview(row.content)}</td>
                            <td>
                              <span className="qb-type-pill">{typeLabel(row.type)}</span>
                            </td>
                            <td className="qb-catalog-points">{row.points ?? '—'}</td>
                            <td className="qb-catalog-cell-origin">
                              {src === 'bank' && bank?.id ? (
                                <Link to={`/admin/question-banks/${bank.id}`} className="qb-catalog-link">
                                  Folder: {bank.title || `Banca #${bank.id}`}
                                </Link>
                              ) : src === 'direct' && testMeta ? (
                                <span className="qb-catalog-origin-test">
                                  Test: <strong>{testMeta.title || `Test #${testMeta.id}`}</strong>
                                  <Link to="/admin/content?tab=tests" className="qb-catalog-link qb-catalog-link-inline">
                                    → Teste
                                  </Link>
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="qb-catalog-pagination">
                  <span className="qb-catalog-page-meta">
                    Pagină {catalogPage} / {catalogLastPage}
                    {catalogTotal > 0 ? ` · ${catalogTotal} întrebări` : ''}
                  </span>
                  <div className="qb-catalog-pagination-actions">
                    <label className="qb-catalog-per-page">
                      Pe pagină
                      <select
                        className="admin-form-input"
                        value={catalogPerPage}
                        onChange={(e) => {
                          setCatalogPerPage(Number(e.target.value));
                          setCatalogPage(1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="lms-btn-secondary"
                      disabled={catalogPage <= 1}
                      onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="lms-btn-secondary"
                      disabled={catalogPage >= catalogLastPage}
                      onClick={() => setCatalogPage((p) => p + 1)}
                    >
                      Următor
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <Modal isOpen={createOpen && canMutateInAdminArea} onClose={() => !createLoading && setCreateOpen(false)}>
          <div className="qb-modal">
            <h3>Folder nou</h3>
            <label>Nume</label>
            <input
              className="admin-form-input"
              value={createForm.title}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <label>Descriere</label>
            <textarea
              className="admin-form-input"
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <label>Tag-uri (separate prin virgulă)</label>
            <input
              className="admin-form-input"
              value={createForm.tagsText}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, tagsText: e.target.value }))}
            />
            <div className="qb-modal-actions">
              <button type="button" className="lms-btn-secondary" onClick={() => setCreateOpen(false)} disabled={createLoading}>
                Anulează
              </button>
              <button type="button" className="lms-btn-primary" onClick={createFolder} disabled={createLoading}>
                {createLoading ? 'Se salvează...' : 'Creează'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={createFromSelectionOpen && canMutateInAdminArea}
          onClose={() => !createFromSelectionLoading && setCreateFromSelectionOpen(false)}
        >
          <div className="qb-modal qb-modal-from-selection">
            <h3>Folder nou din selecție</h3>
            <p className="qb-modal-warning">
              Vor fi mutate <strong>{selectedQuestionIds.length}</strong> întrebări în noul folder. Ele nu vor mai fi
              atașate direct testului — dacă testul trebuie să le folosească în continuare, treci-l pe sursă „din bancă” și
              alege acest folder.
            </p>
            <label htmlFor="qb-from-sel-title">Nume folder</label>
            <input
              id="qb-from-sel-title"
              className="admin-form-input"
              value={createFromSelectionForm.title}
              onChange={(e) => setCreateFromSelectionForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <label htmlFor="qb-from-sel-desc">Descriere</label>
            <textarea
              id="qb-from-sel-desc"
              className="admin-form-input"
              rows={3}
              value={createFromSelectionForm.description}
              onChange={(e) => setCreateFromSelectionForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <label htmlFor="qb-from-sel-tags">Tag-uri (separate prin virgulă)</label>
            <input
              id="qb-from-sel-tags"
              className="admin-form-input"
              value={createFromSelectionForm.tagsText}
              onChange={(e) => setCreateFromSelectionForm((prev) => ({ ...prev, tagsText: e.target.value }))}
            />
            <div className="qb-modal-actions">
              <button
                type="button"
                className="lms-btn-secondary"
                onClick={() => setCreateFromSelectionOpen(false)}
                disabled={createFromSelectionLoading}
              >
                Anulează
              </button>
              <button type="button" className="lms-btn-primary" onClick={createFolderFromSelection} disabled={createFromSelectionLoading}>
                {createFromSelectionLoading ? 'Se creează...' : 'Creează folder și mută'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={moveToExistingOpen && canMutateInAdminArea}
          onClose={() => !moveToExistingLoading && setMoveToExistingOpen(false)}
        >
          <div className="qb-modal qb-modal-from-selection">
            <h3>Adaugă în folder existent</h3>
            <p className="qb-modal-warning">
              Vor fi mutate <strong>{selectedQuestionIds.length}</strong> întrebări în folderul ales. După mutare, ele nu
              vor mai rămâne atașate direct testului.
            </p>
            <label htmlFor="qb-move-target-folder">Folder existent</label>
            <select
              id="qb-move-target-folder"
              className="admin-form-input"
              value={moveTargetBankId}
              onChange={(e) => setMoveTargetBankId(e.target.value)}
            >
              {moveTargetFolders.map((folder) => (
                <option key={folder.id} value={String(folder.id)}>
                  {folder.title || `Banca #${folder.id}`}
                </option>
              ))}
            </select>
            <div className="qb-modal-actions">
              <button
                type="button"
                className="lms-btn-secondary"
                onClick={() => setMoveToExistingOpen(false)}
                disabled={moveToExistingLoading}
              >
                Anulează
              </button>
              <button
                type="button"
                className="lms-btn-primary"
                onClick={moveSelectionToExistingFolder}
                disabled={moveToExistingLoading || moveTargetFolders.length === 0}
              >
                {moveToExistingLoading ? 'Se mută...' : 'Mută în folder'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AdminQuestionBanksPage;
