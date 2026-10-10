package com.evals.notes;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web-slice test — only the MVC layer loads, {@link NoteService} is mocked,
 * no DataSource/Postgres involved. Part of the FAST gate ({@code mvn -q test}).
 */
@WebMvcTest(NoteController.class)
class NoteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NoteService noteService;

    @Test
    void postCreatesNote() throws Exception {
        Note saved = new Note("Groceries", "Milk, eggs, bread");
        when(noteService.create(any(NoteRequest.class))).thenReturn(saved);

        mockMvc.perform(post("/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new NoteRequest("Groceries", "Milk, eggs, bread"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Groceries"))
                .andExpect(jsonPath("$.body").value("Milk, eggs, bread"));
    }

    @Test
    void getByIdReturns404WhenMissing() throws Exception {
        when(noteService.findById(eq(42L)))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "note 42 not found"));

        mockMvc.perform(get("/notes/{id}", 42))
                .andExpect(status().isNotFound());
    }

    @Test
    void getAllReturnsList() throws Exception {
        when(noteService.findAll()).thenReturn(List.of(new Note("Title", "Body")));

        mockMvc.perform(get("/notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Title"));
    }
}
