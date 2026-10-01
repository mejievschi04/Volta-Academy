import { mergeAttributes, Node } from '@tiptap/core';
import { Fragment, Slice } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';

export const LESSON_CALLOUT_TYPES = [
	{ id: 'soft', label: 'Rotund' },
	{ id: 'glow', label: 'Capsulă' },
	{ id: 'outline', label: 'Tăiat' },
	{ id: 'stripe', label: 'Panglică' },
	{ id: 'glass', label: 'Sticlă' },
	{ id: 'lifted', label: 'Panou' },
	{ id: 'bracket', label: 'Paranteză' },
	{ id: 'note', label: 'Notiță' },
	{ id: 'neon', label: 'Neon' },
	{ id: 'folded', label: 'Pliat' },
	{ id: 'spotlight', label: 'Spot' },
];

const CALLOUT_TYPE_IDS = new Set(LESSON_CALLOUT_TYPES.map((type) => type.id));

export function cleanLessonCalloutAccent(value) {
	const color = String(value || '').trim();
	return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : '#ffee00';
}

export function cleanLessonCalloutType(value) {
	return CALLOUT_TYPE_IDS.has(value) ? value : 'soft';
}

function calloutDepth($from) {
	for (let depth = $from.depth; depth > 0; depth -= 1) {
		if ($from.node(depth).type.name === 'lessonCallout') return depth;
	}
	return 0;
}

export const LessonCallout = Node.create({
	name: 'lessonCallout',
	group: 'block',
	content: 'block+',
	defining: true,
	priority: 150,

	addAttributes() {
		return {
			type: {
				default: 'soft',
				parseHTML: (element) => cleanLessonCalloutType(element.getAttribute('data-callout-type')),
				renderHTML: (attributes) => ({
					'data-callout-type': cleanLessonCalloutType(attributes.type),
				}),
			},
			accent: {
				default: '#ffee00',
				parseHTML: (element) => cleanLessonCalloutAccent(
					element.style.getPropertyValue('--rte-callout-accent'),
				),
				renderHTML: (attributes) => ({
					style: `--rte-callout-accent: ${cleanLessonCalloutAccent(attributes.accent)}`,
				}),
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'blockquote[data-callout-box="true"]',
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'blockquote',
			mergeAttributes(HTMLAttributes, { 'data-callout-box': 'true' }),
			['div', { class: 'rte-callout-content' }, 0],
		];
	},

	addCommands() {
		return {
			setLessonCallout: (attributes) => ({ editor, state, tr, dispatch }) => {
				const next = {
					type: cleanLessonCalloutType(attributes?.type),
					accent: cleanLessonCalloutAccent(attributes?.accent),
				};
				const depth = calloutDepth(state.selection.$from);
				if (depth) {
					if (dispatch) {
						const pos = state.selection.$from.before(depth);
						tr.setNodeMarkup(pos, undefined, {
							...state.selection.$from.node(depth).attrs,
							...next,
						});
						dispatch(tr);
					}
					return true;
				}
				const { from, to, empty } = state.selection;
				if (empty) {
					return editor.commands.insertContent({
						type: this.name,
						attrs: next,
						content: [{ type: 'paragraph' }],
					});
				}
				const slice = state.doc.slice(from, to);
				const fragment = !slice.content.firstChild || slice.content.firstChild.isInline
					? Fragment.from(state.schema.nodes.paragraph.create(null, slice.content))
					: slice.content;
				const node = this.type.create(next, fragment);
				if (dispatch) {
					tr.replaceRange(from, to, new Slice(Fragment.from(node), 0, 0));
					const pos = tr.mapping.map(from, -1);
					tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))));
					dispatch(tr.scrollIntoView());
				}
				return true;
			},
		};
	},

	addKeyboardShortcuts() {
		return {
			Enter: () => {
				if (!this.editor.isActive(this.name)) return false;
				const { state } = this.editor;
				const { $from, empty } = state.selection;
				if (!empty || $from.parent.type.name !== 'paragraph' || $from.parent.content.size > 0) return false;
				const depth = calloutDepth($from);
				if (!depth) return false;

				return this.editor.commands.command(({ tr, dispatch }) => {
					if (!dispatch) return true;
					const callout = $from.node(depth);
					const calloutPos = $from.before(depth);
					if (callout.childCount <= 1) {
						const paragraph = state.schema.nodes.paragraph.create();
						tr.replaceWith(calloutPos, calloutPos + callout.nodeSize, paragraph);
						tr.setSelection(TextSelection.near(tr.doc.resolve(calloutPos + 1)));
					} else {
						const paragraphPos = $from.before();
						tr.delete(paragraphPos, paragraphPos + $from.parent.nodeSize);
						const mapped = tr.mapping.map(calloutPos);
						const node = tr.doc.nodeAt(mapped);
						const after = mapped + (node?.nodeSize || 0);
						const paragraph = state.schema.nodes.paragraph.create();
						tr.insert(after, paragraph);
						tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)));
					}
					dispatch(tr.scrollIntoView());
					return true;
				});
			},
		};
	},
});

export default LessonCallout;
