package com.chatapp.service;

import com.chatapp.model.User;
import com.chatapp.model.UserStatus;
import com.chatapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public User registerUser(String username, String email, String password, String avatarUrl) {
        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("Error: Username is already taken!");
        }
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Error: Email is already in use!");
        }

        // Set default avatar if blank
        if (avatarUrl == null || avatarUrl.trim().isEmpty()) {
            avatarUrl = "https://api.dicebear.com/7.x/bottts/svg?seed=" + username;
        }

        User user = new User(username, email, passwordEncoder.encode(password), avatarUrl);
        return userRepository.save(user);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> findById(String id) {
        return userRepository.findById(id);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public void updateUserStatus(String userId, UserStatus status) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setStatus(status);
            userRepository.save(user);
        });
    }

    public void updateUserStatusByUsername(String username, UserStatus status) {
        userRepository.findByUsername(username).ifPresent(user -> {
            user.setStatus(status);
            userRepository.save(user);
        });
    }
}
