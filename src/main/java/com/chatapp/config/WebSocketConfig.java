package com.chatapp.config;

import com.chatapp.security.CustomUserDetails;
import com.chatapp.security.CustomUserDetailsService;
import com.chatapp.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Register standard WebSocket endpoint with SockJS fallback support
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Also register pure WebSocket endpoint without SockJS for raw clients
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Prefix for messages destined to message-handling methods in @Controller classes
        registry.setApplicationDestinationPrefixes("/app");

        // Enable a simple memory-based message broker to send messages to clients on /topic and /queue
        registry.enableSimpleBroker("/topic", "/queue");

        // Prefix used to identify user destinations
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    // Extract JWT from native headers
                    List<String> authorization = accessor.getNativeHeader("Authorization");
                    String jwt = null;

                    if (authorization != null && !authorization.isEmpty()) {
                        String bearerToken = authorization.get(0);
                        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
                            jwt = bearerToken.substring(7);
                        }
                    }

                    if (jwt != null && tokenProvider.validateToken(jwt)) {
                        String userId = tokenProvider.getUserIdFromJWT(jwt);
                        CustomUserDetails userDetails = (CustomUserDetails) customUserDetailsService.loadUserById(userId);
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());
                        accessor.setUser(auth);
                    }
                }
                return message;
            }
        });
    }
}
