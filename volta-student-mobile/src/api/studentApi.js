import { apiFetch } from './apiFetch';

export const studentApi = {
  async login({ email, password, remember }) {
    return apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember: !!remember }),
    });
  },

  async logout() {
    return apiFetch('/auth/logout', { method: 'POST' });
  },

  async me() {
    return apiFetch('/auth/me', { method: 'GET' });
  },

  async profile() {
    return apiFetch('/profile', { method: 'GET' });
  },

  async studentDashboard() {
    return apiFetch('/student/dashboard', { method: 'GET' });
  },

  async courses() {
    return apiFetch('/courses', { method: 'GET' });
  },

  async course(id) {
    return apiFetch(`/courses/${id}`, { method: 'GET' });
  },

  async lesson(id) {
    return apiFetch(`/lessons/${id}`, { method: 'GET' });
  },

  async checkLessonAccess(lessonId) {
    return apiFetch(`/lessons/${lessonId}/access`, { method: 'GET' });
  },

  async completeLesson(lessonId) {
    return apiFetch(`/lessons/${lessonId}/complete`, { method: 'POST' });
  },

  async events() {
    return apiFetch('/events', { method: 'GET' });
  },

  async event(id) {
    return apiFetch(`/events/${id}`, { method: 'GET' });
  },

  async examResults() {
    return apiFetch('/exam-results', { method: 'GET' });
  },

  async achievements() {
    return apiFetch('/achievements', { method: 'GET' });
  },

  async completedCourses() {
    return apiFetch('/completed-courses', { method: 'GET' });
  },

  async messages() {
    return apiFetch('/messages/conversations', { method: 'GET' });
  },

  async conversationMessages(conversationId) {
    return apiFetch(`/messages/conversations/${conversationId}/messages`, { method: 'GET' });
  },

  async sendConversationMessage(conversationId, content) {
    return apiFetch(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  },

  async markConversationRead(conversationId) {
    return apiFetch(`/messages/conversations/${conversationId}/read`, { method: 'POST' });
  },

  async availableMessageUsers(query = '') {
    const q = String(query || '').trim();
    const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
    return apiFetch(`/messages/available-users${suffix}`, { method: 'GET' });
  },

  async createDirectConversation(participantId) {
    return apiFetch('/messages/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'direct', participant_id: participantId }),
    });
  },

  async leaveGroupConversation(conversationId) {
    return apiFetch(`/messages/conversations/${conversationId}/leave`, {
      method: 'POST',
    });
  },
};

