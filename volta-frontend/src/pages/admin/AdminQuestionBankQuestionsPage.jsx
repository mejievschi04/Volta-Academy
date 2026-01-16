import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import QuestionBankEditor from '../../components/admin/question-banks/QuestionBankEditor';

const AdminQuestionBankQuestionsPage = () => {
  const { bankId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [bank, setBank] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [bankId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bankResp, questionsResp] = await Promise.all([
        adminService.getQuestionBank(bankId),
        adminService.getQuestionBankQuestions(bankId),
      ]);
      setBank(bankResp);
      setQuestions(Array.isArray(questionsResp) ? questionsResp : (questionsResp?.data || []));
      setError(null);
    } catch (err) {
      console.error('Error loading questions page:', err);
      setError('Eroare la încărcarea întrebărilor');
      showToast('Eroare la încărcarea întrebărilor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="admin-container">
        <div className="lms-dashboard-loading">
          <div className="lms-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-page-header">
        <div className="admin-page-header-content">
          <h1 className="admin-page-title">{bank?.title || 'Bancă de Întrebări'}</h1>
          <p className="admin-page-subtitle">Gestionează întrebările din această bancă</p>
        </div>
        <button className="lms-btn-secondary" onClick={() => navigate('/admin/question-banks')}>
          Înapoi
        </button>
      </div>

      {error && (
        <div className="lms-error-message">
          {error}
        </div>
      )}

      <QuestionBankEditor
        bankId={bankId}
        questions={questions}
        onUpdate={handleUpdate}
      />
    </div>
  );
};

export default AdminQuestionBankQuestionsPage;
