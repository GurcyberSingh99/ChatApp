package com.chatapp.service;

import com.chatapp.model.StoredFile;
import com.chatapp.repository.StoredFileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Optional;

@Service
public class FileService {

    @Autowired
    private StoredFileRepository storedFileRepository;

    public StoredFile storeFile(MultipartFile file) throws IOException {
        String fileName = file.getOriginalFilename();
        String contentType = file.getContentType();
        byte[] data = file.getBytes();

        StoredFile storedFile = new StoredFile(fileName, contentType, data);
        return storedFileRepository.save(storedFile);
    }

    public Optional<StoredFile> getFile(String id) {
        return storedFileRepository.findById(id);
    }
}
