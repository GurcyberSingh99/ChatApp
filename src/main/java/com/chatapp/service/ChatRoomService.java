package com.chatapp.service;

import com.chatapp.model.ChatRoom;
import com.chatapp.repository.ChatRoomRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ChatRoomService {

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @PostConstruct
    public void initDefaultRoom() {
        // Pre-create standard General room if missing
        if (chatRoomRepository.findByName("General").isEmpty()) {
            ChatRoom room = new ChatRoom("General", true, "system");
            chatRoomRepository.save(room);
        }
    }

    public ChatRoom createRoom(String name, String createdBy) {
        Optional<ChatRoom> existing = chatRoomRepository.findByName(name);
        if (existing.isPresent()) {
            return existing.get();
        }
        ChatRoom room = new ChatRoom(name, true, createdBy);
        return chatRoomRepository.save(room);
    }

    public List<ChatRoom> getAllGroupRooms() {
        return chatRoomRepository.findByIsGroupTrue();
    }

    public Optional<ChatRoom> getRoomById(String id) {
        return chatRoomRepository.findById(id);
    }
}
