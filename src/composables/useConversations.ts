import { ref } from 'vue';
import type { Conversation, Message } from '../types/Conversation';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = 'http://localhost:3000';

export function useConversations() {
  const conversations = ref<Conversation[]>([]);
  const currentConversationId = ref<string>();

  // Generate filename for a conversation
  const getConversationFilename = (conversation: Conversation) => {
    // Use the conversation's actual timestamp
    const date = new Date(conversation.lastResponseTime);
    // Convert to local time to match server's timezone
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    
    const filename = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;
    console.log('Generated filename from timestamp:', {
      lastResponseTime: conversation.lastResponseTime,
      localDate: localDate.toISOString(),
      filename
    });
    return filename;
  };

  // Load conversations from directory
  const loadConversations = async () => {
    try {
      console.log('Loading conversations from server...');
      const response = await fetch(`${API_BASE}/conversations/index`);
      if (!response.ok) throw new Error('Failed to fetch conversation index');
      const fileList = await response.json();
      console.log('Loaded file list:', fileList);
      
      // Limit to last 10 conversations
      const recentFiles = fileList.slice(0, 10);
      const loadPromises = recentFiles.map(async (filename: string) => {
        const response = await fetch(`${API_BASE}/conversations/${filename}`);
        if (!response.ok) throw new Error(`Failed to fetch conversation: ${filename}`);
        const data = await response.json();
        return data.content;
      });
      
      const loadedConversations = (await Promise.all(loadPromises)).filter(Boolean);
      conversations.value = loadedConversations;
      // Sort by last response time
      conversations.value.sort((a, b) => 
        new Date(b.lastResponseTime).getTime() - new Date(a.lastResponseTime).getTime()
      );
      console.log('Successfully loaded conversations:', conversations.value.length);
    } catch (error) {
      console.error('Error loading conversations:', error);
      conversations.value = [];
    }
  };

  // Load conversations immediately when the composable is used
  loadConversations().catch(error => {
    console.error('Failed to load initial conversations:', error);
  });

  // Save a single conversation
  const saveConversation = async (conversation: Conversation) => {
    try {
      const filename = getConversationFilename(conversation);
      const response = await fetch(`${API_BASE}/conversations/${filename}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: conversation }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save conversation');
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  // Create a new conversation
  const createConversation = (systemMessage: Message, model: string) => {
    const conversation: Conversation = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [systemMessage],
      lastResponseTime: new Date().toISOString(),
      model,
      systemPrompt: systemMessage.content
    };
    
    conversations.value.unshift(conversation);
    currentConversationId.value = conversation.id;
    saveConversation(conversation);
    return conversation;
  };

  // Update conversation with new message
  const updateConversation = (id: string, message: Message) => {
    const conversation = conversations.value.find(c => c.id === id);
    if (!conversation) return;

    conversation.messages.push(message);
    if (message.role === 'assistant') {
      conversation.lastResponseTime = new Date().toISOString();
      // Update title based on first user message if it's "New Chat"
      if (conversation.title === 'New Chat' && conversation.messages.length >= 3) {
        const firstUserMessage = conversation.messages.find(m => m.role === 'user');
        if (firstUserMessage) {
          conversation.title = firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
        }
      }
    }

    // Re-sort conversations based on last response time
    conversations.value.sort((a, b) => 
      new Date(b.lastResponseTime).getTime() - new Date(a.lastResponseTime).getTime()
    );

    saveConversation(conversation);
  };

  // Delete a conversation
  const deleteConversation = async (conversation: Conversation) => {
    try {
      console.log('Attempting to delete conversation:', {
        id: conversation.id,
        title: conversation.title,
        lastResponseTime: conversation.lastResponseTime
      });
      
      const filename = getConversationFilename(conversation);
      console.log('Generated filename for deletion:', filename);
      
      const response = await fetch(`${API_BASE}/conversations/${filename}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }
      
      console.log('Successfully deleted conversation from server');
      
      conversations.value = conversations.value.filter(c => c.id !== conversation.id);
      console.log('Updated conversations list in UI, remaining conversations:', conversations.value.length);
      
      if (currentConversationId.value === conversation.id) {
        currentConversationId.value = conversations.value[0]?.id;
        console.log('Updated current conversation ID to:', currentConversationId.value);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // Clear all conversations
  const clearAllConversations = async () => {
    try {
      const response = await fetch(`${API_BASE}/conversations`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear conversations');
      }
      
      conversations.value = [];
      currentConversationId.value = undefined;
    } catch (error) {
      console.error('Error clearing conversations:', error);
    }
  };

  return {
    conversations,
    currentConversationId,
    loadConversations,
    createConversation,
    updateConversation,
    deleteConversation,
    clearAllConversations,
  };
} 