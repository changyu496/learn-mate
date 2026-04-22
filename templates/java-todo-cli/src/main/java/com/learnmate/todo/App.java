package com.learnmate.todo;

import com.learnmate.todo.commands.AddCommand;
import picocli.CommandLine;
import picocli.CommandLine.Command;

@Command(
    name = "todo",
    mixinStandardHelpOptions = true,
    version = "todo-cli 0.1.0",
    description = "A minimal todo CLI. Only `add` is implemented; list/done/delete/search are missing.",
    subcommands = { AddCommand.class }
)
public class App implements Runnable {

    public static void main(String[] args) {
        int exit = new CommandLine(new App()).execute(args);
        System.exit(exit);
    }

    @Override
    public void run() {
        new CommandLine(this).usage(System.out);
    }
}
