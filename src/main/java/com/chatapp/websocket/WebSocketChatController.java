package com.chatapp.websocket;

import com.chatapp.model.ChatMessage;
import com.chatapp.service.ChatMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private ChatMessageService chatMessageService;

    @MessageMapping("/chat/{chatId}/sendMessage")
    public void sendMessage(@DestinationVariable String chatId, @Payload ChatMessage chatMessage) {
        // Save to database history
        ChatMessage savedMessage = chatMessageService.saveMessage(chatMessage);

        // Broadcast to all subscribers of this specific chat channel (Room or Direct Chat)
        messagingTemplate.convertAndSend("/topic/chat/" + chatId, savedMessage);
    }

    @MessageMapping("/chat/{chatId}/typing")
    public void sendTypingIndicator(@DestinationVariable String chatId, @Payload ChatMessage typingMessage) {
        // Broadcast typing status indicator
        messagingTemplate.convertAndSend("/topic/chat/" + chatId + "/typing", typingMessage);
    }
}
