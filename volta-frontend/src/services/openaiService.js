import api from '../api.js';

// Service for AI generation using Hugging Face API
export const openaiService = {
	/**
	 * Generate a course using AI chat
	 * @param {Object} params - Course generation parameters
	 * @param {string} params.prompt - User's prompt/request
	 * @param {Array} params.messages - Chat history (optional)
	 * @param {string} params.type - Type: 'course' or 'test'
	 * @returns {Promise} Stream response
	 */
	generateCourse: async (prompt, messages = []) => {
		try {
			const response = await api.post('/admin/ai/generate-course', {
				prompt,
				messages,
				type: 'course',
			});
			return response.data;
		} catch (error) {
			console.error('Error generating course:', error);
			throw error;
		}
	},

	/**
	 * Generate a test using AI chat
	 * @param {Object} params - Test generation parameters
	 * @param {string} params.prompt - User's prompt/request
	 * @param {Array} params.messages - Chat history (optional)
	 * @param {number} params.courseId - Optional course ID to generate test for
	 * @returns {Promise} Stream response
	 */
	generateTest: async (prompt, messages = [], courseId = null) => {
		try {
			const response = await api.post('/admin/ai/generate-test', {
				prompt,
				messages,
				courseId,
				type: 'test',
			});
			return response.data;
		} catch (error) {
			console.error('Error generating test:', error);
			throw error;
		}
	},

	/**
	 * Stream chat response for course generation
	 * @param {string} prompt - User's prompt
	 * @param {Array} messages - Chat history
	 * @param {Function} onChunk - Callback for each chunk
	 * @param {Function} onData - Callback for special data (like course_id)
	 * @returns {Promise} Full response
	 */
	streamCourseGeneration: async (prompt, messages = [], courseId = null, onChunk = null, onData = null) => {
		try {
			const token = localStorage.getItem('token');
			console.log('Starting course generation request...', { courseId });
			const response = await fetch('/api/admin/ai/generate-course', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'text/event-stream',
					...(token ? { 'Authorization': `Bearer ${token}` } : {}),
				},
				credentials: 'include',
				body: JSON.stringify({ 
					prompt, 
					messages, 
					courseId, // Include course ID for updates
					type: 'course',
					provider: 'huggingface'
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('HTTP error response:', response.status, errorText);
				throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
			}

			if (!response.body) {
				throw new Error('Response body is null');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let fullResponse = '';
			let buffer = '';

			console.log('Starting to read stream...');

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					// Process remaining buffer
					if (buffer) {
						const lines = buffer.split('\n');
						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const data = line.slice(6).trim();
								if (data && data !== '[DONE]') {
									try {
										const parsed = JSON.parse(data);
										if (parsed.content) {
											fullResponse += parsed.content;
											if (onChunk) onChunk(parsed.content);
										}
									} catch (e) {
										console.warn('Failed to parse final chunk:', data, e);
									}
								}
							}
						}
					}
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				
				// Keep last incomplete line in buffer
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6).trim();
						if (data === '[DONE]') {
							console.log('Stream marked as done');
							continue;
						}
						
						if (!data) continue;
						
						try {
							const parsed = JSON.parse(data);
							if (parsed.content) {
								fullResponse += parsed.content;
								if (onChunk) onChunk(parsed.content);
							} else if (parsed.course_id || parsed.course_created) {
								// Handle course creation notification
								if (onData) {
									onData(parsed);
								}
							} else if (parsed.error) {
								console.error('Stream error:', parsed.error);
								throw new Error(parsed.error);
							}
						} catch (e) {
							if (e instanceof Error && e.message.includes('error')) {
								throw e;
							}
							console.warn('Failed to parse SSE data:', data, e);
						}
					}
				}
			}

			console.log('Stream complete. Total response length:', fullResponse.length);
			return { content: fullResponse };
		} catch (error) {
			console.error('Error streaming course generation:', error);
			throw error;
		}
	},

	/**
	 * Stream chat response for test generation
	 * @param {string} prompt - User's prompt
	 * @param {Array} messages - Chat history
	 * @param {number} courseId - Optional course ID
	 * @param {Function} onChunk - Callback for each chunk
	 * @param {Function} onData - Callback for special data (like test_id)
	 * @returns {Promise} Full response
	 */
	streamTestGeneration: async (prompt, messages = [], courseId = null, onChunk = null, onData = null) => {
		try {
			const token = localStorage.getItem('token');
			console.log('Starting test generation request...');
			const response = await fetch('/api/admin/ai/generate-test', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'text/event-stream',
					...(token ? { 'Authorization': `Bearer ${token}` } : {}),
				},
				credentials: 'include',
				body: JSON.stringify({ 
					prompt, 
					messages, 
					courseId, 
					type: 'test',
					provider: 'huggingface'
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('HTTP error response:', response.status, errorText);
				throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
			}

			if (!response.body) {
				throw new Error('Response body is null');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let fullResponse = '';
			let buffer = '';

			console.log('Starting to read stream...');

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					// Process remaining buffer
					if (buffer) {
						const lines = buffer.split('\n');
						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const data = line.slice(6).trim();
								if (data && data !== '[DONE]') {
									try {
										const parsed = JSON.parse(data);
										if (parsed.content) {
											fullResponse += parsed.content;
											if (onChunk) onChunk(parsed.content);
										}
									} catch (e) {
										console.warn('Failed to parse final chunk:', data, e);
									}
								}
							}
						}
					}
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				
				// Keep last incomplete line in buffer
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6).trim();
						if (data === '[DONE]') {
							console.log('Stream marked as done');
							continue;
						}
						
						if (!data) continue;
						
						try {
							const parsed = JSON.parse(data);
							if (parsed.content) {
								fullResponse += parsed.content;
								if (onChunk) onChunk(parsed.content);
							} else if (parsed.test_id || parsed.test_created) {
								// Handle test creation notification
								if (onData) {
									onData(parsed);
								}
							} else if (parsed.error) {
								console.error('Stream error:', parsed.error);
								throw new Error(parsed.error);
							}
						} catch (e) {
							if (e instanceof Error && e.message.includes('error')) {
								throw e;
							}
							console.warn('Failed to parse SSE data:', data, e);
						}
					}
				}
			}

			console.log('Stream complete. Total response length:', fullResponse.length);
			return { content: fullResponse };
		} catch (error) {
			console.error('Error streaming test generation:', error);
			throw error;
		}
	},
};

