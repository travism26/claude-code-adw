package com.evals.notes;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class NoteService {

    private final NoteRepository noteRepository;

    public NoteService(NoteRepository noteRepository) {
        this.noteRepository = noteRepository;
    }

    public Note create(NoteRequest request) {
        if (request == null || isBlank(request.getTitle()) || isBlank(request.getBody())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title and body are required");
        }
        return noteRepository.save(new Note(request.getTitle(), request.getBody()));
    }

    public Note findById(Long id) {
        return noteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "note " + id + " not found"));
    }

    public List<Note> findAll() {
        return noteRepository.findAll();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
