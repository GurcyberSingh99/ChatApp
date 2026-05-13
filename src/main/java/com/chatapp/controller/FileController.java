package com.chatapp.controller;

import com.chatapp.model.StoredFile;
import com.chatapp.service.FileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Autowired
    private FileService fileService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            StoredFile storedFile = fileService.storeFile(file);

            String fileDownloadUri = "/api/files/download/" + storedFile.getId();

            Map<String, Object> response = new HashMap<>();
            response.put("fileId", storedFile.getId());
            response.put("fileName", storedFile.getFileName());
            response.put("fileType", storedFile.getFileType());
            response.put("fileUrl", fileDownloadUri);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Could not upload file: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<byte[]> downloadFile(@PathVariable String id) {
        Optional<StoredFile> fileOptional = fileService.getFile(id);

        if (fileOptional.isPresent()) {
            StoredFile storedFile = fileOptional.get();
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(storedFile.getFileType()))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + storedFile.getFileName() + "\"")
                    .body(storedFile.getData());
        }

        return ResponseEntity.notFound().build();
    }
}
