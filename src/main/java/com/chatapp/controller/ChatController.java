package com.chatapp.controller;

import com.chatapp.model.ChatMessage;
import com.chatapp.model.ChatRoom;
import com.chatapp.security.CustomUserDetails;
import com.chatapp.service.ChatMessageService;
import com.chatapp.service.ChatRoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chats")
public class ChatController {

    @Autowired
    private ChatRoomService chatRoomService;

    @Autowired
    private ChatMessageService chatMessageService;

    @PostMapping("/rooms")
    public ResponseEntity<ChatRoom> createRoom(@RequestBody RoomRequest request, Authentication authentication) {
        String createdBy = "system";
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails userDetails) {
            createdBy = userDetails.getUsername();
        }
        ChatRoom room = chatRoomService.createRoom(request.getName(), createdBy);
        return ResponseEntity.ok(room);
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<ChatRoom>> getAllRooms() {
        return ResponseEntity.ok(chatRoomService.getAllGroupRooms());
    }

    @GetMapping("/history/{chatId}")
    public ResponseEntity<List<ChatMessage>> getChatHistory(@PathVariable String chatId) {
        return ResponseEntity.ok(chatMessageService.getChatHistory(chatId));
    }

    @GetMapping("/direct/{userId1}/{userId2}")
    public ResponseEntity<List<ChatMessage>> getDirectChatHistory(@PathVariable String userId1, @PathVariable String userId2) {
        return ResponseEntity.ok(chatMessageService.getDirectChatHistory(userId1, userId2));
    }

    public static class RoomRequest {
        private String name;
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }
}
