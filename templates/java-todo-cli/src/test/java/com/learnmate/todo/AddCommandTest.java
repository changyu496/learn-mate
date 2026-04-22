package com.learnmate.todo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class AddCommandTest {

    @TempDir
    Path tmp;

    @Test
    void addPersistsTask() {
        Store store = new Store(tmp.resolve("store.json"));

        Task created = store.add("buy milk");

        assertEquals("buy milk", created.getTitle());
        assertFalse(created.isDone());

        List<Task> all = store.loadAll();
        assertEquals(1, all.size());
        assertEquals("buy milk", all.get(0).getTitle());
    }

    @Test
    void idsIncrement() {
        Store store = new Store(tmp.resolve("store.json"));

        Task a = store.add("first");
        Task b = store.add("second");

        assertNotEquals(a.getId(), b.getId());
    }
}
