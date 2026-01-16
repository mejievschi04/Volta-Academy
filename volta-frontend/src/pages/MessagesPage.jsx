import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { messagesService } from '../services/api';
import { logger } from '../utils/logger';

const MessagesPage = () => {
	const { user } = useAuth();
	const { showToast } = useToast();
	const [conversations, setConversations] = useState([]);
	const [selectedConversation, setSelectedConversation] = useState(null);
	const [messages, setMessages] = useState([]);
	const [newMessage, setNewMessage] = useState('');
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [showNewConversationModal, setShowNewConversationModal] = useState(false);
	const [newConversationUserId, setNewConversationUserId] = useState('');
	const [newConversationSearch, setNewConversationSearch] = useState('');
	const [availableUsers, setAvailableUsers] = useState([]);
	const [loadingUsers, setLoadingUsers] = useState(false);
	const messagesEndRef = useRef(null);
	const pollingIntervalRef = useRef(null);
	const conversationsPollingRef = useRef(null);
	const lastMessageIdRef = useRef(null);

	useEffect(() => {
		fetchConversations();

		// Reîncarcă conversațiile când pagina devine activă
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				fetchConversations();
				if (selectedConversation) {
					fetchMessages(selectedConversation.id, true);
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, []);

	useEffect(() => {
		if (selectedConversation) {
			fetchMessages(selectedConversation.id);
		}
	}, [selectedConversation]);

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Polling pentru mesaje noi în conversația activă
	useEffect(() => {
		if (!selectedConversation || !user) return;

		// Setăm ultimul mesaj ID când se schimbă conversația
		if (messages.length > 0) {
			lastMessageIdRef.current = messages[messages.length - 1].id;
		} else {
			lastMessageIdRef.current = null;
		}

		// Funcție pentru a verifica mesaje noi
		const checkNewMessages = async () => {
			// Nu face polling dacă pagina nu este activă
			if (document.hidden) return;

			try {
				const data = await messagesService.getMessages(selectedConversation.id);
				
				if (Array.isArray(data) && data.length > 0) {
					const lastMessage = data[data.length - 1];
					
					// Verifică dacă există mesaje noi
					if (lastMessageIdRef.current && lastMessage.id > lastMessageIdRef.current) {
						// Există mesaje noi - actualizează lista
						setMessages(data);
						lastMessageIdRef.current = lastMessage.id;
						
						// Scroll la final dacă utilizatorul este în jos
						const messagesContainer = document.querySelector('.messages-chat-messages');
						if (messagesContainer) {
							const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
							if (isNearBottom) {
								setTimeout(() => scrollToBottom(), 100);
							}
						}
						
						// Actualizează conversația cu ultimul mesaj
						setConversations(prev => prev.map(conv => 
							conv.id === selectedConversation.id
								? {
									...conv,
									lastMessage: {
										content: lastMessage.content,
										created_at: lastMessage.created_at,
										sender_id: lastMessage.sender_id,
									},
									updated_at: lastMessage.created_at,
								}
								: conv
						));
					} else if (!lastMessageIdRef.current) {
						// Prima încărcare
						setMessages(data);
						if (data.length > 0) {
							lastMessageIdRef.current = data[data.length - 1].id;
						}
					}
				}
		} catch (err) {
			logger.error('Error polling messages:', err);
			}
		};

		// Polling la fiecare 2 secunde
		pollingIntervalRef.current = setInterval(checkNewMessages, 2000);

		return () => {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current);
			}
		};
	}, [selectedConversation, messages.length, user]);

	// Polling pentru actualizarea conversațiilor (ultimul mesaj, contor necitite)
	useEffect(() => {
		if (!user) return;

		const updateConversations = async () => {
			// Nu face polling dacă pagina nu este activă
			if (document.hidden) return;

			try {
				const data = await messagesService.getConversations();
				
				if (Array.isArray(data)) {
					// Actualizează conversațiile, păstrând selecția curentă
					setConversations(prev => {
						const currentSelectedId = selectedConversation?.id;
						const updated = data.map(newConv => {
							const existing = prev.find(c => c.id === newConv.id);
							// Păstrează conversația selectată dacă există
							if (existing && existing.id === currentSelectedId) {
								return existing;
							}
							return newConv;
						});
						
						// Dacă conversația selectată nu mai există, o eliminăm
						if (currentSelectedId && !updated.find(c => c.id === currentSelectedId)) {
							setSelectedConversation(null);
						}
						
						return updated;
					});
				}
		} catch (err) {
			logger.error('Error polling conversations:', err);
			}
		};

		// Polling la fiecare 5 secunde pentru conversații
		conversationsPollingRef.current = setInterval(updateConversations, 5000);

		return () => {
			if (conversationsPollingRef.current) {
				clearInterval(conversationsPollingRef.current);
			}
		};
	}, [user, selectedConversation?.id]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	const fetchConversations = async () => {
		try {
			setLoading(true);
			const data = await messagesService.getConversations();
			
			if (Array.isArray(data)) {
				setConversations(data);
				if (!selectedConversation && data.length > 0) {
					setSelectedConversation(data[0]);
				}
			} else {
				setConversations([]);
			}
		} catch (err) {
			console.error('Error fetching conversations:', err);
			showToast('Eroare la încărcarea conversațiilor', 'error');
			setConversations([]);
		} finally {
			setLoading(false);
		}
	};

	const fetchMessages = async (conversationId, silent = false) => {
		if (!conversationId) return;
		
		try {
			const data = await messagesService.getMessages(conversationId);
			
			if (Array.isArray(data)) {
				setMessages(data);
				// Setăm ultimul mesaj ID pentru polling
				if (data.length > 0) {
					lastMessageIdRef.current = data[data.length - 1].id;
				} else {
					lastMessageIdRef.current = null;
				}
			} else {
				setMessages([]);
				lastMessageIdRef.current = null;
			}
			
			// Mark conversation as read
			if (conversationId) {
				await messagesService.markAsRead(conversationId);
				// Actualizează contorul necitite în lista de conversații
				setConversations(prev => prev.map(conv => 
					conv.id === conversationId
						? { ...conv, unreadCount: 0 }
						: conv
				));
			}
		} catch (err) {
			logger.error('Error fetching messages:', err);
			if (!silent) {
				showToast('Eroare la încărcarea mesajelor', 'error');
			}
			setMessages([]);
			lastMessageIdRef.current = null;
		}
	};

	const handleSendMessage = async (e) => {
		e.preventDefault();
		if (!newMessage.trim() || sending || !selectedConversation) return;

		const messageContent = newMessage.trim();
		const tempId = Date.now();
		setNewMessage('');
		setSending(true);

		// Optimistically add message to UI
		const optimisticMessage = {
			id: tempId,
			content: messageContent,
			sender_id: user.id,
			created_at: new Date().toISOString()
		};
		
		setMessages(prev => [...prev, optimisticMessage]);
		
		// Update conversation last message
		setConversations(prev => prev.map(conv => 
			conv.id === selectedConversation.id
				? {
					...conv,
					lastMessage: {
						content: messageContent,
						created_at: new Date().toISOString(),
						sender_id: user.id
					},
					updated_at: new Date().toISOString()
				}
				: conv
		));

		try {
			const sentMessage = await messagesService.sendMessage(selectedConversation.id, messageContent);
			
			// Replace optimistic message with real one from server
			if (sentMessage && sentMessage.id) {
				setMessages(prev => prev.map(msg => 
					msg.id === tempId ? sentMessage : msg
				));
				lastMessageIdRef.current = sentMessage.id;
			}
			
			// Actualizează conversațiile local fără refresh vizual
			// Nu apelăm fetchConversations() pentru a evita refresh-ul vizual
			// Conversațiile se actualizează deja prin optimistic update și polling
		} catch (err) {
			logger.error('Error sending message:', err);
			// Remove optimistic message on error
			setMessages(prev => prev.filter(msg => msg.id !== tempId));
			showToast('Eroare la trimiterea mesajului', 'error');
			setNewMessage(messageContent); // Restore message on error
		} finally {
			setSending(false);
		}
	};

	const formatTime = (dateString) => {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now - date;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Acum';
		if (minutes < 60) return `Acum ${minutes} min`;
		if (hours < 24) return `Acum ${hours}h`;
		if (days < 7) return `${days} zile`;
		return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
	};

	const getInitials = (name) => {
		return name
			.split(' ')
			.map(n => n[0])
			.join('')
			.toUpperCase()
			.substring(0, 2);
	};

	const handleSearch = async (query) => {
		setSearchQuery(query);
		if (!query.trim()) {
			fetchConversations();
			return;
		}

		try {
			const results = await messagesService.searchConversations(query);
			if (Array.isArray(results) && results.length > 0) {
				setConversations(results);
			} else {
				// Filter local conversations if API doesn't return results
				const filtered = conversations.filter(conv => 
					conv.participant.name.toLowerCase().includes(query.toLowerCase()) ||
					conv.lastMessage?.content?.toLowerCase().includes(query.toLowerCase())
				);
				setConversations(filtered);
			}
		} catch (err) {
			logger.error('Error searching conversations:', err);
			// Fallback to local filtering
			const filtered = conversations.filter(conv => 
				conv.participant.name.toLowerCase().includes(query.toLowerCase()) ||
				conv.lastMessage?.content?.toLowerCase().includes(query.toLowerCase())
			);
			setConversations(filtered);
		}
	};

	const handleNewConversation = async () => {
		if (!newConversationUserId) {
			showToast('Selectează un utilizator', 'error');
			return;
		}

		try {
			const conversation = await messagesService.createConversation(newConversationUserId);
			setConversations(prev => [conversation, ...prev]);
			setSelectedConversation(conversation);
			setShowNewConversationModal(false);
			setNewConversationUserId('');
			setNewConversationSearch('');
			setAvailableUsers([]);
			showToast('Conversație creată', 'success');
		} catch (err) {
			logger.error('Error creating conversation:', err);
			const errorMessage = err.response?.data?.message || err.message || 'Eroare la crearea conversației';
			showToast(errorMessage, 'error');
		}
	};

	const handleSearchUsers = async (query) => {
		setNewConversationSearch(query);
		if (!query.trim()) {
			setAvailableUsers([]);
			return;
		}

		setLoadingUsers(true);
		try {
			const users = await messagesService.getAvailableUsers(query);
			setAvailableUsers(users);
		} catch (err) {
			logger.error('Error searching users:', err);
			setAvailableUsers([]);
		} finally {
			setLoadingUsers(false);
		}
	};

	const handleSelectUser = (userId) => {
		setNewConversationUserId(userId);
		setNewConversationSearch('');
		setAvailableUsers([]);
	};

	// Filter conversations based on search query
	const filteredConversations = searchQuery.trim()
		? conversations.filter(conv => 
			conv.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			conv.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase())
		)
		: conversations;

	if (loading) {
		return (
			<div className="messages-page">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă mesageria...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="messages-page">
			<div className="messages-container">
				{/* Conversations Sidebar */}
				<div className="messages-sidebar">
					<div className="messages-sidebar-header">
						<h2 className="messages-title">Mesagerie</h2>
						<button 
							className="messages-new-conversation-btn" 
							title="Conversație nouă"
							onClick={() => setShowNewConversationModal(true)}
						>
							<span>+</span>
						</button>
					</div>

					<div className="messages-search">
						<input
							type="text"
							placeholder="Caută conversații..."
							className="messages-search-input"
							value={searchQuery}
							onChange={(e) => handleSearch(e.target.value)}
						/>
					</div>

					<div className="messages-conversations-list">
						{filteredConversations.length === 0 && !loading ? (
							<div className="lms-empty-state" style={{ padding: 'var(--space-4)', textAlign: 'center', background: 'transparent', border: 'none' }}>
								<div className="lms-empty-description" style={{ margin: 0 }}>
									{searchQuery ? 'Nu s-au găsit conversații' : 'Nu există conversații'}
								</div>
							</div>
						) : (
							filteredConversations.map((conversation) => (
							<div
								key={conversation.id}
								className={`messages-conversation-item ${
									selectedConversation?.id === conversation.id ? 'active' : ''
								} ${(conversation.unreadCount || 0) > 0 ? 'unread' : ''}`}
								onClick={() => setSelectedConversation(conversation)}
							>
								<div className="messages-conversation-avatar">
									{conversation.participant?.avatar ? (
										<img src={conversation.participant.avatar} alt={conversation.participant?.name || 'User'} />
									) : (
										<span>{getInitials(conversation.participant?.name || 'U')}</span>
									)}
								</div>
								<div className="messages-conversation-content">
									<div className="messages-conversation-header">
										<span className="messages-conversation-name">
											{conversation.participant?.name || 'Utilizator necunoscut'}
										</span>
										<span className="messages-conversation-time">
											{conversation.lastMessage?.created_at 
												? formatTime(conversation.lastMessage.created_at)
												: conversation.updated_at 
													? formatTime(conversation.updated_at)
													: 'Recent'}
										</span>
									</div>
									<div className="messages-conversation-preview">
										<span className="messages-conversation-text">
											{conversation.lastMessage?.content || 'Fără mesaje'}
										</span>
										{conversation.unreadCount > 0 && (
											<span className="messages-unread-badge">
												{conversation.unreadCount}
											</span>
										)}
									</div>
								</div>
							</div>
						)))}
					</div>
				</div>

				{/* Messages Area */}
				<div className="messages-main">
					{selectedConversation ? (
						<>
							{/* Chat Header */}
							<div className="messages-chat-header">
								<div className="messages-chat-header-info">
									<div className="messages-chat-avatar">
										{selectedConversation.participant?.avatar ? (
											<img src={selectedConversation.participant.avatar} alt={selectedConversation.participant?.name || 'User'} />
										) : (
											<span>{getInitials(selectedConversation.participant?.name || 'U')}</span>
										)}
									</div>
									<div>
										<h3 className="messages-chat-name">{selectedConversation.participant?.name || 'Utilizator necunoscut'}</h3>
										<p className="messages-chat-role">
											{selectedConversation.participant?.role === 'admin' ? 'Administrator' :
											 selectedConversation.participant?.role === 'instructor' ? 'Instructor' :
											 'Student'}
										</p>
									</div>
								</div>
								<button className="messages-chat-actions-btn" title="Opțiuni">
									<span>⋯</span>
								</button>
							</div>

							{/* Messages List */}
							<div className="messages-chat-messages">
								{messages.length > 0 ? (
									messages.map((message) => {
										const isOwn = message.sender_id === user?.id;
										return (
											<div
												key={message.id}
												className={`messages-message ${isOwn ? 'own' : 'other'}`}
											>
												<div className="messages-message-content">
													<p>{message.content || ''}</p>
													<span className="messages-message-time">
														{message.created_at 
															? formatTime(message.created_at)
															: 'Acum'}
													</span>
												</div>
											</div>
										);
									})
								) : (
									<div className="lms-empty-state" style={{ padding: 'var(--space-8)' }}>
										<div className="lms-empty-icon">💬</div>
										<div className="lms-empty-title">Nu există mesaje</div>
										<div className="lms-empty-description">Începe conversația trimitând primul mesaj</div>
									</div>
								)}
								<div ref={messagesEndRef} />
							</div>

							{/* Message Input */}
							<form className="messages-chat-input-form" onSubmit={handleSendMessage}>
								<input
									type="text"
									className="messages-chat-input"
									value={newMessage}
									onChange={(e) => setNewMessage(e.target.value)}
									placeholder="Scrie un mesaj..."
									disabled={sending}
								/>
								<button
									type="submit"
									className="messages-chat-send-btn"
									disabled={!newMessage.trim() || sending}
								>
									{sending ? '⏳' : '➤'}
								</button>
							</form>
						</>
					) : (
						<div className="lms-empty-state">
							<div className="lms-empty-icon">💬</div>
							<div className="lms-empty-title">Selectează o conversație</div>
							<div className="lms-empty-description">Selectează o conversație din listă pentru a începe să trimiți mesaje</div>
						</div>
					)}
				</div>
			</div>

			{/* New Conversation Modal */}
			{showNewConversationModal && (
				<div className="messages-modal-overlay" onClick={() => {
					setShowNewConversationModal(false);
					setNewConversationUserId('');
					setNewConversationSearch('');
					setAvailableUsers([]);
				}}>
					<div className="messages-modal" onClick={(e) => e.stopPropagation()}>
						<div className="messages-modal-header">
							<h3>Conversație nouă</h3>
							<button 
								className="messages-modal-close"
								onClick={() => {
									setShowNewConversationModal(false);
									setNewConversationUserId('');
									setNewConversationSearch('');
									setAvailableUsers([]);
								}}
							>
								×
							</button>
						</div>
						<div className="messages-modal-body">
							<div style={{ position: 'relative' }}>
								<input
									type="text"
									placeholder="Caută utilizator după nume sau email..."
									className="messages-modal-input"
									value={newConversationSearch}
									onChange={(e) => handleSearchUsers(e.target.value)}
									autoFocus
								/>
								{loadingUsers && (
									<div style={{ 
										position: 'absolute', 
										right: 'var(--space-3)', 
										top: '50%', 
										transform: 'translateY(-50%)',
										color: 'var(--text-muted)'
									}}>
										⏳
									</div>
								)}
							</div>
							
							{availableUsers.length > 0 && (
								<div className="messages-users-list">
									{availableUsers.map((user) => (
										<div
											key={user.id}
											className={`messages-user-item ${newConversationUserId == user.id ? 'selected' : ''}`}
											onClick={() => handleSelectUser(user.id)}
										>
											<div className="messages-user-avatar">
												{user.avatar ? (
													<img src={user.avatar} alt={user.name} />
												) : (
													<span>{getInitials(user.name)}</span>
												)}
											</div>
											<div className="messages-user-info">
												<div className="messages-user-name">{user.name}</div>
												<div className="messages-user-email">{user.email}</div>
												{user.role && (
													<div className="messages-user-role">
														{user.role === 'admin' ? 'Administrator' :
														 user.role === 'instructor' ? 'Instructor' : 'Student'}
													</div>
												)}
											</div>
											{newConversationUserId == user.id && (
												<div className="messages-user-check">✓</div>
											)}
										</div>
									))}
								</div>
							)}
							
							{newConversationSearch && !loadingUsers && availableUsers.length === 0 && (
								<p style={{ 
									fontSize: 'var(--font-size-xs)', 
									color: 'var(--text-muted)', 
									marginTop: 'var(--space-2)',
									textAlign: 'center'
								}}>
									Nu s-au găsit utilizatori
								</p>
							)}
							
							{newConversationUserId && (
								<div style={{ 
									marginTop: 'var(--space-3)',
									padding: 'var(--space-2)',
									background: 'var(--bg-tertiary)',
									borderRadius: 'var(--radius-md)',
									fontSize: 'var(--font-size-sm)',
									color: 'var(--text-secondary)'
								}}>
									Utilizator selectat: {availableUsers.find(u => u.id == newConversationUserId)?.name || 'ID: ' + newConversationUserId}
								</div>
							)}
						</div>
						<div className="messages-modal-footer">
							<button 
								className="lms-btn-secondary"
								onClick={() => {
									setShowNewConversationModal(false);
									setNewConversationUserId('');
									setNewConversationSearch('');
									setAvailableUsers([]);
								}}
							>
								Anulează
							</button>
							<button 
								className="lms-btn-primary"
								onClick={handleNewConversation}
								disabled={!newConversationUserId}
							>
								Creează
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default MessagesPage;
