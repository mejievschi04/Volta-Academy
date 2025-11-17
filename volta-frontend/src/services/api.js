import api from '../api.js';

export const categoriesService = {
  getAll: async () => {
    const response = await api.get('/categories');
    return response.data;
  },
};

export const coursesService = {
  getAll: async () => {
    const response = await api.get('/courses');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/courses/${id}`);
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
  
  getProgress: async (courseId, userId) => {
    const response = await api.get(`/courses/${courseId}/progress/${userId}`);
    return response.data;
  },
};

export const profileService = {
  getProfile: async () => {
    const response = await api.get('/profile');
    return response.data;
  },
};

export const rewardsService = {
  getAll: async () => {
    const response = await api.get('/rewards');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/rewards/${id}`);
    return response.data;
  },
};

export const eventsService = {
  getAll: async () => {
    const response = await api.get('/events');
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
    const response = await api.get('/auth/me');
    return response.data;
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
  getDashboard: async () => {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },

  // Courses
  getCourses: async () => {
    const response = await api.get('/admin/courses');
    // Handle paginated response (Laravel returns {data: [...], current_page, etc.})
    // or plain array response
    const data = response.data;
    return Array.isArray(data) ? data : (data.data || []);
  },
  
  getCourse: async (id) => {
    const response = await api.get(`/admin/courses/${id}`);
    return response.data;
  },
  
  createCourse: async (courseData) => {
    const response = await api.post('/admin/courses', courseData);
    return response.data;
  },
  
  updateCourse: async (id, courseData) => {
    const response = await api.put(`/admin/courses/${id}`, courseData);
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

  // Lessons
  getLessons: async (courseId = null) => {
    const params = courseId ? { course_id: courseId } : {};
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

  // Exams
  getExams: async (courseId = null) => {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.get('/admin/exams', { params });
    return response.data;
  },
  
  getExam: async (id) => {
    const response = await api.get(`/admin/exams/${id}`);
    return response.data;
  },
  
  createExam: async (examData) => {
    const response = await api.post('/admin/exams', examData);
    return response.data;
  },
  
  updateExam: async (id, examData) => {
    const response = await api.put(`/admin/exams/${id}`, examData);
    return response.data;
  },
  
  deleteExam: async (id) => {
    const response = await api.delete(`/admin/exams/${id}`);
    return response.data;
  },

  // Rewards
  getRewards: async () => {
    const response = await api.get('/admin/rewards');
    return response.data;
  },
  
  getReward: async (id) => {
    const response = await api.get(`/admin/rewards/${id}`);
    return response.data;
  },
  
  createReward: async (rewardData) => {
    const response = await api.post('/admin/rewards', rewardData);
    return response.data;
  },
  
  updateReward: async (id, rewardData) => {
    const response = await api.put(`/admin/rewards/${id}`, rewardData);
    return response.data;
  },
  
  deleteReward: async (id) => {
    const response = await api.delete(`/admin/rewards/${id}`);
    return response.data;
  },

  // Events
  getEvents: async () => {
    const response = await api.get('/admin/events');
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

  // Course Teams
  attachTeamsToCourse: async (courseId, teamIds) => {
    const response = await api.post(`/admin/courses/${courseId}/teams`, { team_ids: teamIds });
    return response.data;
  },

  // Categories
  getCategories: async () => {
    const response = await api.get('/admin/categories');
    return response.data;
  },
  
  getCategory: async (id) => {
    const response = await api.get(`/admin/categories/${id}`);
    return response.data;
  },
  
  createCategory: async (categoryData) => {
    const response = await api.post('/admin/categories', categoryData);
    return response.data;
  },
  
  updateCategory: async (id, categoryData) => {
    const response = await api.put(`/admin/categories/${id}`, categoryData);
    return response.data;
  },
  
  deleteCategory: async (id) => {
    const response = await api.delete(`/admin/categories/${id}`);
    return response.data;
  },
};

