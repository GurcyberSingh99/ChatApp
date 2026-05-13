package com.chatapp.websocket;

import com.chatapp.model.UserStatus;
import com.chatapp.security.CustomUserDetails;
import com.chatapp.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@Component
public class WebSocketEventListener {

    @Autowired
    private UserService userService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();

        if (principal instanceof UsernamePasswordAuthenticationToken auth) {
            if (auth.getPrincipal() instanceof CustomUserDetails userDetails) {
                String userId = userDetails.getId();
                userService.updateUserStatus(userId, UserStatus.ONLINE);

                // Broadcast user online status
                Map<String, Object> statusUpdate = new HashMap<>();
                statusUpdate.put("userId", userId);
                statusUpdate.put("status", UserStatus.ONLINE.name());
                messagingTemplate.convertAndSend("/topic/users/status", statusUpdate);
            }
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();

        if (principal instanceof UsernamePasswordAuthenticationToken auth) {
            if (auth.getPrincipal() instanceof CustomUserDetails userDetails) {
                String userId = userDetails.getId();
                userService.updateUserStatus(userId, UserStatus.OFFLINE);

                // Broadcast user offline status
                Map<String, Object> statusUpdate = new HashMap<>();
                statusUpdate.put("userId", userId);
                statusUpdate.put("status", UserStatus.OFFLINE.name());
                messagingTemplate.convertAndSend("/topic/users/status", statusUpdate);
            }
        }
    }
}
