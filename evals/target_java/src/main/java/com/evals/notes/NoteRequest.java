package com.evals.notes;

/**
 * Inbound payload for creating a {@link Note}. Kept separate from the entity
 * so the API shape and the persistence shape can evolve independently.
 */
public class NoteRequest {

    private String title;
    private String body;

    public NoteRequest() {
    }

    public NoteRequest(String title, String body) {
        this.title = title;
        this.body = body;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }
}
