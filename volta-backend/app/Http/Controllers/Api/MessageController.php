<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MessageController extends Controller
{
    /**
     * Get all conversations for the authenticated user
     */
    public function getConversations(Request $request)
    {
        $user = Auth::user();

        // Get conversations where user is either user1 or user2
        $conversations = Conversation::where('user1_id', $user->id)
            ->orWhere('user2_id', $user->id)
            ->with(['user1', 'user2'])
            ->withCount(['messages as unread_count' => function ($query) use ($user) {
                $query->where('sender_id', '!=', $user->id)
                      ->where('read', false);
            }])
            ->orderBy('last_message_at', 'desc')
            ->get()
            ->map(function ($conversation) use ($user) {
                $participant = $conversation->getOtherParticipant($user->id);
                $lastMessage = $conversation->getLastMessage();

                return [
                    'id' => $conversation->id,
                    'participant' => [
                        'id' => $participant->id,
                        'name' => $participant->name,
                        'email' => $participant->email,
                        'avatar' => $participant->avatar,
                        'role' => $participant->role,
                    ],
                    'lastMessage' => $lastMessage ? [
                        'content' => $lastMessage->content,
                        'created_at' => $lastMessage->created_at->toISOString(),
                        'sender_id' => $lastMessage->sender_id,
                    ] : null,
                    'unreadCount' => $conversation->unread_count ?? 0,
                    'updated_at' => $conversation->last_message_at 
                        ? $conversation->last_message_at->toISOString() 
                        : $conversation->updated_at->toISOString(),
                ];
            });

        return response()->json([
            'data' => $conversations,
        ]);
    }

    /**
     * Get messages for a specific conversation
     */
    public function getMessages(Request $request, $conversationId)
    {
        $user = Auth::user();

        // Verify user is part of this conversation
        $conversation = Conversation::where('id', $conversationId)
            ->where(function ($query) use ($user) {
                $query->where('user1_id', $user->id)
                      ->orWhere('user2_id', $user->id);
            })
            ->firstOrFail();

        $messages = Message::where('conversation_id', $conversationId)
            ->with('sender')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($message) {
                return [
                    'id' => $message->id,
                    'content' => $message->content,
                    'sender_id' => $message->sender_id,
                    'created_at' => $message->created_at->toISOString(),
                    'read' => $message->read,
                ];
            });

        return response()->json([
            'data' => $messages,
        ]);
    }

    /**
     * Send a message in a conversation
     */
    public function sendMessage(Request $request, $conversationId)
    {
        $user = Auth::user();

        // Verify user is part of this conversation
        $conversation = Conversation::where('id', $conversationId)
            ->where(function ($query) use ($user) {
                $query->where('user1_id', $user->id)
                      ->orWhere('user2_id', $user->id);
            })
            ->firstOrFail();

        $validator = Validator::make($request->all(), [
            'content' => 'required|string|max:5000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $message = Message::create([
            'conversation_id' => $conversationId,
            'sender_id' => $user->id,
            'content' => $request->content,
            'read' => false,
        ]);

        // Update conversation's last_message_at
        $conversation->update([
            'last_message_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'id' => $message->id,
                'content' => $message->content,
                'sender_id' => $message->sender_id,
                'created_at' => $message->created_at->toISOString(),
                'read' => $message->read,
            ],
        ], 201);
    }

    /**
     * Create a new conversation
     */
    public function createConversation(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'participant_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $participantId = $request->participant_id;

        // Can't create conversation with yourself
        if ($participantId == $user->id) {
            return response()->json([
                'message' => 'Cannot create conversation with yourself',
            ], 422);
        }

        // Find or create conversation
        $conversation = Conversation::findOrCreateBetween($user->id, $participantId);
        $participant = $conversation->getOtherParticipant($user->id);

        return response()->json([
            'data' => [
                'id' => $conversation->id,
                'participant' => [
                    'id' => $participant->id,
                    'name' => $participant->name,
                    'email' => $participant->email,
                    'avatar' => $participant->avatar,
                    'role' => $participant->role,
                ],
                'lastMessage' => null,
                'unreadCount' => 0,
                'updated_at' => $conversation->updated_at->toISOString(),
            ],
        ], 201);
    }

    /**
     * Search conversations
     */
    public function searchConversations(Request $request)
    {
        $user = Auth::user();
        $query = $request->input('q', '');

        if (empty($query)) {
            return response()->json([
                'data' => [],
            ]);
        }

        // Get conversations and filter by participant name or message content
        $conversations = Conversation::where(function ($q) use ($user) {
                $q->where('user1_id', $user->id)
                  ->orWhere('user2_id', $user->id);
            })
            ->with(['user1', 'user2'])
            ->get()
            ->filter(function ($conversation) use ($user, $query) {
                $participant = $conversation->getOtherParticipant($user->id);
                $lastMessage = $conversation->getLastMessage();
                
                $matchesName = stripos($participant->name, $query) !== false;
                $matchesEmail = stripos($participant->email, $query) !== false;
                $matchesMessage = $lastMessage && stripos($lastMessage->content, $query) !== false;
                
                return $matchesName || $matchesEmail || $matchesMessage;
            })
            ->map(function ($conversation) use ($user) {
                $participant = $conversation->getOtherParticipant($user->id);
                $lastMessage = $conversation->getLastMessage();

                return [
                    'id' => $conversation->id,
                    'participant' => [
                        'id' => $participant->id,
                        'name' => $participant->name,
                        'email' => $participant->email,
                        'avatar' => $participant->avatar,
                        'role' => $participant->role,
                    ],
                    'lastMessage' => $lastMessage ? [
                        'content' => $lastMessage->content,
                        'created_at' => $lastMessage->created_at->toISOString(),
                        'sender_id' => $lastMessage->sender_id,
                    ] : null,
                    'unreadCount' => $conversation->getUnreadCount($user->id),
                    'updated_at' => $conversation->last_message_at 
                        ? $conversation->last_message_at->toISOString() 
                        : $conversation->updated_at->toISOString(),
                ];
            })
            ->values();

        return response()->json([
            'data' => $conversations,
        ]);
    }

    /**
     * Mark conversation as read
     */
    public function markAsRead(Request $request, $conversationId)
    {
        $user = Auth::user();

        // Verify user is part of this conversation
        $conversation = Conversation::where('id', $conversationId)
            ->where(function ($query) use ($user) {
                $query->where('user1_id', $user->id)
                      ->orWhere('user2_id', $user->id);
            })
            ->firstOrFail();

        // Mark all messages from other participant as read
        Message::where('conversation_id', $conversationId)
            ->where('sender_id', '!=', $user->id)
            ->where('read', false)
            ->update([
                'read' => true,
                'read_at' => now(),
            ]);

        return response()->json([
            'message' => 'Conversation marked as read',
        ]);
    }

    /**
     * Get available users for new conversation (users you can message)
     */
    public function getAvailableUsers(Request $request)
    {
        $user = Auth::user();
        $query = $request->input('q', '');

        $users = User::where('id', '!=', $user->id)
            ->when($query, function ($q) use ($query) {
                $q->where(function ($queryBuilder) use ($query) {
                    $queryBuilder->where('name', 'like', "%{$query}%")
                                 ->orWhere('email', 'like', "%{$query}%");
                });
            })
            ->select('id', 'name', 'email', 'avatar', 'role')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => $users,
        ]);
    }
}
