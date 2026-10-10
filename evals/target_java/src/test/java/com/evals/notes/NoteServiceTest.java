package com.evals.notes;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Plain unit test — repository is mocked, no Spring context and no Docker.
 * Part of the FAST gate ({@code mvn -q test}).
 */
@ExtendWith(MockitoExtension.class)
class NoteServiceTest {

    @Mock
    private NoteRepository noteRepository;

    @Test
    void createSavesAndReturnsNote() {
        NoteService noteService = new NoteService(noteRepository);
        NoteRequest request = new NoteRequest("Groceries", "Milk, eggs, bread");
        when(noteRepository.save(any(Note.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Note result = noteService.create(request);

        assertThat(result.getTitle()).isEqualTo("Groceries");
        assertThat(result.getBody()).isEqualTo("Milk, eggs, bread");
        assertThat(result.getCreatedAt()).isNotNull();
        verify(noteRepository).save(any(Note.class));
    }

    @Test
    void createRejectsBlankTitle() {
        NoteService noteService = new NoteService(noteRepository);
        NoteRequest request = new NoteRequest("   ", "body");

        assertThatThrownBy(() -> noteService.create(request))
                .isInstanceOf(ResponseStatusException.class);

        verifyNoInteractions(noteRepository);
    }

    @Test
    void createRejectsMissingBody() {
        NoteService noteService = new NoteService(noteRepository);
        NoteRequest request = new NoteRequest("title", null);

        assertThatThrownBy(() -> noteService.create(request))
                .isInstanceOf(ResponseStatusException.class);

        verifyNoInteractions(noteRepository);
    }

    @Test
    void findByIdReturnsNoteWhenPresent() {
        NoteService noteService = new NoteService(noteRepository);
        Note note = new Note("Title", "Body");
        when(noteRepository.findById(eq(1L))).thenReturn(Optional.of(note));

        assertThat(noteService.findById(1L)).isSameAs(note);
    }

    @Test
    void findByIdThrowsWhenMissing() {
        NoteService noteService = new NoteService(noteRepository);
        when(noteRepository.findById(eq(99L))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> noteService.findById(99L))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void findAllDelegatesToRepository() {
        NoteService noteService = new NoteService(noteRepository);
        Note note = new Note("Title", "Body");
        when(noteRepository.findAll()).thenReturn(List.of(note));

        assertThat(noteService.findAll()).containsExactly(note);
    }
}
