package com.chatapp.repository;

import com.chatapp.model.StoredFile;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StoredFileRepository extends MongoRepository<StoredFile, String> {
}
