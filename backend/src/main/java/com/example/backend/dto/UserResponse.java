package com.example.backend.dto;

import com.example.backend.entity.User;

public class UserResponse {

    private Integer userId;
    private String name;
    private String email;
    private String role;

    public UserResponse(Integer userId, String name, String email, String role) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.role = role;
    }

    public static UserResponse fromEntity(User user) {
        return new UserResponse(user.getUserId(), user.getName(), user.getEmail(), user.getRole());
    }

    public Integer getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getRole() {
        return role;
    }
}
