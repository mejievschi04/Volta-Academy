import React from 'react';
import Modal from '../../common/Modal';
import AICourseChat from './AICourseChat';

const VOLT_CHAT_TITLE_ID = 'volt-chat-dialog-title';

export default function VoltChatDialog({ open, onClose, ...chatProps }) {
	if (!open) return null;

	return (
		<Modal
			isOpen={open}
			onClose={onClose}
			closeOnBackdropClick
			closeOnEscape
			ariaLabelledby={VOLT_CHAT_TITLE_ID}
			className="ai-chat-modal-overlay"
			unstyledContent
		>
			<div className="ai-chat-modal">
				<AICourseChat
					{...chatProps}
					titleId={VOLT_CHAT_TITLE_ID}
					onClose={onClose}
				/>
			</div>
		</Modal>
	);
}
