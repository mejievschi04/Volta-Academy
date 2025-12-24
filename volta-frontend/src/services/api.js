import api from '../api.js';

// Categories are no longer supported

export const coursesService = {
  getAll: async () => {
    const response = await api.get('/courses');
    // Normalize response: handle both array and { data: [] } shapes
    const raw = response?.data;
    const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
    if (!Array.isArray(list)) {
      console.warn('coursesService.getAll: unexpected response shape', raw);
    }
    return list;
  },
  
  getById: async (id) => {
    const response = await api.get(`/courses/${id}`);
    return response.data?.data ?? response.data;
  },
  
  complete: async (id) => {
    const response = await api.post(`/courses/${id}/complete`);
    return response.data;
  },
};

export const lessonsService = {
  getAll: async (courseId = null) => {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.get('/lessons', { params });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/lessons/${id}`);
    return response.data;
  },
  
  complete: async (id) => {
    const response = await api.post(`/lessons/${id}/complete`);
    return response.data;
  },
};

export const dashboardService = {
  getDashboard: async () => {
    // Legacy endpoint - keep for compatibility
    try {
      const response = await api.get('/dashboard');
      return response.data;
    } catch (error) {
      console.error('Dashboard API error:', error);
      if (error.response) {
        throw new Error(error.response.data?.message || `Server error: ${error.response.status}`);
      } else if (error.request) {
        throw new Error('Nu s-a primit răspuns de la server. Verifică dacă backend-ul rulează.');
      } else {
        throw new Error(error.message || 'Eroare necunoscută');
      }
    }
  },
  
  getStudentDashboard: async () => {
    try {
      const response = await api.get('/student/dashboard');
      return response.data;
    } catch (error) {
      console.error('Student Dashboard API error:', error);
      if (error.response) {
        throw new Error(error.response.data?.message || `Server error: ${error.response.status}`);
      } else if (error.request) {
        throw new Error('Nu s-a primit răspuns de la server. Verifică dacă backend-ul rulează.');
      } else {
        throw new Error(error.message || 'Eroare necunoscută');
      }
    }
  },
  
  getProgress: async (courseId, userId) => {
    const response = await api.get(`/courses/${courseId}/progress/${userId}`);
    return response.data;
  },
};

export const courseProgressService = {
  getCourseProgress: async (courseId) => {
    const response = await api.get(`/courses/${courseId}/progress`);
    return response.data;
  },
  
  completeLesson: async (lessonId) => {
    const response = await api.post(`/lessons/${lessonId}/complete`);
    return response.data;
  },
  
  updateLessonProgress: async (lessonId, progressData) => {
    // Update progress without marking as completed
    const response = await api.put(`/lessons/${lessonId}/progress`, progressData);
    return response.data;
  },
  
  checkModuleAccess: async (moduleId) => {
    const response = await api.get(`/modules/${moduleId}/access`);
    return response.data;
  },
  
  checkLessonAccess: async (lessonId) => {
    const response = await api.get(`/lessons/${lessonId}/access`);
    return response.data;
  },
  
  checkExamAccess: async (examId) => {
    const response = await api.get(`/exams/${examId}/access`);
    return response.data;
  },
};

export const examService = {
  getExam: async (examId) => {
    const response = await api.get(`/exams/${examId}`);
    return response.data;
  },
  
  submitExam: async (examId, answers) => {
    const response = await api.post(`/exams/${examId}/submit`, { answers });
    return response.data;
  },
};

export const testService = {
  // Get test for student (from course context)
  getTest: async (testId, courseId = null) => {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.get(`/tests/${testId}`, { params });
    return response.data;
  },
  
  submitTest: async (testId, answers, courseId = null) => {
    const payload = { answers };
    if (courseId) payload.course_id = courseId;
    const response = await api.post(`/tests/${testId}/submit`, payload);
    return response.data;
  },
  
  // Get available tests for a course
  getCourseTests: async (courseId) => {
    const response = await api.get(`/courses/${courseId}/tests`);
    return response.data;
  },
};

export const achievementsService = {
  getAchievements: async () => {
    const response = await api.get('/achievements');
    return response.data;
  },
  
  getCertificates: async () => {
    const response = await api.get('/certificates');
    return response.data;
  },
  
  getCertificateInfo: async (courseId) => {
    const response = await api.get(`/certificates/${courseId}/info`);
    return response.data;
  },
  
  downloadCertificate: async (courseId) => {
    const response = await api.get(`/certificates/${courseId}/download`, {
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `certificat-${courseId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const profileService = {
  getProfile: async () => {
    const response = await api.get('/profile');
    return response.data;
  },
};

export const eventsService = {
  getAll: async (filters = {}) => {
    const response = await api.get('/events', { params: filters });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },
  
  getMyEvents: async (filter = 'all') => {
    const response = await api.get('/events/my', { params: { filter } });
    return response.data;
  },
  
  register: async (eventId) => {
    const response = await api.post(`/events/${eventId}/register`);
    return response.data;
  },
  
  cancelRegistration: async (eventId) => {
    const response = await api.post(`/events/${eventId}/cancel-registration`);
    return response.data;
  },
  
  markAttendance: async (eventId) => {
    const response = await api.post(`/events/${eventId}/mark-attendance`);
    return response.data;
  },
  
  markReplayWatched: async (eventId) => {
    const response = await api.post(`/events/${eventId}/mark-replay-watched`);
    return response.data;
  },
};

export const quizService = {
  getQuiz: async (courseId) => {
    const response = await api.get(`/courses/${courseId}/quiz`);
    return response.data;
  },
  
  submitQuiz: async (courseId, answers) => {
    const response = await api.post(`/courses/${courseId}/quiz/submit`, { answers });
    return response.data;
  },
};

export const examResultsService = {
  getAll: async () => {
    const response = await api.get('/exam-results');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/exam-results/${id}`);
    return response.data;
  },
};

export const authService = {
  register: async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },
  
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  
  me: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      // 401 is expected when user is not authenticated
      // Return null user data instead of throwing
      if (error.response?.status === 401) {
        return { user: null };
      }
      throw error;
    }
  },
  
  changePassword: async (currentPassword, newPassword, newPasswordConfirmation) => {
    const response = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    });
    return response.data;
  },
};

export const adminService = {
  // Dashboard
  getDashboard: async (params = {}) => {
    const response = await api.get('/admin/dashboard', { params });
    return response.data;
  },

  // Courses
  getCourses: async (params = {}) => {
    const response = await api.get('/admin/courses', { params });
    // Handle paginated response (Laravel returns {data: [...], current_page, etc.})
    // or plain array response
    const data = response.data;
    console.log('adminService.getCourses: Raw response:', data);
    console.log('adminService.getCourses: Is array?', Array.isArray(data));
    console.log('adminService.getCourses: Has data property?', data?.data);
    
    // Laravel paginator returns {data: [...], current_page, per_page, total, ...}
    if (Array.isArray(data)) {
      return data;
    }
    
    // If it's a paginated response, extract the data array
    if (data && data.data && Array.isArray(data.data)) {
      return data.data;
    }
    
    // Fallback: return empty array
    console.warn('adminService.getCourses: Unexpected response format, returning empty array');
    return [];
  },
  
  getCourse: async (id) => {
    const response = await api.get(`/admin/courses/${id}`);
    return response.data;
  },
  
  createCourse: async (courseData) => {
    // Check if courseData is FormData
    const isFormData = courseData instanceof FormData;
    const headers = isFormData 
      ? { 'Content-Type': 'multipart/form-data' }
      : { 'Content-Type': 'application/json' };
    
    // If not FormData, remove modules and prepare JSON payload
    const payload = isFormData 
      ? courseData 
      : (() => {
          const { modules, ...coursePayload } = courseData;
          // Ensure currency is 3 characters
          if (coursePayload.currency && coursePayload.currency.length !== 3) {
            coursePayload.currency = 'RON';
          } else if (!coursePayload.currency) {
            coursePayload.currency = 'RON';
          }
          return coursePayload;
        })();
    
    const response = await api.post('/admin/courses', payload, { headers });
    return response.data;
  },
  
  updateCourse: async (id, courseData) => {
    const response = await api.put(`/admin/courses/${id}`, courseData, {
      headers: {
        'Content-Type': courseData instanceof FormData ? 'multipart/form-data' : 'application/json',
      },
    });
    return response.data;
  },
  
  deleteCourse: async (id) => {
    const response = await api.delete(`/admin/courses/${id}`);
    return response.data;
  },

  getTeachers: async () => {
    const response = await api.get('/admin/courses/teachers/list');
    return response.data;
  },

  // Modules
  getModules: async (courseId = null) => {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.get('/admin/modules', { params });
    return response.data;
  },
  
  getModule: async (id) => {
    const response = await api.get(`/admin/modules/${id}`);
    return response.data;
  },
  
  createModule: async (moduleData) => {
    const response = await api.post('/admin/modules', moduleData);
    return response.data;
  },
  
  updateModule: async (id, moduleData) => {
    const response = await api.put(`/admin/modules/${id}`, moduleData);
    return response.data;
  },
  
  deleteModule: async (id) => {
    const response = await api.delete(`/admin/modules/${id}`);
    return response.data;
  },

  // Lessons
  getLessons: async (moduleId = null, courseId = null) => {
    const params = {};
    if (moduleId) params.module_id = moduleId;
    if (courseId) params.course_id = courseId;
    const response = await api.get('/admin/lessons', { params });
    return response.data;
  },
  
  getLesson: async (id) => {
    const response = await api.get(`/admin/lessons/${id}`);
    return response.data;
  },
  
  createLesson: async (lessonData) => {
    const response = await api.post('/admin/lessons', lessonData);
    return response.data;
  },
  
  updateLesson: async (id, lessonData) => {
    const response = await api.put(`/admin/lessons/${id}`, lessonData);
    return response.data;
  },
  
  deleteLesson: async (id) => {
    const response = await api.delete(`/admin/lessons/${id}`);
    return response.data;
  },

  // Exams (Legacy - kept for backward compatibility)
  // ============================================
  // DEPRECATED: Exam Management (Legacy)
  // ============================================
  // These methods are kept for backward compatibility with existing exams.
  // For new development, use the Test Builder (getTests, createTest, etc.)
  // Migration path: Exams → Tests (standalone test builder)
  // ============================================
  
  /**
   * @deprecated Use getTests() instead. Kept for backward compatibility.
   */
  getExams: async (courseId = null) => {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.get('/admin/exams', { params });
    return response.data;
  },
  
  /**
   * @deprecated Use getTest() instead. Kept for backward compatibility.
   */
  getExam: async (id) => {
    const response = await api.get(`/admin/exams/${id}`);
    return response.data;
  },
  
  /**
   * @deprecated Use createTest() instead. Kept for backward compatibility.
   */
  createExam: async (examData) => {
    const response = await api.post('/admin/exams', examData);
    return response.data;
  },
  
  /**
   * @deprecated Use updateTest() instead. Kept for backward compatibility.
   */
  updateExam: async (id, examData) => {
    const response = await api.put(`/admin/exams/${id}`, examData);
    return response.data;
  },
  
  /**
   * @deprecated Use deleteTest() instead. Kept for backward compatibility.
   */
  deleteExam: async (id) => {
    const response = await api.delete(`/admin/exams/${id}`);
    return response.data;
  },

  // Tests (Standalone Test Builder)
  getTests: async (params = {}) => {
    const response = await api.get('/admin/tests', { params });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
  },
  
  getTest: async (id) => {
    const response = await api.get(`/admin/tests/${id}`);
    return response.data;
  },
  
  createTest: async (testData) => {
    const response = await api.post('/admin/tests', testData);
    return response.data;
  },
  
  updateTest: async (id, testData) => {
    const response = await api.put(`/admin/tests/${id}`, testData);
    return response.data;
  },
  
  deleteTest: async (id) => {
    const response = await api.delete(`/admin/tests/${id}`);
    return response.data;
  },

  publishTest: async (id) => {
    const response = await api.post(`/admin/tests/${id}/publish`);
    return response.data;
  },

  linkTestToCourse: async (testId, courseId, options = {}) => {
    const response = await api.post(`/admin/tests/${testId}/link-to-course`, {
      course_id: courseId,
      ...options,
    });
    return response.data;
  },

  unlinkTestFromCourse: async (testId, courseId, scope = null, scopeId = null) => {
    const response = await api.post(`/admin/tests/${testId}/unlink-from-course`, {
      course_id: courseId,
      scope,
      scope_id: scopeId,
    });
    return response.data;
  },

  // Progression Rules
  getProgressionRules: async (courseId) => {
    const response = await api.get(`/admin/courses/${courseId}/progression-rules`);
    return response.data;
  },
  
  createProgressionRule: async (courseId, ruleData) => {
    const response = await api.post(`/admin/courses/${courseId}/progression-rules`, ruleData);
    return response.data;
  },
  
  updateProgressionRule: async (courseId, ruleId, ruleData) => {
    const response = await api.put(`/admin/courses/${courseId}/progression-rules/${ruleId}`, ruleData);
    return response.data;
  },
  
  deleteProgressionRule: async (courseId, ruleId) => {
    const response = await api.delete(`/admin/courses/${courseId}/progression-rules/${ruleId}`);
    return response.data;
  },

  toggleProgressionRule: async (courseId, ruleId) => {
    const response = await api.post(`/admin/courses/${courseId}/progression-rules/${ruleId}/toggle`);
    return response.data;
  },

  reorderProgressionRules: async (courseId, ruleIds) => {
    const response = await api.post(`/admin/courses/${courseId}/progression-rules/reorder`, {
      rule_ids: ruleIds,
    });
    return response.data;
  },

  // Question Banks
  getQuestionBanks: async (params = {}) => {
    const response = await api.get('/admin/question-banks', { params });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
  },
  
  getQuestionBank: async (id) => {
    const response = await api.get(`/admin/question-banks/${id}`);
    return response.data;
  },
  
  createQuestionBank: async (bankData) => {
    const response = await api.post('/admin/question-banks', bankData);
    return response.data;
  },
  
  updateQuestionBank: async (id, bankData) => {
    const response = await api.put(`/admin/question-banks/${id}`, bankData);
    return response.data;
  },
  
  deleteQuestionBank: async (id) => {
    const response = await api.delete(`/admin/question-banks/${id}`);
    return response.data;
  },

  getQuestionBankQuestions: async (bankId) => {
    const response = await api.get(`/admin/question-banks/${bankId}/questions`);
    return response.data;
  },

  addQuestionToBank: async (bankId, questionData) => {
    const response = await api.post(`/admin/question-banks/${bankId}/questions`, questionData);
    return response.data;
  },

  removeQuestionFromBank: async (bankId, questionId) => {
    const response = await api.delete(`/admin/question-banks/${bankId}/questions/${questionId}`);
    return response.data;
  },

  // Events
  getEvents: async (filters = {}) => {
    const response = await api.get('/admin/events', { params: filters });
    return response.data;
  },
  
  getEvent: async (id) => {
    const response = await api.get(`/admin/events/${id}`);
    return response.data;
  },
  
  createEvent: async (eventData) => {
    const response = await api.post('/admin/events', eventData);
    return response.data;
  },
  
  updateEvent: async (id, eventData) => {
    const response = await api.put(`/admin/events/${id}`, eventData);
    return response.data;
  },
  
  deleteEvent: async (id) => {
    const response = await api.delete(`/admin/events/${id}`);
    return response.data;
  },
  
  eventQuickAction: async (id, action) => {
    const response = await api.post(`/admin/events/${id}/actions/${action}`);
    return response.data;
  },
  
  eventBulkAction: async (action, eventIds) => {
    const response = await api.post('/admin/events/bulk-actions', {
      action,
      event_ids: eventIds,
    });
    return response.data;
  },
  
  getEventInsights: async () => {
    const response = await api.get('/admin/events/insights');
    return response.data;
  },
  
  getEventInstructors: async () => {
    const response = await api.get('/admin/events/instructors/list');
    return response.data;
  },

  // Teams
  getTeams: async () => {
    const response = await api.get('/admin/teams');
    return response.data;
  },
  
  getTeam: async (id) => {
    const response = await api.get(`/admin/teams/${id}`);
    return response.data;
  },
  
  createTeam: async (teamData) => {
    const response = await api.post('/admin/teams', teamData);
    return response.data;
  },
  
  updateTeam: async (id, teamData) => {
    const response = await api.put(`/admin/teams/${id}`, teamData);
    return response.data;
  },
  
  deleteTeam: async (id) => {
    const response = await api.delete(`/admin/teams/${id}`);
    return response.data;
  },
  
  attachUsersToTeam: async (teamId, userIds) => {
    const response = await api.post(`/admin/teams/${teamId}/users`, { user_ids: userIds });
    return response.data;
  },
  
  attachCoursesToTeam: async (teamId, courseIds) => {
    const response = await api.post(`/admin/teams/${teamId}/courses`, { course_ids: courseIds });
    return response.data;
  },

  // Users
  getUsers: async () => {
    const response = await api.get('/admin/users');
    // Handle paginated response (Laravel returns {data: [...], current_page, etc.})
    // or plain array response
    const data = response.data;
    return Array.isArray(data) ? data : (data.data || []);
  },
  
  getUser: async (id) => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },
  
  createUser: async (userData) => {
    const response = await api.post('/admin/users', userData);
    return response.data;
  },
  
  updateUser: async (id, userData) => {
    const response = await api.put(`/admin/users/${id}`, userData);
    return response.data;
  },
  
  deleteUser: async (id) => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },

  assignCourses: async (userId, courseIds, isMandatory = true) => {
    const response = await api.post(`/admin/users/${userId}/courses`, {
      course_ids: courseIds,
      is_mandatory: isMandatory,
    });
    return response.data;
  },

  removeCourse: async (userId, courseId) => {
    const response = await api.delete(`/admin/users/${userId}/courses/${courseId}`);
    return response.data;
  },

  // Team Members Management
  getTeamMembers: async (params = {}) => {
    const response = await api.get('/admin/team-members', { params });
    const data = response.data;
    return Array.isArray(data) ? data : (data.data || []);
  },

  updateRoleAndPermissions: async (userId, role, permissions) => {
    const response = await api.put(`/admin/team-members/${userId}/role-permissions`, {
      role,
      permissions,
    });
    return response.data;
  },

  activateTeamMember: async (userId) => {
    const response = await api.post(`/admin/team-members/${userId}/activate`);
    return response.data;
  },

  suspendTeamMember: async (userId, reason = null, suspendedUntil = null) => {
    const response = await api.post(`/admin/team-members/${userId}/suspend`, {
      reason,
      suspended_until: suspendedUntil,
    });
    return response.data;
  },

  resetTeamMemberAccess: async (userId) => {
    const response = await api.post(`/admin/team-members/${userId}/reset-access`);
    return response.data;
  },

  removeTeamMemberFromTeam: async (userId) => {
    const response = await api.post(`/admin/team-members/${userId}/remove-from-team`);
    return response.data;
  },

  // Course Teams
  attachTeamsToCourse: async (courseId, teamIds) => {
    const response = await api.post(`/admin/courses/${courseId}/teams`, { team_ids: teamIds });
    return response.data;
  },

  // Categories are no longer supported

  // Activity Logs
  getActivityLogs: async (params = {}) => {
    const response = await api.get('/admin/activity-logs', { params });
    return response.data;
  },
  
  getActivityLog: async (id) => {
    const response = await api.get(`/admin/activity-logs/${id}`);
    return response.data;
  },

  // Exam Manual Review
  getPendingExamReviews: async () => {
    const response = await api.get('/admin/exams/pending-reviews');
    return response.data;
  },
  
  submitManualReview: async (resultId, reviewScores) => {
    const response = await api.post(`/admin/exam-results/${resultId}/manual-review`, {
      manual_review_scores: reviewScores,
    });
    return response.data;
  },

  // Course Quick Actions
  courseQuickAction: async (courseId, action) => {
    const response = await api.post(`/admin/courses/${courseId}/actions/${action}`);
    return response.data;
  },

  // Course Bulk Actions
  courseBulkAction: async (courseIds, action) => {
    const response = await api.post('/admin/courses/bulk-actions', {
      course_ids: courseIds,
      action: action,
    });
    return response.data;
  },

  // Course Insights
  getCourseInsights: async () => {
    const response = await api.get('/admin/courses/insights');
    return response.data;
  },

  // Course Preview
  previewCourse: async (id) => {
    const response = await api.get(`/admin/courses/${id}/preview`);
    return response.data;
  },

  // Module Management
  reorderModules: async (courseId, moduleIds) => {
    const response = await api.post(`/admin/courses/${courseId}/modules/reorder`, {
      module_ids: moduleIds,
    });
    return response.data;
  },

  toggleModuleLock: async (moduleId) => {
    const response = await api.post(`/admin/modules/${moduleId}/toggle-lock`);
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/admin/settings');
    return response.data;
  },
  updateSettings: async (settingsData) => {
    const response = await api.put('/admin/settings', settingsData);
    return response.data;
  },
  
  // Export & Backup
  exportData: async () => {
    const response = await api.get('/admin/export', {
      responseType: 'json',
    });
    return response.data;
  },
  
  // System
  clearCache: async () => {
    const response = await api.post('/admin/system/clear-cache');
    return response.data;
  },
  
  // Import Backup
  importBackup: async (file) => {
    const formData = new FormData();
    formData.append('backup_file', file);
    const response = await api.post('/admin/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

