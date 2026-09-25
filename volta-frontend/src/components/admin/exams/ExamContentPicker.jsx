import React, { useMemo, useState } from 'react';
import { ArrowLeft, FolderOpen, ListChecks, Search, Star, X } from 'lucide-react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContextShared.js';
import QuestionCatalogByMap, { CatalogGroupCard } from '../question-banks/QuestionCatalogByMap';
import QuestionRow from '../question-banks/QuestionRow';
import Drawer from '../question-banks/Drawer';
import '../../../pages/admin/AdminQuestionBanksPage.css';
import './ExamContentPicker.css';

function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const QUESTION_TYPE_LABELS = {
  single_choice: 'Răspuns unic',
  multiple_choice: 'Răspuns multiplu',
  true_false: 'Adevărat/Fals',
  matching: 'Potrivire',
  ordering: 'Ordonare',
  fill_in_blank: 'Completare spații',
};

export default function ExamContentPicker({
  examSettings,
  setExamSettings,
  selectedQuestionItems,
  onToggleQuestion,
  onAddQuestions,
  onClearQuestions,
  onPatchSelectedQuestion,
  canMutate = true,
  contentBanks,
  contentBanksLoading,
  contentBanksError,
  contentSearch,
  setContentSearch,
  contentSort,
  setContentSort,
  contentOnlyWithQuestions,
  setContentOnlyWithQuestions,
  filteredContentBanks,
  onConfirm,
  confirmLoading,
}) {
  const { error, success } = useToast();
  const selectionMode = examSettings.selectionMode === 'folders' ? 'folders' : 'questions';
  const [questionBrowse, setQuestionBrowse] = useState('catalog');
  const [folderLevel, setFolderLevel] = useState('list');
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderQuestions, setFolderQuestions] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [folderError, setFolderError] = useState('');
  const [drawerQuestion, setDrawerQuestion] = useState(null);
  const [addingFolderId, setAddingFolderId] = useState(null);
  const [starringId, setStarringId] = useState(null);

  const selectedIds = useMemo(
    () => (Array.isArray(examSettings.selectedQuestionIds) ? examSettings.selectedQuestionIds.map(Number) : []),
    [examSettings.selectedQuestionIds],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedFolders = useMemo(
    () => (Array.isArray(contentBanks) ? contentBanks.filter((bank) => examSettings.selectedFolderIds.includes(bank.id)) : []),
    [contentBanks, examSettings.selectedFolderIds],
  );
  const folderQuery = folderSearch.trim().toLowerCase();
  const visibleFolderQuestions = useMemo(
    () => folderQuestions.filter((question) => stripHtml(question?.content || '').toLowerCase().includes(folderQuery)),
    [folderQuestions, folderQuery],
  );
  const folderPool = selectedFolders.reduce((sum, bank) => sum + Number(bank.questions_count || 0), 0);
  const examCount = Math.min(
    Math.max(1, Number(examSettings.questionCount || 1)),
    Math.max(1, selectionMode === 'questions' ? selectedIds.length || 1 : Number(examSettings.questionCount || 1)),
  );
  const canSave = Boolean(
    canMutate
    && !confirmLoading
    && (selectionMode === 'questions' ? selectedIds.length > 0 : examSettings.selectedFolderIds.length > 0),
  );

  const setMode = (mode) => {
    setExamSettings((prev) => ({
      ...prev,
      selectionMode: mode,
      questionCount: Math.max(1, Number(prev.questionCount || 10)),
    }));
  };

  const openFolder = async (bank) => {
    setActiveFolder(bank);
    setFolderLevel('questions');
    setFolderSearch('');
    setFolderError('');
    setFolderLoading(true);
    try {
      const rows = await adminService.getQuestionBankQuestions(bank.id);
      setFolderQuestions(Array.isArray(rows) ? rows : []);
    } catch {
      setFolderQuestions([]);
      setFolderError('Nu s-au putut încărca întrebările folderului.');
    } finally {
      setFolderLoading(false);
    }
  };

  const closeFolder = () => {
    setFolderLevel('list');
    setActiveFolder(null);
    setFolderQuestions([]);
    setFolderSearch('');
  };

  const addQuestions = (rows, origin) => {
    if (onAddQuestions) {
      onAddQuestions(rows, origin);
      return;
    }
    (Array.isArray(rows) ? rows : []).forEach((question) => {
      if (!selectedSet.has(Number(question.id))) onToggleQuestion(question, origin);
    });
  };

  const addAllFromFolder = async (bank) => {
    setAddingFolderId(bank.id);
    try {
      const rows = await adminService.getQuestionBankQuestions(bank.id);
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        error('Acest folder nu are întrebări.');
        return;
      }
      addQuestions(list, bank.title || 'Folder');
      success(`Întrebările din „${bank.title}” au fost adăugate.`);
    } catch {
      error('Nu s-au putut adăuga întrebările folderului.');
    } finally {
      setAddingFolderId(null);
    }
  };

  const toggleVisibleFolderQuestions = () => {
    const allSelected = visibleFolderQuestions.every((question) => selectedSet.has(Number(question.id)));
    if (allSelected) {
      visibleFolderQuestions.forEach((question) => onToggleQuestion(question, activeFolder?.title || 'Folder'));
      return;
    }
    addQuestions(visibleFolderQuestions, activeFolder?.title || 'Folder');
  };

  const toggleStar = async (item) => {
    if (!canMutate || starringId) return;
    setStarringId(item.id);
    try {
      const updated = await adminService.toggleQuestionStar(item.id);
      const starred = Boolean(updated?.question?.is_starred);
      onPatchSelectedQuestion?.(item.id, { is_starred: starred });
    } catch {
      error('Nu am putut schimba steaua.');
    } finally {
      setStarringId(null);
    }
  };

  const openSelectedInTest = (item) => {
    const testId = Number(item?.testId || 0);
    if (testId > 0) {
      window.open(`/admin/tests/${testId}/builder?section=questions&question=${item.id}`, '_blank', 'noopener');
      return;
    }
    const bankId = Number(item?.bankId || 0);
    if (bankId > 0) {
      window.open(`/admin/question-banks/${bankId}`, '_blank', 'noopener');
      return;
    }
    error('Întrebarea nu e legată de un test.');
  };

  const toggleFolder = (bank) => {
    setExamSettings((prev) => {
      const exists = prev.selectedFolderIds.includes(bank.id);
      const selectedFolderIds = exists
        ? prev.selectedFolderIds.filter((folderId) => folderId !== bank.id)
        : [...prev.selectedFolderIds, bank.id];
      return { ...prev, contentBankId: bank.id, selectedFolderIds, selectionMode: 'folders' };
    });
  };

  return (
    <div className="exam-picker">
      <header className="exam-picker-head">
        <div>
          <p className="exam-picker-kicker">Conținut examen</p>
          <h3>Ce întrebări intră în examen?</h3>
          <p className="exam-picker-lead">
            Alegi pool-ul. Steaua o pui pe întrebările deja selectate: cele cu stea apar la toți, restul se trag random. Deschide o întrebare ca să o editezi în test.
          </p>
        </div>
        <div className="exam-picker-head-count" aria-live="polite">
          <strong>{examCount}</strong>
          <span>{examCount === 1 ? 'întrebare în examen' : 'întrebări în examen'}</span>
        </div>
      </header>

      <div className="exam-picker-methods" role="tablist" aria-label="Cum alegi întrebările">
        <button
          type="button"
          role="tab"
          className={selectionMode === 'questions' ? 'lms-btn-primary' : 'lms-btn-secondary'}
          aria-selected={selectionMode === 'questions'}
          onClick={() => setMode('questions')}
        >
          <ListChecks size={18} aria-hidden />
          Alege întrebări
        </button>
        <button
          type="button"
          role="tab"
          className={selectionMode === 'folders' ? 'lms-btn-primary' : 'lms-btn-secondary'}
          aria-selected={selectionMode === 'folders'}
          onClick={() => setMode('folders')}
        >
          <FolderOpen size={18} aria-hidden />
          Din foldere
        </button>
      </div>

      <div className="exam-picker-split">
        <section className="exam-picker-browse" aria-label="Catalog">
          {selectionMode === 'questions' ? (
            <>
              <div className="exam-picker-browse-bar">
                <p className="exam-picker-step">Intră în mapă sau folder, apoi bifează. Sau adaugă tot testul odată.</p>
                <div className="exam-picker-source" role="tablist" aria-label="De unde iei întrebările">
                  <button
                    type="button"
                    className={questionBrowse === 'catalog' ? 'lms-btn-primary' : 'lms-btn-secondary'}
                    onClick={() => setQuestionBrowse('catalog')}
                  >
                    Mape
                  </button>
                  <button
                    type="button"
                    className={questionBrowse === 'folders' ? 'lms-btn-primary' : 'lms-btn-secondary'}
                    onClick={() => setQuestionBrowse('folders')}
                  >
                    Foldere
                  </button>
                </div>
              </div>

              <div className="exam-picker-browse-body">
                {questionBrowse === 'catalog' ? (
                  <QuestionCatalogByMap
                    selectable={canMutate}
                    showStar={false}
                    selectedIds={selectedIds}
                    onToggleSelect={(question, origin) => onToggleQuestion(question, origin || question?.test?.title || 'Catalog')}
                    onAddMany={canMutate ? onAddQuestions : undefined}
                  />
                ) : (
                  <div className="exam-picker-folder-browser">
                    {folderLevel === 'questions' ? (
                      <div className="qb-catalog-nav">
                        <button type="button" className="lms-btn-secondary" onClick={closeFolder}>
                          <ArrowLeft size={16} aria-hidden />
                          Înapoi la foldere
                        </button>
                        <nav className="qb-catalog-crumbs" aria-label="Navigare foldere">
                          <button type="button" className="qb-crumb" onClick={closeFolder}>Foldere</button>
                          {activeFolder ? (
                            <>
                              <span aria-hidden>/</span>
                              <span className="qb-crumb is-active">{activeFolder.title}</span>
                            </>
                          ) : null}
                        </nav>
                      </div>
                    ) : (
                      <div className="qb-search-field">
                        <Search size={18} aria-hidden />
                        <input
                          className="admin-form-input qb-search-input"
                          type="search"
                          placeholder="Caută folder"
                          value={contentSearch}
                          onChange={(e) => setContentSearch(e.target.value)}
                        />
                      </div>
                    )}

                    {folderLevel === 'questions' ? (
                      <div className="qb-search-field">
                        <Search size={18} aria-hidden />
                        <input
                          className="admin-form-input qb-search-input"
                          type="search"
                          placeholder="Caută întrebare"
                          value={folderSearch}
                          onChange={(e) => setFolderSearch(e.target.value)}
                        />
                      </div>
                    ) : null}

                    {folderError ? <p className="exam-picker-error">{folderError}</p> : null}
                    {contentBanksError && folderLevel === 'list' ? <p className="exam-picker-error">{contentBanksError}</p> : null}

                    {folderLevel === 'list' ? (
                      contentBanksLoading ? (
                        <p className="exam-picker-status">Se încarcă folderele...</p>
                      ) : filteredContentBanks.length ? (
                        <section className="qb-catalog-grid" aria-label="Foldere">
                          {filteredContentBanks.map((bank) => (
                            <CatalogGroupCard
                              key={bank.id}
                              title={bank.title}
                              description={bank.description || 'Fără descriere'}
                              icon={<FolderOpen size={22} />}
                              stats={[`${bank.questions_count || 0} întrebări`]}
                              onOpen={() => openFolder(bank)}
                              action={canMutate && Number(bank.questions_count || 0) > 0 ? (
                                <button
                                  type="button"
                                  className="lms-btn-primary lms-btn-sm"
                                  disabled={addingFolderId === bank.id}
                                  onClick={() => addAllFromFolder(bank)}
                                >
                                  {addingFolderId === bank.id ? 'Se adaugă...' : 'Adaugă toate'}
                                </button>
                              ) : null}
                            />
                          ))}
                        </section>
                      ) : (
                        <div className="qb-empty qb-empty--soft">
                          <FolderOpen size={30} aria-hidden />
                          <p className="qb-empty-title">Niciun folder găsit</p>
                        </div>
                      )
                    ) : folderLoading ? (
                      <p className="exam-picker-status">Se încarcă întrebările...</p>
                    ) : visibleFolderQuestions.length ? (
                      <div className="qb-questions-list" role="list" aria-label="Întrebări folder">
                        <div className="qb-catalog-select-bar">
                          {canMutate ? (
                            <button type="button" className="lms-btn-secondary" onClick={toggleVisibleFolderQuestions}>
                              {visibleFolderQuestions.every((question) => selectedSet.has(Number(question.id)))
                                ? 'Deselectează vizibilele'
                                : 'Selectează toate vizibilele'}
                            </button>
                          ) : null}
                          <span>
                            {visibleFolderQuestions.filter((question) => selectedSet.has(Number(question.id))).length} / {visibleFolderQuestions.length} aici
                          </span>
                        </div>
                        {visibleFolderQuestions.map((question) => (
                          <QuestionRow
                            key={question.id}
                            question={question}
                            selected={selectedSet.has(Number(question.id))}
                            readOnly
                            selectable={canMutate}
                            showStar={false}
                            onToggleSelect={() => onToggleQuestion(question, activeFolder?.title || 'Folder')}
                            onToggleStar={() => {}}
                            onOpenDrawer={setDrawerQuestion}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="qb-empty qb-empty--soft">
                        <ListChecks size={30} aria-hidden />
                        <p className="qb-empty-title">Nicio întrebare în acest folder</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="exam-picker-browse-bar">
                <p className="exam-picker-step">Bifează folderele din care se trag întrebările</p>
              </div>
              <div className="exam-picker-random-tools">
                <label>
                  Câte întrebări în examen
                  <input
                    className="admin-form-input"
                    type="number"
                    min={1}
                    max={200}
                    value={examSettings.questionCount}
                    onChange={(e) => setExamSettings((prev) => ({ ...prev, questionCount: Math.max(1, Number(e.target.value || 1)) }))}
                  />
                </label>
                <label className="exam-picker-check">
                  <input type="checkbox" checked={examSettings.includeStarred} onChange={(e) => setExamSettings((prev) => ({ ...prev, includeStarred: e.target.checked }))} />
                  <span>Cele cu stea apar la toți</span>
                </label>
                <div className="qb-search-field exam-picker-tool-search">
                  <Search size={18} aria-hidden />
                  <input
                    className="admin-form-input qb-search-input"
                    type="search"
                    placeholder="Caută folder"
                    value={contentSearch}
                    onChange={(e) => setContentSearch(e.target.value)}
                  />
                </div>
                <label>
                  Sortare
                  <select className="admin-form-input" value={contentSort} onChange={(e) => setContentSort(e.target.value)}>
                    <option value="questions_desc">Cele mai multe întrebări</option>
                    <option value="questions_asc">Cele mai puține întrebări</option>
                    <option value="title_asc">Titlu A-Z</option>
                    <option value="title_desc">Titlu Z-A</option>
                  </select>
                </label>
                <label className="exam-picker-check">
                  <input type="checkbox" checked={contentOnlyWithQuestions} onChange={(e) => setContentOnlyWithQuestions(e.target.checked)} />
                  <span>Doar foldere cu întrebări</span>
                </label>
              </div>
              {contentBanksError ? <p className="exam-picker-error">{contentBanksError}</p> : null}
              {selectedFolders.length > 0 && examSettings.questionCount > folderPool ? (
                <p className="exam-picker-warning">
                  Ai cerut {examSettings.questionCount} întrebări, dar folderele alese au doar {folderPool}.
                </p>
              ) : null}
              <div className="exam-picker-browse-body">
                {contentBanksLoading ? (
                  <p className="exam-picker-status">Se încarcă folderele...</p>
                ) : filteredContentBanks.length ? (
                  <div className="exam-picker-folder-grid">
                    {filteredContentBanks.map((bank) => {
                      const active = examSettings.selectedFolderIds.includes(bank.id);
                      return (
                        <button
                          key={bank.id}
                          type="button"
                          className={`exam-picker-folder-card ${active ? 'is-active' : ''}`}
                          onClick={() => toggleFolder(bank)}
                          aria-pressed={active}
                          disabled={!canMutate}
                        >
                          <span className="exam-picker-folder-check" aria-hidden>{active ? '✓' : ''}</span>
                          <div>
                            <strong>{bank.title}</strong>
                            <p>{bank.description || 'Fără descriere'}</p>
                          </div>
                          <em>{bank.questions_count || 0} disponibile</em>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="qb-empty qb-empty--soft">
                    <FolderOpen size={30} aria-hidden />
                    <p className="qb-empty-title">Niciun folder găsit</p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="exam-picker-tray" aria-label="Selecție curentă">
          {selectionMode === 'questions' ? (
            <>
              <div className="exam-picker-tray-top">
                <div className="exam-picker-tray-head">
                  <h4>Pool · {selectedQuestionItems.length}</h4>
                  {selectedQuestionItems.length > 0 && canMutate ? (
                    <button type="button" className="lms-btn-secondary" onClick={onClearQuestions}>
                      Golește
                    </button>
                  ) : null}
                </div>
                <div className="exam-picker-random-tools exam-picker-random-tools--compact">
                  <label>
                    Câte întrebări primește elevul
                    <input
                      className="admin-form-input"
                      type="number"
                      min={1}
                      max={Math.max(1, selectedIds.length || 1)}
                      value={examSettings.questionCount}
                      onChange={(e) => setExamSettings((prev) => ({
                        ...prev,
                        questionCount: Math.max(1, Number(e.target.value || 1)),
                      }))}
                      disabled={!canMutate}
                    />
                  </label>
                  <label className="exam-picker-check">
                    <input
                      type="checkbox"
                      checked={examSettings.includeStarred}
                      onChange={(e) => setExamSettings((prev) => ({ ...prev, includeStarred: e.target.checked }))}
                      disabled={!canMutate}
                    />
                    <span>Cele cu stea apar la toți</span>
                  </label>
                </div>
                {selectedIds.length > 0 && Number(examSettings.questionCount || 0) > selectedIds.length ? (
                  <p className="exam-picker-warning">
                    Ai cerut {examSettings.questionCount} întrebări, dar pool-ul are doar {selectedIds.length}.
                  </p>
                ) : null}
              </div>
              {selectedQuestionItems.length ? (
                <ul className="exam-picker-tray-list">
                  {selectedQuestionItems.map((item, index) => (
                    <li key={item.id} className="is-question">
                      <span className="exam-picker-tray-index">{index + 1}</span>
                      {canMutate ? (
                        <button
                          type="button"
                          className={`qb-star-btn ${item.is_starred ? 'is-starred' : ''}`}
                          onClick={() => toggleStar(item)}
                          disabled={starringId === item.id}
                          title={item.is_starred ? 'Scoate steaua' : 'Marchează cu stea. Apare la toți elevii.'}
                          aria-label={item.is_starred ? 'Scoate steaua' : 'Marchează cu stea'}
                        >
                          <Star size={18} fill={item.is_starred ? 'currentColor' : 'none'} aria-hidden />
                        </button>
                      ) : (
                        <span className={`qb-star-btn ${item.is_starred ? 'is-starred' : ''}`} aria-hidden>
                          <Star size={18} fill={item.is_starred ? 'currentColor' : 'none'} />
                        </span>
                      )}
                      <button type="button" className="exam-picker-tray-open" onClick={() => openSelectedInTest(item)}>
                        <strong>{stripHtml(item.content) || `Întrebarea ${item.id}`}</strong>
                        <small>{QUESTION_TYPE_LABELS[item.type] || item.type || 'Întrebare'} · {item.origin || 'Selectată'} · Deschide în test</small>
                      </button>
                      {canMutate ? (
                        <button type="button" className="lms-btn-secondary" onClick={() => onToggleQuestion(item, item.origin)}>
                          <X size={14} aria-hidden />
                          Scoate
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="exam-picker-tray-empty">
                  Nicio întrebare încă. Intră într-un test și bifează, sau apasă „Adaugă toate”.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="exam-picker-tray-head">
                <h4>Foldere alese · {selectedFolders.length}</h4>
                {selectedFolders.length > 0 && canMutate ? (
                  <button
                    type="button"
                    className="lms-btn-secondary"
                    onClick={() => setExamSettings((prev) => ({ ...prev, selectedFolderIds: [], contentBankId: null }))}
                  >
                    Golește
                  </button>
                ) : null}
              </div>
              <p className="exam-picker-tray-note">
                {examSettings.questionCount} întrebări din {folderPool} disponibile
              </p>
              {selectedFolders.length ? (
                <ul className="exam-picker-tray-list">
                  {selectedFolders.map((bank, index) => (
                    <li key={bank.id}>
                      <span className="exam-picker-tray-index">{index + 1}</span>
                      <span className="exam-picker-tray-copy">
                        <strong>{bank.title}</strong>
                        <small>{bank.questions_count || 0} întrebări</small>
                      </span>
                      {canMutate ? (
                        <button type="button" className="lms-btn-secondary" onClick={() => toggleFolder(bank)}>
                          <X size={14} aria-hidden />
                          Scoate
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="exam-picker-tray-empty">Bifează cel puțin un folder din stânga.</p>
              )}
            </>
          )}

          <button
            type="button"
            className="lms-btn-primary exam-picker-confirm"
            onClick={onConfirm}
            disabled={!canSave}
          >
            {confirmLoading ? 'Se salvează...' : `Salvează selecția · ${examCount}`}
          </button>
          {!canMutate ? (
            <p className="exam-picker-tray-note">Nu poți modifica selecția din acest cont.</p>
          ) : !canSave && !confirmLoading ? (
            <p className="exam-picker-tray-note">
              {selectionMode === 'questions' ? 'Alege cel puțin o întrebare ca să salvezi.' : 'Alege cel puțin un folder ca să salvezi.'}
            </p>
          ) : null}
        </aside>
      </div>

      <Drawer open={Boolean(drawerQuestion)} question={drawerQuestion} onClose={() => setDrawerQuestion(null)} />
    </div>
  );
}
