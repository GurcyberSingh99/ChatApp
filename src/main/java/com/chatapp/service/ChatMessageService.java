package com.chatapp.service;

import com.chatapp.model.ChatMessage;
import com.chatapp.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Service
public class ChatMessageService {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    public ChatMessage saveMessage(ChatMessage message) {
        message.setTimestamp(new Date());
        
        // Ensure one-to-one chats share a consistent combined chatId regardless of who sends first
        if (message.getRecipientId() != null && !message.getRecipientId().trim().isEmpty()) {
            String senderId = message.getSenderId();
            String recipientId = message.getRecipientId();
            // Create a deterministically ordered composite chatId
            String directChatId = senderId.compareTo(recipientId) < 0 
                    ? senderId + "_" + recipientId 
                    : recipientId + "_" + senderId;
            message.setChatId(directChatId);
        }

        return chatMessageRepository.save(message);
    }

    public List<ChatMessage> getChatHistory(String chatId) {
        return chatMessageRepository.findByChatIdOrderByTimestampAsc(chatId);
    }

    public List<ChatMessage> getDirectChatHistory(String userId1, String userId2) {
        String directChatId = userId1.compareTo(userId2) < 0 
                ? userId1 + "_" + userId2 
                : userId2 + "_" + userId1;
        return chatMessageRepository.findByChatIdOrderByTimestampAsc(directChatId);
    }
}
