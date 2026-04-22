package com.learnmate.todo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public class Store {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final Path path;

    public Store(Path path) {
        this.path = path;
    }

    public static Store defaultStore() {
        return new Store(Paths.get(".todo-store.json"));
    }

    public List<Task> loadAll() {
        if (!Files.exists(path)) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(path.toFile(), new TypeReference<List<Task>>() {});
        } catch (IOException e) {
            throw new RuntimeException("Failed to read store: " + path, e);
        }
    }

    public void saveAll(List<Task> tasks) {
        try {
            MAPPER.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), tasks);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write store: " + path, e);
        }
    }

    public Task add(String title) {
        List<Task> tasks = loadAll();
        String id = String.format("t-%04d", tasks.size() + 1);
        Task t = new Task(id, title, false);
        tasks.add(t);
        saveAll(tasks);
        return t;
    }
}
