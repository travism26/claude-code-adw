package com.evals.notes;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SLOW gate — boots a real Postgres via Testcontainers and exercises the
 * full stack (controller -> service -> JPA -> Postgres) over HTTP. Class
 * name ends in "IT" so maven-surefire (fast gate, {@code mvn test}) skips it
 * and maven-failsafe (slow gate, {@code mvn verify}) picks it up. Requires a
 * running Docker daemon.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class NotesIntegrationIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void createAndFetchNoteRoundTripsThroughRealPostgres() {
        NoteRequest request = new NoteRequest("Integration", "Round trip through Testcontainers Postgres");

        ResponseEntity<Note> createResponse = restTemplate.postForEntity("/notes", request, Note.class);
        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Note created = createResponse.getBody();
        assertThat(created).isNotNull();
        assertThat(created.getId()).isNotNull();

        ResponseEntity<Note> getResponse = restTemplate.getForEntity("/notes/{id}", Note.class, created.getId());
        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(getResponse.getBody()).isNotNull();
        assertThat(getResponse.getBody().getTitle()).isEqualTo("Integration");

        ResponseEntity<Note[]> listResponse = restTemplate.getForEntity("/notes", Note[].class);
        assertThat(listResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listResponse.getBody()).isNotEmpty();
    }
}
