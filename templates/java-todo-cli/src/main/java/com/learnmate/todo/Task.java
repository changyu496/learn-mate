package com.learnmate.todo;

public class Task {
    private String id;
    private String title;
    private boolean done;

    public Task() {}

    public Task(String id, String title, boolean done) {
        this.id = id;
        this.title = title;
        this.done = done;
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public boolean isDone() { return done; }

    public void setId(String id) { this.id = id; }
    public void setTitle(String title) { this.title = title; }
    public void setDone(boolean done) { this.done = done; }
}
