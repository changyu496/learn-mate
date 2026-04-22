package com.learnmate.todo.commands;

import com.learnmate.todo.Store;
import com.learnmate.todo.Task;
import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

import java.util.concurrent.Callable;

@Command(name = "add", description = "Add a new task.")
public class AddCommand implements Callable<Integer> {

    @Parameters(index = "0", description = "Task title.")
    private String title;

    @Override
    public Integer call() {
        Store store = Store.defaultStore();
        Task t = store.add(title);
        System.out.println("Added " + t.getId() + ": " + t.getTitle());
        return 0;
    }
}
